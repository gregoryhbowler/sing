// SendEffect.js
// Wrapper for send/return effects (Mimeophon, Greyhole, Zita)

export class SendEffect {
  constructor(audioContext, effectInstance, name) {
    this.ctx = audioContext;
    this.effect = effectInstance;
    this.name = name;

    // ========== INPUT BUS ==========
    // All mixer channel sends connect here
    this.inputBus = audioContext.createGain();
    this.inputBus.gain.value = 1;

    // ========== RETURN GAIN ==========
    // Controls how much of the effect returns to the master bus
    this.returnGain = audioContext.createGain();
    this.returnGain.gain.value = 1;

    // ========== WIRE ROUTING ==========
    this.wireEffect();

    console.log(`✓ Send Effect "${name}" created`);
  }

  async wireEffect() {
    // Route depends on effect type
    // Most effects have .input and .output properties

    // StandaloneMimeophon pattern - has init() method and uses inputGain/outputGain
    if (this.effect.init && typeof this.effect.init === 'function' && 'inputGain' in this.effect) {
      // Initialize first (e.g., StandaloneMimeophon)
      if (!this.effect.isReady) {
        await this.effect.init();
      }
      this.inputBus.connect(this.effect.inputGain);
      this.effect.outputGain.connect(this.returnGain);
      console.log(`  ✓ SendEffect "${this.name}": Wired via inputGain/outputGain`);
    } else if (this.effect.input && this.effect.output) {
      // Standard routing: inputBus → effect → returnGain
      this.inputBus.connect(this.effect.input);
      this.effect.output.connect(this.returnGain);
    } else if (this.effect.getInput && this.effect.getOutput) {
      // Alternative interface (e.g., Greyhole)
      this.inputBus.connect(this.effect.getInput());
      this.effect.getOutput().connect(this.returnGain);
    } else if (this.effect.getNode) {
      // ZitaReverb pattern - needs init() first
      if (this.effect.init && !this.effect.isInitialized) {
        await this.effect.init('../zita-reverb-processor.js');
      }
      const node = this.effect.getNode();
      if (node) {
        this.inputBus.connect(node);
        node.connect(this.returnGain);
      }
    } else if (this.effect.connect) {
      // Direct AudioNode-like interface
      this.inputBus.connect(this.effect);
      this.effect.connect(this.returnGain);
    } else {
      console.warn(`SendEffect "${this.name}": Unknown effect interface`);
    }
  }

  // ========== I/O ==========
  getInputBus() {
    return this.inputBus;
  }

  getReturnOutput() {
    return this.returnGain;
  }

  // ========== CONTROLS ==========
  setReturnLevel(value) {
    this.returnGain.gain.value = Math.max(0, Math.min(1, value));
  }

  // ========== STATE MANAGEMENT ==========
  getState() {
    const state = {
      returnLevel: this.returnGain.gain.value,
      effect: {}
    };

    // Try to get effect state if available
    if (this.effect.getState) {
      state.effect = this.effect.getState();
    }

    return state;
  }

  setState(state) {
    if (state.returnLevel !== undefined) {
      this.setReturnLevel(state.returnLevel);
    }

    if (state.effect && this.effect.setState) {
      this.effect.setState(state.effect);
    }
  }

  // ========== CLEANUP ==========
  dispose() {
    this.inputBus.disconnect();
    this.returnGain.disconnect();

    if (this.effect.dispose) {
      this.effect.dispose();
    } else if (this.effect.destroy) {
      this.effect.destroy();
    }
  }
}
