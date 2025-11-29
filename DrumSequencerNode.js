// DrumSequencerNode.js
// Wrapper for drum sequencer AudioWorkletProcessor

export class DrumSequencerNode extends AudioWorkletNode {
  constructor(context) {
    super(context, 'drum-sequencer-processor', {
      numberOfInputs: 1,  // Clock input
      numberOfOutputs: 1, // 3 channels: Kick, Snare, Hat triggers
      outputChannelCount: [3],
      channelCount: 1,
      channelCountMode: 'explicit',
      channelInterpretation: 'discrete'
    });
    
    // Store parameter reference
    this.params = {
      swing: this.parameters.get('swing')
    };
    
    // Create I/O nodes
    this.clockInput = context.createGain();
    
    // Create channel splitter for accessing separate trigger outputs
    this.splitter = context.createChannelSplitter(3);
    this.connect(this.splitter);
    
    // Create gain nodes for each trigger output
    this.kickTrigger = context.createGain();
    this.snareTrigger = context.createGain();
    this.hatTrigger = context.createGain();
    
    // Connect splitter to outputs
    this.splitter.connect(this.kickTrigger, 0);
    this.splitter.connect(this.snareTrigger, 1);
    this.splitter.connect(this.hatTrigger, 2);
    
    // Wire up clock input
    this.clockInput.connect(this, 0, 0);
  }

  // ========== PARAMETER SETTERS ==========

  setSwing(value) {
    this.params.swing.value = Math.max(0, Math.min(1, value));
  }

  // ========== STEP PROGRAMMING ==========

  setStep(voice, step, value) {
    this.port.postMessage({ 
      type: 'setStep', 
      voice: voice, // 'kick', 'snare', or 'hat'
      step: step,   // 0-15
      value: value  // true/false or 1/0
    });
  }

  clearPattern(voice) {
    this.port.postMessage({ 
      type: 'clearPattern', 
      voice: voice // 'kick', 'snare', 'hat', or 'all'
    });
  }

  // ========== I/O ACCESSORS ==========

  getClockInput() {
    return this.clockInput;
  }

  getKickTriggerOutput() {
    return this.kickTrigger;
  }

  getSnareTriggerOutput() {
    return this.snareTrigger;
  }

  getHatTriggerOutput() {
    return this.hatTrigger;
  }

  // ========== CLEANUP ==========

  dispose() {
    this.disconnect();
    this.clockInput.disconnect();
    this.splitter.disconnect();
    this.kickTrigger.disconnect();
    this.snareTrigger.disconnect();
    this.hatTrigger.disconnect();
  }
}
