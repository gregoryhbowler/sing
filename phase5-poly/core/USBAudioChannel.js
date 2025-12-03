// USBAudioChannel.js
// External audio input channel (USB/microphone) with full mixer strip

import { MixerChannel } from './MixerChannel.js';

export class USBAudioChannel {
  constructor(audioContext, { DJEqualizerClass, SaturationEffectClass }) {
    this.ctx = audioContext;
    this.enabled = false;
    this.mediaStream = null;
    this.mediaSource = null;
    this.selectedDeviceId = null;
    this.availableDevices = [];

    // Create mixer channel with index 4 (USB channel)
    this.mixerChannel = new MixerChannel(audioContext, 4, {
      DJEqualizerClass,
      SaturationEffectClass
    });

    // Set initial level to 0 (off until enabled)
    this.mixerChannel.setLevel(0);

    // Input gain for external audio (before mixer channel)
    this.inputGain = audioContext.createGain();
    this.inputGain.gain.value = 1;
    this.inputGain.connect(this.mixerChannel.getInput());

    console.log('✓ USB Audio Channel created');
  }

  // ========== DEVICE MANAGEMENT ==========
  async enumerateDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.availableDevices = devices.filter(device => device.kind === 'audioinput');
      console.log('Available audio inputs:', this.availableDevices.map(d => d.label || d.deviceId));
      return this.availableDevices;
    } catch (err) {
      console.error('Failed to enumerate devices:', err);
      return [];
    }
  }

  async enable(deviceId = null) {
    if (this.enabled) {
      await this.disable();
    }

    try {
      // Request audio context resume if needed
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }

      // Build constraints
      const constraints = {
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      };

      // Add device selection if specified
      if (deviceId) {
        constraints.audio.deviceId = { exact: deviceId };
        this.selectedDeviceId = deviceId;
      }

      // Get media stream
      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.mediaSource = this.ctx.createMediaStreamSource(this.mediaStream);
      this.mediaSource.connect(this.inputGain);

      this.enabled = true;
      console.log('✓ USB Audio enabled');

      // Set default level when enabled
      if (this.mixerChannel.fader.gain.value === 0) {
        this.mixerChannel.setLevel(0.8);
      }

      return true;
    } catch (err) {
      console.error('Failed to enable USB audio:', err);
      this.enabled = false;
      return false;
    }
  }

  async disable() {
    if (this.mediaSource) {
      this.mediaSource.disconnect();
      this.mediaSource = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    this.enabled = false;
    console.log('✓ USB Audio disabled');
  }

  async selectDevice(deviceId) {
    if (this.enabled) {
      // Re-enable with new device
      return await this.enable(deviceId);
    } else {
      this.selectedDeviceId = deviceId;
      return true;
    }
  }

  // ========== MIXER CHANNEL PASSTHROUGH ==========
  getInput() {
    return this.inputGain;
  }

  getOutput() {
    return this.mixerChannel.getOutput();
  }

  getSendAOutput() {
    return this.mixerChannel.getSendAOutput();
  }

  getSendBOutput() {
    return this.mixerChannel.getSendBOutput();
  }

  getSendCOutput() {
    return this.mixerChannel.getSendCOutput();
  }

  setLevel(value) {
    this.mixerChannel.setLevel(value);
  }

  setPan(value) {
    this.mixerChannel.setPan(value);
  }

  setSendA(value) {
    this.mixerChannel.setSendA(value);
  }

  setSendB(value) {
    this.mixerChannel.setSendB(value);
  }

  setSendC(value) {
    this.mixerChannel.setSendC(value);
  }

  setMute(muted) {
    this.mixerChannel.setMute(muted);
  }

  setSolo(solo) {
    this.mixerChannel.setSolo(solo);
  }

  updateMuteState(anySolo) {
    this.mixerChannel.updateMuteState(anySolo);
  }

  // Input gain control (pre-mixer)
  setInputGain(value) {
    this.inputGain.gain.value = Math.max(0, Math.min(2, value));
  }

  // Access to saturation and EQ
  get saturation() {
    return this.mixerChannel.saturation;
  }

  get djEQ() {
    return this.mixerChannel.djEQ;
  }

  get fader() {
    return this.mixerChannel.fader;
  }

  get panner() {
    return this.mixerChannel.panner;
  }

  get isMuted() {
    return this.mixerChannel.isMuted;
  }

  get isSolo() {
    return this.mixerChannel.isSolo;
  }

  // ========== STATE MANAGEMENT ==========
  getState() {
    return {
      enabled: this.enabled,
      selectedDeviceId: this.selectedDeviceId,
      inputGain: this.inputGain.gain.value,
      mixer: this.mixerChannel.getState()
    };
  }

  setState(state) {
    if (state.inputGain !== undefined) {
      this.setInputGain(state.inputGain);
    }

    if (state.mixer) {
      this.mixerChannel.setState(state.mixer);
    }

    // Note: We don't auto-enable on state restore for security reasons
    // User must explicitly enable USB audio
    if (state.selectedDeviceId) {
      this.selectedDeviceId = state.selectedDeviceId;
    }
  }

  // ========== CLEANUP ==========
  dispose() {
    this.disable();
    this.inputGain.disconnect();
    this.mixerChannel.dispose();
  }
}
