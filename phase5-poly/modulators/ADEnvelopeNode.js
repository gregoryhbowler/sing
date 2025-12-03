// ADEnvelopeNode.js
// Wrapper for AD envelope processor

export class ADEnvelopeNode {
  constructor(audioContext) {
    this.ctx = audioContext;

    // Create AudioWorkletNode
    this.node = new AudioWorkletNode(audioContext, 'ad-envelope-processor', {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      channelCount: 1,
      channelCountMode: 'explicit',
      channelInterpretation: 'discrete'
    });

    // Store parameter references
    this.params = {
      attack: this.node.parameters.get('attack'),
      decay: this.node.parameters.get('decay')
    };

    console.log('✓ AD Envelope created');
  }

  // Trigger the envelope (start attack phase)
  trigger() {
    this.node.port.postMessage({ type: 'trigger' });
  }

  // Release/force decay
  release() {
    this.node.port.postMessage({ type: 'release' });
  }

  // Set attack time in seconds
  setAttack(seconds) {
    this.params.attack.value = Math.max(0.001, Math.min(2.0, seconds));
  }

  // Set decay time in seconds
  setDecay(seconds) {
    this.params.decay.value = Math.max(0.01, Math.min(10.0, seconds));
  }

  // Get output node for connecting to VCA gain
  getOutput() {
    return this.node;
  }

  getState() {
    return {
      attack: this.params.attack.value,
      decay: this.params.decay.value
    };
  }

  setState(state) {
    if (state.attack !== undefined) this.setAttack(state.attack);
    if (state.decay !== undefined) this.setDecay(state.decay);
  }

  dispose() {
    this.node.disconnect();
  }
}
