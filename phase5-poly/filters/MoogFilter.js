// MoogFilter.js
// Wrapper for Moog Ladder filter processor

import { FilterInterface } from './FilterInterface.js';

export class MoogFilter extends FilterInterface {
  constructor(audioContext) {
    super();
    this.ctx = audioContext;

    // Create AudioWorkletNode
    this.node = new AudioWorkletNode(audioContext, 'moog-ladder-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCount: 1,
      channelCountMode: 'explicit',
      channelInterpretation: 'discrete'
    });

    // Store parameter references
    this.params = {
      cutoff: this.node.parameters.get('cutoff'),
      resonance: this.node.parameters.get('resonance'),
      drive: this.node.parameters.get('drive'),
      warmth: this.node.parameters.get('warmth')
    };

    // Create FM input gain
    this.fmGain = audioContext.createGain();
    this.fmGain.gain.value = 0; // No FM by default

    // FM modulates cutoff
    this.fmGain.connect(this.params.cutoff);

    console.log('✓ Moog Filter created');
  }

  // FilterInterface implementation
  getInput() {
    return this.node;
  }

  getOutput() {
    return this.node;
  }

  getFMInput() {
    return this.fmGain;
  }

  setCutoff(value) {
    // value: 20-20000 Hz
    this.params.cutoff.value = Math.max(20, Math.min(20000, value));
  }

  setResonance(value) {
    // value: 0-1
    this.params.resonance.value = Math.max(0, Math.min(1, value));
  }

  // Additional Moog-specific methods
  setDrive(value) {
    this.params.drive.value = Math.max(0, Math.min(1, value));
  }

  setWarmth(value) {
    this.params.warmth.value = Math.max(0, Math.min(1, value));
  }

  getState() {
    return {
      type: 'moog',
      cutoff: this.params.cutoff.value,
      resonance: this.params.resonance.value,
      drive: this.params.drive.value,
      warmth: this.params.warmth.value
    };
  }

  setState(state) {
    if (state.cutoff !== undefined) this.setCutoff(state.cutoff);
    if (state.resonance !== undefined) this.setResonance(state.resonance);
    if (state.drive !== undefined) this.setDrive(state.drive);
    if (state.warmth !== undefined) this.setWarmth(state.warmth);
  }

  dispose() {
    this.node.disconnect();
    this.fmGain.disconnect();
  }
}
