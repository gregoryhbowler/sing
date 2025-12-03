// MixerChannel.js
// Per-voice mixer channel with EQ, saturation, sends, and fader

export class MixerChannel {
  constructor(audioContext, index, { DJEqualizerClass, SaturationEffectClass }) {
    this.ctx = audioContext;
    this.index = index;

    // ========== INPUT ==========
    this.input = audioContext.createGain();
    this.input.gain.value = 1;

    // ========== DJ EQ ==========
    this.djEQ = new DJEqualizerClass(audioContext);

    // ========== SATURATION ==========
    this.saturation = new SaturationEffectClass(audioContext);

    // ========== POST-FADER SPLIT (for sends) ==========
    this.postFaderSplit = audioContext.createGain();
    this.postFaderSplit.gain.value = 1;

    // ========== SEND GAINS ==========
    this.sendAGain = audioContext.createGain();
    this.sendBGain = audioContext.createGain();
    this.sendCGain = audioContext.createGain();
    this.sendAGain.gain.value = 0;
    this.sendBGain.gain.value = 0;
    this.sendCGain.gain.value = 0;

    // ========== CHANNEL STRIP ==========
    this.panner = audioContext.createStereoPanner();
    this.panner.pan.value = 0; // Center

    this.fader = audioContext.createGain();
    this.fader.gain.value = 0.8; // Default level

    // ========== MUTE/SOLO ==========
    this.muteGain = audioContext.createGain();
    this.muteGain.gain.value = 1;
    this.isMuted = false;
    this.isSolo = false;

    // ========== OUTPUT ==========
    this.output = audioContext.createGain();
    this.output.gain.value = 1;

    // ========== WIRE SIGNAL FLOW ==========
    // Input → EQ → Saturation → Panner → Fader → Post-fader split
    this.input.connect(this.djEQ.input);
    this.djEQ.output.connect(this.saturation.input);
    this.saturation.output.connect(this.panner);
    this.panner.connect(this.fader);
    this.fader.connect(this.postFaderSplit);

    // Sends (post-fader - respects channel level)
    this.postFaderSplit.connect(this.sendAGain);
    this.postFaderSplit.connect(this.sendBGain);
    this.postFaderSplit.connect(this.sendCGain);

    // Main path: Post-fader split → Mute → Output
    this.postFaderSplit.connect(this.muteGain);
    this.muteGain.connect(this.output);

    console.log(`✓ Mixer Channel ${index + 1} created`);
  }

  // ========== SEND OUTPUTS (for connecting to send buses) ==========
  getSendAOutput() {
    return this.sendAGain;
  }

  getSendBOutput() {
    return this.sendBGain;
  }

  getSendCOutput() {
    return this.sendCGain;
  }

  // ========== SEND CONTROLS ==========
  setSendA(value) {
    this.sendAGain.gain.value = Math.max(0, Math.min(1, value));
  }

  setSendB(value) {
    this.sendBGain.gain.value = Math.max(0, Math.min(1, value));
  }

  setSendC(value) {
    this.sendCGain.gain.value = Math.max(0, Math.min(1, value));
  }

  // ========== CHANNEL CONTROLS ==========
  setPan(value) {
    // -1 (left) to +1 (right)
    this.panner.pan.value = Math.max(-1, Math.min(1, value));
  }

  setLevel(value) {
    this.fader.gain.value = Math.max(0, Math.min(1, value));
  }

  setMute(muted) {
    this.isMuted = muted;
    this.updateMuteState();
  }

  setSolo(solo) {
    this.isSolo = solo;
    // Solo logic is handled externally by the mixer parent
  }

  updateMuteState(anySolo = false) {
    if (this.isMuted) {
      this.muteGain.gain.value = 0;
    } else if (anySolo && !this.isSolo) {
      this.muteGain.gain.value = 0; // Mute non-solo channels
    } else {
      this.muteGain.gain.value = 1;
    }
  }

  // ========== I/O ==========
  getInput() {
    return this.input;
  }

  getOutput() {
    return this.output;
  }

  // ========== STATE MANAGEMENT ==========
  getState() {
    return {
      level: this.fader.gain.value,
      pan: this.panner.pan.value,
      mute: this.isMuted,
      solo: this.isSolo,
      sendA: this.sendAGain.gain.value,
      sendB: this.sendBGain.gain.value,
      sendC: this.sendCGain.gain.value,
      eq: this.djEQ.getState(),
      saturation: {
        mode: this.saturation.mode,
        drive: this.saturation.drive,
        bias: this.saturation.bias,
        mix: this.saturation.mix,
        harmonics: this.saturation.harmonics
      }
    };
  }

  setState(state) {
    if (state.level !== undefined) this.setLevel(state.level);
    if (state.pan !== undefined) this.setPan(state.pan);
    if (state.mute !== undefined) this.setMute(state.mute);
    if (state.solo !== undefined) this.setSolo(state.solo);
    if (state.sendA !== undefined) this.setSendA(state.sendA);
    if (state.sendB !== undefined) this.setSendB(state.sendB);
    if (state.sendC !== undefined) this.setSendC(state.sendC);

    // EQ
    if (state.eq) {
      if (state.eq.low) {
        this.djEQ.setLowGain(state.eq.low.gain);
        this.djEQ.setLowKill(state.eq.low.killed);
      }
      if (state.eq.mid) {
        this.djEQ.setMidGain(state.eq.mid.gain);
        this.djEQ.setMidKill(state.eq.mid.killed);
      }
      if (state.eq.high) {
        this.djEQ.setHighGain(state.eq.high.gain);
        this.djEQ.setHighKill(state.eq.high.killed);
      }
    }

    // Saturation
    if (state.saturation) {
      if (state.saturation.mode) this.saturation.setMode(state.saturation.mode);
      if (state.saturation.drive !== undefined) this.saturation.setDrive(state.saturation.drive);
      if (state.saturation.bias !== undefined) this.saturation.setBias(state.saturation.bias);
      if (state.saturation.mix !== undefined) this.saturation.setMix(state.saturation.mix);
      if (state.saturation.harmonics) this.saturation.setHarmonics(state.saturation.harmonics);
    }
  }

  // ========== CLEANUP ==========
  dispose() {
    this.input.disconnect();
    this.djEQ.destroy();
    // Saturation doesn't have a destroy method in the existing code
    try {
      this.saturation.input.disconnect();
      this.saturation.output.disconnect();
    } catch (e) {}
    this.postFaderSplit.disconnect();
    this.sendAGain.disconnect();
    this.sendBGain.disconnect();
    this.sendCGain.disconnect();
    this.panner.disconnect();
    this.fader.disconnect();
    this.muteGain.disconnect();
    this.output.disconnect();
  }
}
