// MIDIManager.js
// Handles MIDI input for 4-voice polyphony with MIDI clock support

export class MIDIManager {
  constructor() {
    this.access = null;
    this.inputs = [];
    this.voices = []; // Array of Voice instances
    this.isConnected = false;

    // Clock callbacks
    this.onClockTick = null; // Called at divided rate (for transpose sequencers)
    this.onBaseClockTick = null; // Called at base rate (for LFOs)
    this.onStart = null;
    this.onStop = null;
    this.onContinue = null;

    // MIDI clock division (ticks per step)
    // MIDI clock runs at 24 ppqn (pulses per quarter note)
    this.clockDivision = 6; // Default: 1/16 note (6 ticks) for transpose sequencers
    this.clockCount = 0;
    this.isRunning = false;

    // MIDI Learn system
    this.midiLearnMode = false;
    this.midiLearnTarget = null; // { element, parameterId, callback }
    this.midiMappings = new Map(); // Map of "channel:cc" -> { parameterId, element, callback, min, max }
    this.onMidiLearnComplete = null; // Callback when learn completes
    this.onMidiLearnCancel = null; // Callback when learn is cancelled

    // Load saved mappings from localStorage
    this.loadMappings();
  }

  async init() {
    try {
      this.access = await navigator.requestMIDIAccess();
      this.access.onstatechange = (e) => this.handleStateChange(e);
      this.scanInputs();
      this.isConnected = true;
      console.log('✓ MIDI initialized');
      return true;
    } catch (err) {
      console.error('MIDI access denied:', err);
      this.isConnected = false;
      return false;
    }
  }

  scanInputs() {
    this.inputs = [];
    for (let input of this.access.inputs.values()) {
      input.onmidimessage = (msg) => this.handleMessage(msg);
      this.inputs.push(input);
      console.log(`MIDI Input: ${input.name}`);
    }
  }

  handleStateChange(e) {
    console.log(`MIDI ${e.port.type} ${e.port.state}: ${e.port.name}`);
    this.scanInputs();
  }

  setVoices(voices) {
    if (voices.length !== 4) {
      console.error('MIDIManager requires exactly 4 voices');
      return;
    }
    this.voices = voices;
    console.log('✓ MIDI voices assigned (channels 1-4)');
  }

  setClockDivision(ticks) {
    // Common divisions:
    // 6 = 1/16 note
    // 12 = 1/8 note
    // 24 = 1/4 note
    this.clockDivision = Math.max(1, Math.round(ticks));
    console.log(`MIDI clock division: ${ticks} ticks/step`);
  }

  handleMessage(msg) {
    const [status, data1, data2] = msg.data;

    // Debug: Log all incoming MIDI messages when in learn mode
    if (this.midiLearnMode) {
      const command = status >> 4;
      const channel = (status & 0x0F) + 1;
      console.log(`🎹 MIDI IN: status=0x${status.toString(16)} cmd=${command} ch=${channel} data1=${data1} data2=${data2}`);
    }

    // ========== CHANNEL MESSAGES ==========
    if (status < 0xF0) {
      const channel = (status & 0x0F) + 1; // 1-16
      const command = status >> 4;

      // Handle CC messages from ALL channels (for MIDI Learn and mapped parameters)
      if (command === 0xB) {
        // Get voice for channels 1-4, null for others
        const voice = (channel >= 1 && channel <= 4) ? this.voices[channel - 1] : null;
        this.handleCC(voice, channel, data1, data2);
      }

      // Handle note and pitch bend only for channels 1-4
      if (channel >= 1 && channel <= 4) {
        const voice = this.voices[channel - 1];
        if (!voice) return;

        switch (command) {
          case 0x9: // Note On
            if (data2 > 0) {
              voice.noteOn(data1, data2);
            } else {
              voice.noteOff(data1); // Velocity 0 = note off
            }
            break;

          case 0x8: // Note Off
            voice.noteOff(data1);
            break;

          case 0xE: // Pitch Bend
            this.handlePitchBend(voice, channel, data1, data2);
            break;
        }
      }
    }

    // ========== SYSTEM MESSAGES ==========
    switch (status) {
      case 0xF8: // MIDI Clock (24 ppqn)
        this.handleClock();
        break;

      case 0xFA: // Start
        this.clockCount = 0;
        this.isRunning = true;
        if (this.onStart) this.onStart();
        console.log('MIDI Start');
        break;

      case 0xFC: // Stop
        this.isRunning = false;
        if (this.onStop) this.onStop();
        console.log('MIDI Stop');
        break;

      case 0xFB: // Continue
        this.isRunning = true;
        if (this.onContinue) this.onContinue();
        console.log('MIDI Continue');
        break;
    }
  }

  handleClock() {
    if (!this.isRunning) return;

    this.clockCount++;

    // Fire base clock tick on every MIDI clock (24 ppqn)
    // LFOs use this for independent timing
    if (this.onBaseClockTick) {
      this.onBaseClockTick();
    }

    // Fire divided clock tick (for transpose sequencers)
    if (this.clockCount >= this.clockDivision) {
      this.clockCount = 0;

      if (this.onClockTick) {
        this.onClockTick();
      }
    }
  }

  handleCC(voice, channel, cc, value) {
    const normalized = value / 127;

    // Check if we're in MIDI Learn mode
    if (this.midiLearnMode && this.midiLearnTarget) {
      this.completeMidiLearn(channel, cc);
      return;
    }

    // Check for user-defined MIDI mappings (these take priority)
    const mappingKey = `${channel}:${cc}`;
    const mapping = this.midiMappings.get(mappingKey);
    if (mapping && mapping.callback) {
      // Scale MIDI value (0-127) to parameter range
      const scaledValue = mapping.min + normalized * (mapping.max - mapping.min);
      mapping.callback(scaledValue);

      // Update the UI element if it exists
      if (mapping.element) {
        mapping.element.value = scaledValue;
        // Dispatch input event so UI updates
        mapping.element.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return;
    }

    // Default CC mappings (only if no user mapping exists and voice is valid)
    if (!voice) return;

    switch (cc) {
      case 1: // Mod Wheel → Filter cutoff
        if (voice.filter && voice.filter.setCutoff) {
          voice.filter.setCutoff(20 + normalized * 19980);
        }
        break;

      case 74: // Brightness → Filter cutoff
        if (voice.filter && voice.filter.setCutoff) {
          voice.filter.setCutoff(20 + normalized * 19980);
        }
        break;

      case 71: // Resonance → Filter resonance
        if (voice.filter && voice.filter.setResonance) {
          voice.filter.setResonance(normalized);
        }
        break;
    }
  }

  handlePitchBend(voice, channel, lsb, msb) {
    // Pitch bend: 14-bit value (0-16383, center = 8192)
    const bendValue = (msb << 7) | lsb;
    const normalized = (bendValue - 8192) / 8192; // -1 to +1

    // Typical pitch bend range is ±2 semitones
    const semitones = normalized * 2;
    const cv = semitones / 12; // Convert to 1V/oct

    // Apply to quantizer offset
    if (voice.quantizer) {
      voice.quantizer.setOffset(cv);
    }
  }

  getInputNames() {
    return this.inputs.map(i => i.name);
  }

  getConnectionStatus() {
    return {
      connected: this.isConnected,
      inputCount: this.inputs.length,
      voiceCount: this.voices.length,
      clockDivision: this.clockDivision,
      isRunning: this.isRunning
    };
  }

  dispose() {
    if (this.access) {
      for (let input of this.inputs) {
        input.onmidimessage = null;
      }
    }
  }

  // ========== MIDI LEARN SYSTEM ==========

  /**
   * Start MIDI Learn mode for a parameter
   * @param {string} parameterId - Unique identifier for this parameter
   * @param {HTMLElement} element - The slider/knob element
   * @param {Function} callback - Function to call with new values
   * @param {number} min - Minimum value for the parameter
   * @param {number} max - Maximum value for the parameter
   */
  startMidiLearn(parameterId, element, callback, min = 0, max = 1) {
    this.midiLearnMode = true;
    this.midiLearnTarget = {
      parameterId,
      element,
      callback,
      min,
      max
    };
    console.log(`🎹 MIDI Learn: Waiting for CC message for "${parameterId}"...`);
  }

  /**
   * Cancel MIDI Learn mode
   */
  cancelMidiLearn() {
    this.midiLearnMode = false;
    this.midiLearnTarget = null;
    if (this.onMidiLearnCancel) {
      this.onMidiLearnCancel();
    }
    console.log('🎹 MIDI Learn cancelled');
  }

  /**
   * Complete MIDI Learn - called when a CC is received during learn mode
   */
  completeMidiLearn(channel, cc) {
    if (!this.midiLearnTarget) return;

    const mappingKey = `${channel}:${cc}`;
    const { parameterId, element, callback, min, max } = this.midiLearnTarget;

    // Remove any existing mapping for this CC
    this.midiMappings.delete(mappingKey);

    // Remove any existing mapping for this parameter (so one param can only have one CC)
    for (const [key, mapping] of this.midiMappings.entries()) {
      if (mapping.parameterId === parameterId) {
        this.midiMappings.delete(key);
      }
    }

    // Create new mapping
    this.midiMappings.set(mappingKey, {
      parameterId,
      element,
      callback,
      min,
      max,
      channel,
      cc
    });

    console.log(`🎹 MIDI Learn: Mapped Ch${channel} CC${cc} → "${parameterId}"`);

    // Save mappings to localStorage
    this.saveMappings();

    // Exit learn mode
    this.midiLearnMode = false;
    const completedTarget = this.midiLearnTarget;
    this.midiLearnTarget = null;

    // Notify completion
    if (this.onMidiLearnComplete) {
      this.onMidiLearnComplete(channel, cc, completedTarget);
    }
  }

  /**
   * Remove a MIDI mapping by parameter ID
   */
  removeMidiMapping(parameterId) {
    for (const [key, mapping] of this.midiMappings.entries()) {
      if (mapping.parameterId === parameterId) {
        this.midiMappings.delete(key);
        console.log(`🎹 Removed MIDI mapping for "${parameterId}"`);
        this.saveMappings();
        return true;
      }
    }
    return false;
  }

  /**
   * Get the MIDI mapping for a parameter
   */
  getMidiMappingForParameter(parameterId) {
    for (const mapping of this.midiMappings.values()) {
      if (mapping.parameterId === parameterId) {
        return mapping;
      }
    }
    return null;
  }

  /**
   * Save mappings to localStorage
   */
  saveMappings() {
    const mappingsArray = [];
    for (const [key, mapping] of this.midiMappings.entries()) {
      mappingsArray.push({
        key,
        parameterId: mapping.parameterId,
        min: mapping.min,
        max: mapping.max,
        channel: mapping.channel,
        cc: mapping.cc
      });
    }
    localStorage.setItem('phase5poly_midi_mappings', JSON.stringify(mappingsArray));
  }

  /**
   * Load mappings from localStorage (only metadata, callbacks must be re-registered)
   */
  loadMappings() {
    try {
      const saved = localStorage.getItem('phase5poly_midi_mappings');
      if (saved) {
        const mappingsArray = JSON.parse(saved);
        // Store as pending mappings - callbacks will be registered later by UI
        this.pendingMappings = new Map();
        for (const m of mappingsArray) {
          this.pendingMappings.set(m.key, {
            parameterId: m.parameterId,
            min: m.min,
            max: m.max,
            channel: m.channel,
            cc: m.cc,
            element: null,
            callback: null
          });
        }
        console.log(`🎹 Loaded ${mappingsArray.length} MIDI mappings from storage`);
      }
    } catch (e) {
      console.warn('Failed to load MIDI mappings:', e);
    }
  }

  /**
   * Register a parameter's callback for a previously saved mapping
   * Called by UI when setting up sliders
   */
  registerMappingCallback(parameterId, element, callback, min = 0, max = 1) {
    if (!this.pendingMappings) return false;

    for (const [key, mapping] of this.pendingMappings.entries()) {
      if (mapping.parameterId === parameterId) {
        // Move from pending to active mappings
        this.midiMappings.set(key, {
          ...mapping,
          element,
          callback,
          min,
          max
        });
        this.pendingMappings.delete(key);
        return true;
      }
    }
    return false;
  }

  /**
   * Get all current mappings for display
   */
  getAllMappings() {
    const result = [];
    for (const [key, mapping] of this.midiMappings.entries()) {
      result.push({
        key,
        channel: mapping.channel,
        cc: mapping.cc,
        parameterId: mapping.parameterId
      });
    }
    return result;
  }

  /**
   * Clear all MIDI mappings
   */
  clearAllMappings() {
    this.midiMappings.clear();
    this.saveMappings();
    console.log('🎹 All MIDI mappings cleared');
  }
}
