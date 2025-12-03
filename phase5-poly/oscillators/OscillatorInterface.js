// OscillatorInterface.js
// Abstract interface for oscillators in Phase 5 Poly

export class OscillatorInterface {
  getPitchCVInput() {
    throw new Error('getPitchCVInput() not implemented');
  }

  getFMInput() {
    throw new Error('getFMInput() not implemented');
  }

  getOutput() {
    throw new Error('getOutput() not implemented');
  }

  getState() {
    throw new Error('getState() not implemented');
  }

  setState(state) {
    throw new Error('setState() not implemented');
  }

  dispose() {
    throw new Error('dispose() not implemented');
  }
}
