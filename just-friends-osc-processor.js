/**
 * just-friends-osc-processor.js
 * 
 * AudioWorkletProcessor implementing a Just Friends-inspired multi-output oscillator.
 * Primary focus: cycle/sound mode (waveshaped VCOs with harmonic/subharmonic relationships)
 * 
 * Based on the Mannequins Just Friends technical map.
 * 
 * Channel Layout:
 *   Input 0:
 *     - ch0: TIME CV (1V/oct style, "v/8")
 *     - ch1: FM input (audio-rate frequency modulation)
 *     - ch2: INTONE CV (optional audio-rate modulation)
 *   
 *   Output 0 (7 channels):
 *     - ch0: IDENTITY (1N)
 *     - ch1: 2N
 *     - ch2: 3N
 *     - ch3: 4N
 *     - ch4: 5N
 *     - ch5: 6N
 *     - ch6: MIX (equal mix, tanh-limited)
 * 
 * NOTES FOR FUTURE MODES:
 * - transient mode: AR envelopes, trigger-based excitation
 * - sustain mode: ASR envelopes, gate-sensitive
 * - shape range: slower LFO rates (minutes to ms)
 * - RUN modes: SHIFT, STRATA, VOLLEY, SPILL, PLUME, FLOOM
 */

class JustFriendsProcessor extends AudioWorkletProcessor {
  
  static get parameterDescriptors() {
    return [
      {
        name: 'time',
        defaultValue: 0.5,
        minValue: 0,
        maxValue: 1,
        automationRate: 'a-rate'
      },
      {
        name: 'intone',
        defaultValue: 0.5,
        minValue: 0,
        maxValue: 1,
        automationRate: 'a-rate'
      },
      {
        name: 'ramp',
        defaultValue: 0.5,
        minValue: 0,
        maxValue: 1,
        automationRate: 'a-rate'
      },
      {
        name: 'curve',
        defaultValue: 0.5,
        minValue: 0,
        maxValue: 1,
        automationRate: 'a-rate'
      },
      {
        name: 'range',
        defaultValue: 1, // 0=SHAPE, 1=SOUND, 2=TRANSIENT (stub)
        minValue: 0,
        maxValue: 2,
        automationRate: 'k-rate'
      },
      {
        name: 'mode',
        defaultValue: 2, // 0=TRANSIENT, 1=SUSTAIN, 2=CYCLE
        minValue: 0,
        maxValue: 2,
        automationRate: 'k-rate'
      },
      {
        name: 'run',
        defaultValue: 1, // For RUN modes (later), default to 1 in cycle
        minValue: 0,
        maxValue: 1,
        automationRate: 'a-rate'
      },
      {
        name: 'fmIndex',
        defaultValue: 0,
        minValue: 0,
        maxValue: 1,
        automationRate: 'a-rate'
      }
    ];
  }

  constructor(options) {
    super();
    
    // Phase accumulators for 6 oscillators (0 to 1 range)
    this.phases = new Float32Array(6);
    
    // Initialize phases to 0
    for (let i = 0; i < 6; i++) {
      this.phases[i] = 0;
    }
    
    // Constants
    this.NUM_OSCILLATORS = 6;
    
    // Frequency range constants for SOUND mode
    // Based on technical map: Hz to kHz range (~5-7 octaves)
    // Using similar approach to Mangrove: base freq around middle C area
    this.SOUND_BASE_FREQ = 261.63; // C4 as center frequency when time=0.5
    this.SOUND_OCTAVE_RANGE = 7; // Total octave range
    
    // SHAPE mode range (much slower - LFO territory)
    this.SHAPE_BASE_FREQ = 0.1; // Very slow base
    this.SHAPE_OCTAVE_RANGE = 12; // Wide range for LFO speeds
    
    // FM scaling (conservative for musical results)
    this.FM_SCALE = 0.5;
    
    // TIME CV range (based on technical map: -2V to +5V useful range)
    this.TIME_CV_MIN = -2;
    this.TIME_CV_MAX = 5;
  }

  /**
   * Convert time knob position (0-1) to a voltage-like value
   * Maps 0-1 to roughly -2V to +5V equivalent for frequency calculation
   */
  timeToVolt(timeNorm) {
    // Map 0-1 to the voltage range
    return this.TIME_CV_MIN + timeNorm * (this.TIME_CV_MAX - this.TIME_CV_MIN);
  }

  /**
   * Convert voltage to frequency (exponential, 1V/octave)
   * Similar to Mangrove's voltToFreq approach
   */
  voltToFreq(volt, baseFreq) {
    return baseFreq * Math.pow(2, volt);
  }

  /**
   * Calculate INTONE multiplier for a given oscillator index
   * 
   * From the technical map:
   * - At noon (0.5): all multipliers = 1 (unison)
   * - Fully CW (1.0): 2N=2x, 3N=3x, 4N=4x, 5N=5x, 6N=6x (overtones)
   * - Fully CCW (0.0): 2N=1/2, 3N=1/3, 4N=1/4, 5N=1/5, 6N=1/6 (undertones)
   * 
   * The knob has special shaping for finer control around noon.
   * 
   * @param {number} intone - Normalized INTONE value (0-1)
   * @param {number} n - Oscillator index (1-6, where 1=IDENTITY)
   * @returns {number} Frequency multiplier
   */
  getIntoneMultiplier(intone, n) {
    if (n === 1) return 1; // IDENTITY is always 1x
    
    // Apply shaping for finer control around noon
    // Use a slight S-curve to make the center region more sensitive
    const shaped = this.shapeIntone(intone);
    
    if (shaped >= 0.5) {
      // CW from noon: interpolate from 1x to Nx
      const t = (shaped - 0.5) * 2; // 0 to 1
      return 1 + t * (n - 1);
    } else {
      // CCW from noon: interpolate from 1x to 1/Nx
      const t = (0.5 - shaped) * 2; // 0 to 1
      return 1 / (1 + t * (n - 1));
    }
  }

  /**
   * Shape the INTONE control for finer resolution around noon
   * Uses a subtle S-curve
   */
  shapeIntone(intone) {
    // Subtle S-curve: more resolution near center
    const centered = intone - 0.5;
    const shaped = centered * (1 - 0.3 * Math.abs(centered));
    return 0.5 + shaped;
  }

  /**
   * Generate a linear slope value based on phase and RAMP setting
   * 
   * RAMP controls rise/fall ratio:
   * - 0 (CCW): instant rise, long fall (saw down)
   * - 0.5 (noon): equal rise/fall (triangle)
   * - 1 (CW): long rise, instant fall (ramp up)
   * 
   * @param {number} phase - Current phase (0-1)
   * @param {number} ramp - RAMP parameter (0-1)
   * @returns {number} Linear slope value (-1 to 1)
   */
  generateLinearSlope(phase, ramp) {
    // Calculate rise proportion (0 to 1)
    // At ramp=0: rise is near-instant (small proportion)
    // At ramp=0.5: rise = fall (0.5 each)
    // At ramp=1: rise takes almost entire cycle
    
    const minRise = 0.001; // Prevent divide by zero
    const maxRise = 0.999;
    const riseProportion = minRise + ramp * (maxRise - minRise);
    
    let value;
    
    if (phase < riseProportion) {
      // Rising phase: -1 to +1
      value = -1 + 2 * (phase / riseProportion);
    } else {
      // Falling phase: +1 to -1
      const fallPhase = (phase - riseProportion) / (1 - riseProportion);
      value = 1 - 2 * fallPhase;
    }
    
    return value;
  }

  /**
   * Apply CURVE waveshaping to a linear slope
   * 
   * From the technical map:
   * - CCW (0): rectangular/square shapes
   * - 9 o'clock (~0.25): logarithmic curves
   * - Noon (0.5): linear (no shaping)
   * - 3 o'clock (~0.75): exponential curves
   * - CW (1): sinusoidal
   * 
   * @param {number} linearValue - Input value (-1 to 1)
   * @param {number} curve - CURVE parameter (0-1)
   * @returns {number} Shaped value (-1 to 1)
   */
  applyCurve(linearValue, curve) {
    if (curve < 0.01) {
      // Fully CCW: hard square/rectangular
      return linearValue >= 0 ? 1 : -1;
    }
    
    if (Math.abs(curve - 0.5) < 0.01) {
      // Noon: pure linear
      return linearValue;
    }
    
    if (curve > 0.99) {
      // Fully CW: sinusoidal
      // Map linear -1 to 1 -> sine wave
      return Math.sin(linearValue * Math.PI * 0.5);
    }
    
    // Interpolate between shapes
    if (curve < 0.5) {
      // CCW side: logarithmic to linear
      // At 0: square, at 0.25: log, at 0.5: linear
      const t = curve * 2; // 0 to 1 as curve goes 0 to 0.5
      
      if (t < 0.5) {
        // Square to log blend
        const squareVal = linearValue >= 0 ? 1 : -1;
        const logT = t * 2; // 0 to 1
        const logVal = this.logShape(linearValue);
        return squareVal * (1 - logT) + logVal * logT;
      } else {
        // Log to linear blend
        const logVal = this.logShape(linearValue);
        const linT = (t - 0.5) * 2; // 0 to 1
        return logVal * (1 - linT) + linearValue * linT;
      }
    } else {
      // CW side: linear to exponential to sine
      const t = (curve - 0.5) * 2; // 0 to 1 as curve goes 0.5 to 1
      
      if (t < 0.5) {
        // Linear to expo blend
        const expoVal = this.expoShape(linearValue);
        const expoT = t * 2; // 0 to 1
        return linearValue * (1 - expoT) + expoVal * expoT;
      } else {
        // Expo to sine blend
        const expoVal = this.expoShape(linearValue);
        const sineVal = Math.sin(linearValue * Math.PI * 0.5);
        const sineT = (t - 0.5) * 2; // 0 to 1
        return expoVal * (1 - sineT) + sineVal * sineT;
      }
    }
  }

  /**
   * Logarithmic waveshaping
   * Quick change at start of phase, slows down toward end
   */
  logShape(x) {
    // Attempt to create log-like curve that maintains -1 to 1 range
    const sign = x >= 0 ? 1 : -1;
    const absX = Math.abs(x);
    // Use a curve that starts fast and slows: sqrt-like behavior
    return sign * Math.sqrt(absX);
  }

  /**
   * Exponential waveshaping
   * Slow change at start, accelerates toward end
   */
  expoShape(x) {
    // Exponential-like curve
    const sign = x >= 0 ? 1 : -1;
    const absX = Math.abs(x);
    // Square for exponential-like behavior
    return sign * absX * absX;
  }

  /**
   * Soft limiter using tanh
   */
  softLimit(x, gain = 1) {
    return Math.tanh(x * gain);
  }

  /**
   * Main DSP process function
   */
  process(inputs, outputs, parameters) {
    const output = outputs[0];
    const input = inputs[0];
    
    // Get input channels (may be empty if nothing connected)
    const timeCVChannel = input && input[0] ? input[0] : null;
    const fmChannel = input && input[1] ? input[1] : null;
    const intoneCVChannel = input && input[2] ? input[2] : null;
    
    // Get output channels
    const outputChannels = output;
    const blockSize = outputChannels[0] ? outputChannels[0].length : 128;
    
    // Get parameter values (handle both a-rate and k-rate)
    const getParam = (name, i) => {
      const param = parameters[name];
      return param.length > 1 ? param[i] : param[0];
    };
    
    // Range and mode are k-rate
    const range = Math.round(parameters.range[0]);
    const mode = Math.round(parameters.mode[0]);
    
    // Determine base frequency based on range
    const baseFreq = range === 1 ? this.SOUND_BASE_FREQ : this.SHAPE_BASE_FREQ;
    
    // Process each sample
    for (let i = 0; i < blockSize; i++) {
      // Get parameter values for this sample
      const time = getParam('time', i);
      let intone = getParam('intone', i);
      const ramp = getParam('ramp', i);
      const curve = getParam('curve', i);
      const fmIndex = getParam('fmIndex', i);
      const run = getParam('run', i);
      
      // Get CV inputs
      const timeCV = timeCVChannel ? timeCVChannel[i] : 0;
      const fmSignal = fmChannel ? fmChannel[i] : 0;
      const intoneCV = intoneCVChannel ? intoneCVChannel[i] : 0;
      
      // Add INTONE CV (scaled: -5V to +5V sweeps full range when knob at noon)
      // CV is assumed to be in a normalized range, scale appropriately
      intone = Math.max(0, Math.min(1, intone + intoneCV * 0.1));
      
      // Calculate base frequency from TIME knob + CV
      // TIME knob maps to voltage, then add external CV
      const timeVolt = this.timeToVolt(time);
      const totalVolt = timeVolt + timeCV;
      
      // Clamp voltage to useful range
      const clampedVolt = Math.max(this.TIME_CV_MIN, Math.min(this.TIME_CV_MAX, totalVolt));
      
      // Convert to base frequency (IDENTITY frequency)
      const identityFreq = this.voltToFreq(clampedVolt, baseFreq);
      
      // Mix accumulator for MIX output
      let mixSum = 0;
      
      // Process each of the 6 oscillators
      for (let osc = 0; osc < this.NUM_OSCILLATORS; osc++) {
        const n = osc + 1; // 1-indexed (IDENTITY=1, 2N=2, etc.)
        
        // Get frequency multiplier from INTONE
        const intoneMultiplier = this.getIntoneMultiplier(intone, n);
        
        // Calculate this oscillator's frequency
        let freq = identityFreq * intoneMultiplier;
        
        // Apply FM (linear FM on frequency)
        // FM is applied proportionally to base frequency for musical results
        if (fmIndex > 0 && fmSignal !== 0) {
          const fmAmount = fmSignal * fmIndex * this.FM_SCALE * freq;
          freq += fmAmount;
        }
        
        // Ensure frequency stays positive and reasonable
        freq = Math.max(0.001, freq);
        
        // Calculate phase increment
        const phaseInc = freq / sampleRate;
        
        // Process based on mode
        let outputValue = 0;
        
        if (mode === 2) {
          // CYCLE mode: free-running oscillators
          
          // Generate linear slope based on phase and RAMP
          const linearSlope = this.generateLinearSlope(this.phases[osc], ramp);
          
          // Apply CURVE waveshaping
          outputValue = this.applyCurve(linearSlope, curve);
          
          // Advance phase
          this.phases[osc] += phaseInc;
          
          // Wrap phase
          while (this.phases[osc] >= 1) {
            this.phases[osc] -= 1;
          }
          while (this.phases[osc] < 0) {
            this.phases[osc] += 1;
          }
          
        } else if (mode === 1) {
          // SUSTAIN mode: stub - behave like cycle for now
          // TODO: Implement gated ASR behavior
          const linearSlope = this.generateLinearSlope(this.phases[osc], ramp);
          outputValue = this.applyCurve(linearSlope, curve);
          this.phases[osc] += phaseInc;
          while (this.phases[osc] >= 1) this.phases[osc] -= 1;
          
        } else {
          // TRANSIENT mode: stub - behave like cycle for now
          // TODO: Implement triggered AR behavior
          const linearSlope = this.generateLinearSlope(this.phases[osc], ramp);
          outputValue = this.applyCurve(linearSlope, curve);
          this.phases[osc] += phaseInc;
          while (this.phases[osc] >= 1) this.phases[osc] -= 1;
        }
        
        // Scale output based on range
        // SOUND range: bipolar -1 to +1 (representing -5V to +5V)
        // SHAPE range: unipolar 0 to 1 (representing 0-8V) - but we output bipolar for consistency
        // For now, always output bipolar (-1 to 1)
        
        // Write to output channel
        if (outputChannels[osc]) {
          outputChannels[osc][i] = outputValue;
        }
        
        // Accumulate for mix
        mixSum += outputValue;
      }
      
      // Generate MIX output
      // In SOUND range: equal mix of all 6, tanh limited
      // In SHAPE range: scaled max ("analog OR") - but for simplicity, use sum for now
      if (outputChannels[6]) {
        if (range === 1) {
          // SOUND range: equal mix with soft limiting
          // Divide by ~3 to get reasonable pre-limit level, then tanh
          const mixValue = this.softLimit(mixSum / 3, 1);
          outputChannels[6][i] = mixValue;
        } else {
          // SHAPE range: implement scaled max (analog OR)
          // Each slope divided by its index, output max
          // For now, simplified: just use soft-limited sum
          // TODO: Implement proper scaled max for shape range
          const mixValue = this.softLimit(mixSum / 3, 1);
          outputChannels[6][i] = mixValue;
        }
      }
    }
    
    // Keep processor alive
    return true;
  }
}

registerProcessor('just-friends-processor', JustFriendsProcessor);
