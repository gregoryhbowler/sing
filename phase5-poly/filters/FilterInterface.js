// FilterInterface.js
// Abstract interface for filters in Phase 5 Poly

export class FilterInterface {
  getInput() {
    throw new Error('getInput() not implemented');
  }

  getOutput() {
    throw new Error('getOutput() not implemented');
  }

  getFMInput() {
    throw new Error('getFMInput() not implemented');
  }

  setCutoff(value) {
    throw new Error('setCutoff() not implemented');
  }

  setResonance(value) {
    throw new Error('setResonance() not implemented');
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
