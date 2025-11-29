// drum-synth-processor.js
// 3-voice drum synthesizer: Kick, Snare, Hi-Hat
// Features: Per-channel saturation, independent pitch/decay control

class DrumSynthProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      // Kick parameters
      { name: 'kickPitch', defaultValue: 50, minValue: 20, maxValue: 200 },
      { name: 'kickDecay', defaultValue: 0.5, minValue: 0.01, maxValue: 2 },
      { name: 'kickDrive', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'kickVolume', defaultValue: 0.8, minValue: 0, maxValue: 1 },
      
      // Snare parameters
      { name: 'snarePitch', defaultValue: 220, minValue: 100, maxValue: 500 },
      { name: 'snareDecay', defaultValue: 0.2, minValue: 0.01, maxValue: 1 },
      { name: 'snareDrive', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'snareVolume', defaultValue: 0.6, minValue: 0, maxValue: 1 },
      
      // Hi-Hat parameters
      { name: 'hatDecay', defaultValue: 0.05, minValue: 0.005, maxValue: 0.3 },
      { name: 'hatHPF', defaultValue: 7000, minValue: 4000, maxValue: 12000 },
      { name: 'hatDrive', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'hatVolume', defaultValue: 0.4, minValue: 0, maxValue: 1 }
    ];
  }

  constructor() {
    super();
    
    // Kick state
    this.kickPhase = 0;
    this.kickEnv = 0;
    
    // Snare state
    this.snarePhase = 0;
    this.snareEnv = 0;
    
    // Hi-Hat state
    this.hatEnv = 0;
    
    // Hi-Hat filter state (1-pole HPF)
    this.hatHP_x1 = 0;
    this.hatHP_y1 = 0;
    
    // Snare filter state (1-pole HPF)
    this.snareHP_x1 = 0;
    this.snareHP_y1 = 0;
    
    this.twoPI = 2 * Math.PI;
  }

  applySaturation(signal, drive) {
    if (drive < 0.01) return signal;
    
    // Soft saturation using tanh
    // drive 0 = clean, drive 1 = heavy saturation
    const preGain = 1 + (drive * 4);
    const saturated = Math.tanh(signal * preGain);
    
    // Compensate gain
    return saturated / (1 + drive * 0.5);
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    if (!output || output.length < 2) return true;
    
    const outputL = output[0];
    const outputR = output[1];
    
    // Get trigger inputs
    const input = inputs[0];
    const kickTrig = input && input[0] ? input[0] : null;
    const snareTrig = input && input[1] ? input[1] : null;
    const hatTrig = input && input[2] ? input[2] : null;
    
    // Get parameters (k-rate)
    const kickPitch = parameters.kickPitch[0];
    const kickDecay = parameters.kickDecay[0];
    const kickDrive = parameters.kickDrive[0];
    const kickVolume = parameters.kickVolume[0];
    
    const snarePitch = parameters.snarePitch[0];
    const snareDecay = parameters.snareDecay[0];
    const snareDrive = parameters.snareDrive[0];
    const snareVolume = parameters.snareVolume[0];
    
    const hatDecay = parameters.hatDecay[0];
    const hatHPF = parameters.hatHPF[0];
    const hatDrive = parameters.hatDrive[0];
    const hatVolume = parameters.hatVolume[0];
    
    // Calculate envelope coefficients
    const kickEnvCoeff = Math.exp(-1 / (sampleRate * kickDecay));
    const snareEnvCoeff = Math.exp(-1 / (sampleRate * snareDecay));
    const hatEnvCoeff = Math.exp(-1 / (sampleRate * hatDecay));
    
    // Hi-Hat HPF coefficients
    const hatRC = 1.0 / (hatHPF * this.twoPI);
    const hatDT = 1.0 / sampleRate;
    const hatAlpha = hatRC / (hatRC + hatDT);
    
    // Snare HPF coefficients (1400 Hz)
    const snareRC = 1.0 / (1400 * this.twoPI);
    const snareAlpha = snareRC / (snareRC + hatDT);
    
    for (let i = 0; i < outputL.length; i++) {
      let kickSignal = 0;
      let snareSignal = 0;
      let hatSignal = 0;
      
      // ========== KICK SYNTHESIS ==========
      if (kickTrig && kickTrig[i] > 0.5) {
        this.kickEnv = 1.0;
        this.kickPhase = 0;
      }
      
      this.kickEnv *= kickEnvCoeff;
      
      // Pitch sweep (envelope modulates pitch)
      const currentKickFreq = kickPitch + (kickPitch * 4 * this.kickEnv);
      this.kickPhase += currentKickFreq / sampleRate;
      if (this.kickPhase > 1) this.kickPhase -= 1;
      
      const kickOsc = Math.sin(this.kickPhase * this.twoPI);
      
      // Apply envelope (squared for punch)
      kickSignal = kickOsc * this.kickEnv * this.kickEnv;
      
      // Apply saturation
      kickSignal = this.applySaturation(kickSignal, kickDrive);
      
      // Apply volume
      kickSignal *= kickVolume;
      
      // ========== SNARE SYNTHESIS ==========
      if (snareTrig && snareTrig[i] > 0.5) {
        this.snareEnv = 1.0;
        this.snarePhase = 0;
      }
      
      this.snareEnv *= snareEnvCoeff;
      
      // Tone component
      const currentSnareFreq = snarePitch + (snarePitch * 0.5 * this.snareEnv);
      this.snarePhase += currentSnareFreq / sampleRate;
      if (this.snarePhase > 1) this.snarePhase -= 1;
      
      const snareTone = Math.sin(this.snarePhase * this.twoPI);
      
      // Noise component
      const snareNoise = (Math.random() * 2) - 1;
      
      // Mix (80% noise, 20% tone)
      let snareRaw = (snareNoise * 0.8) + (snareTone * 0.2);
      snareRaw *= this.snareEnv;
      
      // High-pass filter
      const snareHP = snareAlpha * (this.snareHP_y1 + snareRaw - this.snareHP_x1);
      this.snareHP_x1 = snareRaw;
      this.snareHP_y1 = snareHP;
      
      snareSignal = snareHP;
      
      // Apply saturation
      snareSignal = this.applySaturation(snareSignal, snareDrive);
      
      // Apply volume
      snareSignal *= snareVolume;
      
      // ========== HI-HAT SYNTHESIS ==========
      if (hatTrig && hatTrig[i] > 0.5) {
        this.hatEnv = 1.0;
      }
      
      this.hatEnv *= hatEnvCoeff;
      
      // White noise
      const hatNoise = (Math.random() * 2) - 1;
      
      // Apply envelope
      let hatRaw = hatNoise * this.hatEnv;
      
      // High-pass filter (sharp, bright)
      const hatHP = hatAlpha * (this.hatHP_y1 + hatRaw - this.hatHP_x1);
      this.hatHP_x1 = hatRaw;
      this.hatHP_y1 = hatHP;
      
      hatSignal = hatHP;
      
      // Apply saturation
      hatSignal = this.applySaturation(hatSignal, hatDrive);
      
      // Apply volume
      hatSignal *= hatVolume;
      
      // ========== MIX & OUTPUT ==========
      const mix = kickSignal + snareSignal + hatSignal;
      
      // Soft limiting on master
      const limited = Math.tanh(mix * 1.2);
      
      outputL[i] = limited;
      outputR[i] = limited;
    }
    
    return true;
  }
}

registerProcessor('drum-synth-processor', DrumSynthProcessor);
