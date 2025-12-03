// main.js
// Entry point for Phase 5 Poly application

import { Phase5PolyApp } from './core/Phase5PolyApp.js';

// Import existing node classes from parent directory
import { MangroveNode } from '../MangroveNode.js';
import { JustFriendsOscNode } from '../JustFriendsOscNode.js';
import { JustFriendsNode } from '../JustFriendsNode.js';
import { QuantizerNode } from '../QuantizerNode.js';
import { TransposeSequencerNode } from '../TransposeSequencerNode.js';
import { ThreeSistersNode } from '../ThreeSistersNode.js';
import { LFONode } from '../LFONode.js';
import GreyholeNode from '../GreyholeNode.js';
import { ZitaReverb } from '../ZitaReverb.js';
import { DJEqualizer } from '../DJEqualizer.js';
import { SaturationEffect } from '../SaturationEffect.js';
import { StandaloneMimeophon } from '../mimeophon-standalone.js';

// WAV Recorder for capturing performances
import { WavRecorder } from '../WavRecorder.js';

// Global app instance
let app = null;

// WAV Recorder instance
let wavRecorder = null;
let lastRecordingBlob = null;

// ===== HELPER FUNCTIONS =====

/**
 * Convert linear slider value (0-1) to logarithmic frequency (20-20000 Hz)
 * This ensures even frequency response across the slider range
 */
function sliderToFrequency(value) {
  // value: 0-1
  // Map to log scale: 20 Hz to 20000 Hz
  const minFreq = Math.log(20);
  const maxFreq = Math.log(20000);
  return Math.exp(minFreq + value * (maxFreq - minFreq));
}

/**
 * Convert frequency (20-20000 Hz) to linear slider value (0-1)
 */
function frequencyToSlider(freq) {
  const minFreq = Math.log(20);
  const maxFreq = Math.log(20000);
  const clampedFreq = Math.max(20, Math.min(20000, freq));
  return (Math.log(clampedFreq) - minFreq) / (maxFreq - minFreq);
}

// Initialize application
async function init() {
  console.log('Initializing Phase 5 Poly...');

  const statusEl = document.getElementById('status');
  statusEl.textContent = 'Loading audio worklets...';

  try {
    // Create app instance with dependencies
    app = new Phase5PolyApp({
      MangroveNode,
      JustFriendsOscNode,
      JustFriendsNode,
      QuantizerNode,
      TransposeSequencerNode,
      ThreeSistersNode,
      LFONode,
      GreyholeNode,
      ZitaReverb,
      DJEqualizer,
      SaturationEffect,
      StandaloneMimeophon
    });

    await app.init();

    // Export for debugging
    window.app = app;

    statusEl.textContent = 'Ready! Press Start Audio to begin.';
    statusEl.classList.add('ready');

    // Build UI
    buildUI();

    // Set up event listeners
    setupEventListeners();

    console.log('✓ Application initialized successfully');
  } catch (err) {
    console.error('Failed to initialize:', err);
    statusEl.textContent = `Error: ${err.message}`;
    statusEl.classList.add('error');
  }
}

// Build UI components
function buildUI() {
  buildVoiceUI();
  buildFMOscUI();
  buildMixerUI();
  buildSendsUI();
  buildLFOUI();
}

function buildVoiceUI() {
  const container = document.getElementById('voicesContainer');
  if (!container) return;

  app.voices.forEach((voice, i) => {
    const panel = document.createElement('div');
    panel.className = 'voice-panel collapsed';
    panel.innerHTML = `
      <div class="voice-header">
        <button class="voice-expand-btn">▶</button>
        <h3>Voice ${i + 1} [CH${i + 1}]</h3>
        <div class="voice-quick-info">
          <span class="osc-type">Mangrove</span> |
          <span class="filter-type">Moog</span>
        </div>
        <button class="voice-active-btn active" data-voice="${i}">●</button>
      </div>
      <div class="voice-content">
        <div class="param-section">
          <h4>Transpose Sequencer</h4>
          <div class="transpose-seq-grid" data-voice="${i}">
            ${Array.from({ length: 16 }, (_, stepIdx) => `
              <div class="transpose-step" data-voice="${i}" data-step="${stepIdx}">
                <div class="step-number">${stepIdx + 1}</div>
                <input type="number" class="step-transpose" min="-24" max="24" value="0" title="Transpose (-24 to +24)">
                <input type="number" class="step-repeats" min="1" max="64" value="1" title="Repeats (1-64)">
                <label class="step-active-toggle">
                  <input type="checkbox" class="step-active-checkbox">
                  <span class="checkmark"></span>
                </label>
              </div>
            `).join('')}
          </div>
          <div class="transpose-controls">
            <label>Mode:</label>
            <select class="transpose-mode-select" data-voice="${i}">
              <option value="forward" selected>Forward</option>
              <option value="backward">Backward</option>
              <option value="pingpong">Ping-Pong</option>
              <option value="random">Random</option>
            </select>
            <button class="transpose-clear-btn" data-voice="${i}">Clear All</button>
          </div>
        </div>
        <div class="param-section">
          <h4>Oscillator</h4>
          <div class="param-row">
            <label>type</label>
            <select class="osc-type-select" data-voice="${i}">
              <option value="mangrove" selected>Mangrove</option>
              <option value="justfriends">Just Friends</option>
            </select>
          </div>

          <!-- Mangrove Controls -->
          <div class="mangrove-controls" data-voice="${i}">
            <div class="param-row">
              <label>pitch</label>
              <input type="range" class="osc-pitch" min="0" max="1" step="0.01" value="0.5">
              <span class="value-display">0.50</span>
            </div>
            <div class="param-row">
              <label>barrel</label>
              <input type="range" class="osc-barrel" min="0" max="1" step="0.01" value="0.5">
              <span class="value-display">0.50</span>
            </div>
            <div class="param-row">
              <label>formant</label>
              <input type="range" class="osc-formant" min="0" max="1" step="0.01" value="0.48">
              <span class="value-display">0.48</span>
            </div>
            <div class="param-row">
              <label>air</label>
              <input type="range" class="osc-air" min="0" max="1" step="0.01" value="0.5">
              <span class="value-display">0.50</span>
            </div>
          </div>

          <!-- Just Friends Controls -->
          <div class="justfriends-controls" data-voice="${i}" style="display: none;">
            <div class="param-row">
              <label>time</label>
              <input type="range" class="jf-time" min="0" max="1" step="0.01" value="0.5">
              <span class="value-display">0.50</span>
            </div>
            <div class="param-row">
              <label>intone</label>
              <input type="range" class="jf-intone" min="0" max="1" step="0.01" value="0.5">
              <span class="value-display">0.50</span>
            </div>
            <div class="param-row">
              <label>ramp</label>
              <input type="range" class="jf-ramp" min="0" max="1" step="0.01" value="0.5">
              <span class="value-display">0.50</span>
            </div>
            <div class="param-row">
              <label>curve</label>
              <input type="range" class="jf-curve" min="0" max="1" step="0.01" value="0.5">
              <span class="value-display">0.50</span>
            </div>
            <div class="param-row">
              <label>mode/range</label>
              <select class="jf-mode-range">
                <option value="transient-shape">Transient/Shape (SHIFT)</option>
                <option value="sustain-shape">Sustain/Shape (STRATA)</option>
                <option value="cycle-shape">Cycle/Shape (VOLLEY)</option>
                <option value="transient-sound">Transient/Sound (SPILL)</option>
                <option value="sustain-sound">Sustain/Sound (PLUME)</option>
                <option value="cycle-sound" selected>Cycle/Sound (FLOOM)</option>
              </select>
            </div>
            <div class="param-row">
              <label>run enabled</label>
              <input type="checkbox" class="jf-run-enabled">
            </div>
          </div>
        </div>
        <div class="param-section">
          <h4>FM (Oscillator)</h4>
          <div class="param-row">
            <label>FM A depth</label>
            <input type="range" class="fm-osc-a-depth" data-voice="${i}" min="0" max="1" step="0.01" value="0">
            <span class="value-display">0.00</span>
          </div>
          <div class="param-row">
            <label>FM B depth</label>
            <input type="range" class="fm-osc-b-depth" data-voice="${i}" min="0" max="1" step="0.01" value="0">
            <span class="value-display">0.00</span>
          </div>
        </div>
        <div class="param-section">
          <h4>Filter</h4>
          <div class="param-row">
            <label>type</label>
            <select class="filter-type-select" data-voice="${i}">
              <option value="moog" selected>Moog Ladder</option>
              <option value="wasp">Wasp</option>
              <option value="sem">SEM</option>
              <option value="threesisters">Three Sisters</option>
            </select>
          </div>

          <!-- Moog Filter Controls -->
          <div class="moog-filter-controls" data-voice="${i}">
            <div class="param-row">
              <label>cutoff</label>
              <input type="range" class="moog-cutoff" min="0" max="1" step="0.001" value="0.65">
              <span class="value-display">${Math.round(sliderToFrequency(0.65))} Hz</span>
            </div>
            <div class="param-row">
              <label>resonance</label>
              <input type="range" class="moog-resonance" min="0" max="1" step="0.01" value="0">
              <span class="value-display">0.00</span>
            </div>
            <div class="param-row">
              <label>drive</label>
              <input type="range" class="moog-drive" min="0" max="1" step="0.01" value="0.5">
              <span class="value-display">0.50</span>
            </div>
            <div class="param-row">
              <label>warmth</label>
              <input type="range" class="moog-warmth" min="0" max="1" step="0.01" value="1.0">
              <span class="value-display">1.00</span>
            </div>
          </div>

          <!-- Wasp Filter Controls -->
          <div class="wasp-filter-controls" data-voice="${i}" style="display: none;">
            <div class="param-row">
              <label>cutoff</label>
              <input type="range" class="wasp-cutoff" min="0" max="1" step="0.001" value="0.65">
              <span class="value-display">${Math.round(sliderToFrequency(0.65))} Hz</span>
            </div>
            <div class="param-row">
              <label>resonance</label>
              <input type="range" class="wasp-resonance" min="0" max="1" step="0.01" value="0.5">
              <span class="value-display">0.50</span>
            </div>
            <div class="param-row">
              <label>mode</label>
              <select class="wasp-mode">
                <option value="0" selected>Low Pass</option>
                <option value="1">Band Pass</option>
                <option value="2">High Pass</option>
                <option value="3">Notch</option>
              </select>
            </div>
            <div class="param-row">
              <label>drive</label>
              <input type="range" class="wasp-drive" min="0" max="1" step="0.01" value="0.5">
              <span class="value-display">0.50</span>
            </div>
            <div class="param-row">
              <label>chaos</label>
              <input type="range" class="wasp-chaos" min="0" max="1" step="0.01" value="0.3">
              <span class="value-display">0.30</span>
            </div>
          </div>

          <!-- SEM Filter Controls -->
          <div class="sem-filter-controls" data-voice="${i}" style="display: none;">
            <div class="param-row">
              <label>cutoff</label>
              <input type="range" class="sem-cutoff" min="0" max="1" step="0.001" value="0.65">
              <span class="value-display">${Math.round(sliderToFrequency(0.65))} Hz</span>
            </div>
            <div class="param-row">
              <label>resonance</label>
              <input type="range" class="sem-resonance" min="0" max="1" step="0.01" value="0">
              <span class="value-display">0.00</span>
            </div>
            <div class="param-row">
              <label>morph (LP↔HP)</label>
              <input type="range" class="sem-morph" min="-1" max="1" step="0.01" value="0">
              <span class="value-display">0.00</span>
            </div>
            <div class="param-row">
              <label>drive</label>
              <input type="range" class="sem-drive" min="0.1" max="10" step="0.1" value="3">
              <span class="value-display">3.0</span>
            </div>
          </div>

          <!-- Three Sisters Filter Controls -->
          <div class="threesisters-filter-controls" data-voice="${i}" style="display: none;">
            <div class="param-row">
              <label>frequency</label>
              <input type="range" class="ts-freq" min="20" max="16000" step="1" value="1000">
              <span class="value-display">1000 Hz</span>
            </div>
            <div class="param-row">
              <label>span</label>
              <input type="range" class="ts-span" min="0" max="1" step="0.01" value="0.5">
              <span class="value-display">0.50</span>
            </div>
            <div class="param-row">
              <label>quality (Q)</label>
              <input type="range" class="ts-quality" min="0" max="1" step="0.01" value="0.5">
              <span class="value-display">0.50</span>
            </div>
            <div class="param-row">
              <label>mode</label>
              <select class="ts-mode">
                <option value="0" selected>Crossover</option>
                <option value="1">Formant</option>
              </select>
            </div>
          </div>
        </div>
        <div class="param-section">
          <h4>FM (Filter)</h4>
          <div class="param-row">
            <label>FM C depth</label>
            <input type="range" class="fm-filter-c-depth" data-voice="${i}" min="0" max="1" step="0.01" value="0">
            <span class="value-display">0.00</span>
          </div>
          <div class="param-row">
            <label>FM D depth</label>
            <input type="range" class="fm-filter-d-depth" data-voice="${i}" min="0" max="1" step="0.01" value="0">
            <span class="value-display">0.00</span>
          </div>
        </div>
        <div class="param-section">
          <h4>Envelope</h4>
          <div class="param-row">
            <label>attack</label>
            <input type="range" class="env-attack" data-voice="${i}" min="0.001" max="2" step="0.001" value="0.01">
            <span class="value-display">10 ms</span>
          </div>
          <div class="param-row">
            <label>decay</label>
            <input type="range" class="env-decay" data-voice="${i}" min="0.01" max="10" step="0.01" value="0.8">
            <span class="value-display">800 ms</span>
          </div>
        </div>
        <div class="param-section quantizer-section">
          <h4>Quantizer</h4>
          <div class="param-row">
            <label>scale</label>
            <select class="quantizer-scale" data-voice="${i}">
              <option value="chromatic" selected>Chromatic</option>
              <option value="major">Major</option>
              <option value="minor">Natural Minor</option>
              <option value="harmonic-minor">Harmonic Minor</option>
              <option value="melodic-minor">Melodic Minor</option>
              <option value="dorian">Dorian</option>
              <option value="phrygian">Phrygian</option>
              <option value="lydian">Lydian</option>
              <option value="mixolydian">Mixolydian</option>
              <option value="locrian">Locrian</option>
              <option value="pentatonic-major">Pentatonic Major</option>
              <option value="pentatonic-minor">Pentatonic Minor</option>
              <option value="blues">Blues</option>
              <option value="whole-tone">Whole Tone</option>
              <option value="diminished">Diminished</option>
            </select>
          </div>
          <div class="param-row">
            <label>root</label>
            <select class="quantizer-root" data-voice="${i}">
              <option value="0" selected>C</option>
              <option value="1">C#/Db</option>
              <option value="2">D</option>
              <option value="3">D#/Eb</option>
              <option value="4">E</option>
              <option value="5">F</option>
              <option value="6">F#/Gb</option>
              <option value="7">G</option>
              <option value="8">G#/Ab</option>
              <option value="9">A</option>
              <option value="10">A#/Bb</option>
              <option value="11">B</option>
            </select>
          </div>
          <div class="piano-keyboard" data-voice="${i}">
            <div class="piano-white-keys">
              <div class="piano-key white" data-note="0" title="C"><span>C</span></div>
              <div class="piano-key white" data-note="2" title="D"><span>D</span></div>
              <div class="piano-key white" data-note="4" title="E"><span>E</span></div>
              <div class="piano-key white" data-note="5" title="F"><span>F</span></div>
              <div class="piano-key white" data-note="7" title="G"><span>G</span></div>
              <div class="piano-key white" data-note="9" title="A"><span>A</span></div>
              <div class="piano-key white" data-note="11" title="B"><span>B</span></div>
            </div>
            <div class="piano-black-keys">
              <div class="piano-key black" data-note="1" title="C#" style="left: 10.7%"><span>C#</span></div>
              <div class="piano-key black" data-note="3" title="D#" style="left: 25%"><span>D#</span></div>
              <div class="piano-key black" data-note="6" title="F#" style="left: 53.6%"><span>F#</span></div>
              <div class="piano-key black" data-note="8" title="G#" style="left: 67.9%"><span>G#</span></div>
              <div class="piano-key black" data-note="10" title="A#" style="left: 82.1%"><span>A#</span></div>
            </div>
          </div>
          <div class="param-row">
            <label>depth (octaves)</label>
            <input type="range" class="quantizer-depth" data-voice="${i}" min="0" max="8" step="0.1" value="1">
            <span class="value-display">1.0</span>
          </div>
          <div class="param-row">
            <label>offset (V)</label>
            <input type="range" class="quantizer-offset" data-voice="${i}" min="-4" max="4" step="0.08333" value="0">
            <span class="value-display">0.00</span>
          </div>
        </div>
      </div>
    `;
    container.appendChild(panel);

    // Toggle expand/collapse
    const expandBtn = panel.querySelector('.voice-expand-btn');
    expandBtn.addEventListener('click', () => {
      panel.classList.toggle('collapsed');
      expandBtn.textContent = panel.classList.contains('collapsed') ? '▶' : '▼';
    });

    // Oscillator type selector
    const oscTypeSelect = panel.querySelector('.osc-type-select');
    const oscTypeDisplay = panel.querySelector('.osc-type');
    const mangroveControls = panel.querySelector('.mangrove-controls');
    const jfControls = panel.querySelector('.justfriends-controls');

    oscTypeSelect.addEventListener('change', (e) => {
      const type = e.target.value;
      voice.setOscillatorType(type);
      oscTypeDisplay.textContent = type === 'mangrove' ? 'Mangrove' : 'Just Friends';

      // Toggle control visibility
      if (type === 'mangrove') {
        mangroveControls.style.display = 'block';
        jfControls.style.display = 'none';
      } else {
        mangroveControls.style.display = 'none';
        jfControls.style.display = 'block';
      }

      console.log(`Voice ${i + 1}: Switched to ${type} oscillator`);
    });

    // Mangrove oscillator controls
    const pitchSlider = mangroveControls.querySelector('.osc-pitch');
    const barrelSlider = mangroveControls.querySelector('.osc-barrel');
    const formantSlider = mangroveControls.querySelector('.osc-formant');
    const airSlider = mangroveControls.querySelector('.osc-air');

    pitchSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      voice.mangrove.setPitch(value);
      e.target.nextElementSibling.textContent = value.toFixed(2);
    });

    barrelSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      voice.mangrove.setBarrel(value);
      e.target.nextElementSibling.textContent = value.toFixed(2);
    });

    formantSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      voice.mangrove.setFormant(value);
      e.target.nextElementSibling.textContent = value.toFixed(2);
    });

    airSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      voice.mangrove.setAir(value);
      e.target.nextElementSibling.textContent = value.toFixed(2);
    });

    // Just Friends oscillator controls
    const jfTimeSlider = jfControls.querySelector('.jf-time');
    const jfIntoneSlider = jfControls.querySelector('.jf-intone');
    const jfRampSlider = jfControls.querySelector('.jf-ramp');
    const jfCurveSlider = jfControls.querySelector('.jf-curve');
    const jfModeRangeSelect = jfControls.querySelector('.jf-mode-range');
    const jfRunEnabledCheckbox = jfControls.querySelector('.jf-run-enabled');

    jfTimeSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      voice.jfOsc.params.time.value = value;
      e.target.nextElementSibling.textContent = value.toFixed(2);
    });

    jfIntoneSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      voice.jfOsc.params.intone.value = value;
      e.target.nextElementSibling.textContent = value.toFixed(2);
    });

    jfRampSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      voice.jfOsc.params.ramp.value = value;
      e.target.nextElementSibling.textContent = value.toFixed(2);
    });

    jfCurveSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      voice.jfOsc.params.curve.value = value;
      e.target.nextElementSibling.textContent = value.toFixed(2);
    });

    jfModeRangeSelect.addEventListener('change', (e) => {
      const mode = e.target.value;
      switch (mode) {
        case 'transient-shape':
          voice.jfOsc.setTransientShapeMode();
          break;
        case 'sustain-shape':
          voice.jfOsc.setSustainShapeMode();
          break;
        case 'cycle-shape':
          voice.jfOsc.setCycleShapeMode();
          break;
        case 'transient-sound':
          voice.jfOsc.setTransientSoundMode();
          break;
        case 'sustain-sound':
          voice.jfOsc.setSustainSoundMode();
          break;
        case 'cycle-sound':
          voice.jfOsc.setCycleSoundMode();
          break;
      }
      console.log(`Voice ${i + 1} JF: ${mode}`);
    });

    jfRunEnabledCheckbox.addEventListener('change', (e) => {
      voice.jfOsc.enableRunMode(e.target.checked);
      console.log(`Voice ${i + 1} JF RUN: ${e.target.checked}`);
    });

    // FM depth controls
    const fmOscASlider = panel.querySelector('.fm-osc-a-depth');
    const fmOscBSlider = panel.querySelector('.fm-osc-b-depth');
    const fmFilterCSlider = panel.querySelector('.fm-filter-c-depth');
    const fmFilterDSlider = panel.querySelector('.fm-filter-d-depth');

    fmOscASlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      voice.setFMOscADepth(value);
      e.target.nextElementSibling.textContent = value.toFixed(2);
    });

    fmOscBSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      voice.setFMOscBDepth(value);
      e.target.nextElementSibling.textContent = value.toFixed(2);
    });

    fmFilterCSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      voice.setFMFilterCDepth(value);
      e.target.nextElementSibling.textContent = value.toFixed(2);
    });

    fmFilterDSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      voice.setFMFilterDDepth(value);
      e.target.nextElementSibling.textContent = value.toFixed(2);
    });

    // Filter type selector
    const filterTypeSelect = panel.querySelector('.filter-type-select');
    const filterTypeDisplay = panel.querySelector('.filter-type');
    const moogControls = panel.querySelector('.moog-filter-controls');
    const waspControls = panel.querySelector('.wasp-filter-controls');
    const semControls = panel.querySelector('.sem-filter-controls');
    const threeSistersControls = panel.querySelector('.threesisters-filter-controls');

    filterTypeSelect.addEventListener('change', (e) => {
      const type = e.target.value;
      voice.setFilterType(type);

      // Update display text
      const displayNames = {
        'moog': 'Moog',
        'wasp': 'Wasp',
        'sem': 'SEM',
        'threesisters': 'Three Sisters'
      };
      filterTypeDisplay.textContent = displayNames[type];

      // Toggle control visibility
      moogControls.style.display = type === 'moog' ? 'block' : 'none';
      waspControls.style.display = type === 'wasp' ? 'block' : 'none';
      semControls.style.display = type === 'sem' ? 'block' : 'none';
      threeSistersControls.style.display = type === 'threesisters' ? 'block' : 'none';

      console.log(`Voice ${i + 1}: Switched to ${type} filter`);
    });

    // ===== MOOG FILTER CONTROLS =====
    const moogCutoff = moogControls.querySelector('.moog-cutoff');
    const moogResonance = moogControls.querySelector('.moog-resonance');
    const moogDrive = moogControls.querySelector('.moog-drive');
    const moogWarmth = moogControls.querySelector('.moog-warmth');

    moogCutoff.addEventListener('input', (e) => {
      const sliderValue = parseFloat(e.target.value);
      const freq = sliderToFrequency(sliderValue);
      voice.filters.moog.setCutoff(freq);
      e.target.nextElementSibling.textContent = `${Math.round(freq)} Hz`;
      console.log(`Voice ${i + 1} Moog cutoff: slider=${sliderValue.toFixed(3)}, freq=${Math.round(freq)} Hz, param=${voice.filters.moog.params.cutoff.value.toFixed(1)}`);
    });

    moogResonance.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      voice.filters.moog.setResonance(value);
      e.target.nextElementSibling.textContent = value.toFixed(2);
    });

    moogDrive.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      voice.filters.moog.setDrive(value);
      e.target.nextElementSibling.textContent = value.toFixed(2);
    });

    moogWarmth.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      voice.filters.moog.setWarmth(value);
      e.target.nextElementSibling.textContent = value.toFixed(2);
    });

    // Initialize Moog filter to match UI defaults
    voice.filters.moog.setCutoff(sliderToFrequency(0.65));
    voice.filters.moog.setDrive(0.5);
    voice.filters.moog.setWarmth(1.0);

    // ===== WASP FILTER CONTROLS =====
    const waspCutoff = waspControls.querySelector('.wasp-cutoff');
    const waspResonance = waspControls.querySelector('.wasp-resonance');
    const waspMode = waspControls.querySelector('.wasp-mode');
    const waspDrive = waspControls.querySelector('.wasp-drive');
    const waspChaos = waspControls.querySelector('.wasp-chaos');

    waspCutoff.addEventListener('input', (e) => {
      const sliderValue = parseFloat(e.target.value);
      const freq = sliderToFrequency(sliderValue);
      voice.filters.wasp.setCutoff(freq);
      e.target.nextElementSibling.textContent = `${Math.round(freq)} Hz`;
    });

    waspResonance.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      voice.filters.wasp.setResonance(value);
      e.target.nextElementSibling.textContent = value.toFixed(2);
    });

    waspMode.addEventListener('change', (e) => {
      const value = parseInt(e.target.value);
      voice.filters.wasp.setMode(value);
      console.log(`Voice ${i + 1} Wasp mode: ${['LP', 'BP', 'HP', 'Notch'][value]}`);
    });

    waspDrive.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      voice.filters.wasp.setDrive(value);
      e.target.nextElementSibling.textContent = value.toFixed(2);
    });

    waspChaos.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      voice.filters.wasp.setChaos(value);
      e.target.nextElementSibling.textContent = value.toFixed(2);
    });

    // Initialize Wasp filter to match PROCESSOR defaults (not UI)
    voice.filters.wasp.setCutoff(sliderToFrequency(0.65));
    voice.filters.wasp.setResonance(0.5); // Match processor default!
    voice.filters.wasp.setDrive(0.5);
    voice.filters.wasp.setChaos(0.3); // Match processor default!
    voice.filters.wasp.setMode(0); // LP mode

    // ===== SEM FILTER CONTROLS =====
    const semCutoff = semControls.querySelector('.sem-cutoff');
    const semResonance = semControls.querySelector('.sem-resonance');
    const semMorph = semControls.querySelector('.sem-morph');
    const semDrive = semControls.querySelector('.sem-drive');

    semCutoff.addEventListener('input', (e) => {
      const sliderValue = parseFloat(e.target.value);
      const freq = sliderToFrequency(sliderValue);
      voice.filters.sem.setCutoff(freq);
      e.target.nextElementSibling.textContent = `${Math.round(freq)} Hz`;
    });

    semResonance.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      voice.filters.sem.setResonance(value);
      e.target.nextElementSibling.textContent = value.toFixed(2);
    });

    semMorph.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      voice.filters.sem.setMorph(value);
      e.target.nextElementSibling.textContent = value.toFixed(2);
    });

    semDrive.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      voice.filters.sem.setDrive(value);
      e.target.nextElementSibling.textContent = value.toFixed(2);
    });

    // Initialize SEM filter to match UI defaults
    voice.filters.sem.setCutoff(sliderToFrequency(0.65));
    voice.filters.sem.setDrive(3.0); // Higher drive for audible filtering (range: 0.1-10)

    // ===== THREE SISTERS FILTER CONTROLS =====
    const tsFreq = threeSistersControls.querySelector('.ts-freq');
    const tsSpan = threeSistersControls.querySelector('.ts-span');
    const tsQuality = threeSistersControls.querySelector('.ts-quality');
    const tsMode = threeSistersControls.querySelector('.ts-mode');

    tsFreq.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      // setFreq expects 0-1 knob value, but slider gives Hz
      // Convert Hz to knob value using logarithmic scale
      const knobValue = Math.log(value / 20) / Math.log(20000 / 20);
      voice.filters.threesisters.setFreq(knobValue);
      e.target.nextElementSibling.textContent = `${Math.round(value)} Hz`;
    });

    tsSpan.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      voice.filters.threesisters.setSpan(value);
      e.target.nextElementSibling.textContent = value.toFixed(2);
    });

    tsQuality.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      voice.filters.threesisters.setQuality(value);
      e.target.nextElementSibling.textContent = value.toFixed(2);
    });

    tsMode.addEventListener('change', (e) => {
      const value = parseInt(e.target.value);
      voice.filters.threesisters.setMode(value);
      console.log(`Voice ${i + 1} Three Sisters mode: ${['Crossover', 'Formant'][value]}`);
    });

    // Envelope controls
    const attackSlider = panel.querySelector('.env-attack');
    const decaySlider = panel.querySelector('.env-decay');

    attackSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      voice.envelope.setAttack(value);
      e.target.nextElementSibling.textContent = `${Math.round(value * 1000)} ms`;
    });

    decaySlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      voice.envelope.setDecay(value);
      e.target.nextElementSibling.textContent = `${Math.round(value * 1000)} ms`;
    });

    // Quantizer controls
    const quantizerSection = panel.querySelector('.quantizer-section');
    const scaleSelect = quantizerSection.querySelector('.quantizer-scale');
    const rootSelect = quantizerSection.querySelector('.quantizer-root');
    const pianoKeyboard = quantizerSection.querySelector('.piano-keyboard');
    const pianoKeys = pianoKeyboard.querySelectorAll('.piano-key');
    const depthSlider = quantizerSection.querySelector('.quantizer-depth');
    const offsetSlider = quantizerSection.querySelector('.quantizer-offset');

    // Helper to update piano keyboard from a mask
    const updatePianoKeyboard = (mask) => {
      pianoKeys.forEach(key => {
        const noteIdx = parseInt(key.dataset.note);
        key.classList.toggle('active', mask[noteIdx]);
      });
    };

    // Initialize piano keyboard to show all notes active (chromatic)
    updatePianoKeyboard(voice.quantizer.getNoteMask());

    // Scale preset selector
    scaleSelect.addEventListener('change', (e) => {
      const scale = e.target.value;
      const root = parseInt(rootSelect.value);

      switch (scale) {
        case 'chromatic':
          voice.quantizer.setChromatic();
          break;
        case 'major':
          voice.quantizer.setMajorScale(root);
          break;
        case 'minor':
          voice.quantizer.setMinorScale(root);
          break;
        case 'harmonic-minor':
          voice.quantizer.setHarmonicMinor(root);
          break;
        case 'melodic-minor':
          voice.quantizer.setMelodicMinor(root);
          break;
        case 'dorian':
          voice.quantizer.setDorianMode(root);
          break;
        case 'phrygian':
          voice.quantizer.setPhrygianMode(root);
          break;
        case 'lydian':
          voice.quantizer.setLydianMode(root);
          break;
        case 'mixolydian':
          voice.quantizer.setMixolydianMode(root);
          break;
        case 'locrian':
          voice.quantizer.setLocrianMode(root);
          break;
        case 'pentatonic-major':
          voice.quantizer.setPentatonicMajor(root);
          break;
        case 'pentatonic-minor':
          voice.quantizer.setPentatonicMinor(root);
          break;
        case 'blues':
          voice.quantizer.setBluesScale(root);
          break;
        case 'whole-tone':
          voice.quantizer.setWholeTone(root);
          break;
        case 'diminished':
          voice.quantizer.setDiminished(root);
          break;
      }

      // Update piano keyboard to reflect the new scale
      updatePianoKeyboard(voice.quantizer.getNoteMask());
      console.log(`Voice ${i + 1}: Quantizer scale set to ${scale} (root: ${rootSelect.options[rootSelect.selectedIndex].text})`);
    });

    // Root note selector
    rootSelect.addEventListener('change', (e) => {
      const root = parseInt(e.target.value);
      voice.quantizer.setRoot(root);

      // Re-apply current scale with new root
      const currentScale = scaleSelect.value;
      if (currentScale !== 'chromatic') {
        // Trigger scale change to recalculate with new root
        scaleSelect.dispatchEvent(new Event('change'));
      }
    });

    // Piano key click handlers
    pianoKeys.forEach(key => {
      key.addEventListener('click', () => {
        const noteIdx = parseInt(key.dataset.note);
        const isActive = key.classList.contains('active');

        // Toggle the note
        voice.quantizer.setNote(noteIdx, !isActive);
        key.classList.toggle('active', !isActive);

        console.log(`Voice ${i + 1}: Note ${key.title} ${!isActive ? 'enabled' : 'disabled'}`);
      });
    });

    // Depth slider
    depthSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      voice.quantizer.setDepth(value);
      e.target.nextElementSibling.textContent = value.toFixed(1);
    });

    // Offset slider
    offsetSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      voice.quantizer.setOffset(value);
      e.target.nextElementSibling.textContent = value.toFixed(2);
    });

    // Transpose sequencer controls
    const transposeSteps = panel.querySelectorAll('.transpose-step');
    transposeSteps.forEach((stepEl, stepIdx) => {
      const transposeInput = stepEl.querySelector('.step-transpose');
      const repeatsInput = stepEl.querySelector('.step-repeats');
      const activeCheckbox = stepEl.querySelector('.step-active-checkbox');

      const updateCell = () => {
        voice.transposeSeq.setCell(stepIdx, {
          transpose: parseInt(transposeInput.value),
          repeats: parseInt(repeatsInput.value),
          active: activeCheckbox.checked
        });
      };

      transposeInput.addEventListener('change', updateCell);
      repeatsInput.addEventListener('change', updateCell);
      activeCheckbox.addEventListener('change', () => {
        updateCell();
        stepEl.classList.toggle('active', activeCheckbox.checked);
      });
    });

    // Set up step highlight handler using addEventListener (don't overwrite the node's handler)
    // TransposeSequencerNode already has its own port.onmessage, so we use the custom event it dispatches
    voice.transposeSeq.addEventListener('step-changed', (event) => {
      transposeSteps.forEach(s => s.classList.remove('current'));
      const currentStepEl = transposeSteps[event.detail.step];
      if (currentStepEl) {
        currentStepEl.classList.add('current');
      }
    });

    // Transpose mode selector
    const modeSelect = panel.querySelector('.transpose-mode-select');
    modeSelect.addEventListener('change', (e) => {
      voice.transposeSeq.setPlaybackMode(e.target.value);
    });

    // Clear button
    const clearBtn = panel.querySelector('.transpose-clear-btn');
    clearBtn.addEventListener('click', () => {
      voice.transposeSeq.clearCells();
      // Reset UI
      transposeSteps.forEach(stepEl => {
        stepEl.querySelector('.step-transpose').value = 0;
        stepEl.querySelector('.step-repeats').value = 1;
        stepEl.querySelector('.step-active-checkbox').checked = false;
        stepEl.classList.remove('active');
      });
    });
  });
}

function buildFMOscUI() {
  const container = document.getElementById('fmOscGrid');
  if (!container) return;

  ['A', 'B', 'C', 'D'].forEach(letter => {
    const panel = document.createElement('div');
    panel.className = 'fm-osc-module';
    const usage = letter === 'A' || letter === 'B' ? 'Osc FM' : 'Filter FM';
    panel.innerHTML = `
      <h4>FM ${letter} <span class="fm-usage">(${usage})</span></h4>
      <div class="param-row">
        <label>pitch</label>
        <input type="range" class="fm-pitch" data-osc="${letter}" min="0" max="1" step="0.01" value="0.5">
        <span class="value-display">0.50</span>
      </div>
      <div class="param-row">
        <label>fine</label>
        <input type="range" class="fm-fine" data-osc="${letter}" min="0" max="1" step="0.001" value="0.5">
        <span class="value-display">0.500</span>
      </div>
      <div class="param-row">
        <label>barrel</label>
        <input type="range" class="fm-barrel" data-osc="${letter}" min="0" max="1" step="0.01" value="0.5">
        <span class="value-display">0.50</span>
      </div>
      <div class="param-row">
        <label>formant</label>
        <input type="range" class="fm-formant" data-osc="${letter}" min="0" max="1" step="0.01" value="0.48">
        <span class="value-display">0.48</span>
      </div>
      <div class="param-row">
        <label>air</label>
        <input type="range" class="fm-air" data-osc="${letter}" min="0" max="1" step="0.01" value="0.5">
        <span class="value-display">0.50</span>
      </div>
      <div class="param-row">
        <label>fm index</label>
        <input type="range" class="fm-index" data-osc="${letter}" min="0" max="1" step="0.01" value="1.0">
        <span class="value-display">1.00</span>
      </div>
    `;
    container.appendChild(panel);

    const osc = app.fmOscillators[letter];

    // Pitch
    const pitchSlider = panel.querySelector('.fm-pitch');
    pitchSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      osc.setPitch(value);
      e.target.nextElementSibling.textContent = value.toFixed(2);
    });

    // Fine
    const fineSlider = panel.querySelector('.fm-fine');
    fineSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      osc.setFine(value);
      e.target.nextElementSibling.textContent = value.toFixed(3);
    });

    // Barrel
    const barrelSlider = panel.querySelector('.fm-barrel');
    barrelSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      osc.setBarrel(value);
      e.target.nextElementSibling.textContent = value.toFixed(2);
    });

    // Formant
    const formantSlider = panel.querySelector('.fm-formant');
    formantSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      osc.setFormant(value);
      e.target.nextElementSibling.textContent = value.toFixed(2);
    });

    // Air
    const airSlider = panel.querySelector('.fm-air');
    airSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      osc.setAir(value);
      e.target.nextElementSibling.textContent = value.toFixed(2);
    });

    // FM Index
    const indexSlider = panel.querySelector('.fm-index');
    indexSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      osc.setFMIndex(value);
      e.target.nextElementSibling.textContent = value.toFixed(2);
    });
  });
}

function buildMixerUI() {
  const container = document.getElementById('mixerChannels');
  if (!container) return;

  app.mixerChannels.forEach((channel, i) => {
    const panel = document.createElement('div');
    panel.className = 'mixer-channel';
    panel.innerHTML = `
      <h4>CH ${i + 1}</h4>
      <div class="param-row">
        <label>level</label>
        <input type="range" class="ch-level" data-ch="${i}" min="0" max="1" step="0.01" value="0.8">
      </div>
      <div class="param-row">
        <label>pan</label>
        <input type="range" class="ch-pan" data-ch="${i}" min="-1" max="1" step="0.01" value="0">
      </div>

      <!-- Saturation Controls -->
      <div class="saturation-section">
        <h5>saturation</h5>
        <div class="param-row">
          <label>type</label>
          <select class="sat-mode" data-ch="${i}">
            <option value="tape" selected>Tape</option>
            <option value="triode">Triode</option>
            <option value="pentode">Pentode</option>
            <option value="transformer">Transformer</option>
          </select>
        </div>
        <div class="param-row">
          <label>drive</label>
          <input type="range" class="sat-drive" data-ch="${i}" min="0" max="1" step="0.01" value="0">
          <span class="value-display">0%</span>
        </div>
        <div class="param-row">
          <label>bias</label>
          <input type="range" class="sat-bias" data-ch="${i}" min="-1" max="1" step="0.01" value="0">
          <span class="value-display">0</span>
        </div>
        <div class="param-row">
          <label>mix</label>
          <input type="range" class="sat-mix" data-ch="${i}" min="0" max="1" step="0.01" value="1">
          <span class="value-display">100%</span>
        </div>
      </div>

      <!-- Sends -->
      <div class="sends-section">
        <h5>sends</h5>
        <div class="param-row">
          <label>A (Mime)</label>
          <input type="range" class="ch-sendA" data-ch="${i}" min="0" max="1" step="0.01" value="0">
        </div>
        <div class="param-row">
          <label>B (Grey)</label>
          <input type="range" class="ch-sendB" data-ch="${i}" min="0" max="1" step="0.01" value="0">
        </div>
        <div class="param-row">
          <label>C (Zita)</label>
          <input type="range" class="ch-sendC" data-ch="${i}" min="0" max="1" step="0.01" value="0">
        </div>
      </div>

      <div class="mixer-buttons">
        <button class="mixer-mute-btn" data-ch="${i}">M</button>
        <button class="mixer-solo-btn" data-ch="${i}">S</button>
      </div>
    `;
    container.appendChild(panel);

    // Level and Pan
    panel.querySelector('.ch-level').addEventListener('input', (e) => {
      channel.setLevel(parseFloat(e.target.value));
    });

    panel.querySelector('.ch-pan').addEventListener('input', (e) => {
      channel.setPan(parseFloat(e.target.value));
    });

    // Saturation controls
    panel.querySelector('.sat-mode').addEventListener('change', (e) => {
      channel.saturation.setMode(e.target.value);
      console.log(`CH ${i + 1} Saturation mode: ${e.target.value}`);
    });

    panel.querySelector('.sat-drive').addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      channel.saturation.setDrive(value);
      e.target.nextElementSibling.textContent = Math.round(value * 100) + '%';
    });

    panel.querySelector('.sat-bias').addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      channel.saturation.setBias(value);
      e.target.nextElementSibling.textContent = value.toFixed(2);
    });

    panel.querySelector('.sat-mix').addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      channel.saturation.setMix(value);
      e.target.nextElementSibling.textContent = Math.round(value * 100) + '%';
    });

    // Send controls
    panel.querySelector('.ch-sendA').addEventListener('input', (e) => {
      channel.setSendA(parseFloat(e.target.value));
    });

    panel.querySelector('.ch-sendB').addEventListener('input', (e) => {
      channel.setSendB(parseFloat(e.target.value));
    });

    panel.querySelector('.ch-sendC').addEventListener('input', (e) => {
      channel.setSendC(parseFloat(e.target.value));
    });

    // Mute/Solo buttons
    panel.querySelector('.mixer-mute-btn').addEventListener('click', (e) => {
      const btn = e.target;
      btn.classList.toggle('active');
      channel.setMute(btn.classList.contains('active'));
    });

    panel.querySelector('.mixer-solo-btn').addEventListener('click', (e) => {
      const btn = e.target;
      btn.classList.toggle('active');
      channel.setSolo(btn.classList.contains('active'));
      app.updateSoloStates();
    });
  });

  // ========== USB AUDIO CHANNEL ==========
  buildUSBAudioChannelUI(container);
}

function buildUSBAudioChannelUI(container) {
  const channel = app.usbAudioChannel;

  const panel = document.createElement('div');
  panel.className = 'mixer-channel usb-audio-channel';
  panel.innerHTML = `
    <h4>USB Audio</h4>

    <!-- Device Selection -->
    <div class="usb-controls">
      <div class="param-row">
        <label>device</label>
        <select class="usb-device-select">
          <option value="">-- select device --</option>
        </select>
      </div>
      <button class="usb-enable-btn">Enable</button>
    </div>

    <div class="param-row">
      <label>input</label>
      <input type="range" class="usb-input-gain" min="0" max="2" step="0.01" value="1">
      <span class="value-display">100%</span>
    </div>

    <div class="param-row">
      <label>level</label>
      <input type="range" class="usb-level" min="0" max="1" step="0.01" value="0">
    </div>
    <div class="param-row">
      <label>pan</label>
      <input type="range" class="usb-pan" min="-1" max="1" step="0.01" value="0">
    </div>

    <!-- Saturation Controls -->
    <div class="saturation-section">
      <h5>saturation</h5>
      <div class="param-row">
        <label>type</label>
        <select class="usb-sat-mode">
          <option value="tape" selected>Tape</option>
          <option value="triode">Triode</option>
          <option value="pentode">Pentode</option>
          <option value="transformer">Transformer</option>
        </select>
      </div>
      <div class="param-row">
        <label>drive</label>
        <input type="range" class="usb-sat-drive" min="0" max="1" step="0.01" value="0">
        <span class="value-display">0%</span>
      </div>
      <div class="param-row">
        <label>bias</label>
        <input type="range" class="usb-sat-bias" min="-1" max="1" step="0.01" value="0">
        <span class="value-display">0</span>
      </div>
      <div class="param-row">
        <label>mix</label>
        <input type="range" class="usb-sat-mix" min="0" max="1" step="0.01" value="1">
        <span class="value-display">100%</span>
      </div>
    </div>

    <!-- Sends -->
    <div class="sends-section">
      <h5>sends</h5>
      <div class="param-row">
        <label>A (Mime)</label>
        <input type="range" class="usb-sendA" min="0" max="1" step="0.01" value="0">
      </div>
      <div class="param-row">
        <label>B (Grey)</label>
        <input type="range" class="usb-sendB" min="0" max="1" step="0.01" value="0">
      </div>
      <div class="param-row">
        <label>C (Zita)</label>
        <input type="range" class="usb-sendC" min="0" max="1" step="0.01" value="0">
      </div>
    </div>

    <div class="mixer-buttons">
      <button class="mixer-mute-btn usb-mute">M</button>
      <button class="mixer-solo-btn usb-solo">S</button>
    </div>
  `;
  container.appendChild(panel);

  // Device selection
  const deviceSelect = panel.querySelector('.usb-device-select');
  const enableBtn = panel.querySelector('.usb-enable-btn');

  // Populate device list on first click
  deviceSelect.addEventListener('focus', async () => {
    const devices = await channel.enumerateDevices();
    deviceSelect.innerHTML = '<option value="">-- select device --</option>';
    devices.forEach(device => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.textContent = device.label || `Device ${device.deviceId.slice(0, 8)}`;
      deviceSelect.appendChild(option);
    });
  });

  deviceSelect.addEventListener('change', (e) => {
    if (e.target.value) {
      channel.selectedDeviceId = e.target.value;
    }
  });

  enableBtn.addEventListener('click', async () => {
    if (channel.enabled) {
      await channel.disable();
      enableBtn.textContent = 'Enable';
      enableBtn.classList.remove('active');
    } else {
      const success = await channel.enable(deviceSelect.value || null);
      if (success) {
        enableBtn.textContent = 'Disable';
        enableBtn.classList.add('active');
        // Update level slider to show actual level
        panel.querySelector('.usb-level').value = channel.fader.gain.value;
      }
    }
  });

  // Input gain
  panel.querySelector('.usb-input-gain').addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    channel.setInputGain(value);
    e.target.nextElementSibling.textContent = Math.round(value * 100) + '%';
  });

  // Level and Pan
  panel.querySelector('.usb-level').addEventListener('input', (e) => {
    channel.setLevel(parseFloat(e.target.value));
  });

  panel.querySelector('.usb-pan').addEventListener('input', (e) => {
    channel.setPan(parseFloat(e.target.value));
  });

  // Saturation controls
  panel.querySelector('.usb-sat-mode').addEventListener('change', (e) => {
    channel.saturation.setMode(e.target.value);
    console.log(`USB Audio Saturation mode: ${e.target.value}`);
  });

  panel.querySelector('.usb-sat-drive').addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    channel.saturation.setDrive(value);
    e.target.nextElementSibling.textContent = Math.round(value * 100) + '%';
  });

  panel.querySelector('.usb-sat-bias').addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    channel.saturation.setBias(value);
    e.target.nextElementSibling.textContent = value.toFixed(2);
  });

  panel.querySelector('.usb-sat-mix').addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    channel.saturation.setMix(value);
    e.target.nextElementSibling.textContent = Math.round(value * 100) + '%';
  });

  // Send controls
  panel.querySelector('.usb-sendA').addEventListener('input', (e) => {
    channel.setSendA(parseFloat(e.target.value));
  });

  panel.querySelector('.usb-sendB').addEventListener('input', (e) => {
    channel.setSendB(parseFloat(e.target.value));
  });

  panel.querySelector('.usb-sendC').addEventListener('input', (e) => {
    channel.setSendC(parseFloat(e.target.value));
  });

  // Mute/Solo buttons
  panel.querySelector('.usb-mute').addEventListener('click', (e) => {
    const btn = e.target;
    btn.classList.toggle('active');
    channel.setMute(btn.classList.contains('active'));
  });

  panel.querySelector('.usb-solo').addEventListener('click', (e) => {
    const btn = e.target;
    btn.classList.toggle('active');
    channel.setSolo(btn.classList.contains('active'));
    app.updateSoloStates();
  });
}

function buildSendsUI() {
  const container = document.getElementById('sendsGrid');
  if (!container) return;

  // ========== MIMEOPHON ==========
  const mimeophonPanel = document.createElement('div');
  mimeophonPanel.className = 'send-module send-module-large';
  mimeophonPanel.innerHTML = `
    <div class="send-header">
      <h4>Mimeophon</h4>
      <select class="mimeophon-preset">
        <option value="">-- preset --</option>
        <option value="karplus">Karplus String</option>
        <option value="flange">Flange</option>
        <option value="chorus">Chorus</option>
        <option value="slapback">Slapback</option>
        <option value="dubEcho">Dub Echo</option>
        <option value="tapeDelay">Tape Delay</option>
        <option value="ambient">Ambient</option>
        <option value="shimmer">Shimmer</option>
      </select>
    </div>

    <div class="send-controls-grid">
      <!-- Zone Buttons -->
      <div class="zone-buttons">
        <button class="zone-btn" data-zone="0">A<span class="zone-range">5-50ms</span></button>
        <button class="zone-btn active" data-zone="1">B<span class="zone-range">50-400ms</span></button>
        <button class="zone-btn" data-zone="2">C<span class="zone-range">0.4-2s</span></button>
        <button class="zone-btn" data-zone="3">D<span class="zone-range">2-10s</span></button>
      </div>

      <div class="param-row">
        <label>rate</label>
        <input type="range" class="mime-rate" min="0" max="1" step="0.01" value="0.5">
        <span class="value-display">50%</span>
      </div>
      <div class="param-row">
        <label>repeats</label>
        <input type="range" class="mime-repeats" min="0" max="1.2" step="0.01" value="0.3">
        <span class="value-display">30%</span>
      </div>
      <div class="param-row">
        <label>color</label>
        <input type="range" class="mime-color" min="0" max="1" step="0.01" value="0.5">
        <span class="value-display">tape</span>
      </div>
      <div class="param-row">
        <label>halo</label>
        <input type="range" class="mime-halo" min="0" max="1" step="0.01" value="0">
        <span class="value-display">0%</span>
      </div>
      <div class="param-row">
        <label>skew</label>
        <input type="range" class="mime-skew" min="-1" max="1" step="0.01" value="0">
        <span class="value-display">0</span>
      </div>
      <div class="param-row">
        <label>mix</label>
        <input type="range" class="mime-mix" min="0" max="1" step="0.01" value="0.5">
        <span class="value-display">50%</span>
      </div>

      <div class="toggle-buttons">
        <button class="toggle-btn mime-hold">hold</button>
        <button class="toggle-btn mime-flip">flip</button>
        <button class="toggle-btn mime-pingpong">ping-pong</button>
      </div>

      <div class="param-row">
        <label>return</label>
        <input type="range" class="send-return" min="0" max="1" step="0.01" value="1">
        <span class="value-display">100%</span>
      </div>
    </div>
  `;
  container.appendChild(mimeophonPanel);

  // Mimeophon event listeners
  const mimeophon = app.sendEffects.mimeophon.effect;

  const getColorName = (val) => {
    if (val < 0.2) return 'dark';
    if (val < 0.4) return 'BBD';
    if (val < 0.6) return 'tape';
    if (val < 0.8) return 'bright';
    return 'crisp';
  };

  // Zone buttons
  mimeophonPanel.querySelectorAll('.zone-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      mimeophonPanel.querySelectorAll('.zone-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      mimeophon.setZone(parseInt(btn.dataset.zone));
    });
  });

  // Rate
  mimeophonPanel.querySelector('.mime-rate').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    mimeophon.setRate(val);
    e.target.nextElementSibling.textContent = Math.round(val * 100) + '%';
  });

  // Repeats
  mimeophonPanel.querySelector('.mime-repeats').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    mimeophon.setRepeats(val);
    e.target.nextElementSibling.textContent = Math.round(val * 100) + '%';
  });

  // Color
  mimeophonPanel.querySelector('.mime-color').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    mimeophon.setColor(val);
    e.target.nextElementSibling.textContent = getColorName(val);
  });

  // Halo
  mimeophonPanel.querySelector('.mime-halo').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    mimeophon.setHalo(val);
    e.target.nextElementSibling.textContent = Math.round(val * 100) + '%';
  });

  // Skew
  mimeophonPanel.querySelector('.mime-skew').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    mimeophon.setSkew(val);
    if (val > 0) {
      e.target.nextElementSibling.textContent = 'R' + Math.round(val * 100);
    } else if (val < 0) {
      e.target.nextElementSibling.textContent = 'L' + Math.round(Math.abs(val) * 100);
    } else {
      e.target.nextElementSibling.textContent = '0';
    }
  });

  // Mix
  mimeophonPanel.querySelector('.mime-mix').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    mimeophon.setMix(val);
    e.target.nextElementSibling.textContent = Math.round(val * 100) + '%';
  });

  // Toggle buttons
  mimeophonPanel.querySelector('.mime-hold').addEventListener('click', (e) => {
    e.target.classList.toggle('active');
    mimeophon.setHold(e.target.classList.contains('active'));
  });

  mimeophonPanel.querySelector('.mime-flip').addEventListener('click', (e) => {
    e.target.classList.toggle('active');
    mimeophon.setFlip(e.target.classList.contains('active'));
  });

  mimeophonPanel.querySelector('.mime-pingpong').addEventListener('click', (e) => {
    e.target.classList.toggle('active');
    mimeophon.setPingPong(e.target.classList.contains('active'));
  });

  // Return level
  mimeophonPanel.querySelector('.send-return').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    app.sendEffects.mimeophon.setReturnLevel(val);
    e.target.nextElementSibling.textContent = Math.round(val * 100) + '%';
  });

  // Preset selector
  mimeophonPanel.querySelector('.mimeophon-preset').addEventListener('change', (e) => {
    const presetName = e.target.value;
    if (!presetName) return;

    const presets = StandaloneMimeophon.getPresets();
    const preset = presets[presetName];
    if (preset) {
      mimeophon.loadPreset(preset);
      // Update UI to match preset
      if (preset.zone !== undefined) {
        mimeophonPanel.querySelectorAll('.zone-btn').forEach(btn => {
          btn.classList.toggle('active', parseInt(btn.dataset.zone) === preset.zone);
        });
      }
      if (preset.rate !== undefined) {
        mimeophonPanel.querySelector('.mime-rate').value = preset.rate;
        mimeophonPanel.querySelector('.mime-rate').nextElementSibling.textContent = Math.round(preset.rate * 100) + '%';
      }
      if (preset.repeats !== undefined) {
        mimeophonPanel.querySelector('.mime-repeats').value = preset.repeats;
        mimeophonPanel.querySelector('.mime-repeats').nextElementSibling.textContent = Math.round(preset.repeats * 100) + '%';
      }
      if (preset.color !== undefined) {
        mimeophonPanel.querySelector('.mime-color').value = preset.color;
        mimeophonPanel.querySelector('.mime-color').nextElementSibling.textContent = getColorName(preset.color);
      }
      if (preset.halo !== undefined) {
        mimeophonPanel.querySelector('.mime-halo').value = preset.halo;
        mimeophonPanel.querySelector('.mime-halo').nextElementSibling.textContent = Math.round(preset.halo * 100) + '%';
      }
      if (preset.skew !== undefined) {
        mimeophonPanel.querySelector('.mime-skew').value = preset.skew;
      }
      if (preset.mix !== undefined) {
        mimeophonPanel.querySelector('.mime-mix').value = preset.mix;
        mimeophonPanel.querySelector('.mime-mix').nextElementSibling.textContent = Math.round(preset.mix * 100) + '%';
      }
    }
    setTimeout(() => { e.target.value = ''; }, 100);
  });

  // ========== GREYHOLE ==========
  const greyholePanel = document.createElement('div');
  greyholePanel.className = 'send-module send-module-large';
  greyholePanel.innerHTML = `
    <h4>Greyhole</h4>
    <div class="send-controls-grid">
      <div class="param-row">
        <label>delay time</label>
        <input type="range" class="grey-delayTime" min="0" max="10" step="0.1" value="2">
        <span class="value-display">2.0s</span>
      </div>
      <div class="param-row">
        <label>size</label>
        <input type="range" class="grey-size" min="0.5" max="5" step="0.1" value="3">
        <span class="value-display">3.0</span>
      </div>
      <div class="param-row">
        <label>feedback</label>
        <input type="range" class="grey-feedback" min="0" max="1" step="0.01" value="0.7">
        <span class="value-display">70%</span>
      </div>
      <div class="param-row">
        <label>damping</label>
        <input type="range" class="grey-damping" min="0" max="1" step="0.01" value="0.1">
        <span class="value-display">10%</span>
      </div>
      <div class="param-row">
        <label>diffusion</label>
        <input type="range" class="grey-diffusion" min="0" max="1" step="0.01" value="0.7">
        <span class="value-display">70%</span>
      </div>
      <div class="param-row">
        <label>mod depth</label>
        <input type="range" class="grey-modDepth" min="0" max="1" step="0.01" value="0">
        <span class="value-display">0%</span>
      </div>
      <div class="param-row">
        <label>mod freq</label>
        <input type="range" class="grey-modFreq" min="0" max="10" step="0.1" value="0.1">
        <span class="value-display">0.1 Hz</span>
      </div>
      <div class="param-row">
        <label>mix</label>
        <input type="range" class="grey-mix" min="0" max="1" step="0.01" value="1">
        <span class="value-display">100%</span>
      </div>
      <div class="param-row">
        <label>return</label>
        <input type="range" class="send-return" min="0" max="1" step="0.01" value="1">
        <span class="value-display">100%</span>
      </div>
    </div>
  `;
  container.appendChild(greyholePanel);

  // Greyhole event listeners
  const greyhole = app.sendEffects.greyhole.effect;

  greyholePanel.querySelector('.grey-delayTime').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    greyhole.delayTime = val;
    e.target.nextElementSibling.textContent = val.toFixed(1) + 's';
  });

  greyholePanel.querySelector('.grey-size').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    greyhole.size = val;
    e.target.nextElementSibling.textContent = val.toFixed(1);
  });

  greyholePanel.querySelector('.grey-feedback').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    greyhole.feedback = val;
    e.target.nextElementSibling.textContent = Math.round(val * 100) + '%';
  });

  greyholePanel.querySelector('.grey-damping').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    greyhole.damping = val;
    e.target.nextElementSibling.textContent = Math.round(val * 100) + '%';
  });

  greyholePanel.querySelector('.grey-diffusion').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    greyhole.diffusion = val;
    e.target.nextElementSibling.textContent = Math.round(val * 100) + '%';
  });

  greyholePanel.querySelector('.grey-modDepth').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    greyhole.modDepth = val;
    e.target.nextElementSibling.textContent = Math.round(val * 100) + '%';
  });

  greyholePanel.querySelector('.grey-modFreq').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    greyhole.modFreq = val;
    e.target.nextElementSibling.textContent = val.toFixed(1) + ' Hz';
  });

  greyholePanel.querySelector('.grey-mix').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    greyhole.mix = val;
    e.target.nextElementSibling.textContent = Math.round(val * 100) + '%';
  });

  greyholePanel.querySelector('.send-return').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    app.sendEffects.greyhole.setReturnLevel(val);
    e.target.nextElementSibling.textContent = Math.round(val * 100) + '%';
  });

  // ========== ZITA REVERB ==========
  const zitaPanel = document.createElement('div');
  zitaPanel.className = 'send-module send-module-large';
  zitaPanel.innerHTML = `
    <div class="send-header">
      <h4>Zita Reverb</h4>
      <select class="zita-preset">
        <option value="">-- preset --</option>
        <option value="small">Small Room</option>
        <option value="medium">Medium Hall</option>
        <option value="large">Large Hall</option>
        <option value="hall">Concert Hall</option>
        <option value="bright">Bright Space</option>
        <option value="dark">Dark Chamber</option>
      </select>
    </div>
    <div class="send-controls-grid">
      <div class="param-row">
        <label>pre-delay</label>
        <input type="range" class="zita-preDel" min="0" max="200" step="1" value="20">
        <span class="value-display">20 ms</span>
      </div>
      <div class="param-row">
        <label>LF crossover</label>
        <input type="range" class="zita-lfFc" min="30" max="1200" step="10" value="200">
        <span class="value-display">200 Hz</span>
      </div>
      <div class="param-row">
        <label>low RT60</label>
        <input type="range" class="zita-lowRt60" min="0.1" max="3" step="0.1" value="1">
        <span class="value-display">1.0s</span>
      </div>
      <div class="param-row">
        <label>mid RT60</label>
        <input type="range" class="zita-midRt60" min="0.1" max="3" step="0.1" value="1">
        <span class="value-display">1.0s</span>
      </div>
      <div class="param-row">
        <label>HF damping</label>
        <input type="range" class="zita-hfDamp" min="1200" max="23520" step="100" value="6000">
        <span class="value-display">6000 Hz</span>
      </div>
      <div class="param-row">
        <label>return</label>
        <input type="range" class="send-return" min="0" max="1" step="0.01" value="1">
        <span class="value-display">100%</span>
      </div>
    </div>
  `;
  container.appendChild(zitaPanel);

  // Zita event listeners
  const zita = app.sendEffects.zita.effect;

  zitaPanel.querySelector('.zita-preDel').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    zita.setPreDelay(val);
    e.target.nextElementSibling.textContent = val + ' ms';
  });

  zitaPanel.querySelector('.zita-lfFc').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    zita.setLowFreqCrossover(val);
    e.target.nextElementSibling.textContent = val + ' Hz';
  });

  zitaPanel.querySelector('.zita-lowRt60').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    zita.setLowRT60(val);
    e.target.nextElementSibling.textContent = val.toFixed(1) + 's';
  });

  zitaPanel.querySelector('.zita-midRt60').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    zita.setMidRT60(val);
    e.target.nextElementSibling.textContent = val.toFixed(1) + 's';
  });

  zitaPanel.querySelector('.zita-hfDamp').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    zita.setHighFreqDamping(val);
    e.target.nextElementSibling.textContent = val + ' Hz';
  });

  zitaPanel.querySelector('.send-return').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    app.sendEffects.zita.setReturnLevel(val);
    e.target.nextElementSibling.textContent = Math.round(val * 100) + '%';
  });

  // Zita preset selector
  zitaPanel.querySelector('.zita-preset').addEventListener('change', (e) => {
    const presetName = e.target.value;
    if (!presetName) return;

    zita.loadPreset(presetName);

    // Update UI from preset
    const preset = zita.constructor.presets[presetName];
    if (preset) {
      if (preset.preDel !== undefined) {
        zitaPanel.querySelector('.zita-preDel').value = preset.preDel;
        zitaPanel.querySelector('.zita-preDel').nextElementSibling.textContent = preset.preDel + ' ms';
      }
      if (preset.lfFc !== undefined) {
        zitaPanel.querySelector('.zita-lfFc').value = preset.lfFc;
        zitaPanel.querySelector('.zita-lfFc').nextElementSibling.textContent = preset.lfFc + ' Hz';
      }
      if (preset.lowRt60 !== undefined) {
        zitaPanel.querySelector('.zita-lowRt60').value = preset.lowRt60;
        zitaPanel.querySelector('.zita-lowRt60').nextElementSibling.textContent = preset.lowRt60.toFixed(1) + 's';
      }
      if (preset.midRt60 !== undefined) {
        zitaPanel.querySelector('.zita-midRt60').value = preset.midRt60;
        zitaPanel.querySelector('.zita-midRt60').nextElementSibling.textContent = preset.midRt60.toFixed(1) + 's';
      }
      if (preset.hfDamp !== undefined) {
        zitaPanel.querySelector('.zita-hfDamp').value = preset.hfDamp;
        zitaPanel.querySelector('.zita-hfDamp').nextElementSibling.textContent = preset.hfDamp + ' Hz';
      }
    }
    setTimeout(() => { e.target.value = ''; }, 100);
  });
}

function buildLFOUI() {
  const container = document.getElementById('lfoGrid');
  if (!container) return;

  const waveforms = [
    'Sine', 'Square', 'Triangle', 'S&H', 'Smooth Random',
    'Ramp Down', 'Ramp Up', 'Exp Down', 'Exp Up'
  ];

  const modes = ['Unipolar', 'Bipolar', 'Inv Unipolar', 'Inv Bipolar'];

  // Build destination options from app.destinationMap
  const destOptions = Object.keys(app.destinationMap).map(key =>
    `<option value="${key}">${key}</option>`
  ).join('');

  app.lfos.forEach((lfo, i) => {
    const panel = document.createElement('div');
    panel.className = 'lfo-module collapsed';
    panel.innerHTML = `
      <div class="lfo-header">
        <button class="lfo-expand-btn">▶</button>
        <h4>LFO ${i + 1}</h4>
        <span class="lfo-quick-info">
          <span class="lfo-rate-display">1.00 Hz</span>
        </span>
      </div>
      <div class="lfo-content">
        <div class="param-row">
          <label>rate (Hz)</label>
          <input type="range" class="lfo-rate" data-lfo="${i}" min="0.01" max="20" step="0.01" value="1">
          <span class="value-display">1.00</span>
        </div>
        <div class="param-row">
          <label>waveform</label>
          <select class="lfo-waveform" data-lfo="${i}">
            ${waveforms.map((w, idx) =>
              `<option value="${idx}"${idx === 0 ? ' selected' : ''}>${w}</option>`
            ).join('')}
          </select>
        </div>
        <div class="param-row">
          <label>phase</label>
          <input type="range" class="lfo-phase" data-lfo="${i}" min="0" max="1" step="0.01" value="0">
          <span class="value-display">0.00</span>
        </div>

        <div class="lfo-sync-section">
          <div class="param-row">
            <label>clock sync</label>
            <button class="lfo-sync-btn" data-lfo="${i}">Off</button>
            <select class="lfo-sync-division" data-lfo="${i}" disabled>
              <option value="1">1/16 note</option>
              <option value="2">1/8 note</option>
              <option value="4" selected>1/4 note</option>
              <option value="8">1/2 note</option>
              <option value="16">1 bar</option>
              <option value="32">2 bars</option>
              <option value="64">4 bars</option>
              <option value="128">8 bars</option>
            </select>
          </div>
        </div>

        <div class="lfo-destination" data-dest="0">
          <h5>Destination A</h5>
          <div class="param-row">
            <label>target</label>
            <select class="lfo-dest-target">
              <option value="" selected>None</option>
              ${destOptions}
            </select>
          </div>
          <div class="param-row">
            <label>depth</label>
            <input type="range" class="lfo-dest-depth" min="0" max="1" step="0.01" value="0.5">
            <span class="value-display">0.50</span>
          </div>
          <div class="param-row">
            <label>offset</label>
            <input type="range" class="lfo-dest-offset" min="-1" max="1" step="0.01" value="0">
            <span class="value-display">0.00</span>
          </div>
          <div class="param-row">
            <label>mode</label>
            <select class="lfo-dest-mode">
              ${modes.map((m, idx) =>
                `<option value="${idx}"${idx === 0 ? ' selected' : ''}>${m}</option>`
              ).join('')}
            </select>
          </div>
        </div>

        <div class="lfo-destination" data-dest="1">
          <h5>Destination B</h5>
          <div class="param-row">
            <label>target</label>
            <select class="lfo-dest-target">
              <option value="" selected>None</option>
              ${destOptions}
            </select>
          </div>
          <div class="param-row">
            <label>depth</label>
            <input type="range" class="lfo-dest-depth" min="0" max="1" step="0.01" value="0.5">
            <span class="value-display">0.50</span>
          </div>
          <div class="param-row">
            <label>offset</label>
            <input type="range" class="lfo-dest-offset" min="-1" max="1" step="0.01" value="0">
            <span class="value-display">0.00</span>
          </div>
          <div class="param-row">
            <label>mode</label>
            <select class="lfo-dest-mode">
              ${modes.map((m, idx) =>
                `<option value="${idx}"${idx === 0 ? ' selected' : ''}>${m}</option>`
              ).join('')}
            </select>
          </div>
        </div>
      </div>
    `;
    container.appendChild(panel);

    // Expand/collapse
    const expandBtn = panel.querySelector('.lfo-expand-btn');
    expandBtn.addEventListener('click', () => {
      panel.classList.toggle('collapsed');
      expandBtn.textContent = panel.classList.contains('collapsed') ? '▶' : '▼';
    });

    // Rate control
    const rateSlider = panel.querySelector('.lfo-rate');
    const rateDisplay = panel.querySelector('.lfo-rate-display');
    rateSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      lfo.setRate(value);
      e.target.nextElementSibling.textContent = value.toFixed(2);
      rateDisplay.textContent = `${value.toFixed(2)} Hz`;
    });

    // Waveform control
    const waveformSelect = panel.querySelector('.lfo-waveform');
    waveformSelect.addEventListener('change', (e) => {
      lfo.setWaveform(parseInt(e.target.value));
    });

    // Phase control
    const phaseSlider = panel.querySelector('.lfo-phase');
    phaseSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      lfo.setPhase(value);
      e.target.nextElementSibling.textContent = value.toFixed(2);
    });

    // Clock sync controls
    const syncBtn = panel.querySelector('.lfo-sync-btn');
    const syncDivision = panel.querySelector('.lfo-sync-division');

    syncBtn.addEventListener('click', () => {
      const isEnabled = syncBtn.textContent === 'On';
      const newState = !isEnabled;

      lfo.setClockSync(newState);
      syncBtn.textContent = newState ? 'On' : 'Off';
      syncBtn.classList.toggle('active', newState);
      syncDivision.disabled = !newState;

      // When sync enabled, disable rate slider (rate is controlled by clock)
      rateSlider.disabled = newState;
      if (newState) {
        rateDisplay.textContent = 'Synced';
      } else {
        rateDisplay.textContent = `${lfo.params.rate.value.toFixed(2)} Hz`;
      }
    });

    syncDivision.addEventListener('change', (e) => {
      const division = parseFloat(e.target.value);
      lfo.setClockDivision(division);
    });

    // Destination controls (A and B)
    panel.querySelectorAll('.lfo-destination').forEach(destEl => {
      const destIndex = parseInt(destEl.dataset.dest);
      const targetSelect = destEl.querySelector('.lfo-dest-target');
      const depthSlider = destEl.querySelector('.lfo-dest-depth');
      const offsetSlider = destEl.querySelector('.lfo-dest-offset');
      const modeSelect = destEl.querySelector('.lfo-dest-mode');

      const updateDestination = () => {
        const targetKey = targetSelect.value;
        if (!targetKey) {
          lfo.setDestination(destIndex, null);
          return;
        }

        const destInfo = app.destinationMap[targetKey];
        if (!destInfo || !destInfo.param) {
          console.error(`Destination ${targetKey} not found in map`);
          return;
        }

        // Extract param and scale from destination info
        const { param, scale } = destInfo;

        // Apply scale to depth: depth slider is 0-1, scale converts to actual range
        const depth = parseFloat(depthSlider.value) * scale;
        const offset = parseFloat(offsetSlider.value) * scale;
        const mode = parseInt(modeSelect.value);

        lfo.setDestination(destIndex, param, depth, offset, mode);
        console.log(`LFO ${i + 1} Dest ${destIndex === 0 ? 'A' : 'B'} → ${targetKey} (scale: ${scale})`);
      };

      targetSelect.addEventListener('change', updateDestination);

      depthSlider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        e.target.nextElementSibling.textContent = value.toFixed(2);
        updateDestination();
      });

      offsetSlider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        e.target.nextElementSibling.textContent = value.toFixed(2);
        updateDestination();
      });

      modeSelect.addEventListener('change', updateDestination);
    });
  });
}

function setupEventListeners() {
  // Start/Stop buttons
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const transportIndicator = document.getElementById('transportIndicator');

  if (startBtn) {
    startBtn.addEventListener('click', async () => {
      await app.start();
      startBtn.style.display = 'none';
      if (stopBtn) stopBtn.style.display = 'flex';
      if (transportIndicator) transportIndicator.classList.add('running');

      // Initialize WAV recorder after audio context is running
      if (!wavRecorder && app.audioContext) {
        wavRecorder = new WavRecorder(app.audioContext);
        // Route master output through recorder
        app.masterBus.disconnect();
        app.masterBus.connect(wavRecorder.getInput());
        wavRecorder.getOutput().connect(app.masterGain);
        console.log('✓ WAV Recorder initialized and routed');
      }
    });
  }

  if (stopBtn) {
    stopBtn.addEventListener('click', () => {
      app.stop();
      app.resetClock(); // Reset sequencers to step 0 on stop
      stopBtn.style.display = 'none';
      if (startBtn) startBtn.style.display = 'flex';
      if (transportIndicator) transportIndicator.classList.remove('running');
    });
  }

  // Reset clock button
  const resetClockBtn = document.getElementById('resetClockBtn');
  if (resetClockBtn) {
    resetClockBtn.addEventListener('click', () => {
      app.resetClock();
    });
  }

  // Sticky bar master volume (synced with panel volume)
  const stickyMasterVolume = document.getElementById('stickyMasterVolume');
  const stickyMasterVolumeValue = document.getElementById('stickyMasterVolumeValue');
  const masterVolume = document.getElementById('masterVolume');
  const masterVolumeValue = document.getElementById('masterVolumeValue');

  // Sync both volume controls
  function updateMasterVolume(value) {
    app.masterGain.gain.value = value;
    if (stickyMasterVolume) stickyMasterVolume.value = value;
    if (stickyMasterVolumeValue) stickyMasterVolumeValue.textContent = value.toFixed(2);
    if (masterVolume) masterVolume.value = value;
    if (masterVolumeValue) masterVolumeValue.textContent = value.toFixed(2);
  }

  if (stickyMasterVolume) {
    stickyMasterVolume.addEventListener('input', (e) => {
      updateMasterVolume(parseFloat(e.target.value));
    });
  }

  if (masterVolume) {
    masterVolume.addEventListener('input', (e) => {
      updateMasterVolume(parseFloat(e.target.value));
    });
  }

  // ===== WAV RECORDER CONTROLS =====
  setupRecorderControls();

  // ===== PATCH BANK =====
  initPatchBank();

  // ===== MIDI LEARN SYSTEM =====
  setupMidiLearn();

  // Clock source buttons
  document.querySelectorAll('.clock-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.clock-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      const source = e.target.dataset.source;
      app.setClockSource(source);

      // Show/hide clock controls based on source
      const divControl = document.getElementById('clockDivisionControl');
      const jf1Control = document.getElementById('jf1ClockControl');
      const internalControl = document.getElementById('internalClockControl');
      if (divControl) divControl.style.display = source === 'midi' ? 'block' : 'none';
      if (jf1Control) jf1Control.style.display = source === 'jf1' ? 'block' : 'none';
      if (internalControl) internalControl.style.display = source === 'internal' ? 'block' : 'none';
    });
  });

  // Internal clock controls
  const internalBPM = document.getElementById('internalClockBPM');
  const internalBPMValue = document.getElementById('internalClockBPMValue');
  const internalDivision = document.getElementById('internalClockDivision');

  if (internalBPM) {
    internalBPM.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      app.setInternalClockBPM(value);
      if (internalBPMValue) internalBPMValue.textContent = value;
    });
  }

  if (internalDivision) {
    internalDivision.addEventListener('change', (e) => {
      const value = parseInt(e.target.value);
      app.setInternalClockDivision(value);
    });
  }

  // Set internal clock as default on init
  app.setClockSource('internal');

  // Just Friends #1 clock controls
  const jf1Time = document.getElementById('jf1Time');
  const jf1TimeValue = document.getElementById('jf1TimeValue');
  const jf1Intone = document.getElementById('jf1Intone');
  const jf1IntoneValue = document.getElementById('jf1IntoneValue');
  const jf1Ramp = document.getElementById('jf1Ramp');
  const jf1RampValue = document.getElementById('jf1RampValue');
  const jf1Curve = document.getElementById('jf1Curve');
  const jf1CurveValue = document.getElementById('jf1CurveValue');

  if (jf1Time) {
    jf1Time.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      app.jf1.params.time.value = value;
      if (jf1TimeValue) jf1TimeValue.textContent = value.toFixed(2);
    });
  }

  if (jf1Intone) {
    jf1Intone.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      app.jf1.params.intone.value = value;
      if (jf1IntoneValue) jf1IntoneValue.textContent = value.toFixed(2);
    });
  }

  if (jf1Ramp) {
    jf1Ramp.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      app.jf1.params.ramp.value = value;
      if (jf1RampValue) jf1RampValue.textContent = value.toFixed(2);
    });
  }

  if (jf1Curve) {
    jf1Curve.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      app.jf1.params.curve.value = value;
      if (jf1CurveValue) jf1CurveValue.textContent = value.toFixed(2);
    });
  }

  // Clock division
  const clockDivision = document.getElementById('clockDivision');
  if (clockDivision) {
    clockDivision.addEventListener('change', (e) => {
      app.midiManager.setClockDivision(parseInt(e.target.value));
    });
  }

  // Save patch
  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const state = app.getState();
      const json = JSON.stringify(state, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `phase5-poly-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      console.log('✓ Patch saved');
    });
  }

  // Load patch
  const loadBtn = document.getElementById('loadBtn');
  const fileInput = document.getElementById('patchFileInput');
  if (loadBtn && fileInput) {
    loadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const text = await file.text();
      const state = JSON.parse(text);
      app.setState(state);
      updateUIFromState(state);
      console.log('✓ Patch loaded');
      fileInput.value = ''; // Reset for next load
    });
  }

  // Update MIDI status
  updateMIDIStatus();
  setInterval(updateMIDIStatus, 1000);
}

function updateMIDIStatus() {
  const indicator = document.getElementById('midiIndicator');
  const statusText = document.getElementById('midiStatusText');

  if (!app || !app.midiManager) return;

  const status = app.midiManager.getConnectionStatus();

  if (indicator) {
    indicator.className = 'status-indicator ' + (status.connected ? 'connected' : 'disconnected');
  }

  if (statusText) {
    if (status.connected) {
      statusText.textContent = `MIDI: ${status.inputCount} input(s) connected`;
    } else {
      statusText.textContent = 'MIDI: Disconnected';
    }
  }
}

// ===== UPDATE UI FROM LOADED STATE =====
function updateUIFromState(state) {
  // Update master volume
  if (state.masterVolume !== undefined) {
    const stickyVolume = document.getElementById('stickyMasterVolume');
    const stickyVolumeValue = document.getElementById('stickyMasterVolumeValue');
    const masterVolume = document.getElementById('masterVolume');
    const masterVolumeValue = document.getElementById('masterVolumeValue');

    if (stickyVolume) stickyVolume.value = state.masterVolume;
    if (stickyVolumeValue) stickyVolumeValue.textContent = state.masterVolume.toFixed(2);
    if (masterVolume) masterVolume.value = state.masterVolume;
    if (masterVolumeValue) masterVolumeValue.textContent = state.masterVolume.toFixed(2);
  }

  // Update clock source buttons
  if (state.clockSource) {
    document.querySelectorAll('.clock-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.source === state.clockSource);
    });

    // Show/hide relevant clock control panels
    const divControl = document.getElementById('clockDivisionControl');
    const jf1Control = document.getElementById('jf1ClockControl');
    const internalControl = document.getElementById('internalClockControl');

    if (divControl) divControl.style.display = state.clockSource === 'midi' ? 'block' : 'none';
    if (jf1Control) jf1Control.style.display = state.clockSource === 'jf1' ? 'block' : 'none';
    if (internalControl) internalControl.style.display = state.clockSource === 'internal' ? 'block' : 'none';
  }

  // Update internal clock controls
  if (state.internalClockBPM !== undefined) {
    const bpmSlider = document.getElementById('internalClockBPM');
    const bpmValue = document.getElementById('internalClockBPMValue');
    if (bpmSlider) bpmSlider.value = state.internalClockBPM;
    if (bpmValue) bpmValue.textContent = state.internalClockBPM;
  }

  if (state.internalClockDivision !== undefined) {
    const divSelect = document.getElementById('internalClockDivision');
    if (divSelect) divSelect.value = state.internalClockDivision;
  }

  // Update MIDI clock division
  if (state.midiClockDivision !== undefined) {
    const midiDivSelect = document.getElementById('clockDivision');
    if (midiDivSelect) midiDivSelect.value = state.midiClockDivision;
  }

  // Refresh all voice UIs (oscillator, filter, envelope panels)
  if (state.voices && typeof refreshVoiceUIs === 'function') {
    refreshVoiceUIs();
  }

  // Refresh all LFO UIs
  if (state.lfos && typeof refreshLFOUIs === 'function') {
    refreshLFOUIs();
  }

  // Refresh mixer UIs
  if (state.mixerChannels && typeof refreshMixerUIs === 'function') {
    refreshMixerUIs();
  }

  console.log('UI updated from loaded state');
}

// ===== PATCH BANK =====
const PATCH_BANK_STORAGE_KEY = 'phase5poly_patch_bank';
let patchBank = Array(16).fill(null);
let activePatchSlot = -1;
let pendingSlotForLoad = -1;

function initPatchBank() {
  // Load patch bank from localStorage
  try {
    const saved = localStorage.getItem(PATCH_BANK_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length === 16) {
        patchBank = parsed;
        console.log('Patch bank loaded from storage');
      }
    }
  } catch (e) {
    console.warn('Could not load patch bank from storage:', e);
  }

  // Update slot UI
  updatePatchBankUI();

  // Set up event listeners
  const slots = document.querySelectorAll('.patch-slot');
  const slotFileInput = document.getElementById('patchSlotFileInput');

  slots.forEach(slot => {
    const slotIndex = parseInt(slot.dataset.slot);

    // Left click - recall patch (or load file if empty)
    slot.addEventListener('click', (e) => {
      e.preventDefault();
      if (patchBank[slotIndex]) {
        // Recall the patch
        recallPatch(slotIndex);
      } else {
        // Empty slot - open file dialog to load a patch into this slot
        pendingSlotForLoad = slotIndex;
        slotFileInput.click();
      }
    });

    // Right click - store current patch to slot (or load file to replace)
    slot.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (e.shiftKey && patchBank[slotIndex]) {
        // Shift+right-click on filled slot - clear it
        clearPatchSlot(slotIndex);
      } else if (patchBank[slotIndex]) {
        // Right-click on filled slot - open file dialog to replace
        pendingSlotForLoad = slotIndex;
        slotFileInput.click();
      } else {
        // Right-click on empty slot - store current patch
        storePatchToSlot(slotIndex);
      }
    });
  });

  // Handle file input for loading patch to slot
  if (slotFileInput) {
    slotFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file || pendingSlotForLoad < 0) return;

      try {
        const text = await file.text();
        const state = JSON.parse(text);

        // Store to the pending slot
        patchBank[pendingSlotForLoad] = {
          name: file.name.replace('.json', ''),
          state: state
        };

        savePatchBank();
        updatePatchBankUI();
        console.log(`Patch "${file.name}" loaded to slot ${pendingSlotForLoad + 1}`);
      } catch (err) {
        console.error('Error loading patch file:', err);
      }

      pendingSlotForLoad = -1;
      slotFileInput.value = '';
    });
  }
}

function storePatchToSlot(slotIndex) {
  const state = app.getState();
  const name = state.name || `Patch ${slotIndex + 1}`;

  patchBank[slotIndex] = {
    name: name,
    state: state
  };

  savePatchBank();
  updatePatchBankUI();

  // Visual feedback
  const slot = document.querySelector(`.patch-slot[data-slot="${slotIndex}"]`);
  if (slot) {
    slot.classList.add('storing');
    setTimeout(() => slot.classList.remove('storing'), 500);
  }

  console.log(`Current patch stored to slot ${slotIndex + 1}`);
}

function recallPatch(slotIndex) {
  const patch = patchBank[slotIndex];
  if (!patch) return;

  // Apply the patch
  app.setState(patch.state);
  updateUIFromState(patch.state);

  // Reset clock when recalling a patch for clean start
  app.resetClock();

  // Update active slot
  activePatchSlot = slotIndex;
  updatePatchBankUI();

  console.log(`Recalled patch "${patch.name}" from slot ${slotIndex + 1}`);
}

function clearPatchSlot(slotIndex) {
  patchBank[slotIndex] = null;
  if (activePatchSlot === slotIndex) {
    activePatchSlot = -1;
  }
  savePatchBank();
  updatePatchBankUI();
  console.log(`Cleared slot ${slotIndex + 1}`);
}

function savePatchBank() {
  try {
    localStorage.setItem(PATCH_BANK_STORAGE_KEY, JSON.stringify(patchBank));
  } catch (e) {
    console.warn('Could not save patch bank to storage:', e);
  }
}

function updatePatchBankUI() {
  const slots = document.querySelectorAll('.patch-slot');

  slots.forEach(slot => {
    const slotIndex = parseInt(slot.dataset.slot);
    const patch = patchBank[slotIndex];

    slot.classList.toggle('has-patch', !!patch);
    slot.classList.toggle('active', slotIndex === activePatchSlot);

    if (patch) {
      slot.title = `Slot ${slotIndex + 1}: ${patch.name}\nClick to recall | Right-click to replace | Shift+Right-click to clear`;
    } else {
      slot.title = `Slot ${slotIndex + 1} - Empty\nClick to load file | Right-click to store current`;
    }
  });
}

// ===== MIDI LEARN SYSTEM =====
let midiLearnMenu = null;
let currentMidiLearnElement = null;

function setupMidiLearn() {
  // Set up callbacks for MIDI Learn completion/cancellation
  if (app && app.midiManager) {
    app.midiManager.onMidiLearnComplete = (channel, cc, target) => {
      document.body.classList.remove('midi-learn-mode');
      if (currentMidiLearnElement) {
        currentMidiLearnElement.classList.remove('midi-learn-waiting');
        // Add visual indicator for mapped parameter
        const paramRow = currentMidiLearnElement.closest('.param-row');
        if (paramRow) {
          paramRow.classList.add('midi-mapped');
          const label = paramRow.querySelector('label');
          if (label) {
            label.dataset.midiCc = `CC${cc}`;
          }
        }
      }
      currentMidiLearnElement = null;
      hideMidiLearnMenu();
    };

    app.midiManager.onMidiLearnCancel = () => {
      document.body.classList.remove('midi-learn-mode');
      if (currentMidiLearnElement) {
        currentMidiLearnElement.classList.remove('midi-learn-waiting');
      }
      currentMidiLearnElement = null;
    };
  }

  // Add right-click handler to all sliders
  document.querySelectorAll('input[type="range"]').forEach(slider => {
    slider.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showMidiLearnMenu(e, slider);
    });
  });

  // Close menu when clicking elsewhere
  document.addEventListener('click', (e) => {
    if (midiLearnMenu && !midiLearnMenu.contains(e.target)) {
      hideMidiLearnMenu();
    }
  });

  // Allow ESC to cancel MIDI Learn
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (app && app.midiManager && app.midiManager.midiLearnMode) {
        app.midiManager.cancelMidiLearn();
      }
      hideMidiLearnMenu();
    }
  });

  // Register callbacks for any existing mappings from localStorage
  registerExistingMappings();
}

function showMidiLearnMenu(e, slider) {
  hideMidiLearnMenu();

  const parameterId = getParameterIdForSlider(slider);
  if (!parameterId) return;

  // Check if this parameter already has a mapping
  const existingMapping = app.midiManager ? app.midiManager.getMidiMappingForParameter(parameterId) : null;

  // Create context menu
  midiLearnMenu = document.createElement('div');
  midiLearnMenu.className = 'midi-learn-menu';
  midiLearnMenu.innerHTML = `
    <div class="midi-learn-menu-item learn" data-action="learn">
      <span class="menu-icon">🎹</span>
      <span>MIDI Learn</span>
    </div>
    ${existingMapping ? `
    <div class="midi-learn-menu-item" data-action="info">
      <span class="menu-icon">ℹ️</span>
      <span>Ch${existingMapping.channel} CC${existingMapping.cc}</span>
    </div>
    <div class="midi-learn-menu-separator"></div>
    <div class="midi-learn-menu-item remove" data-action="remove">
      <span class="menu-icon">✕</span>
      <span>Remove Mapping</span>
    </div>
    ` : ''}
  `;

  // Position menu
  midiLearnMenu.style.left = `${e.clientX}px`;
  midiLearnMenu.style.top = `${e.clientY}px`;

  // Add click handlers
  midiLearnMenu.querySelectorAll('.midi-learn-menu-item').forEach(item => {
    item.addEventListener('click', () => {
      const action = item.dataset.action;
      if (action === 'learn') {
        startMidiLearnForSlider(slider, parameterId);
      } else if (action === 'remove') {
        removeMidiMapping(parameterId, slider);
      }
      hideMidiLearnMenu();
    });
  });

  document.body.appendChild(midiLearnMenu);
}

function hideMidiLearnMenu() {
  if (midiLearnMenu) {
    midiLearnMenu.remove();
    midiLearnMenu = null;
  }
}

function getParameterIdForSlider(slider) {
  // Generate a unique parameter ID based on slider's position in the DOM
  // Use class names and data attributes to create a unique ID

  const voicePanel = slider.closest('.voice-panel');
  const voiceIndex = voicePanel ? voicePanel.dataset.voice : null;

  const lfoModule = slider.closest('.lfo-module');
  const lfoIndex = lfoModule ? lfoModule.dataset.lfo : null;

  const sendModule = slider.closest('.send-module');
  const mixerChannel = slider.closest('.mixer-channel');
  const fmOscModule = slider.closest('.fm-osc-module');

  // Get the slider's identifying class
  const classes = Array.from(slider.classList);
  const identifyingClass = classes.find(c =>
    c !== 'param-slider' &&
    !c.startsWith('midi-') &&
    c !== 'volume-slider'
  ) || slider.id;

  if (!identifyingClass && !slider.id) {
    // Fallback: use the label text
    const label = slider.closest('.param-row')?.querySelector('label')?.textContent;
    if (label) {
      if (voiceIndex) return `voice${voiceIndex}_${label.toLowerCase().replace(/\s+/g, '_')}`;
      if (lfoIndex) return `lfo${lfoIndex}_${label.toLowerCase().replace(/\s+/g, '_')}`;
      return `global_${label.toLowerCase().replace(/\s+/g, '_')}`;
    }
    return null;
  }

  // Build the parameter ID
  if (voiceIndex !== null) {
    return `voice${voiceIndex}_${identifyingClass}`;
  }
  if (lfoIndex !== null) {
    return `lfo${lfoIndex}_${identifyingClass}`;
  }
  if (sendModule) {
    const sendType = sendModule.querySelector('h4')?.textContent.toLowerCase().replace(/\s+/g, '_') || 'send';
    return `send_${sendType}_${identifyingClass}`;
  }
  if (mixerChannel) {
    const channelIndex = mixerChannel.dataset.channel || '0';
    return `mixer${channelIndex}_${identifyingClass}`;
  }
  if (fmOscModule) {
    const oscIndex = fmOscModule.dataset.osc || '0';
    return `fmosc${oscIndex}_${identifyingClass}`;
  }

  // Global parameter
  return `global_${identifyingClass || slider.id}`;
}

function startMidiLearnForSlider(slider, parameterId) {
  if (!app || !app.midiManager) {
    console.warn('MIDI not available');
    return;
  }

  // Get slider's min/max values
  const min = parseFloat(slider.min) || 0;
  const max = parseFloat(slider.max) || 1;

  // Create callback that updates the parameter
  const callback = (value) => {
    slider.value = value;
    slider.dispatchEvent(new Event('input', { bubbles: true }));
  };

  // Visual feedback
  document.body.classList.add('midi-learn-mode');
  slider.classList.add('midi-learn-waiting');
  currentMidiLearnElement = slider;

  // Start MIDI Learn
  app.midiManager.startMidiLearn(parameterId, slider, callback, min, max);
}

function removeMidiMapping(parameterId, slider) {
  if (!app || !app.midiManager) return;

  app.midiManager.removeMidiMapping(parameterId);

  // Remove visual indicator
  const paramRow = slider.closest('.param-row');
  if (paramRow) {
    paramRow.classList.remove('midi-mapped');
    const label = paramRow.querySelector('label');
    if (label) {
      delete label.dataset.midiCc;
    }
  }
}

function registerExistingMappings() {
  // Re-register callbacks for mappings that were loaded from localStorage
  if (!app || !app.midiManager || !app.midiManager.pendingMappings) return;

  document.querySelectorAll('input[type="range"]').forEach(slider => {
    const parameterId = getParameterIdForSlider(slider);
    if (!parameterId) return;

    const min = parseFloat(slider.min) || 0;
    const max = parseFloat(slider.max) || 1;

    const callback = (value) => {
      slider.value = value;
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    };

    // Try to register this parameter's callback
    if (app.midiManager.registerMappingCallback(parameterId, slider, callback, min, max)) {
      // Add visual indicator
      const paramRow = slider.closest('.param-row');
      if (paramRow) {
        paramRow.classList.add('midi-mapped');
        const mapping = app.midiManager.getMidiMappingForParameter(parameterId);
        if (mapping) {
          const label = paramRow.querySelector('label');
          if (label) {
            label.dataset.midiCc = `CC${mapping.cc}`;
          }
        }
      }
    }
  });

  console.log('🎹 MIDI mappings registered for UI elements');
}

// ===== WAV RECORDER CONTROLS =====
function setupRecorderControls() {
  const recordBtn = document.getElementById('recorderRecordBtn');
  const pauseBtn = document.getElementById('recorderPauseBtn');
  const resumeBtn = document.getElementById('recorderResumeBtn');
  const stopBtn = document.getElementById('recorderStopBtn');
  const downloadBtn = document.getElementById('recorderDownloadBtn');
  const cancelBtn = document.getElementById('recorderCancelBtn');
  const timeDisplay = document.getElementById('recorderTime');
  const indicator = document.getElementById('recorderIndicator');

  // Helper to update UI based on recorder state
  function updateRecorderUI(state) {
    // Reset all buttons
    if (recordBtn) recordBtn.style.display = 'none';
    if (pauseBtn) pauseBtn.style.display = 'none';
    if (resumeBtn) resumeBtn.style.display = 'none';
    if (stopBtn) stopBtn.style.display = 'none';
    if (downloadBtn) downloadBtn.style.display = 'none';
    if (cancelBtn) cancelBtn.style.display = 'none';

    // Reset indicator
    if (indicator) {
      indicator.classList.remove('recording', 'paused');
    }
    if (timeDisplay) {
      timeDisplay.classList.remove('recording', 'paused');
    }

    switch (state) {
      case 'idle':
        if (recordBtn) recordBtn.style.display = 'flex';
        if (lastRecordingBlob) {
          if (downloadBtn) downloadBtn.style.display = 'flex';
        }
        break;

      case 'recording':
        if (pauseBtn) pauseBtn.style.display = 'flex';
        if (stopBtn) stopBtn.style.display = 'flex';
        if (cancelBtn) cancelBtn.style.display = 'flex';
        if (indicator) indicator.classList.add('recording');
        if (timeDisplay) timeDisplay.classList.add('recording');
        break;

      case 'paused':
        if (resumeBtn) resumeBtn.style.display = 'flex';
        if (stopBtn) stopBtn.style.display = 'flex';
        if (cancelBtn) cancelBtn.style.display = 'flex';
        if (indicator) indicator.classList.add('paused');
        if (timeDisplay) timeDisplay.classList.add('paused');
        break;

      case 'stopped':
        if (recordBtn) recordBtn.style.display = 'flex';
        if (lastRecordingBlob) {
          if (downloadBtn) downloadBtn.style.display = 'flex';
        }
        break;
    }
  }

  // Initial state
  updateRecorderUI('idle');

  // Record button
  if (recordBtn) {
    recordBtn.addEventListener('click', () => {
      if (!wavRecorder) {
        console.warn('WAV Recorder not initialized. Start audio first.');
        return;
      }
      wavRecorder.start();
      updateRecorderUI('recording');

      // Set up time update callback
      wavRecorder.onTimeUpdate = (duration) => {
        if (timeDisplay) {
          timeDisplay.textContent = wavRecorder.formatDuration(duration);
        }
      };
    });
  }

  // Pause button
  if (pauseBtn) {
    pauseBtn.addEventListener('click', () => {
      if (wavRecorder) {
        wavRecorder.pause();
        updateRecorderUI('paused');
      }
    });
  }

  // Resume button
  if (resumeBtn) {
    resumeBtn.addEventListener('click', () => {
      if (wavRecorder) {
        wavRecorder.resume();
        updateRecorderUI('recording');
      }
    });
  }

  // Stop button
  if (stopBtn) {
    stopBtn.addEventListener('click', () => {
      if (wavRecorder) {
        lastRecordingBlob = wavRecorder.stop();
        updateRecorderUI('stopped');
      }
    });
  }

  // Download button
  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      if (lastRecordingBlob && wavRecorder) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        wavRecorder.downloadRecording(lastRecordingBlob, `phase5-poly-${timestamp}.wav`);
      }
    });
  }

  // Cancel button
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      if (wavRecorder) {
        wavRecorder.cancel();
        if (timeDisplay) timeDisplay.textContent = '00:00.00';
        updateRecorderUI('idle');
      }
    });
  }
}

// Initialize on load
window.addEventListener('DOMContentLoaded', init);

// Cleanup on unload
window.addEventListener('beforeunload', () => {
  if (app) {
    app.dispose();
  }
});
