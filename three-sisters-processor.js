// three-sisters-processor.js
// Three Sisters Multi-Mode Filter - TRUE TO HARDWARE
// Based on Mannequins Three Sisters Technical Map
// Uses proper state-variable filter topology with self-oscillation capability

class ThreeSistersProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'freq', defaultValue: 0.5, minValue: 0, maxValue: 1 },
      { name: 'span', defaultValue: 0.5, minValue: 0, maxValue: 1 },
      { name: 'quality', defaultValue: 0.5, minValue: 0, maxValue: 1 },
      { name: 'mode', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'fmAttenuverter', defaultValue: 0.5, minValue: 0, maxValue: 1 }
    ];
  }

  constructor() {
    super();

    this.sampleRate = sampleRate;

    // Initialize 6 SVF filters (2 per block) - using trapezoidal integration for stability
    this.lowSVF1 = this.createSVF();
    this.lowSVF2 = this.createSVF();
    this.centreSVF1 = this.createSVF();
    this.centreSVF2 = this.createSVF();
    this.highSVF1 = this.createSVF();
    this.highSVF2 = this.createSVF();

    // Self-oscillation noise injection for startup
    this.noiseState = Math.random() * 2 - 1;

    // Debug
    this.debugCounter = 0;

    console.log('Three Sisters processor initialized - TRUE TO HARDWARE with self-oscillation');
  }

  createSVF() {
    return {
      ic1eq: 0.0,  // Integrator 1 state
      ic2eq: 0.0   // Integrator 2 state
    };
  }

  resetSVF(svf) {
    svf.ic1eq = 0.0;
    svf.ic2eq = 0.0;
  }

  // Volt-per-octave frequency calculation
  // Knob at noon = ~500Hz, full range ~30Hz to ~8kHz
  freqKnobToHz(knob) {
    // 8 octave range centered at 500Hz
    const octaves = (knob - 0.5) * 8;
    return 500.0 * Math.pow(2, octaves);
  }

  // SPAN uses exponential (octave) scaling like the hardware
  // Per tech map: SPAN voltage added/subtracted from FREQ in V/oct domain
  spanKnobToOctaves(knob) {
    // At noon (0.5): 0 octaves spread
    // At max (1.0): +3 octaves spread
    // At min (0.0): -3 octaves spread (inverts LOW/HIGH)
    return (knob - 0.5) * 6.0;
  }

  // Fast tanh approximation for analog warmth
  fastTanh(x) {
    if (x < -3) return -1;
    if (x > 3) return 1;
    const x2 = x * x;
    return x * (27 + x2) / (27 + 9 * x2);
  }

  // SVF using trapezoidal integration (Zavalishin/VA topology)
  // This is stable at high resonance and can self-oscillate cleanly
  processSVF(svf, input, cutoffHz, resonance) {
    // Prewarp cutoff frequency
    const g = Math.tan(Math.PI * Math.min(cutoffHz, this.sampleRate * 0.49) / this.sampleRate);

    // Resonance: 0 = no resonance, 1 = self-oscillation threshold, >1 = self-oscillating
    // k = 2 - 2*R where R is the resonance factor (0-1 range maps to k = 2 down to 0)
    const k = Math.max(0, 2.0 - 2.0 * resonance);

    // Inject tiny noise to kick-start self-oscillation
    this.noiseState = this.noiseState * 0.99 + (Math.random() - 0.5) * 0.0001;
    const noisyInput = input + this.noiseState * resonance;

    // Trapezoidal SVF
    const d = 1.0 / (1.0 + g * (g + k));

    const hp = (noisyInput - (g + k) * svf.ic1eq - svf.ic2eq) * d;
    const v1 = g * hp;
    const bp = v1 + svf.ic1eq;
    svf.ic1eq = v1 + bp;

    const v2 = g * bp;
    const lp = v2 + svf.ic2eq;
    svf.ic2eq = v2 + lp;

    // Apply soft saturation for analog warmth (subtle, preserves dynamics)
    const satAmount = 0.3 + resonance * 0.5;
    const saturatedBp = this.fastTanh(bp * satAmount) / satAmount;
    const saturatedLp = this.fastTanh(lp * satAmount) / satAmount;
    const saturatedHp = this.fastTanh(hp * satAmount) / satAmount;

    // Safety: reset on NaN/Inf
    if (!isFinite(svf.ic1eq) || !isFinite(svf.ic2eq)) {
      this.resetSVF(svf);
      return { lp: 0, bp: 0, hp: 0 };
    }

    return {
      lp: saturatedLp,
      bp: saturatedBp,
      hp: saturatedHp
    };
  }

  // LOW block: Two SVFs in series, both at same cutoff
  // Crossover mode: LP → LP = 24dB/oct lowpass
  // Formant mode: LP → HP = 12dB/oct bandpass
  processLowBlock(input, cfLow, resonance, mode, antiQ) {
    const out1 = this.processSVF(this.lowSVF1, input, cfLow, resonance);
    const out2 = this.processSVF(this.lowSVF2, out1.lp, cfLow, resonance);

    let mainOutput, complementary;

    if (mode < 0.5) {
      // Crossover: 24dB lowpass
      mainOutput = out2.lp;
      complementary = out1.hp;  // Mix in highs for notch effect
    } else {
      // Formant: 12dB bandpass (LP→HP)
      mainOutput = out2.hp;
      complementary = out1.lp;
    }

    // Anti-resonance: mix complementary back in (creates notch/dry-wet)
    return mainOutput + complementary * antiQ;
  }

  // HIGH block: Two SVFs in series, both at same cutoff
  // Crossover mode: HP → HP = 24dB/oct highpass
  // Formant mode: HP → LP = 12dB/oct bandpass
  processHighBlock(input, cfHigh, resonance, mode, antiQ) {
    const out1 = this.processSVF(this.highSVF1, input, cfHigh, resonance);
    const out2 = this.processSVF(this.highSVF2, out1.hp, cfHigh, resonance);

    let mainOutput, complementary;

    if (mode < 0.5) {
      // Crossover: 24dB highpass
      mainOutput = out2.hp;
      complementary = out1.lp;  // Mix in lows for notch effect
    } else {
      // Formant: 12dB bandpass (HP→LP)
      mainOutput = out2.lp;
      complementary = out1.hp;
    }

    return mainOutput + complementary * antiQ;
  }

  // CENTRE block: HP at cfLow → LP at cfHigh (crossover) or both at cfCentre (formant)
  // Crossover mode: passes frequencies BETWEEN LOW and HIGH cutoffs
  // Formant mode: 12dB bandpass at FREQ
  processCentreBlock(input, cfLow, cfHigh, cfCentre, resonance, mode, antiQ) {
    let out1, out2;

    if (mode < 0.5) {
      // Crossover: HP at cfLow, then LP at cfHigh
      // This creates a "crossover" bandpass between the two cutoffs
      out1 = this.processSVF(this.centreSVF1, input, cfLow, resonance);
      out2 = this.processSVF(this.centreSVF2, out1.hp, cfHigh, resonance);

      const mainOutput = out2.lp;
      const comp1 = out1.lp;   // Frequencies below cfLow
      const comp2 = out2.hp;   // Frequencies above cfHigh

      return mainOutput + (comp1 + comp2) * antiQ * 0.5;
    } else {
      // Formant: both at cfCentre = 12dB bandpass
      out1 = this.processSVF(this.centreSVF1, input, cfCentre, resonance);
      out2 = this.processSVF(this.centreSVF2, out1.hp, cfCentre, resonance);

      const mainOutput = out2.lp;
      const comp1 = out1.lp;
      const comp2 = out2.hp;

      return mainOutput + (comp1 + comp2) * antiQ * 0.5;
    }
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];

    if (this.debugCounter === 0) {
      console.log(`Three Sisters: ${inputs.length} input buses`);
    }
    this.debugCounter++;

    const audioIn = inputs[0]?.[0] || new Float32Array(128);
    const fmIn = inputs[0]?.[1] || new Float32Array(128);

    const lowOut = output[0];
    const centreOut = output[1];
    const highOut = output[2];
    const allOut = output[3];

    if (!lowOut || !centreOut || !highOut || !allOut) return true;

    for (let i = 0; i < audioIn.length; i++) {
      const freqKnob = parameters.freq[i] ?? parameters.freq[0];
      const spanKnob = parameters.span[i] ?? parameters.span[0];
      const quality = parameters.quality[i] ?? parameters.quality[0];
      const mode = parameters.mode[i] ?? parameters.mode[0];
      const fmAtten = parameters.fmAttenuverter[i] ?? parameters.fmAttenuverter[0];

      const audioSample = audioIn[i];
      const fmSample = fmIn[i];

      // === FREQ CALCULATION (V/oct) ===
      let baseFreqHz = this.freqKnobToHz(freqKnob);

      // FM input with attenuverter: ±5V = ±5 octaves at full
      const fmAmount = (fmAtten - 0.5) * 2.0;
      const fmVoltage = fmSample * fmAmount * 5.0;  // ±5 octaves max
      const fmMultiplier = Math.pow(2, fmVoltage);
      let modulatedFreq = baseFreqHz * fmMultiplier;

      // Frequency limits
      const nyquist = this.sampleRate * 0.49;
      modulatedFreq = Math.max(20, Math.min(nyquist, modulatedFreq));

      // === SPAN CALCULATION (exponential, per tech doc) ===
      // SPAN adds/subtracts octaves from FREQ for LOW/HIGH
      const spanOctaves = this.spanKnobToOctaves(spanKnob);

      const cfCentre = modulatedFreq;
      // LOW = FREQ - SPAN (in octave domain)
      const cfLow = Math.max(20, Math.min(nyquist, modulatedFreq * Math.pow(2, -Math.abs(spanOctaves))));
      // HIGH = FREQ + SPAN (in octave domain)
      const cfHigh = Math.max(20, Math.min(nyquist, modulatedFreq * Math.pow(2, Math.abs(spanOctaves))));

      // === QUALITY CALCULATION ===
      // Per tech doc: Noon = minimum resonance
      // CW from noon = increasing resonance → self-oscillation at ~3 o'clock
      // CCW from noon = anti-resonance (notch/dry-wet mixing)

      let resonance = 0.0;
      let antiQ = 0.0;

      if (quality >= 0.5) {
        // CW from noon: resonance
        const resAmount = (quality - 0.5) * 2.0;  // 0 to 1
        // Map to resonance: 0 = no resonance, 0.75 = edge of oscillation, 1.0+ = oscillating
        // Use exponential curve for better control in the "sweet spot"
        resonance = Math.pow(resAmount, 1.5) * 1.2;  // Can exceed 1.0 for guaranteed oscillation
      } else {
        // CCW from noon: anti-resonance (dry/wet / notch)
        resonance = 0.0;
        antiQ = (0.5 - quality) * 2.0;  // 0 to 1
      }

      // === PROCESS FILTER BLOCKS ===
      // Input gain: Mangrove outputs ~±1, scale up for filter drive
      const inputGain = 2.0;
      const scaledInput = audioSample * inputGain;

      const lowSample = this.processLowBlock(scaledInput, cfLow, resonance, mode, antiQ);
      const centreSample = this.processCentreBlock(scaledInput, cfLow, cfHigh, cfCentre, resonance, mode, antiQ);
      const highSample = this.processHighBlock(scaledInput, cfHigh, resonance, mode, antiQ);

      // === OUTPUT ===
      // Output gain to match Eurorack levels (~10Vpp)
      // Soft clip at output stage for safety
      const outputGain = 3.0;

      lowOut[i] = this.fastTanh(lowSample * outputGain * 0.3) * 3.0;
      centreOut[i] = this.fastTanh(centreSample * outputGain * 0.3) * 3.0;
      highOut[i] = this.fastTanh(highSample * outputGain * 0.3) * 3.0;

      // ALL output: equal mix of all three
      allOut[i] = (lowOut[i] + centreOut[i] + highOut[i]) / 2.0;  // Divided by 2, not 3, for hotter output
    }

    return true;
  }
}

registerProcessor('three-sisters-processor', ThreeSistersProcessor);
