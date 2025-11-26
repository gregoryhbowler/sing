// JustFriendsNode.js
// Wrapper for Just Friends AudioWorkletProcessor

export class JustFriendsNode extends AudioWorkletNode {
  constructor(context) {
    super(context, 'just-friends-processor', {
      numberOfInputs: 11,  // 6 triggers + TIME CV + INTONE CV + RAMP CV + CURVE CV + FM INPUT
      numberOfOutputs: 1,  // 7 channels: IDENTITY, 2N, 3N, 4N, 5N, 6N, MIX
      outputChannelCount: [7],
      channelCount: 1,
      channelCountMode: 'explicit',
      channelInterpretation: 'discrete'
    });
    
    // Store parameter references
    this.params = {
      time: this.parameters.get('time'),
      intone: this.parameters.get('intone'),
      ramp: this.parameters.get('ramp'),
      curve: this.parameters.get('curve'),
      range: this.parameters.get('range'),
      mode: this.parameters.get('mode'),
      fmDepth: this.parameters.get('fmDepth'),
      fmMode: this.parameters.get('fmMode')
    };

    // Create channel splitter for accessing separate slope outputs
    this.splitter = context.createChannelSplitter(7);
    this.connect(this.splitter);

    // Create gain nodes for each output
    this.slopeOutputs = {
      identity: context.createGain(),
      n2: context.createGain(),
      n3: context.createGain(),
      n4: context.createGain(),
      n5: context.createGain(),
      n6: context.createGain(),
      mix: context.createGain()
    };
    
    // Connect splitter to individual outputs
    this.splitter.connect(this.slopeOutputs.identity, 0);
    this.splitter.connect(this.slopeOutputs.n2, 1);
    this.splitter.connect(this.slopeOutputs.n3, 2);
    this.splitter.connect(this.slopeOutputs.n4, 3);
    this.splitter.connect(this.slopeOutputs.n5, 4);
    this.splitter.connect(this.slopeOutputs.n6, 5);
    this.splitter.connect(this.slopeOutputs.mix, 6);

    // Create input gain nodes for CV/trigger inputs
    this.triggerInputs = Array.from({ length: 6 }, () => context.createGain());
    this.timeCvInput = context.createGain();
    this.intoneCvInput = context.createGain();
    this.rampCvInput = context.createGain();
    this.curveCvInput = context.createGain();
    this.fmInput = context.createGain();

    // Connect inputs to the processor (matching the input index order)
    this.triggerInputs.forEach((input, i) => {
      input.connect(this, 0, i);
    });
    this.timeCvInput.connect(this, 0, 6);
    this.intoneCvInput.connect(this, 0, 7);
    this.rampCvInput.connect(this, 0, 8);
    this.curveCvInput.connect(this, 0, 9);
    this.fmInput.connect(this, 0, 10);
  }

  // ========== PARAMETER SETTERS ==========

  setTime(knobValue) {
    this.params.time.value = Math.max(0, Math.min(1, knobValue));
  }

  setIntone(knobValue) {
    this.params.intone.value = Math.max(0, Math.min(1, knobValue));
  }

  setRamp(knobValue) {
    this.params.ramp.value = Math.max(0, Math.min(1, knobValue));
  }

  setCurve(knobValue) {
    this.params.curve.value = Math.max(0, Math.min(1, knobValue));
  }

  setRange(rangeValue) {
    // 0 = shape, 1 = sound
    this.params.range.value = rangeValue;
  }

  setMode(modeValue) {
    // 0 = transient, 1 = sustain, 2 = cycle
    this.params.mode.value = Math.max(0, Math.min(2, Math.round(modeValue)));
  }

  setFMDepth(knobValue) {
    // 0.5 = noon (no FM), <0.5 = INTONE style, >0.5 = TIME style
    this.params.fmDepth.value = Math.max(0, Math.min(1, knobValue));
  }

  setFMMode(modeValue) {
    // <0.5 = INTONE style, >0.5 = TIME style
    this.params.fmMode.value = Math.max(0, Math.min(1, modeValue));
  }

  // ========== OUTPUT ACCESSORS ==========

  getIdentityOutput() {
    return this.slopeOutputs.identity;
  }

  get2NOutput() {
    return this.slopeOutputs.n2;
  }

  get3NOutput() {
    return this.slopeOutputs.n3;
  }

  get4NOutput() {
    return this.slopeOutputs.n4;
  }

  get5NOutput() {
    return this.slopeOutputs.n5;
  }

  get6NOutput() {
    return this.slopeOutputs.n6;
  }

  getMixOutput() {
    return this.slopeOutputs.mix;
  }

  // Get any slope output by index (0-5)
  getSlopeOutput(index) {
    const outputs = [
      this.slopeOutputs.identity,
      this.slopeOutputs.n2,
      this.slopeOutputs.n3,
      this.slopeOutputs.n4,
      this.slopeOutputs.n5,
      this.slopeOutputs.n6
    ];
    return outputs[index];
  }

  // ========== INPUT ACCESSORS ==========

  // Get trigger input for a specific slope (0-5)
  getTriggerInput(index) {
    if (index < 0 || index >= 6) {
      throw new Error(`Invalid trigger index: ${index}. Must be 0-5.`);
    }
    return this.triggerInputs[index];
  }

  getTimeCVInput() {
    return this.timeCvInput;
  }

  getIntoneCVInput() {
    return this.intoneCvInput;
  }

  getRampCVInput() {
    return this.rampCvInput;
  }

  getCurveCVInput() {
    return this.curveCvInput;
  }

  getFMInput() {
    return this.fmInput;
  }

  // ========== CONVENIENCE METHODS ==========

  // Set all triggers to the same source (trigger normalling behavior)
  connectTriggerToAll(sourceNode) {
    this.triggerInputs.forEach(input => {
      sourceNode.connect(input);
    });
  }

  // Disconnect all triggers
  disconnectAllTriggers() {
    this.triggerInputs.forEach(input => {
      input.disconnect();
    });
  }

  // ========== CLEANUP ==========

  dispose() {
    // Disconnect all outputs
    this.disconnect();
    Object.values(this.slopeOutputs).forEach(output => output.disconnect());
    
    // Disconnect all inputs
    this.triggerInputs.forEach(input => input.disconnect());
    this.timeCvInput.disconnect();
    this.intoneCvInput.disconnect();
    this.rampCvInput.disconnect();
    this.curveCvInput.disconnect();
    this.fmInput.disconnect();
    
    this.splitter.disconnect();
  }
}
