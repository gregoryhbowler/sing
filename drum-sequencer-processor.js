// drum-sequencer-processor.js
class DrumSequencerProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'swing', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'clockDivision', defaultValue: 4, minValue: 1, maxValue: 16 }
    ];
  }

  constructor() {
    super();
    
    // Pulse detection
    this.prevStepPulse = 0;
    this.prevResetPulse = 0;
    this.pulseThreshold = 0.5;
    
    // Timing state - measure time between input pulses
    this.lastPulseTime = 0;
    this.pulseInterval = 0; // samples between input pulses
    
    // Internal subdivision counter
    this.sampleCounter = 0;
    this.subdivisionSize = 0; // samples per drum step
    
    // Sequencer state
    this.currentStep = 0;
    this.steps = 16;
    this.clockDivision = 4;
    
    // Pattern arrays
    this.kickPattern = new Array(16).fill(0);
    this.snarePattern = new Array(16).fill(0);
    this.hatPattern = new Array(16).fill(0);
    
    // Message handling
    this.port.onmessage = (event) => {
      const { type } = event.data;
      
      if (type === 'setStep') {
        const { voice, step, value } = event.data;
        if (voice === 'kick') this.kickPattern[step] = value ? 1 : 0;
        else if (voice === 'snare') this.snarePattern[step] = value ? 1 : 0;
        else if (voice === 'hat') this.hatPattern[step] = value ? 1 : 0;
      } else if (type === 'clearPattern') {
        const { voice } = event.data;
        if (voice === 'kick' || voice === 'all') this.kickPattern.fill(0);
        if (voice === 'snare' || voice === 'all') this.snarePattern.fill(0);
        if (voice === 'hat' || voice === 'all') this.hatPattern.fill(0);
      }
    };
    
    this.totalSamples = 0;
    this.debugCounter = 0;
    this.debugInterval = sampleRate * 2;
    this.lastPulseLog = 0;
  }

  detectPulse(currentSample, prevSample) {
    return prevSample < this.pulseThreshold && currentSample >= this.pulseThreshold;
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    if (!output || output.length < 3) return true;
    
    const kickOut = output[0];
    const snareOut = output[1];
    const hatOut = output[2];
    
    const stepClockIn = inputs[0] && inputs[0][0] ? inputs[0][0] : null;
    const resetClockIn = inputs[1] && inputs[1][0] ? inputs[1][0] : null;
    
    this.clockDivision = Math.max(1, Math.min(16, Math.round(parameters.clockDivision[0])));
    
    for (let i = 0; i < kickOut.length; i++) {
      this.totalSamples++;
      this.sampleCounter++;
      
      let shouldTrigger = false;
      
      // Detect reset pulse
      if (resetClockIn && this.detectPulse(resetClockIn[i], this.prevResetPulse)) {
        this.currentStep = 0;
        this.sampleCounter = 0;
        shouldTrigger = true;
        console.log('[Drum] Reset');
        this.prevResetPulse = resetClockIn[i];
      } else {
        if (resetClockIn) this.prevResetPulse = resetClockIn[i];
      }
      
      // Detect input clock pulse
      if (stepClockIn && this.detectPulse(stepClockIn[i], this.prevStepPulse)) {
        // Measure interval between pulses
        const currentTime = this.totalSamples;
        if (this.lastPulseTime > 0) {
          this.pulseInterval = currentTime - this.lastPulseTime;
          // Divide the interval by clockDivision to get drum step size
          this.subdivisionSize = Math.floor(this.pulseInterval / this.clockDivision);
          
          console.log(`[Drum] Pulse detected. Interval: ${this.pulseInterval} samples, Division: ${this.clockDivision}, Subdivision: ${this.subdivisionSize} samples/step`);
        }
        this.lastPulseTime = currentTime;
        this.sampleCounter = 0;
        shouldTrigger = true;
        
        this.prevStepPulse = stepClockIn[i];
      } else {
        if (stepClockIn) this.prevStepPulse = stepClockIn[i];
      }
      
      // Check for internal subdivision triggers
      if (!shouldTrigger && this.subdivisionSize > 0) {
        if (this.sampleCounter >= this.subdivisionSize) {
          shouldTrigger = true;
          this.sampleCounter = 0;
        }
      }
      
      // Output
      if (shouldTrigger) {
        kickOut[i] = this.kickPattern[this.currentStep];
        snareOut[i] = this.snarePattern[this.currentStep];
        hatOut[i] = this.hatPattern[this.currentStep];
        
        this.currentStep = (this.currentStep + 1) % 16;
      } else {
        kickOut[i] = 0;
        snareOut[i] = 0;
        hatOut[i] = 0;
      }
    }
    
    return true;
  }
}

registerProcessor('drum-sequencer-processor', DrumSequencerProcessor);
