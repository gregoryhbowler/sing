// drum-sequencer-processor.js
// Generative 16-step drum sequencer
// Each clock pulse = one step (16th note)
// Clock source should pulse at 16th note rate (e.g., 8 Hz for 120 BPM)

class DrumSequencerProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'swing', defaultValue: 0, minValue: 0, maxValue: 1 }
    ];
  }

  constructor() {
    super();
    
    // Clock state
    this.prevClockSample = 0;
    this.clockThreshold = 0.1;
    this.lastClockTime = 0; // Sample count of last clock edge
    this.clockInterval = 0; // Measured interval between clocks
    this.stepSize = 5512; // Samples per step (default ~8 Hz = 120 BPM 16th notes at 44.1kHz)
    
    // Sequencer state
    this.currentStep = 0; // 0-15
    this.stepPhase = 0; // Sample counter within current step
    this.steps = 16;
    
    // Swing state
    this.swingAmount = 0; // 0-1
    
    // Pattern arrays (1 = trigger, 0 = silence)
    this.kickPattern = new Array(16).fill(0);
    this.snarePattern = new Array(16).fill(0);
    this.hatPattern = new Array(16).fill(0);
    
    // Groove mask (controls which 16th subdivisions play)
    // Index: 0=downbeat, 1=e, 2=&, 3=a
    this.grooveMask = [1, 0, 1, 1]; // Default: mute the 'e'
    
    // Initialize patterns
    //this.generatePattern();
    
    // Message handling
this.port.onmessage = (event) => {
  const { type } = event.data;
  
  if (type === 'setStep') {
    const { voice, step, value } = event.data;
    if (voice === 'kick') {
      this.kickPattern[step] = value ? 1 : 0;
    } else if (voice === 'snare') {
      this.snarePattern[step] = value ? 1 : 0;
    } else if (voice === 'hat') {
      this.hatPattern[step] = value ? 1 : 0;
    }
  } else if (type === 'clearPattern') {
    const { voice } = event.data;
    if (voice === 'kick' || voice === 'all') {
      this.kickPattern.fill(0);
    }
    if (voice === 'snare' || voice === 'all') {
      this.snarePattern.fill(0);
    }
    if (voice === 'hat' || voice === 'all') {
      this.hatPattern.fill(0);
    }
  }
};
    
    this.sampleCount = 0;
  }


  detectClock(currentSample) {
    // Detect rising edge
    const crossed = this.prevClockSample < this.clockThreshold && 
                   currentSample >= this.clockThreshold;
    this.prevClockSample = currentSample;
    return crossed;
  }

  updateClockInterval() {
    const now = this.sampleCount;
    
    if (this.lastClockTime > 0) {
      this.clockInterval = now - this.lastClockTime;
      
      // Each clock pulse = one step (16th note)
      // Clock source should already be pulsing at 16th note rate
      this.stepSize = this.clockInterval;
      
      // Clamp to reasonable 16th note range (60-480 BPM)
      // 60 BPM 16ths: 11025 samples, 480 BPM 16ths: 1378 samples at 44.1kHz
      this.stepSize = Math.max(1378, Math.min(11025, this.stepSize));
    }
    
    this.lastClockTime = now;
  }

  getSwingDelay(step) {
    // Apply swing to every other 16th note (the "e" and "a" of each beat)
    // step % 4: 0=downbeat, 1=e, 2=&, 3=a
    const subDiv = step % 4;
    
    if (subDiv === 1 || subDiv === 3) {
      // These are the swung notes
      return this.stepSize * this.swingAmount * 0.3; // Max 30% delay
    }
    
    return 0;
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    if (!output || output.length < 3) return true;
    
    const kickOut = output[0];
    const snareOut = output[1];
    const hatOut = output[2];
    
    // Get clock input
    const input = inputs[0];
    const clockIn = input && input[0] ? input[0] : null;
    
    // Get swing parameter
    this.swingAmount = parameters.swing[0];
    
    for (let i = 0; i < kickOut.length; i++) {
      this.sampleCount++;
      
      // Detect clock edges and update interval
      if (clockIn && this.detectClock(clockIn[i])) {
        this.updateClockInterval();
      }
      
      // Calculate swing delay for current step
      const swingDelay = this.getSwingDelay(this.currentStep);
      const effectiveStepSize = this.stepSize + swingDelay;
      
      // Advance step phase
      this.stepPhase++;
      
      // Check if we should advance to next step
      if (this.stepPhase >= effectiveStepSize) {
        this.stepPhase = 0;
        this.currentStep = (this.currentStep + 1) % 16;
      }
      
      // Trigger on first sample of step
      if (this.stepPhase === 0) {
        // Check groove mask
        const subDiv = this.currentStep % 4;
        const isAllowed = this.grooveMask[subDiv];
        
        if (isAllowed) {
          kickOut[i] = this.kickPattern[this.currentStep];
          snareOut[i] = this.snarePattern[this.currentStep];
          hatOut[i] = this.hatPattern[this.currentStep];
        } else {
          kickOut[i] = 0;
          snareOut[i] = 0;
          hatOut[i] = 0;
        }
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
