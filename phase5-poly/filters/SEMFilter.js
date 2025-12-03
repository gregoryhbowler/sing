// SEMFilter.js
// Wrapper for SEM state-variable filter processor

import { FilterInterface } from './FilterInterface.js';

export class SEMFilter extends FilterInterface {
  constructor(audioContext) {
    super();
    this.ctx = audioContext;

    // Create AudioWorkletNode
    this.node = new AudioWorkletNode(audioContext, 'sem-filter-processor', {
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
      morph: this.node.parameters.get('morph'),
      drive: this.node.parameters.get('drive'),
      oversample: this.node.parameters.get('oversample')
    };

    // Create FM input gain
    this.fmGain = audioContext.createGain();
    this.fmGain.gain.value = 0;

    // FM modulates cutoff
    this.fmGain.connect(this.params.cutoff);

    console.log('✓ SEM Filter created');
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

  // SEM-specific methods
  setMorph(value) {
    // -1 to +1: LP → BP → HP → Notch
    this.params.morph.value = Math.max(-1, Math.min(1, value));
  }

  setDrive(value) {
    this.params.drive.value = Math.max(0.1, Math.min(10, value));
  }

  setOversample(value) {
    // 1, 2, or 4
    this.params.oversample.value = Math.max(1, Math.min(4, Math.round(value)));
  }

  getState() {
    return {
      type: 'sem',
      cutoff: this.params.cutoff.value,
      resonance: this.params.resonance.value,
      morph: this.params.morph.value,
      drive: this.params.drive.value,
      oversample: this.params.oversample.value
    };
  }

  setState(state) {
    if (state.cutoff !== undefined) this.setCutoff(state.cutoff);
    if (state.resonance !== undefined) this.setResonance(state.resonance);
    if (state.morph !== undefined) this.setMorph(state.morph);
    if (state.drive !== undefined) this.setDrive(state.drive);
    if (state.oversample !== undefined) this.setOversample(state.oversample);
  }

  dispose() {
    this.node.disconnect();
    this.fmGain.disconnect();
  }
}
