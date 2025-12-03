// ThreeSistersFilter.js
// Wrapper for Three Sisters filter (using existing ThreeSistersNode)

import { FilterInterface } from './FilterInterface.js';

export class ThreeSistersFilter extends FilterInterface {
  constructor(audioContext, ThreeSistersNodeClass) {
    super();
    this.ctx = audioContext;

    // Create Three Sisters node using provided class
    this.node = new ThreeSistersNodeClass(audioContext);

    // Store parameter references
    this.params = {
      freq: this.node.params.freq,
      span: this.node.params.span,
      quality: this.node.params.quality,
      mode: this.node.params.mode,
      fmAttenuverter: this.node.params.fmAttenuverter
    };

    console.log('✓ Three Sisters Filter created');
  }

  // FilterInterface implementation
  getInput() {
    return this.node.getAudioInput();
  }

  getOutput() {
    return this.node.getAllOutput(); // Use ALL output for mixer
  }

  getFMInput() {
    return this.node.getFMInput();
  }

  setCutoff(value) {
    // Map cutoff (Hz) to freq knob (0-1)
    // Three Sisters uses a knob value, not direct frequency
    const knobValue = Math.log(value / 20) / Math.log(20000 / 20);
    this.node.setFreq(knobValue);
  }

  setResonance(value) {
    // Map resonance to quality (0.5 = neutral)
    this.node.setQuality(0.5 + value * 0.5);
  }

  // Three Sisters-specific methods
  setFreq(knobValue) {
    this.node.setFreq(knobValue);
  }

  setSpan(value) {
    this.node.setSpan(value);
  }

  setQuality(value) {
    this.node.setQuality(value);
  }

  setMode(value) {
    // 0 = crossover, 1 = formant
    this.node.setMode(value);
  }

  setFMAttenuverter(value) {
    this.node.setFMAttenuverter(value);
  }

  getState() {
    return {
      type: 'threesisters',
      freq: this.params.freq.value,
      span: this.params.span.value,
      quality: this.params.quality.value,
      mode: this.params.mode.value,
      fmAttenuverter: this.params.fmAttenuverter.value
    };
  }

  setState(state) {
    if (state.freq !== undefined) this.setFreq(state.freq);
    if (state.span !== undefined) this.setSpan(state.span);
    if (state.quality !== undefined) this.setQuality(state.quality);
    if (state.mode !== undefined) this.setMode(state.mode);
    if (state.fmAttenuverter !== undefined) this.setFMAttenuverter(state.fmAttenuverter);
  }

  dispose() {
    this.node.dispose();
  }
}
