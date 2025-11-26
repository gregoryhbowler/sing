// main.js
// Phase 3: JF #1 → Quantizer → Mangrove A integration with scope visualization

import { JustFriendsNode } from './JustFriendsNode.js';
import { QuantizerNode } from './QuantizerNode.js';
import { MangroveNode } from './MangroveNode.js';

class Phase3App {
  constructor() {
    this.audioContext = null;
    this.jf1 = null;
    this.quantizer = null;
    this.mangrove = null;
    this.masterGain = null;
    this.isRunning = false;

    // Scope visualization
    this.scope1Analyser = null;
    this.scope1Canvas = null;
    this.scope1Ctx = null;
    this.scope1AnimationId = null;

    // Setup UI when DOM is ready
    this.setupUI();
  }

  async init() {
    try {
      // Create audio context
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Load all AudioWorklet processors
      await this.audioContext.audioWorklet.addModule('./just-friends-processor.js');
      await this.audioContext.audioWorklet.addModule('./quantizer-processor.js');
      await this.audioContext.audioWorklet.addModule('./mangrove-processor.js');
      
      console.log('All AudioWorklets loaded successfully');
      
      // Create module instances
      this.jf1 = new JustFriendsNode(this.audioContext);
      this.quantizer = new QuantizerNode(this.audioContext);
      this.mangrove = new MangroveNode(this.audioContext);
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = 0.3;

      // Setup scope visualization
      this.setupScope1();

      // Wire up the signal path:
      // JF #1 IDENTITY → Scope 1 → Quantizer → Mangrove A pitch CV
      this.jf1.getIdentityOutput().connect(this.scope1Analyser);
      this.scope1Analyser.connect(this.quantizer.getInput());
      this.quantizer.getOutput().connect(this.mangrove.getPitchCVInput());

      // Audio output: Mangrove FORMANT → Master Gain → Destination
      this.mangrove.getFormantOutput().connect(this.masterGain);
      this.masterGain.connect(this.audioContext.destination);

      // Configure default settings
      this.configureDefaults();
      
      // Update UI
      document.getElementById('status').textContent = 'Ready';
      document.getElementById('startBtn').disabled = false;
      
      // Sync UI with default values
      this.syncUIWithParameters();
      
      console.log('Phase 3 system initialized successfully');
      console.log('Signal flow: JF #1 → Scope 1 → Quantizer → Mangrove A');
      
    } catch (error) {
      console.error('Failed to initialize system:', error);
      document.getElementById('status').textContent = 'Error: ' + error.message;
    }
  }

  configureDefaults() {
    // JF #1: Cycle mode, shape range, slow modulation
    this.jf1.setMode(2); // cycle
    this.jf1.setRange(0); // shape
    this.jf1.setTime(0.25);
    this.jf1.setIntone(0.5);
    this.jf1.setRamp(0.5);
    this.jf1.setCurve(0.5);

    // Quantizer: C major scale, moderate depth
    this.quantizer.setMajorScale(0);
    this.quantizer.setDepth(0.4);
    this.quantizer.setOffset(0);

    // Mangrove: Mid-range settings
    this.mangrove.setPitch(0.5);
    this.mangrove.setBarrel(0.3);
    this.mangrove.setFormant(0.6);
    this.mangrove.setAir(0.5);
  }

  setupScope1() {
    // Create analyser for scope visualization
    this.scope1Analyser = this.audioContext.createAnalyser();
    this.scope1Analyser.fftSize = 2048;
    this.scope1Analyser.smoothingTimeConstant = 0;

    // Get canvas
    this.scope1Canvas = document.getElementById('scope1');
    this.scope1Ctx = this.scope1Canvas.getContext('2d');
  }

  startScope1() {
    const bufferLength = this.scope1Analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);

    const draw = () => {
      this.scope1AnimationId = requestAnimationFrame(draw);

      this.scope1Analyser.getFloatTimeDomainData(dataArray);

      // Clear canvas
      this.scope1Ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      this.scope1Ctx.fillRect(0, 0, this.scope1Canvas.width, this.scope1Canvas.height);

      // Draw grid
      this.scope1Ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
      this.scope1Ctx.lineWidth = 1;
      
      // Horizontal grid lines
      for (let i = 0; i <= 4; i++) {
        const y = (this.scope1Canvas.height / 4) * i;
        this.scope1Ctx.beginPath();
        this.scope1Ctx.moveTo(0, y);
        this.scope1Ctx.lineTo(this.scope1Canvas.width, y);
        this.scope1Ctx.stroke();
      }

      // Draw waveform
      this.scope1Ctx.lineWidth = 2;
      this.scope1Ctx.strokeStyle = '#6b5b95';
      this.scope1Ctx.beginPath();

      const sliceWidth = this.scope1Canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i];
        const y = ((v + 1) / 2) * this.scope1Canvas.height;

        if (i === 0) {
          this.scope1Ctx.moveTo(x, y);
        } else {
          this.scope1Ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      this.scope1Ctx.stroke();

      // Draw center line
      this.scope1Ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
      this.scope1Ctx.lineWidth = 1;
      this.scope1Ctx.beginPath();
      this.scope1Ctx.moveTo(0, this.scope1Canvas.height / 2);
      this.scope1Ctx.lineTo(this.scope1Canvas.width, this.scope1Canvas.height / 2);
      this.scope1Ctx.stroke();
    };

    draw();
  }

  stopScope1() {
    if (this.scope1AnimationId) {
      cancelAnimationFrame(this.scope1AnimationId);
      this.scope1AnimationId = null;
    }
  }

  start() {
    if (!this.jf1) return;
    
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    
    this.isRunning = true;
    this.startScope1();
    
    document.getElementById('startBtn').innerHTML = '<span class="btn-icon">⏸</span> Stop';
    document.getElementById('status').textContent = 'Running';
  }

  stop() {
    if (!this.jf1) return;
    
    this.audioContext.suspend();
    this.stopScope1();
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

  setupUI() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.bindControls());
    } else {
      this.bindControls();
    }
  }

  bindControls() {
    // Start/Stop button
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

    // Scale preset buttons
    const presetBtns = document.querySelectorAll('.preset-btn');
    presetBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        // Remove active class from all
        presetBtns.forEach(b => b.classList.remove('active'));
        // Add to clicked
        e.target.classList.add('active');
        
        const scale = e.target.dataset.scale;
        this.setScale(scale);
      });
    });

    // Piano keyboard
    this.createPianoKeyboard();

    // Mangrove controls
    this.bindKnob('pitchKnob', (val) => this.mangrove?.setPitch(val));
    this.bindKnob('barrelKnob', (val) => this.mangrove?.setBarrel(val));
    this.bindKnob('formantKnob', (val) => this.mangrove?.setFormant(val));
    this.bindKnob('airKnob', (val) => this.mangrove?.setAir(val));
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
        this.quantizer.setMajorScale(0); // C major
        break;
      case 'minor':
        this.quantizer.setMinorScale(9); // A minor
        break;
      case 'penta-maj':
        this.quantizer.setPentatonicMajor(0); // C penta major
        break;
      case 'penta-min':
        this.quantizer.setPentatonicMinor(9); // A penta minor
        break;
    }

    // Update piano keyboard visual
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
      'pitchKnob', 'barrelKnob', 'formantKnob', 'airKnob', 'masterVolume'
    ];

    params.forEach(param => {
      const knob = document.getElementById(param);
      const display = document.getElementById(param + 'Value');
      if (knob && display) {
        display.textContent = parseFloat(knob.value).toFixed(2);
      }
    });

    // Update piano keyboard to show C major (default)
    this.updatePianoKeyboard();
  }
}

// Initialize app when page loads
const app = new Phase3App();
window.addEventListener('load', () => app.init());
