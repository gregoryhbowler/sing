// Phase5PolyApp.js
// Main application class for 4-voice polyphonic modular synthesis

import { Voice } from './Voice.js';
import { MIDIManager } from './MIDIManager.js';
import { MixerChannel } from './MixerChannel.js';
import { SendEffect } from './SendEffect.js';
import { USBAudioChannel } from './USBAudioChannel.js';

export class Phase5PolyApp {
  constructor(dependencies) {
    // Store class dependencies (injected from main.js)
    this.deps = dependencies;

    // Audio context
    this.audioContext = null;

    // Voice components
    this.voices = []; // 4 Voice instances
    this.mixerChannels = []; // 4 MixerChannel instances

    // FM Oscillators (4 Mangroves)
    this.fmOscillators = {
      A: null,
      B: null,
      C: null,
      D: null
    };

    // Send Effects
    this.sendEffects = {
      mimeophon: null,
      greyhole: null,
      zita: null
    };

    // USB Audio Channel (external audio input)
    this.usbAudioChannel = null;

    // LFOs (12 instances)
    this.lfos = [];

    // Clock sources
    this.jf1 = null; // Just Friends for internal clock
    this.clockSource = 'midi'; // 'midi', 'jf1', or 'internal'
    this.internalClockInterval = null; // Timer for internal clock
    this.internalClockBPM = 120; // Default BPM for internal clock
    this.internalClockDivision = 1; // Transpose seq division (1 = every 16th, 2 = every 8th, etc.)
    this.baseTickCount = 0; // Counter for base clock ticks

    // MIDI manager
    this.midiManager = null;

    // Master bus
    this.masterGain = null;
    this.masterBus = null;

    // Destination map for LFO routing
    this.destinationMap = {};

    // State
    this.isInitialized = false;
  }

  async init() {
    console.log('='.repeat(60));
    console.log('PHASE 5 POLY - 4-Voice Polyphonic Synthesis');
    console.log('='.repeat(60));

    // Create audio context
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    console.log(`✓ AudioContext created (${this.audioContext.sampleRate} Hz)`);

    // Load all worklet processors
    await this.loadWorklets();

    // Create components
    this.createJF1();
    this.createFMOscillators();
    this.createVoices();
    this.createMixerChannels();
    this.createUSBAudioChannel();
    await this.createSendEffects();
    this.createLFOs();
    this.createMaster();

    // Wire audio routing
    this.routeAudio();

    // Build destination map for LFOs
    this.buildDestinationMap();

    // Initialize MIDI
    this.midiManager = new MIDIManager();
    await this.midiManager.init();
    this.midiManager.setVoices(this.voices);

    // Set up clock callbacks
    // Divided clock tick - for transpose sequencers (respects MIDI clock division)
    this.midiManager.onClockTick = () => {
      if (this.clockSource === 'midi') {
        this.voices.forEach(v => v.clockTick());
      }
    };

    // Base clock tick - for LFOs (every MIDI clock message, 24 ppqn)
    this.midiManager.onBaseClockTick = () => {
      if (this.clockSource === 'midi') {
        this.lfos.forEach(lfo => lfo.clockTick());
      }
    };

    // Initialize clock source (sets transpose sequencers to correct mode)
    // Default to internal clock since it works without external MIDI transport
    this.setClockSource('internal');

    this.isInitialized = true;
    console.log('='.repeat(60));
    console.log('✓ Phase 5 Poly initialized successfully');
    console.log('='.repeat(60));

    return true;
  }

  async loadWorklets() {
    console.log('Loading AudioWorklet processors...');

    const worklets = [
      '../mangrove-processor.js',
      '../just-friends-processor.js',
      '../just-friends-osc-processor.js',
      '../quantizer-processor.js',
      '../transpose-sequencer-processor.js',
      '../three-sisters-processor.js',
      '../moog-processor.js',
      '../wasp-processor.js',
      '../sem-processor.js',
      './modulators/ad-envelope-processor.js',
      '../lfo-processor.js',
      '../greyhole-processor.js',
      '../zita-reverb-processor.js'
    ];

    for (const worklet of worklets) {
      try {
        await this.audioContext.audioWorklet.addModule(worklet);
        console.log(`  ✓ ${worklet.split('/').pop()}`);
      } catch (err) {
        console.error(`  ✗ Failed to load ${worklet}:`, err);
      }
    }
  }

  createJF1() {
    // Just Friends #1 for internal clock generation
    this.jf1 = new this.deps.JustFriendsNode(this.audioContext);
    this.jf1.setMode(2); // Cycle mode (LFO)
    this.jf1.setRange(0); // Shape range (CV-rate, slower)
    this.jf1.params.time.value = 0.25; // Default tempo

    console.log('✓ Just Friends #1 (clock source) created');
  }

  createFMOscillators() {
    console.log('Creating FM oscillators...');

    this.fmOscillators.A = new this.deps.MangroveNode(this.audioContext);
    this.fmOscillators.B = new this.deps.MangroveNode(this.audioContext);
    this.fmOscillators.C = new this.deps.MangroveNode(this.audioContext);
    this.fmOscillators.D = new this.deps.MangroveNode(this.audioContext);

    // Set default formant to 0.48 (other params default to 0.5 in processor)
    ['A', 'B', 'C', 'D'].forEach(letter => {
      this.fmOscillators[letter].setFormant(0.48);
    });

    console.log('✓ 4 FM oscillators (Mangroves A, B, C, D) created');
  }

  createVoices() {
    console.log('Creating voices...');

    for (let i = 0; i < 4; i++) {
      const voice = new Voice(this.audioContext, i, {
        MangroveNodeClass: this.deps.MangroveNode,
        JustFriendsOscNodeClass: this.deps.JustFriendsOscNode,
        QuantizerNodeClass: this.deps.QuantizerNode,
        TransposeSequencerNodeClass: this.deps.TransposeSequencerNode,
        ThreeSistersNodeClass: this.deps.ThreeSistersNode
      });

      this.voices.push(voice);
    }

    console.log('✓ 4 voices created');
  }

  createMixerChannels() {
    console.log('Creating mixer channels...');

    for (let i = 0; i < 4; i++) {
      const channel = new MixerChannel(this.audioContext, i, {
        DJEqualizerClass: this.deps.DJEqualizer,
        SaturationEffectClass: this.deps.SaturationEffect
      });

      this.mixerChannels.push(channel);
    }

    console.log('✓ 4 mixer channels created');
  }

  createUSBAudioChannel() {
    this.usbAudioChannel = new USBAudioChannel(this.audioContext, {
      DJEqualizerClass: this.deps.DJEqualizer,
      SaturationEffectClass: this.deps.SaturationEffect
    });
  }

  async createSendEffects() {
    console.log('Creating send effects...');

    // Mimeophon (using existing standalone class)
    const mimeophonInstance = new this.deps.StandaloneMimeophon(this.audioContext);
    this.sendEffects.mimeophon = new SendEffect(
      this.audioContext,
      mimeophonInstance,
      'Mimeophon'
    );
    await this.sendEffects.mimeophon.wireEffect();

    // Greyhole
    const greyholeInstance = new this.deps.GreyholeNode(this.audioContext);
    this.sendEffects.greyhole = new SendEffect(
      this.audioContext,
      greyholeInstance,
      'Greyhole'
    );
    await this.sendEffects.greyhole.wireEffect();

    // Zita Reverb
    const zitaInstance = new this.deps.ZitaReverb(this.audioContext);
    this.sendEffects.zita = new SendEffect(
      this.audioContext,
      zitaInstance,
      'Zita'
    );
    await this.sendEffects.zita.wireEffect();

    console.log('✓ 3 send effects created');
  }

  createLFOs() {
    console.log('Creating LFOs...');

    for (let i = 0; i < 12; i++) {
      const lfo = new this.deps.LFONode(this.audioContext, i);
      this.lfos.push(lfo);
    }

    console.log('✓ 12 LFOs created');
  }

  createMaster() {
    // Master bus with gain control
    this.masterBus = this.audioContext.createGain();
    this.masterBus.gain.value = 1;

    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = 0.3; // Default master volume

    this.masterBus.connect(this.masterGain);
    this.masterGain.connect(this.audioContext.destination);

    console.log('✓ Master bus created');
  }

  routeAudio() {
    console.log('Routing audio...');

    // ========== VOICES → MIXER CHANNELS ==========
    this.voices.forEach((voice, i) => {
      voice.getOutput().connect(this.mixerChannels[i].getInput());
    });

    // ========== FM OSCILLATORS → VOICES ==========
    this.voices.forEach(voice => {
      // FM A & B → Oscillator FM
      this.fmOscillators.A.getFormantOutput().connect(voice.getFMOscAInput());
      this.fmOscillators.B.getFormantOutput().connect(voice.getFMOscBInput());

      // FM C & D → Filter FM
      this.fmOscillators.C.getFormantOutput().connect(voice.getFMFilterCInput());
      this.fmOscillators.D.getFormantOutput().connect(voice.getFMFilterDInput());
    });

    // ========== MIXER CHANNELS → SEND BUSES ==========
    const sendABus = this.sendEffects.mimeophon.getInputBus();
    const sendBBus = this.sendEffects.greyhole.getInputBus();
    const sendCBus = this.sendEffects.zita.getInputBus();

    this.mixerChannels.forEach(channel => {
      channel.getSendAOutput().connect(sendABus);
      channel.getSendBOutput().connect(sendBBus);
      channel.getSendCOutput().connect(sendCBus);
    });

    // ========== MIXER CHANNELS → MASTER BUS ==========
    this.mixerChannels.forEach(channel => {
      channel.getOutput().connect(this.masterBus);
    });

    // ========== USB AUDIO CHANNEL → SENDS & MASTER ==========
    this.usbAudioChannel.getSendAOutput().connect(sendABus);
    this.usbAudioChannel.getSendBOutput().connect(sendBBus);
    this.usbAudioChannel.getSendCOutput().connect(sendCBus);
    this.usbAudioChannel.getOutput().connect(this.masterBus);

    // ========== SEND RETURNS → MASTER BUS ==========
    this.sendEffects.mimeophon.getReturnOutput().connect(this.masterBus);
    this.sendEffects.greyhole.getReturnOutput().connect(this.masterBus);
    this.sendEffects.zita.getReturnOutput().connect(this.masterBus);

    // ========== CLOCK ROUTING (JF1) ==========
    // When clock source is JF1, connect its Identity output to transpose sequencers
    this.jf1.getIdentityOutput().connect(this.voices[0].transposeSeq.getClockInput());
    this.jf1.getIdentityOutput().connect(this.voices[1].transposeSeq.getClockInput());
    this.jf1.getIdentityOutput().connect(this.voices[2].transposeSeq.getClockInput());
    this.jf1.getIdentityOutput().connect(this.voices[3].transposeSeq.getClockInput());

    console.log('✓ Audio routing complete');
  }

  buildDestinationMap() {
    console.log('Building LFO destination map...');

    this.destinationMap = {};

    // Helper to add destination with optional scale factor
    // Scale determines how much a depth of 1.0 affects the parameter
    // Default scale of 1 works for 0-1 normalized params
    const addDest = (key, param, scale = 1) => {
      this.destinationMap[key] = { param, scale };
    };

    // ========== PER-VOICE DESTINATIONS ==========
    this.voices.forEach((voice, i) => {
      const prefix = `v${i + 1}`;

      // Quantizer (0-8 range for depth, -4 to 4 for offset)
      addDest(`${prefix}.quant.depth`, voice.quantizer.params.depth, 8);
      addDest(`${prefix}.quant.offset`, voice.quantizer.params.offset, 4);

      // Oscillator (Mangrove) - 0-1 normalized knobs
      addDest(`${prefix}.osc.pitch`, voice.mangrove.params.pitchKnob);
      addDest(`${prefix}.osc.barrel`, voice.mangrove.params.barrelKnob);
      addDest(`${prefix}.osc.formant`, voice.mangrove.params.formantKnob);
      addDest(`${prefix}.osc.air`, voice.mangrove.params.airKnob);

      // Oscillator (Just Friends) - 0-1 normalized
      addDest(`${prefix}.jfosc.time`, voice.jfOsc.params.time);
      addDest(`${prefix}.jfosc.intone`, voice.jfOsc.params.intone);
      addDest(`${prefix}.jfosc.ramp`, voice.jfOsc.params.ramp);
      addDest(`${prefix}.jfosc.curve`, voice.jfOsc.params.curve);

      // Envelope (attack/decay in seconds, scale to ~2s range)
      addDest(`${prefix}.env.attack`, voice.envelope.params.attack, 2);
      addDest(`${prefix}.env.decay`, voice.envelope.params.decay, 2);

      // Filters - Moog (cutoff 20-20000 Hz, use 10000 scale for useful sweep)
      addDest(`${prefix}.moog.cutoff`, voice.filters.moog.params.cutoff, 10000);
      addDest(`${prefix}.moog.resonance`, voice.filters.moog.params.resonance);
      addDest(`${prefix}.moog.drive`, voice.filters.moog.params.drive);
      addDest(`${prefix}.moog.warmth`, voice.filters.moog.params.warmth);

      // Filters - Wasp (cutoff 20-20000 Hz)
      addDest(`${prefix}.wasp.cutoff`, voice.filters.wasp.params.cutoff, 10000);
      addDest(`${prefix}.wasp.resonance`, voice.filters.wasp.params.resonance);
      addDest(`${prefix}.wasp.drive`, voice.filters.wasp.params.drive);
      addDest(`${prefix}.wasp.chaos`, voice.filters.wasp.params.chaos);

      // Filters - SEM (cutoff 20-20000 Hz, morph -1 to +1)
      addDest(`${prefix}.sem.cutoff`, voice.filters.sem.params.cutoff, 10000);
      addDest(`${prefix}.sem.resonance`, voice.filters.sem.params.resonance);
      addDest(`${prefix}.sem.morph`, voice.filters.sem.params.morph, 2); // -1 to +1 range
      addDest(`${prefix}.sem.drive`, voice.filters.sem.params.drive);

      // Filters - Three Sisters (freq is 0-1 knob)
      addDest(`${prefix}.3sis.freq`, voice.filters.threesisters.params.freq);
      addDest(`${prefix}.3sis.span`, voice.filters.threesisters.params.span);
      addDest(`${prefix}.3sis.quality`, voice.filters.threesisters.params.quality);
      addDest(`${prefix}.3sis.fmAtten`, voice.filters.threesisters.params.fmAttenuverter);

      // FM depths (0-1 range)
      addDest(`${prefix}.fmA.depth`, voice.fmOscAGain.gain);
      addDest(`${prefix}.fmB.depth`, voice.fmOscBGain.gain);
      addDest(`${prefix}.fmC.depth`, voice.fmFilterCGain.gain);
      addDest(`${prefix}.fmD.depth`, voice.fmFilterDGain.gain);

      // Mixer (level 0-1, pan -1 to +1)
      addDest(`${prefix}.mixer.level`, this.mixerChannels[i].fader.gain);
      addDest(`${prefix}.mixer.pan`, this.mixerChannels[i].panner.pan, 2); // -1 to +1
      addDest(`${prefix}.mixer.sendA`, this.mixerChannels[i].sendAGain.gain);
      addDest(`${prefix}.mixer.sendB`, this.mixerChannels[i].sendBGain.gain);
      addDest(`${prefix}.mixer.sendC`, this.mixerChannels[i].sendCGain.gain);
    });

    // ========== FM OSCILLATORS ==========
    ['A', 'B', 'C', 'D'].forEach(letter => {
      const fm = this.fmOscillators[letter];
      addDest(`fm${letter}.pitch`, fm.params.pitchKnob);
      addDest(`fm${letter}.barrel`, fm.params.barrelKnob);
      addDest(`fm${letter}.formant`, fm.params.formantKnob);
      addDest(`fm${letter}.air`, fm.params.airKnob);
    });

    // ========== USB AUDIO CHANNEL ==========
    addDest('usb.level', this.usbAudioChannel.fader.gain);
    addDest('usb.pan', this.usbAudioChannel.panner.pan, 2); // -1 to +1
    addDest('usb.sendA', this.usbAudioChannel.mixerChannel.sendAGain.gain);
    addDest('usb.sendB', this.usbAudioChannel.mixerChannel.sendBGain.gain);
    addDest('usb.sendC', this.usbAudioChannel.mixerChannel.sendCGain.gain);
    addDest('usb.inputGain', this.usbAudioChannel.inputGain.gain, 2); // 0-2 range

    // ========== GLOBAL ==========
    addDest('master.volume', this.masterGain.gain);
    addDest('jf1.time', this.jf1.params.time);
    addDest('jf1.intone', this.jf1.params.intone);
    addDest('jf1.ramp', this.jf1.params.ramp);
    addDest('jf1.curve', this.jf1.params.curve);

    // ========== LFO CROSS-MODULATION ==========
    this.lfos.forEach((lfo, i) => {
      addDest(`lfo${i + 1}.rate`, lfo.params.rate, 20); // 0-20 Hz range for cross-mod
      addDest(`lfo${i + 1}.phase`, lfo.params.phase);
    });

    console.log(`✓ Destination map built (${Object.keys(this.destinationMap).length} destinations)`);
  }

  // ========== CLOCK SOURCE CONTROL ==========
  setClockSource(source) {
    if (source !== 'midi' && source !== 'jf1' && source !== 'internal') {
      console.error('Invalid clock source:', source);
      return;
    }

    // Stop internal clock if switching away from it
    if (this.clockSource === 'internal' && source !== 'internal') {
      this.stopInternalClock();
    }

    this.clockSource = source;

    if (source === 'jf1') {
      // JF1 is already routed to transpose sequencers
      // Set transpose sequencers to use JF clock mode
      this.voices.forEach(v => {
        v.transposeSeq.setClockSource('jf');
      });
      console.log('Clock source: Just Friends #1');
    } else if (source === 'internal') {
      // Internal timer-based clock
      this.voices.forEach(v => {
        v.transposeSeq.setClockSource('rene'); // Use external trigger mode
      });
      this.startInternalClock();
      console.log(`Clock source: Internal (${this.internalClockBPM} BPM)`);
    } else {
      // MIDI clock mode - handled by MIDI Manager
      this.stopInternalClock(); // Stop internal clock when switching to MIDI
      this.voices.forEach(v => {
        v.transposeSeq.setClockSource('rene'); // Using 'rene' mode for external triggering
      });
      console.log('Clock source: MIDI Clock');
    }
  }

  startInternalClock() {
    this.stopInternalClock(); // Ensure no duplicate timers

    // Base clock runs at 16th note intervals (4 ticks per beat)
    // This gives us a consistent base rate for all clock consumers
    // Each consumer (transpose seq, LFOs) can then subdivide as needed
    const baseTicksPerBeat = 4; // 16th notes
    const baseIntervalMs = (60000 / this.internalClockBPM) / baseTicksPerBeat;

    // Track tick counts for division
    this.baseTickCount = 0;

    this.internalClockInterval = setInterval(() => {
      this.baseTickCount++;

      // Transpose sequencers use their own division
      // internalClockDivision: 1 = every tick, 2 = every 2nd tick, 4 = every 4th, etc.
      if (this.baseTickCount % this.internalClockDivision === 0) {
        this.voices.forEach(v => v.clockTick());
      }

      // LFOs always receive every base tick - they handle their own division internally
      this.lfos.forEach(lfo => lfo.clockTick());
    }, baseIntervalMs);

    console.log(`Internal clock started: ${baseIntervalMs.toFixed(1)}ms base tick, transpose div: ${this.internalClockDivision}`);
  }

  stopInternalClock() {
    if (this.internalClockInterval) {
      clearInterval(this.internalClockInterval);
      this.internalClockInterval = null;
    }
    this.baseTickCount = 0;
  }

  setInternalClockBPM(bpm) {
    this.internalClockBPM = Math.max(30, Math.min(300, bpm));
    if (this.clockSource === 'internal') {
      this.startInternalClock(); // Restart with new BPM
    }
  }

  setInternalClockDivision(division) {
    // This now only affects transpose sequencers, not LFOs
    this.internalClockDivision = Math.max(1, Math.min(16, division));
    // No need to restart clock - division is checked on each tick
    console.log(`Transpose sequencer division set to: ${division}`);
  }

  resetClock() {
    // Reset all transpose sequencers to step 0
    this.voices.forEach(v => {
      v.transposeSeq.reset();
    });
    // Reset internal clock tick counter
    this.baseTickCount = 0;
    // Reset MIDI clock counter
    if (this.midiManager) {
      this.midiManager.clockCount = 0;
    }
    console.log('Clock reset - all sequencers returned to step 0');
  }

  // ========== SOLO MANAGEMENT ==========
  updateSoloStates() {
    const anySolo = this.mixerChannels.some(ch => ch.isSolo) || this.usbAudioChannel.isSolo;
    this.mixerChannels.forEach(ch => ch.updateMuteState(anySolo));
    this.usbAudioChannel.updateMuteState(anySolo);
  }

  // ========== STATE MANAGEMENT ==========
  getState() {
    return {
      version: '2.0',
      name: 'Untitled Patch',
      created: new Date().toISOString(),
      clockSource: this.clockSource,
      masterVolume: this.masterGain.gain.value,

      // Clock settings
      internalClockBPM: this.internalClockBPM,
      internalClockDivision: this.internalClockDivision,
      midiClockDivision: this.midiManager ? this.midiManager.clockDivision : 6,

      voices: this.voices.map(v => v.getState()),
      mixerChannels: this.mixerChannels.map(ch => ch.getState()),
      usbAudioChannel: this.usbAudioChannel.getState(),

      fmOscillators: {
        A: {
          pitch: this.fmOscillators.A.params.pitchKnob.value,
          barrel: this.fmOscillators.A.params.barrelKnob.value,
          formant: this.fmOscillators.A.params.formantKnob.value,
          air: this.fmOscillators.A.params.airKnob.value
        },
        B: {
          pitch: this.fmOscillators.B.params.pitchKnob.value,
          barrel: this.fmOscillators.B.params.barrelKnob.value,
          formant: this.fmOscillators.B.params.formantKnob.value,
          air: this.fmOscillators.B.params.airKnob.value
        },
        C: {
          pitch: this.fmOscillators.C.params.pitchKnob.value,
          barrel: this.fmOscillators.C.params.barrelKnob.value,
          formant: this.fmOscillators.C.params.formantKnob.value,
          air: this.fmOscillators.C.params.airKnob.value
        },
        D: {
          pitch: this.fmOscillators.D.params.pitchKnob.value,
          barrel: this.fmOscillators.D.params.barrelKnob.value,
          formant: this.fmOscillators.D.params.formantKnob.value,
          air: this.fmOscillators.D.params.airKnob.value
        }
      },

      sendEffects: {
        mimeophon: this.sendEffects.mimeophon.getState(),
        greyhole: this.sendEffects.greyhole.getState(),
        zita: this.sendEffects.zita.getState()
      },

      lfos: this.lfos.map(lfo => ({
        rate: lfo.params.rate.value,
        waveform: lfo.params.waveform.value,
        phase: lfo.params.phase.value,
        clockSync: lfo.getClockSyncState(),
        destinations: [
          lfo.getDestinationInfo(0),
          lfo.getDestinationInfo(1)
        ]
      }))
    };
  }

  setState(state) {
    // Clock settings (restore before clockSource so internal clock uses correct values)
    if (state.internalClockBPM !== undefined) this.internalClockBPM = state.internalClockBPM;
    if (state.internalClockDivision !== undefined) this.internalClockDivision = state.internalClockDivision;
    if (state.midiClockDivision !== undefined && this.midiManager) {
      this.midiManager.setClockDivision(state.midiClockDivision);
    }

    if (state.clockSource) this.setClockSource(state.clockSource);
    if (state.masterVolume !== undefined) this.masterGain.gain.value = state.masterVolume;

    if (state.voices) {
      state.voices.forEach((voiceState, i) => {
        if (this.voices[i]) {
          this.voices[i].setState(voiceState);
        }
      });
    }

    if (state.mixerChannels) {
      state.mixerChannels.forEach((chState, i) => {
        if (this.mixerChannels[i]) {
          this.mixerChannels[i].setState(chState);
        }
      });
    }

    if (state.usbAudioChannel) {
      this.usbAudioChannel.setState(state.usbAudioChannel);
    }

    if (state.fmOscillators) {
      ['A', 'B', 'C', 'D'].forEach(letter => {
        const fmState = state.fmOscillators[letter];
        const fm = this.fmOscillators[letter];
        if (fmState && fm) {
          if (fmState.pitch !== undefined) fm.params.pitchKnob.value = fmState.pitch;
          if (fmState.barrel !== undefined) fm.params.barrelKnob.value = fmState.barrel;
          if (fmState.formant !== undefined) fm.params.formantKnob.value = fmState.formant;
          if (fmState.air !== undefined) fm.params.airKnob.value = fmState.air;
        }
      });
    }

    if (state.sendEffects) {
      if (state.sendEffects.mimeophon) this.sendEffects.mimeophon.setState(state.sendEffects.mimeophon);
      if (state.sendEffects.greyhole) this.sendEffects.greyhole.setState(state.sendEffects.greyhole);
      if (state.sendEffects.zita) this.sendEffects.zita.setState(state.sendEffects.zita);
    }

    if (state.lfos) {
      state.lfos.forEach((lfoState, i) => {
        if (this.lfos[i]) {
          if (lfoState.rate !== undefined) this.lfos[i].setRate(lfoState.rate);
          if (lfoState.waveform !== undefined) this.lfos[i].setWaveform(lfoState.waveform);
          if (lfoState.phase !== undefined) this.lfos[i].setPhase(lfoState.phase);
          // Restore clock sync state
          if (lfoState.clockSync) {
            if (lfoState.clockSync.division !== undefined) {
              this.lfos[i].setClockDivision(lfoState.clockSync.division);
            }
            if (lfoState.clockSync.enabled) {
              this.lfos[i].enableClockSync();
            } else {
              this.lfos[i].disableClockSync();
            }
          }
          // LFO destinations are restored separately via UI
        }
      });
    }
  }

  // ========== AUDIO CONTROL ==========
  async start() {
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    console.log('✓ Audio started');
  }

  stop() {
    if (this.audioContext.state === 'running') {
      this.audioContext.suspend();
    }
    console.log('✓ Audio stopped');
  }

  dispose() {
    console.log('Disposing Phase 5 Poly...');

    this.stopInternalClock(); // Stop internal clock timer

    this.voices.forEach(v => v.dispose());
    this.mixerChannels.forEach(ch => ch.dispose());
    if (this.usbAudioChannel) this.usbAudioChannel.dispose();

    Object.values(this.fmOscillators).forEach(fm => fm.dispose());
    Object.values(this.sendEffects).forEach(fx => fx.dispose());

    this.lfos.forEach(lfo => lfo.dispose());

    if (this.jf1) this.jf1.dispose();
    if (this.midiManager) this.midiManager.dispose();

    if (this.audioContext) {
      this.audioContext.close();
    }

    console.log('✓ Phase 5 Poly disposed');
  }
}
