// DrumSynthNode.js
// Wrapper for drum synthesizer AudioWorkletProcessor

export class DrumSynthNode extends AudioWorkletNode {
  constructor(context) {
    super(context, 'drum-synth-processor', {
      numberOfInputs: 1,  // 3 channels: Kick, Snare, Hat triggers
      numberOfOutputs: 1, // Stereo output
      outputChannelCount: [2],
      channelCount: 3,
      channelCountMode: 'explicit',
      channelInterpretation: 'discrete'
    });
    
    // Store parameter references
    this.params = {
      // Kick
      kickPitch: this.parameters.get('kickPitch'),
      kickDecay: this.parameters.get('kickDecay'),
      kickDrive: this.parameters.get('kickDrive'),
      kickVolume: this.parameters.get('kickVolume'),
      
      // Snare
      snarePitch: this.parameters.get('snarePitch'),
      snareDecay: this.parameters.get('snareDecay'),
      snareDrive: this.parameters.get('snareDrive'),
      snareVolume: this.parameters.get('snareVolume'),
      
      // Hi-Hat
      hatDecay: this.parameters.get('hatDecay'),
      hatHPF: this.parameters.get('hatHPF'),
      hatDrive: this.parameters.get('hatDrive'),
      hatVolume: this.parameters.get('hatVolume')
    };
    
    // Create input gain nodes for separate trigger routing
    this.kickTrigger = context.createGain();
    this.snareTrigger = context.createGain();
    this.hatTrigger = context.createGain();
    
    // Create channel merger for triggers
    this.triggerMerger = context.createChannelMerger(3);
    
    // Wire up triggers
    this.kickTrigger.connect(this.triggerMerger, 0, 0);
    this.snareTrigger.connect(this.triggerMerger, 0, 1);
    this.hatTrigger.connect(this.triggerMerger, 0, 2);
    this.triggerMerger.connect(this, 0, 0);
    
    // Create output gain
    this.output = context.createGain();
    this.connect(this.output);
  }

  // ========== PARAMETER SETTERS ==========

  // Kick
  setKickPitch(value) {
    this.params.kickPitch.value = Math.max(20, Math.min(200, value));
  }

  setKickDecay(value) {
    this.params.kickDecay.value = Math.max(0.01, Math.min(2, value));
  }

  setKickDrive(value) {
    this.params.kickDrive.value = Math.max(0, Math.min(1, value));
  }

  setKickVolume(value) {
    this.params.kickVolume.value = Math.max(0, Math.min(1, value));
  }

  // Snare
  setSnarePitch(value) {
    this.params.snarePitch.value = Math.max(100, Math.min(500, value));
  }

  setSnareDecay(value) {
    this.params.snareDecay.value = Math.max(0.01, Math.min(1, value));
  }

  setSnareDrive(value) {
    this.params.snareDrive.value = Math.max(0, Math.min(1, value));
  }

  setSnareVolume(value) {
    this.params.snareVolume.value = Math.max(0, Math.min(1, value));
  }

  // Hi-Hat
  setHatDecay(value) {
    this.params.hatDecay.value = Math.max(0.005, Math.min(0.3, value));
  }

  setHatHPF(value) {
    this.params.hatHPF.value = Math.max(4000, Math.min(12000, value));
  }

  setHatDrive(value) {
    this.params.hatDrive.value = Math.max(0, Math.min(1, value));
  }

  setHatVolume(value) {
    this.params.hatVolume.value = Math.max(0, Math.min(1, value));
  }

  // ========== RANDOMIZE KIT ==========

  randomizeKit() {
    // Randomize all synthesis parameters
    this.setKickPitch(30 + Math.random() * 100);
    this.setKickDecay(0.2 + Math.random() * 1.0);
    this.setKickDrive(Math.random() * 0.7);
    
    this.setSnarePitch(150 + Math.random() * 250);
    this.setSnareDecay(0.1 + Math.random() * 0.4);
    this.setSnareDrive(Math.random() * 0.7);
    
    this.setHatDecay(0.02 + Math.random() * 0.15);
    this.setHatHPF(6000 + Math.random() * 4000);
    this.setHatDrive(Math.random() * 0.5);
    
    console.log('✓ Drum kit randomized');
  }

  randomizeKick() {
    this.setKickPitch(30 + Math.random() * 100);
    this.setKickDecay(0.2 + Math.random() * 1.0);
    this.setKickDrive(Math.random() * 0.7);
  }

  randomizeSnare() {
    this.setSnarePitch(150 + Math.random() * 250);
    this.setSnareDecay(0.1 + Math.random() * 0.4);
    this.setSnareDrive(Math.random() * 0.7);
  }

  randomizeHat() {
    this.setHatDecay(0.02 + Math.random() * 0.15);
    this.setHatHPF(6000 + Math.random() * 4000);
    this.setHatDrive(Math.random() * 0.5);
  }

  // ========== I/O ACCESSORS ==========

  getKickTriggerInput() {
    return this.kickTrigger;
  }

  getSnareTriggerInput() {
    return this.snareTrigger;
  }

  getHatTriggerInput() {
    return this.hatTrigger;
  }

  getOutput() {
    return this.output;
  }

  // ========== CLEANUP ==========

  dispose() {
    this.disconnect();
    this.kickTrigger.disconnect();
    this.snareTrigger.disconnect();
    this.hatTrigger.disconnect();
    this.triggerMerger.disconnect();
    this.output.disconnect();
  }
}
