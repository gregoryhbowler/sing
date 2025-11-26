// main.js - Phase 5: Three Sisters Filter Integration
//
// Signal flow:
// JF #1 → Quantizer → Mangrove A (pitch CV)
// Mangrove B FORMANT → Mangrove A FM (audio-rate through-zero FM)
// Mangrove A FORMANT → Three Sisters audio input
// Mangrove C FORMANT → Three Sisters FM input
// Three Sisters ALL → Scope 2 → Master → Output

import { JustFriendsNode } from './JustFriendsNode.js';
import { QuantizerNode } from './QuantizerNode.js';
import { MangroveNode } from './MangroveNode.js';
import { ThreeSistersNode } from './ThreeSistersNode.js';

class Phase5App {
  constructor() {
    this.audioContext = null;
    
    // Modules
    this.jf1 = null;
    this.quantizer = null;
    this.mangroveA = null;
    this.mangroveB = null;
    this.mangroveC = null;
    this.threeSisters = null;
    this.masterGain = null;
    
    // FM routing
    this.fmGainB = null;
    
    this.isRunning = false;

    // Scope visualization
    this.scope1Analyser = null;
    this.scope1Canvas = null;
    this.scope1Ctx = null;
    this.scope1AnimationId = null;

    this.scope2Analyser = null;
    this.scope2Canvas = null;
    this.scope2Ctx = null;
    this.scope2AnimationId = null;

    this.setupUI();
  }

  async init() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Load AudioWorklet processors
      await this.audioContext.audioWorklet.addModule('./just-friends-processor.js');
      await this.audioContext.audioWorklet.addModule('./quantizer-processor.js');
      await this.audioContext.audioWorklet.addModule('./mangrove-processor.js');
      await this.audioContext.audioWorklet.addModule('./three-sisters-processor.js');
      
      console.log('%c✓ All AudioWorklets loaded - Phase 5', 'color: green; font-weight: bold');
      
      // Create module instances
      this.jf1 = new JustFriendsNode(this.audioContext);
      this.quantizer = new QuantizerNode(this.audioContext);
      this.mangroveA = new MangroveNode(this.audioContext);
      this.mangroveB = new MangroveNode(this.audioContext);
      this.mangroveC = new MangroveNode(this.audioContext);
      this.threeSisters = new ThreeSistersNode(this.audioContext);
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = 0.3;

      this.fmGainB = this.audioContext.createGain();
      this.fmGainB.gain.value = 0.0; // Start disabled

      this.setupScope1();
      this.setupScope2();

      // ========== SIGNAL ROUTING ==========
      
      // 1. JF #1 → Scope 1 → Quantizer → Mangrove A pitch CV
      this.jf1.getIdentityOutput().connect(this.scope1Analyser);
      this.scope1Analyser.connect(this.quantizer.getInput());
      this.quantizer.getOutput().connect(this.mangroveA.getPitchCVInput());

      // 2. Mangrove B FORMANT → FM Gain → Mangrove A FM input
      this.mangroveB.getFormantOutput().connect(this.fmGainB);
      this.fmGainB.connect(this.mangroveA.getFMInput());

      // 3. Mangrove A FORMANT → Three Sisters audio input
      this.mangroveA.getFormantOutput().connect(this.threeSisters.getAudioInput());

      // 4. Mangrove C FORMANT → Three Sisters FM input
      this.mangroveC.getFormantOutput().connect(this.threeSisters.getFMInput());

      // 5. Three Sisters ALL output → Scope 2 → Master → Output
      this.threeSisters.getAllOutput().connect(this.scope2Analyser);
      this.scope2Analyser.connect(this.masterGain);
      this.masterGain.connect(this.audioContext.destination);
      
      console.log('=== Phase 5 Signal Flow ===');
      console.log('JF #1 → Quantizer → Mangrove A pitch');
      console.log('Mangrove B FORMANT → Mangrove A FM');
      console.log('Mangrove A FORMANT → Three Sisters audio input');
      console.log('Mangrove C FORMANT → Three Sisters FM input');
      console.log('Three Sisters ALL → Scope 2 → Master → Output');
      
      this.configureDefaults();
      
      document.getElementById('status').textContent = 'Ready - Filter System Active';
      document.getElementById('startBtn').disabled = false;
      
      this.syncUIWithParameters();
      
      console.log('%c✓ Phase 5 initialized - Three Sisters filter ready!', 'color: green; font-weight: bold');
      
    } catch (error) {
      console.error('Failed to initialize:', error);
      document.getElementById('status').textContent = 'Error: ' + error.message;
    }
  }

  configureDefaults() {
    // JF #1: Cycle mode LFO for pitch modulation
    this.jf1.setMode(2);
    this.jf1.setRange(0);
    this.jf1.setTime(0.25);
    this.jf1.setIntone(0.5);
    this.jf1.setRamp(0.5);
    this.jf1.setCurve(0.5);

    // Quantizer: C major scale
    this.quantizer.setMajorScale(0);
    this.quantizer.setDepth(1.0);
    this.quantizer.setOffset(0);

    // Mangrove A: Main voice
    this.mangroveA.setPitch(0.5);
    this.mangroveA.setBarrel(0.3);
    this.mangroveA.setFormant(0.6);
    this.mangroveA.setAir(0.5);
    this.mangroveA.setFMIndex(0.3);

    // Mangrove B: FM modulator
    this.mangroveB.setPitch(0.52);
    this.mangroveB.setBarrel(0.65);
    this.mangroveB.setFormant(0.55);
    this.mangroveB.setAir(0.7);

    // Mangrove C: Filter FM source
    this.mangroveC.setPitch(0.6);
    this.mangroveC.setBarrel(0.5);
    this.mangroveC.setFormant(0.5);
    this.mangroveC.setAir(0.8);

    // Three Sisters: Default filter settings
    this.threeSisters.setFreq(0.5);      // Mid-range cutoff (~500Hz)
    this.threeSisters.setSpan(0.5);      // No spread (noon)
    this.threeSisters.setQuality(0.5);   // Neutral Q (0.707, Butterworth)
    this.threeSisters.setMode(0);        // Crossover mode
    this.threeSisters.setFMAttenuverter(0.5); // FM off (noon position)
    
    console.log('Default settings configured');
    console.log('Three Sisters: CROSSOVER mode, neutral Q=0.707, ~500Hz cutoff');
  }

  setupScope1() {
    this.scope1Analyser = this.audioContext.createAnalyser();
    this.scope1Analyser.fftSize = 2048;
    this.scope1Analyser.smoothingTimeConstant = 0;
    this.scope1Canvas = document.getElementById('scope1');
    this.scope1Ctx = this.scope1Canvas.getContext('2d');
  }

  setupScope2() {
    this.scope2Analyser = this.audioContext.createAnalyser();
    this.scope2Analyser.fftSize = 2048;
    this.scope2Analyser.smoothingTimeConstant = 0;
    this.scope2Canvas = document.getElementById('scope2');
    this.scope2Ctx = this.scope2Canvas.getContext('2d');
  }

  drawScope(analyser, canvas, ctx, color = '#6b5b95') {
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    
    analyser.getFloatTimeDomainData(dataArray);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 1;
    
    for (let i = 0; i <= 4; i++) {
      const y = (canvas.height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    ctx.lineWidth = 2;
    ctx.strokeStyle = color;
    ctx.beginPath();

    const sliceWidth = canvas.width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i];
      const y = ((v + 1) / 2) * canvas.height;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
  }

  startScope1() {
    const draw = () => {
      this.scope1AnimationId = requestAnimationFrame(draw);
      this.drawScope(this.scope1Analyser, this.scope1Canvas, this.scope1Ctx, '#6b5b95');
    };
    draw();
  }

  startScope2() {
    const draw = () => {
      this.scope2AnimationId = requestAnimationFrame(draw);
      this.drawScope(this.scope2Analyser, this.scope2Canvas, this.scope2Ctx, '#d67e7e');
    };
    draw();
  }

  stopScope1() {
    if (this.scope1AnimationId) {
      cancelAnimationFrame(this.scope1AnimationId);
      this.scope1AnimationId = null;
    }
  }

  stopScope2() {
    if (this.scope2AnimationId) {
      cancelAnimationFrame(this.scope2AnimationId);
      this.scope2AnimationId = null;
    }
  }

  start() {
    if (!this.mangroveA) return;
    
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    
    this.isRunning = true;
    this.startScope1();
    this.startScope2();
    
    document.getElementById('startBtn').innerHTML = '<span class="btn-icon">⏸</span> Stop';
    document.getElementById('status').textContent = 'Running - Filter Active';
    
    console.log('%c▶ Phase 5 system running', 'color: green; font-weight: bold');
  }

  stop() {
    if (!this.mangroveA) return;
    
    this.audioContext.suspend();
    this.stopScope1();
    this.stopScope2();
    this.isRunning = false;
    
    document.getElementById('startBtn').innerHTML = '<span class="btn-icon">▶</span> Start Audio';
    document.getElementById('status').textContent = 'Stopped';
  }

  toggle() {
    if (this.isRunning) {
      this.stop();
    } else {
      this.start();
    }
  }

  toggleFM(enabled) {
    if (!this.fmGainB) return;
    
    const now = this.audioContext.currentTime;
    this.fmGainB.gain.cancelScheduledValues(now);
    this.fmGainB.gain.setValueAtTime(this.fmGainB.gain.value, now);
    this.fmGainB.gain.linearRampToValueAtTime(enabled ? 1.0 : 0.0, now + 0.05);
    
    console.log(`FM B → A: ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }

  setupUI() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.bindControls());
    } else {
      this.bindControls();
    }
  }

  bindControls() {
    const startBtn = document.getElementById('startBtn');
    if (startBtn) {
      startBtn.addEventListener('click', () => this.toggle());
    }

    // JF #1 controls
    this.bindKnob('jf1Time', (val) => this.jf1?.setTime(val));
    this.bindKnob('jf1Intone', (val) => this.jf1?.setIntone(val));
    this.bindKnob('jf1Ramp', (val) => this.jf1?.setRamp(val));
    this.bindKnob('jf1Curve', (val) => this.jf1?.setCurve(val));

    const jf1Mode = document.getElementById('jf1Mode');
    if (jf1Mode) {
      jf1Mode.addEventListener('change', (e) => {
        this.jf1?.setMode(parseInt(e.target.value));
      });
    }

    const jf1Range = document.getElementById('jf1Range');
    if (jf1Range) {
      jf1Range.addEventListener('change', (e) => {
        this.jf1?.setRange(parseInt(e.target.value));
      });
    }

    // Quantizer controls
    this.bindKnob('quantDepth', (val) => this.quantizer?.setDepth(val));
    this.bindKnob('quantOffset', (val) => this.quantizer?.setOffset(val));

    const presetBtns = document.querySelectorAll('.preset-btn');
    presetBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        presetBtns.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        const scale = e.target.dataset.scale;
        this.setScale(scale);
      });
    });

    this.createPianoKeyboard();

    // Mangrove A controls
    this.bindKnob('maPitch', (val) => this.mangroveA?.setPitch(val));
    this.bindKnob('maBarrel', (val) => this.mangroveA?.setBarrel(val));
    this.bindKnob('maFormant', (val) => this.mangroveA?.setFormant(val));
    this.bindKnob('maAir', (val) => this.mangroveA?.setAir(val));
    this.bindKnob('maFmIndex', (val) => this.mangroveA?.setFMIndex(val));

    // Mangrove B controls
    this.bindKnob('mbPitch', (val) => this.mangroveB?.setPitch(val));
    this.bindKnob('mbBarrel', (val) => this.mangroveB?.setBarrel(val));
    this.bindKnob('mbFormant', (val) => this.mangroveB?.setFormant(val));

    const fmEnable = document.getElementById('fmEnable');
    if (fmEnable) {
      fmEnable.checked = false;
      fmEnable.addEventListener('change', (e) => {
        this.toggleFM(e.target.checked);
      });
    }

    // Mangrove C controls
    this.bindKnob('mcPitch', (val) => this.mangroveC?.setPitch(val));
    this.bindKnob('mcBarrel', (val) => this.mangroveC?.setBarrel(val));
    this.bindKnob('mcFormant', (val) => this.mangroveC?.setFormant(val));

    // Three Sisters controls
    this.bindKnob('tsFreq', (val) => this.threeSisters?.setFreq(val));
    this.bindKnob('tsSpan', (val) => this.threeSisters?.setSpan(val));
    this.bindKnob('tsQuality', (val) => this.threeSisters?.setQuality(val));
    this.bindKnob('tsFmAtten', (val) => this.threeSisters?.setFMAttenuverter(val));

    const tsMode = document.getElementById('tsMode');
    if (tsMode) {
      tsMode.addEventListener('change', (e) => {
        this.threeSisters?.setMode(parseFloat(e.target.value));
      });
    }

    this.bindKnob('masterVolume', (val) => {
      if (this.masterGain) this.masterGain.gain.value = val;
    });
  }

  bindKnob(id, callback) {
    const knob = document.getElementById(id);
    const display = document.getElementById(id + 'Value');
    
    if (knob) {
      knob.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        callback(value);
        if (display) {
          display.textContent = value.toFixed(2);
        }
      });
      
      knob.addEventListener('change', (e) => {
        const value = parseFloat(e.target.value);
        if (display) {
          display.textContent = value.toFixed(2);
        }
      });
      
      if (display) {
        display.textContent = parseFloat(knob.value).toFixed(2);
      }
    }
  }

  createPianoKeyboard() {
    const container = document.getElementById('pianoKeyboard');
    if (!container) return;

    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const isBlackKey = [false, true, false, true, false, false, true, false, true, false, true, false];

    for (let i = 0; i < 12; i++) {
      const key = document.createElement('div');
      key.className = isBlackKey[i] ? 'piano-key black-key active' : 'piano-key white-key active';
      key.dataset.note = i;
      key.title = noteNames[i];
      
      key.addEventListener('click', () => {
        key.classList.toggle('active');
        const isActive = key.classList.contains('active');
        this.quantizer?.setNote(i, isActive);
      });
      
      container.appendChild(key);
    }
  }

  setScale(scaleName) {
    if (!this.quantizer) return;

    switch (scaleName) {
      case 'chromatic':
        this.quantizer.setChromatic();
        break;
      case 'major':
        this.quantizer.setMajorScale(0);
        break;
      case 'minor':
        this.quantizer.setMinorScale(9);
        break;
      case 'penta-maj':
        this.quantizer.setPentatonicMajor(0);
        break;
      case 'penta-min':
        this.quantizer.setPentatonicMinor(9);
        break;
    }

    this.updatePianoKeyboard();
  }

  updatePianoKeyboard() {
    const mask = this.quantizer?.getNoteMask();
    if (!mask) return;

    const keys = document.querySelectorAll('.piano-key');
    keys.forEach((key, i) => {
      if (mask[i]) {
        key.classList.add('active');
      } else {
        key.classList.remove('active');
      }
    });
  }

  syncUIWithParameters() {
    const params = [
      'jf1Time', 'jf1Intone', 'jf1Ramp', 'jf1Curve',
      'quantDepth', 'quantOffset',
      'maPitch', 'maBarrel', 'maFormant', 'maAir', 'maFmIndex',
      'mbPitch', 'mbBarrel', 'mbFormant',
      'mcPitch', 'mcBarrel', 'mcFormant',
      'tsFreq', 'tsSpan', 'tsQuality', 'tsFmAtten',
      'masterVolume'
    ];

    params.forEach(param => {
      const knob = document.getElementById(param);
      const display = document.getElementById(param + 'Value');
      if (knob && display) {
        const value = parseFloat(knob.value);
        display.textContent = value.toFixed(2);
      }
    });

    this.updatePianoKeyboard();
    
    const fmEnable = document.getElementById('fmEnable');
    if (fmEnable) {
      fmEnable.checked = false;
    }
    
    console.log('UI synced - Phase 5 ready');
  }
}

const app = new Phase5App();
window.addEventListener('load', () => app.init());
