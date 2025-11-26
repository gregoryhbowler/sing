// three-sisters-processor.js
// Three Sisters Multi-Mode Filter - AudioWorklet Processor
// Based on Mannequins Three Sisters technical specifications
//
// Architecture: 3 filter blocks (LOW, CENTRE, HIGH)
// Each block contains 2 cascaded state-variable filters (SVFs)
// Supports CROSSOVER and FORMANT modes with audio-rate FM

class ThreeSistersProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      // Main filter controls (matching technical map)
      { name: 'freq', defaultValue: 0.5, minValue: 0, maxValue: 1 },      // Main cutoff knob
      { name: 'span', defaultValue: 0.5, minValue: 0, maxValue: 1 },      // Spread knob
      { name: 'quality', defaultValue: 0.5, minValue: 0, maxValue: 1 },   // Resonance control
      { name: 'mode', defaultValue: 0, minValue: 0, maxValue: 1 },        // 0=crossover, 1=formant
      
      // FM controls (attenuverter style: 0.5 = noon/off, <0.5 = negative, >0.5 = positive)
      { name: 'fmAttenuverter', defaultValue: 0.5, minValue: 0, maxValue: 1 }
    ];
  }

  constructor() {
    super();
    
    this.sampleRate = sampleRate;
    
    // Initialize 6 SVF filters (2 per block)
    // LOW block
    this.lowSVF1 = this.createSVF();
    this.lowSVF2 = this.createSVF();
    
    // CENTRE block
    this.centreSVF1 = this.createSVF();
    this.centreSVF2 = this.createSVF();
    
    // HIGH block
    this.highSVF1 = this.createSVF();
    this.highSVF2 = this.createSVF();
    
    console.log('Three Sisters processor initialized');
  }

  // Create a state-variable filter with LP, BP, HP outputs
  createSVF() {
    return {
      lp: 0.0,  // Lowpass output (also state variable)
      bp: 0.0,  // Bandpass output (also state variable)
      hp: 0.0   // Highpass output (computed each sample)
    };
  }

  // Reset SVF state (for clearing artifacts)
  resetSVF(svf) {
    svf.lp = 0.0;
    svf.bp = 0.0;
    svf.hp = 0.0;
  }

  // Map FREQ knob (0-1) to cutoff frequency in Hz
  // Exponential mapping with 1V/oct scaling
  freqKnobToHz(knob) {
    // Map 0-1 to roughly 20Hz - 10kHz
    // Center frequency around 500Hz (knob = 0.5)
    const octaves = (knob - 0.5) * 8; // ±4 octaves from center
    return 500.0 * Math.pow(2, octaves);
  }

  // Calculate frequency coefficient for SVF
  // cutoffHz: cutoff frequency in Hz
  calculateFreqCoeff(cutoffHz) {
    // Standard SVF frequency coefficient
    // f = 2 * sin(π * fc / fs)
    const omega = Math.PI * cutoffHz / this.sampleRate;
    let f = 2.0 * Math.sin(omega);
    
    // Clamp for stability (must be < 2.0)
    f = Math.min(1.99, Math.max(0.0001, f));
    
    return f;
  }

  // Process one sample through an SVF (Chamberlin algorithm)
  // Returns the SVF object with updated lp, bp, hp outputs
  processSVF(svf, input, freqCoeff, q) {
    // Standard Chamberlin state-variable filter
    // Process in this order to avoid feedback issues
    
    // 1. Calculate highpass
    svf.hp = input - svf.lp - q * svf.bp;
    
    // 2. Update bandpass state
    svf.bp = svf.bp + freqCoeff * svf.hp;
    
    // 3. Update lowpass state  
    svf.lp = svf.lp + freqCoeff * svf.bp;
    
    return svf;
  }

  // Process LOW filter block
  processLowBlock(input, cfLow, q, mode, antiResonanceAmount) {
    const freqCoeff = this.calculateFreqCoeff(cfLow);
    
    // First SVF: lowpass
    this.processSVF(this.lowSVF1, input, freqCoeff, q);
    
    // Second SVF: feed from first
    const svf1Out = this.lowSVF1.lp;
    this.processSVF(this.lowSVF2, svf1Out, freqCoeff, q);
    
    let mainOutput;
    let complementaryOutput;
    
    if (mode < 0.5) {
      // CROSSOVER mode: LP → LP (4-pole lowpass, 24dB/oct)
      mainOutput = this.lowSVF2.lp;
      complementaryOutput = this.lowSVF1.hp; // Highpass for anti-resonance
    } else {
      // FORMANT mode: LP → HP (bandpass, 12dB/oct)
      mainOutput = this.lowSVF2.hp;
      complementaryOutput = this.lowSVF1.lp; // Lowpass for anti-resonance
    }
    
    // Mix in complementary output for anti-resonance (CCW quality)
    const output = mainOutput + complementaryOutput * antiResonanceAmount;
    
    return output;
  }

  // Process HIGH filter block
  processHighBlock(input, cfHigh, q, mode, antiResonanceAmount) {
    const freqCoeff = this.calculateFreqCoeff(cfHigh);
    
    // First SVF: highpass
    this.processSVF(this.highSVF1, input, freqCoeff, q);
    
    // Second SVF: feed from first
    const svf1Out = this.highSVF1.hp;
    this.processSVF(this.highSVF2, svf1Out, freqCoeff, q);
    
    let mainOutput;
    let complementaryOutput;
    
    if (mode < 0.5) {
      // CROSSOVER mode: HP → HP (4-pole highpass, 24dB/oct)
      mainOutput = this.highSVF2.hp;
      complementaryOutput = this.highSVF1.lp; // Lowpass for anti-resonance
    } else {
      // FORMANT mode: HP → LP (bandpass, 12dB/oct)
      mainOutput = this.highSVF2.lp;
      complementaryOutput = this.highSVF1.hp; // Highpass for anti-resonance
    }
    
    // Mix in complementary output for anti-resonance
    const output = mainOutput + complementaryOutput * antiResonanceAmount;
    
    return output;
  }

  // Process CENTRE filter block
  processCentreBlock(input, cfLow, cfHigh, cfCentre, q, mode, antiResonanceAmount) {
    if (mode < 0.5) {
      // CROSSOVER mode: HP at cfLow → LP at cfHigh
      // This creates a crossover/bandpass between the two cutoffs
      const freqCoeff1 = this.calculateFreqCoeff(cfLow);
      const freqCoeff2 = this.calculateFreqCoeff(cfHigh);
      
      // First SVF: highpass at LOW cutoff
      this.processSVF(this.centreSVF1, input, freqCoeff1, q);
      
      // Second SVF: lowpass at HIGH cutoff
      const svf1Out = this.centreSVF1.hp;
      this.processSVF(this.centreSVF2, svf1Out, freqCoeff2, q);
      
      const mainOutput = this.centreSVF2.lp;
      
      // For anti-resonance, mix both complementary outputs
      const comp1 = this.centreSVF1.lp;
      const comp2 = this.centreSVF2.hp;
      const complementaryOutput = (comp1 + comp2) * 0.5;
      
      return mainOutput + complementaryOutput * antiResonanceAmount;
      
    } else {
      // FORMANT mode: HP → LP at cfCentre (bandpass, 12dB/oct)
      const freqCoeff = this.calculateFreqCoeff(cfCentre);
      
      // First SVF: highpass
      this.processSVF(this.centreSVF1, input, freqCoeff, q);
      
      // Second SVF: lowpass
      const svf1Out = this.centreSVF1.hp;
      this.processSVF(this.centreSVF2, svf1Out, freqCoeff, q);
      
      const mainOutput = this.centreSVF2.lp;
      
      // For anti-resonance in formant mode
      const comp1 = this.centreSVF1.lp;
      const comp2 = this.centreSVF2.hp;
      const complementaryOutput = (comp1 + comp2) * 0.5;
      
      return mainOutput + complementaryOutput * antiResonanceAmount;
    }
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    
    // Input channels: [0] = ALL(IN), [1] = FM(IN)
    const audioIn = input[0] || new Float32Array(128);
    const fmIn = input[1] || new Float32Array(128);
    
    // Output channels: [0] = LOW, [1] = CENTRE, [2] = HIGH, [3] = ALL
    const lowOut = output[0];
    const centreOut = output[1];
    const highOut = output[2];
    const allOut = output[3];
    
    if (!lowOut || !centreOut || !highOut || !allOut) return true;
    
    for (let i = 0; i < audioIn.length; i++) {
      // Get parameters
      const freqKnob = parameters.freq[i] ?? parameters.freq[0];
      const spanKnob = parameters.span[i] ?? parameters.span[0];
      const quality = parameters.quality[i] ?? parameters.quality[0];
      const mode = parameters.mode[i] ?? parameters.mode[0];
      const fmAtten = parameters.fmAttenuverter[i] ?? parameters.fmAttenuverter[0];
      
      // Audio input (from Mangrove A) - already normalized ±1
      const audioSample = audioIn[i];
      
      // FM input (from Mangrove C) - already normalized ±1
      const fmSample = fmIn[i];
      
      // === FREQ CALCULATION (1V/oct style) ===
      // Map FREQ knob to base frequency (20Hz - 10kHz range)
      let baseFreqHz = this.freqKnobToHz(freqKnob);
      
      // Apply FM through attenuverter (bipolar control)
      // Attenuverter: 0 = full negative, 0.5 = off, 1 = full positive
      const fmAmount = (fmAtten - 0.5) * 2.0; // -1 to +1
      
      // FM modulates exponentially (1V/oct style)
      // fmSample is ±1, scale it appropriately for musical range
      const fmVoltage = fmSample * fmAmount * 2.0; // ±2V range when attenuverter at max
      const fmMultiplier = Math.pow(2, fmVoltage); // Exponential FM
      const modulatedFreq = baseFreqHz * fmMultiplier;
      
      // === SPAN CALCULATION ===
      // SPAN spreads LOW and HIGH cutoffs apart
      // Map span knob to Hz offset (proportional to base frequency)
      // At noon (0.5), no spread; at max (1.0), wide spread
      const spanAmount = (spanKnob - 0.5) * 2.0; // -1 to +1
      const spanHz = modulatedFreq * Math.abs(spanAmount) * 0.8; // Up to 80% of base freq
      
      // Calculate cutoff frequencies for each block
      const cfCentre = modulatedFreq;
      const cfLow = Math.max(20, modulatedFreq - spanHz);
      const cfHigh = Math.min(20000, modulatedFreq + spanHz);
      
      // === QUALITY (RESONANCE) CALCULATION ===
      // Quality < 0.5: anti-resonance (notch filtering)
      // Quality = 0.5: neutral (Q = 0.707, Butterworth response)
      // Quality > 0.5: resonance
      // Quality > 0.9: self-oscillation
      
      let q; // Damping factor (q = 1/Q)
      let antiResonanceAmount = 0;
      
      if (quality < 0.5) {
        // CCW from noon: anti-resonance
        // Use neutral Q but mix in complementary outputs
        q = 1.0 / 0.707; // Butterworth Q
        antiResonanceAmount = (0.5 - quality) * 2.0; // 0 to 1
      } else {
        // CW from noon: increase resonance
        const resonanceAmount = (quality - 0.5) * 2.0; // 0 to 1
        
        // Map to Q: 0.707 (neutral) to 30 (self-oscillation)
        // Exponential curve for better control at high resonance
        const minQ = 0.707;
        const maxQ = 30.0;
        const Q = minQ + (maxQ - minQ) * Math.pow(resonanceAmount, 1.5);
        q = 1.0 / Q; // Convert to damping
        antiResonanceAmount = 0;
      }
      
      // === PROCESS FILTER BLOCKS ===
      const lowSample = this.processLowBlock(
        audioSample, cfLow, q, mode, antiResonanceAmount
      );
      
      const centreSample = this.processCentreBlock(
        audioSample, cfLow, cfHigh, cfCentre, q, mode, antiResonanceAmount
      );
      
      const highSample = this.processHighBlock(
        audioSample, cfHigh, q, mode, antiResonanceAmount
      );
      
      // === OUTPUT ===
      // Outputs are already in Web Audio range (±1)
      lowOut[i] = lowSample;
      centreOut[i] = centreSample;
      highOut[i] = highSample;
      
      // ALL output: equal mix of three
      allOut[i] = (lowSample + centreSample + highSample) / 3.0;
    }
    
    return true;
  }
}

registerProcessor('three-sisters-processor', ThreeSistersProcessor);
