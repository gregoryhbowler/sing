// Voice.js
// Complete polyphonic voice with oscillator, filter, envelope, quantizer, and transpose sequencer

import { MoogFilter } from '../filters/MoogFilter.js';
import { WaspFilter } from '../filters/WaspFilter.js';
import { SEMFilter } from '../filters/SEMFilter.js';
import { ThreeSistersFilter } from '../filters/ThreeSistersFilter.js';
import { ADEnvelopeNode } from '../modulators/ADEnvelopeNode.js';

export class Voice {
  constructor(audioContext, index, {
    MangroveNodeClass,
    JustFriendsOscNodeClass,
    QuantizerNodeClass,
    TransposeSequencerNodeClass,
    ThreeSistersNodeClass
  }) {
    this.ctx = audioContext;
    this.index = index;
    this.enabled = true;
    this.currentNote = -1;

    // ========== TRANSPOSE SEQUENCER ==========
    this.transposeSeq = new TransposeSequencerNodeClass(audioContext);

    // ========== QUANTIZER ==========
    this.quantizer = new QuantizerNodeClass(audioContext);

    // ========== OSCILLATORS ==========
    this.oscillatorType = 'mangrove'; // or 'justfriends'
    this.mangrove = new MangroveNodeClass(audioContext);
    this.jfOsc = new JustFriendsOscNodeClass(audioContext);
    this.oscillator = this.mangrove;

    // Set Mangrove defaults (formant=0.48, others default to 0.5 in processor)
    this.mangrove.setFormant(0.48);

    // ========== FILTERS ==========
    this.filterType = 'moog'; // or 'wasp', 'sem', 'threesisters'
    this.filters = {
      moog: new MoogFilter(audioContext),
      wasp: new WaspFilter(audioContext),
      sem: new SEMFilter(audioContext),
      threesisters: new ThreeSistersFilter(audioContext, ThreeSistersNodeClass)
    };
    this.filter = this.filters.moog;

    // ========== ENVELOPE & VCA ==========
    this.envelope = new ADEnvelopeNode(audioContext);
    this.vca = audioContext.createGain();
    this.vca.gain.value = 0; // Controlled by envelope

    // ========== OUTPUT GAIN ==========
    this.output = audioContext.createGain();
    this.output.gain.value = 1;

    // ========== FM INPUT GAINS ==========
    // For oscillator FM (from FM A & B)
    this.fmOscAGain = audioContext.createGain();
    this.fmOscBGain = audioContext.createGain();
    this.fmOscAGain.gain.value = 0;
    this.fmOscBGain.gain.value = 0;

    // For filter FM (from FM C & D)
    this.fmFilterCGain = audioContext.createGain();
    this.fmFilterDGain = audioContext.createGain();
    this.fmFilterCGain.gain.value = 0;
    this.fmFilterDGain.gain.value = 0;

    // ========== TRANSPOSE ROUTING ==========
    // Transpose sequencer output → quantizer transpose input
    this.transposeGain = audioContext.createGain();
    this.transposeGain.gain.value = 12; // Scale to semitones

    // ========== MIDI NOTE CV ==========
    // We need a constant source to hold the incoming MIDI note pitch
    this.noteCV = audioContext.createConstantSource();
    this.noteCV.offset.value = 0; // 1V/oct (0 = C4)
    this.noteCV.start();

    // ========== WIRE SIGNAL PATH ==========
    this.wireSignalPath();

    console.log(`✓ Voice ${index + 1} created`);
  }

  wireSignalPath() {
    // ===== PITCH PATH =====
    // Note CV + Transpose → Quantizer → Oscillators
    this.noteCV.connect(this.quantizer.getInput());
    this.transposeSeq.getTransposeOutput().connect(this.transposeGain);
    this.transposeGain.connect(this.quantizer.params.transpose);

    // Quantizer output → Both oscillators (only active one plays)
    this.quantizer.getOutput().connect(this.mangrove.getPitchCVInput());
    this.quantizer.getOutput().connect(this.jfOsc.getTimeCVInput());

    // ===== FM ROUTING =====
    // FM A & B → Oscillator FM inputs
    this.fmOscAGain.connect(this.mangrove.getFMInput());
    this.fmOscBGain.connect(this.mangrove.getFMInput());
    this.fmOscAGain.connect(this.jfOsc.getFMInput());
    this.fmOscBGain.connect(this.jfOsc.getFMInput());

    // FM C & D → All filter FM inputs (so switching filters doesn't lose FM routing)
    Object.values(this.filters).forEach(filter => {
      this.fmFilterCGain.connect(filter.getFMInput());
      this.fmFilterDGain.connect(filter.getFMInput());
    });

    // ===== ENVELOPE → VCA =====
    this.envelope.getOutput().connect(this.vca.gain);

    // ===== INITIAL OSCILLATOR/FILTER ROUTING =====
    this.updateOscillatorRouting();
    this.updateFilterRouting();
  }

  updateOscillatorRouting() {
    // Disconnect both oscillators first
    try {
      this.mangrove.getFormantOutput().disconnect();
    } catch (e) {}
    try {
      this.jfOsc.getMixOutput().disconnect();
    } catch (e) {}

    // Connect active oscillator to active filter
    if (this.oscillatorType === 'mangrove') {
      this.mangrove.getFormantOutput().connect(this.filter.getInput());
    } else {
      this.jfOsc.getMixOutput().connect(this.filter.getInput());
    }
  }

  updateFilterRouting() {
    // Disconnect all filters from VCA
    Object.values(this.filters).forEach(f => {
      try {
        f.getOutput().disconnect();
      } catch (e) {}
    });

    // Reconnect oscillator → filter
    if (this.oscillatorType === 'mangrove') {
      try {
        this.mangrove.getFormantOutput().disconnect();
      } catch (e) {}
      this.mangrove.getFormantOutput().connect(this.filter.getInput());
    } else {
      try {
        this.jfOsc.getMixOutput().disconnect();
      } catch (e) {}
      this.jfOsc.getMixOutput().connect(this.filter.getInput());
    }

    // Connect active filter → VCA → output
    this.filter.getOutput().connect(this.vca);
    this.vca.connect(this.output);
  }

  // ========== OSCILLATOR SELECTION ==========
  setOscillatorType(type) {
    if (type !== 'mangrove' && type !== 'justfriends') {
      console.error('Invalid oscillator type:', type);
      return;
    }

    if (type === this.oscillatorType) return;

    this.oscillatorType = type;
    this.oscillator = type === 'mangrove' ? this.mangrove : this.jfOsc;
    this.updateOscillatorRouting();

    console.log(`Voice ${this.index + 1}: Switched to ${type}`);
  }

  // ========== FILTER SELECTION ==========
  setFilterType(type) {
    if (!this.filters[type]) {
      console.error('Invalid filter type:', type);
      return;
    }

    if (type === this.filterType) return;

    this.filterType = type;
    this.filter = this.filters[type];
    this.updateFilterRouting();

    console.log(`Voice ${this.index + 1}: Switched to ${type} filter`);
  }

  // ========== MIDI NOTE HANDLING ==========
  noteOn(note, velocity) {
    if (!this.enabled) return;

    this.currentNote = note;

    // Convert MIDI note to 1V/oct CV (C4 = 0V)
    const cv = (note - 60) / 12;
    this.noteCV.offset.setValueAtTime(cv, this.ctx.currentTime);

    // Trigger envelope
    this.envelope.trigger();
  }

  noteOff(note) {
    if (note === this.currentNote) {
      this.envelope.release();
      this.currentNote = -1;
    }
  }

  // ========== CLOCK TICK ==========
  clockTick() {
    this.transposeSeq.trigger(); // Advance the transpose sequencer
  }

  // ========== FM DEPTH CONTROLS ==========
  setFMOscADepth(value) {
    this.fmOscAGain.gain.value = value;
  }

  setFMOscBDepth(value) {
    this.fmOscBGain.gain.value = value;
  }

  setFMFilterCDepth(value) {
    this.fmFilterCGain.gain.value = value;
  }

  setFMFilterDDepth(value) {
    this.fmFilterDGain.gain.value = value;
  }

  // ========== FM INPUT CONNECTIONS (for main app to connect FM oscillators) ==========
  getFMOscAInput() {
    return this.fmOscAGain;
  }

  getFMOscBInput() {
    return this.fmOscBGain;
  }

  getFMFilterCInput() {
    return this.fmFilterCGain;
  }

  getFMFilterDInput() {
    return this.fmFilterDGain;
  }

  // ========== OUTPUT ==========
  getOutput() {
    return this.output;
  }

  // ========== STATE MANAGEMENT ==========
  getState() {
    return {
      enabled: this.enabled,
      oscillatorType: this.oscillatorType,
      filterType: this.filterType,
      transposeSeq: {
        cells: this.transposeSeq.getCells(),
        playbackMode: this.transposeSeq.getPlaybackMode()
      },
      quantizer: {
        root: this.quantizer.getRoot(),
        noteMask: this.quantizer.getNoteMask(),
        depth: this.quantizer.params.depth.value,
        offset: this.quantizer.params.offset.value
      },
      oscillator: this.oscillator === this.mangrove ? {
        type: 'mangrove',
        pitch: this.mangrove.params.pitchKnob.value,
        barrel: this.mangrove.params.barrelKnob.value,
        formant: this.mangrove.params.formantKnob.value,
        air: this.mangrove.params.airKnob.value,
        fmIndex: this.mangrove.params.fmIndex.value
      } : {
        type: 'justfriends',
        time: this.jfOsc.params.time.value,
        intone: this.jfOsc.params.intone.value,
        ramp: this.jfOsc.params.ramp.value,
        curve: this.jfOsc.params.curve.value,
        mode: this.jfOsc.params.mode.value,
        range: this.jfOsc.params.range.value,
        runEnabled: this.jfOsc.params.runEnabled.value,
        run: this.jfOsc.params.run.value,
        fmIndex: this.jfOsc.params.fmIndex.value
      },
      filter: this.filter.getState(),
      envelope: this.envelope.getState(),
      fm: {
        oscA: this.fmOscAGain.gain.value,
        oscB: this.fmOscBGain.gain.value,
        filterC: this.fmFilterCGain.gain.value,
        filterD: this.fmFilterDGain.gain.value
      }
    };
  }

  setState(state) {
    if (state.enabled !== undefined) this.enabled = state.enabled;
    if (state.oscillatorType) this.setOscillatorType(state.oscillatorType);
    if (state.filterType) this.setFilterType(state.filterType);

    // Transpose sequencer
    if (state.transposeSeq) {
      // Handle both old format (just cells array) and new format (object with cells and playbackMode)
      if (Array.isArray(state.transposeSeq)) {
        this.transposeSeq.setCells(state.transposeSeq);
      } else {
        if (state.transposeSeq.cells) {
          this.transposeSeq.setCells(state.transposeSeq.cells);
        }
        if (state.transposeSeq.playbackMode) {
          this.transposeSeq.setPlaybackMode(state.transposeSeq.playbackMode);
        }
      }
    }

    // Quantizer
    if (state.quantizer) {
      if (state.quantizer.noteMask) {
        this.quantizer.setNoteMask(state.quantizer.noteMask);
      }
      if (state.quantizer.root !== undefined) {
        this.quantizer.setRoot(state.quantizer.root);
      }
      if (state.quantizer.depth !== undefined) {
        this.quantizer.setDepth(state.quantizer.depth);
      }
      if (state.quantizer.offset !== undefined) {
        this.quantizer.setOffset(state.quantizer.offset);
      }
    }

    // Oscillator
    if (state.oscillator) {
      if (state.oscillator.type === 'mangrove') {
        if (state.oscillator.pitch !== undefined) this.mangrove.setPitch(state.oscillator.pitch);
        if (state.oscillator.barrel !== undefined) this.mangrove.setBarrel(state.oscillator.barrel);
        if (state.oscillator.formant !== undefined) this.mangrove.setFormant(state.oscillator.formant);
        if (state.oscillator.air !== undefined) this.mangrove.setAir(state.oscillator.air);
        if (state.oscillator.fmIndex !== undefined) this.mangrove.setFMIndex(state.oscillator.fmIndex);
      } else if (state.oscillator.type === 'justfriends') {
        if (state.oscillator.time !== undefined) this.jfOsc.params.time.value = state.oscillator.time;
        if (state.oscillator.intone !== undefined) this.jfOsc.params.intone.value = state.oscillator.intone;
        if (state.oscillator.ramp !== undefined) this.jfOsc.params.ramp.value = state.oscillator.ramp;
        if (state.oscillator.curve !== undefined) this.jfOsc.params.curve.value = state.oscillator.curve;
        if (state.oscillator.mode !== undefined) this.jfOsc.params.mode.value = state.oscillator.mode;
        if (state.oscillator.range !== undefined) this.jfOsc.params.range.value = state.oscillator.range;
        if (state.oscillator.runEnabled !== undefined) this.jfOsc.params.runEnabled.value = state.oscillator.runEnabled;
        if (state.oscillator.run !== undefined) this.jfOsc.params.run.value = state.oscillator.run;
        if (state.oscillator.fmIndex !== undefined) this.jfOsc.params.fmIndex.value = state.oscillator.fmIndex;
      }
    }

    // Filter
    if (state.filter) {
      this.filter.setState(state.filter);
    }

    // Envelope
    if (state.envelope) {
      this.envelope.setState(state.envelope);
    }

    // FM depths
    if (state.fm) {
      if (state.fm.oscA !== undefined) this.setFMOscADepth(state.fm.oscA);
      if (state.fm.oscB !== undefined) this.setFMOscBDepth(state.fm.oscB);
      if (state.fm.filterC !== undefined) this.setFMFilterCDepth(state.fm.filterC);
      if (state.fm.filterD !== undefined) this.setFMFilterDDepth(state.fm.filterD);
    }
  }

  // ========== CLEANUP ==========
  dispose() {
    this.noteCV.stop();
    this.noteCV.disconnect();

    this.transposeSeq.dispose();
    this.quantizer.dispose();
    this.mangrove.dispose();
    this.jfOsc.dispose();

    Object.values(this.filters).forEach(f => f.dispose());

    this.envelope.dispose();
    this.vca.disconnect();
    this.output.disconnect();

    this.fmOscAGain.disconnect();
    this.fmOscBGain.disconnect();
    this.fmFilterCGain.disconnect();
    this.fmFilterDGain.disconnect();
    this.transposeGain.disconnect();
  }
}
