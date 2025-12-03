/**
 * AD Envelope Processor
 * Simple Attack-Decay envelope for snappy MIDI-triggered synthesis
 *
 * Features:
 * - Fast attack phase (exponential rise to 1.0)
 * - Exponential decay phase (falls from 1.0 to 0)
 * - Message-based triggering (for MIDI note events)
 * - No sustain phase (AD only)
 */

class ADEnvelopeProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: 'attack',
        defaultValue: 0.01,  // 10ms - Quick but not too snappy
        minValue: 0.001,
        maxValue: 2.0,
        automationRate: 'k-rate'
      },
      {
        name: 'decay',
        defaultValue: 5.0,  // 5 seconds - long enough for testing filters
        minValue: 0.01,
        maxValue: 10.0,
        automationRate: 'k-rate'
      }
    ];
  }

  constructor() {
    super();

    this.envelope = 0;
    this.stage = 'idle'; // 'idle', 'attack', 'decay'

    // Listen for trigger/release messages
    this.port.onmessage = (e) => {
      if (e.data.type === 'trigger') {
        this.trigger();
      } else if (e.data.type === 'release') {
        this.release();
      }
    };
  }

  trigger() {
    this.stage = 'attack';
  }

  release() {
    // In AD envelope, release just forces decay stage
    if (this.stage !== 'idle') {
      this.stage = 'decay';
    }
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];

    if (!output || !output[0]) {
      return true;
    }

    const attack = parameters.attack[0];
    const decay = parameters.decay[0];

    // Calculate exponential coefficients
    // These give smooth exponential curves
    const attackCoef = Math.exp(-1 / (attack * sampleRate));
    const decayCoef = Math.exp(-1 / (decay * sampleRate));

    for (let i = 0; i < output[0].length; i++) {
      if (this.stage === 'attack') {
        // Exponential rise to 1.0
        this.envelope = 1 - (1 - this.envelope) * attackCoef;

        // When very close to 1.0, switch to decay
        if (this.envelope > 0.9999) {
          this.envelope = 1;
          this.stage = 'decay';
        }
      } else if (this.stage === 'decay') {
        // Exponential decay from current level
        this.envelope *= decayCoef;

        // When very close to 0, go idle
        if (this.envelope < 0.0001) {
          this.envelope = 0;
          this.stage = 'idle';
        }
      }

      // Output to all channels
      for (let ch = 0; ch < output.length; ch++) {
        output[ch][i] = this.envelope;
      }
    }

    return true;
  }
}

registerProcessor('ad-envelope-processor', ADEnvelopeProcessor);
