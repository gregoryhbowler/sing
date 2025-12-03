// WaspFilter.js
// Wrapper for Wasp multimode filter processor

import { FilterInterface } from './FilterInterface.js';

export class WaspFilter extends FilterInterface {
  constructor(audioContext) {
    super();
    this.ctx = audioContext;

    // DC blocking filter (remove any DC offset from Mangrove)
    // Mangrove's complex waveshaping can produce DC that destabilizes the Wasp's SVF
    this.dcBlocker = audioContext.createBiquadFilter();
    this.dcBlocker.type = 'highpass';
    this.dcBlocker.frequency.value = 5; // Remove sub-5Hz DC
    this.dcBlocker.Q.value = 0.7;

    // Input gain - try lower gain to avoid crushing signal in nonlinearity
    // Mangrove is hotter than simple oscillator, may need more attenuation
    this.inputGain = audioContext.createGain();
    this.inputGain.gain.value = 0.25; // Try 0.25 instead of 0.5

    // Create AudioWorkletNode
    this.node = new AudioWorkletNode(audioContext, 'wasp-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCount: 1,
      channelCountMode: 'explicit',
      channelInterpretation: 'discrete'
    });

    // Connect: dcBlocker → inputGain → processor
    this.dcBlocker.connect(this.inputGain);
    this.inputGain.connect(this.node);

    // Store parameter references
    this.params = {
      cutoff: this.node.parameters.get('cutoff'),
      resonance: this.node.parameters.get('resonance'),
      mode: this.node.parameters.get('mode'),
      drive: this.node.parameters.get('drive'),
      chaos: this.node.parameters.get('chaos')
    };

    // Create FM input gain
    this.fmGain = audioContext.createGain();
    this.fmGain.gain.value = 0;

    // FM modulates cutoff
    this.fmGain.connect(this.params.cutoff);

    console.log('✓ Wasp Filter created');
  }

  // FilterInterface implementation
  getInput() {
    return this.dcBlocker;  // Return DC blocker as input (first in chain)
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

  // Wasp-specific methods
  setMode(value) {
    // 0=LP, 1=BP, 2=HP, 3=Notch
    this.params.mode.value = Math.max(0, Math.min(3, Math.round(value)));
  }

  setDrive(value) {
    this.params.drive.value = Math.max(0, Math.min(1, value));
  }

  setChaos(value) {
    this.params.chaos.value = Math.max(0, Math.min(1, value));
  }

  getState() {
    return {
      type: 'wasp',
      cutoff: this.params.cutoff.value,
      resonance: this.params.resonance.value,
      mode: this.params.mode.value,
      drive: this.params.drive.value,
      chaos: this.params.chaos.value
    };
  }

  setState(state) {
    if (state.cutoff !== undefined) this.setCutoff(state.cutoff);
    if (state.resonance !== undefined) this.setResonance(state.resonance);
    if (state.mode !== undefined) this.setMode(state.mode);
    if (state.drive !== undefined) this.setDrive(state.drive);
    if (state.chaos !== undefined) this.setChaos(state.chaos);
  }

  dispose() {
    this.dcBlocker.disconnect();
    this.inputGain.disconnect();
    this.node.disconnect();
    this.fmGain.disconnect();
  }
}
