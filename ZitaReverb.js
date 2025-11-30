// ZitaReverb - High-quality FDN reverb for Web Audio
// Usage helper class

class ZitaReverb {
  constructor(audioContext) {
    this.context = audioContext;
    this.node = null;
    this.isInitialized = false;
    
    // Parameter ranges (matching the C++ header)
    this.paramRanges = {
      preDel: { min: 0, max: 200, default: 20, unit: 'ms' },
      lfFc: { min: 30, max: 1200, default: 200, unit: 'Hz' },
      lowRt60: { min: 0.1, max: 3.0, default: 1.0, unit: 's' },
      midRt60: { min: 0.1, max: 3.0, default: 1.0, unit: 's' },
      hfDamp: { min: 1200, max: 23520, default: 6000, unit: 'Hz' }
    };
  }
  
  async init(workletUrl) {
    if (this.isInitialized) {
      return this.node;
    }
    
    try {
      // Load the AudioWorklet processor
      await this.context.audioWorklet.addModule(workletUrl);
      
      // Create the AudioWorklet node
      this.node = new AudioWorkletNode(this.context, 'zita-reverb-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2]
      });
      
      this.isInitialized = true;
      return this.node;
    } catch (error) {
      console.error('Failed to initialize ZitaReverb:', error);
      throw error;
    }
  }
  
  // Parameter setters
  setPreDelay(ms) {
    this._setParam('preDel', ms);
  }
  
  setLowFreqCrossover(hz) {
    this._setParam('lfFc', hz);
  }
  
  setLowRT60(seconds) {
    this._setParam('lowRt60', seconds);
  }
  
  setMidRT60(seconds) {
    this._setParam('midRt60', seconds);
  }
  
  setHighFreqDamping(hz) {
    this._setParam('hfDamp', hz);
  }
  
  // Set all parameters at once
  setParams(params) {
    if (params.preDel !== undefined) this.setPreDelay(params.preDel);
    if (params.lfFc !== undefined) this.setLowFreqCrossover(params.lfFc);
    if (params.lowRt60 !== undefined) this.setLowRT60(params.lowRt60);
    if (params.midRt60 !== undefined) this.setMidRT60(params.midRt60);
    if (params.hfDamp !== undefined) this.setHighFreqDamping(params.hfDamp);
  }
  
  // Internal parameter setter
  _setParam(param, value) {
    if (!this.isInitialized || !this.node) {
      console.warn('ZitaReverb not initialized yet');
      return;
    }
    
    // Clamp value to range
    const range = this.paramRanges[param];
    if (range) {
      value = Math.max(range.min, Math.min(range.max, value));
    }
    
    this.node.port.postMessage({
      type: 'setParam',
      param: param,
      value: value
    });
  }
  
  // Connect to destination
  connect(destination) {
    if (!this.node) {
      throw new Error('ZitaReverb not initialized. Call init() first.');
    }
    return this.node.connect(destination);
  }
  
  // Disconnect from all or specific destination
  disconnect(destination) {
    if (!this.node) return;
    if (destination) {
      this.node.disconnect(destination);
    } else {
      this.node.disconnect();
    }
  }
  
  // Get the underlying AudioWorkletNode
  getNode() {
    return this.node;
  }
  
  // Preset configurations
  static presets = {
    small: {
      preDel: 10,
      lfFc: 300,
      lowRt60: 0.8,
      midRt60: 0.6,
      hfDamp: 8000
    },
    medium: {
      preDel: 20,
      lfFc: 200,
      lowRt60: 1.5,
      midRt60: 1.2,
      hfDamp: 6000
    },
    large: {
      preDel: 40,
      lfFc: 150,
      lowRt60: 2.5,
      midRt60: 2.0,
      hfDamp: 5000
    },
    hall: {
      preDel: 50,
      lfFc: 120,
      lowRt60: 3.0,
      midRt60: 2.5,
      hfDamp: 4000
    },
    bright: {
      preDel: 15,
      lfFc: 250,
      lowRt60: 1.0,
      midRt60: 1.0,
      hfDamp: 12000
    },
    dark: {
      preDel: 25,
      lfFc: 180,
      lowRt60: 1.5,
      midRt60: 1.2,
      hfDamp: 3000
    }
  };
  
  // Load a preset
  loadPreset(presetName) {
    const preset = ZitaReverb.presets[presetName];
    if (!preset) {
      console.warn(`Preset "${presetName}" not found`);
      return;
    }
    this.setParams(preset);
  }

/**
 * Create UI for the ZitaReverb
 */
createUI() {
  if (this.uiContainer) {
    return this.uiContainer;
  }
  
  const container = document.createElement('div');
  container.className = 'zita-reverb-container';
  container.style.cssText = `
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 12px;
    padding: 20px;
    color: #ffffff;
    max-width: 600px;
    margin: 20px auto;
    box-shadow: 0 10px 40px rgba(0,0,0,0.5);
  `;
  
  container.innerHTML = `
    <style>
      .zita-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        padding-bottom: 15px;
        border-bottom: 2px solid rgba(255,255,255,0.2);
      }
      .zita-title {
        font-size: 1.5em;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 2px;
      }
      .zita-preset-selector {
        display: flex;
        gap: 10px;
        align-items: center;
      }
      .zita-preset-selector label {
        font-size: 0.9em;
        text-transform: uppercase;
        font-weight: 500;
      }
      .zita-preset-selector select {
        padding: 8px 12px;
        border-radius: 6px;
        background: rgba(0,0,0,0.3);
        color: #ffffff;
        border: 1px solid rgba(255,255,255,0.2);
        font-size: 0.9em;
        cursor: pointer;
      }
      .zita-controls {
        display: grid;
        gap: 15px;
      }
      .zita-param {
        background: rgba(0,0,0,0.2);
        border-radius: 8px;
        padding: 12px 15px;
      }
      .zita-param-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 8px;
      }
      .zita-param-label {
        font-size: 0.85em;
        text-transform: uppercase;
        letter-spacing: 1px;
        font-weight: 500;
      }
      .zita-param-value {
        font-size: 0.85em;
        font-weight: 600;
        color: #ffd700;
      }
      .zita-controls input[type="range"] {
        width: 100%;
        height: 4px;
        border-radius: 2px;
        background: rgba(255,255,255,0.2);
        outline: none;
        -webkit-appearance: none;
      }
      .zita-controls input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #ffd700;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(255,215,0,0.5);
      }
      .zita-controls input[type="range"]::-moz-range-thumb {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #ffd700;
        cursor: pointer;
        border: none;
        box-shadow: 0 2px 8px rgba(255,215,0,0.5);
      }
    </style>
    
    <div class="zita-header">
      <div class="zita-title">Zita Reverb</div>
      <div class="zita-preset-selector">
        <label>preset:</label>
        <select id="zita-preset">
          <option value="">-- select --</option>
          <option value="small">Small Room</option>
          <option value="medium">Medium Hall</option>
          <option value="large">Large Hall</option>
          <option value="hall">Concert Hall</option>
          <option value="bright">Bright Space</option>
          <option value="dark">Dark Chamber</option>
        </select>
      </div>
    </div>
    
    <div class="zita-controls">
      <div class="zita-param">
        <div class="zita-param-header">
          <span class="zita-param-label">Pre-Delay</span>
          <span class="zita-param-value" id="zita-preDel-value">20 ms</span>
        </div>
        <input type="range" id="zita-preDel" min="0" max="200" step="1" value="20">
      </div>
      
      <div class="zita-param">
        <div class="zita-param-header">
          <span class="zita-param-label">Low Freq Crossover</span>
          <span class="zita-param-value" id="zita-lfFc-value">200 Hz</span>
        </div>
        <input type="range" id="zita-lfFc" min="30" max="1200" step="10" value="200">
      </div>
      
      <div class="zita-param">
        <div class="zita-param-header">
          <span class="zita-param-label">Low RT60</span>
          <span class="zita-param-value" id="zita-lowRt60-value">1.0 s</span>
        </div>
        <input type="range" id="zita-lowRt60" min="0.1" max="3.0" step="0.1" value="1.0">
      </div>
      
      <div class="zita-param">
        <div class="zita-param-header">
          <span class="zita-param-label">Mid RT60</span>
          <span class="zita-param-value" id="zita-midRt60-value">1.0 s</span>
        </div>
        <input type="range" id="zita-midRt60" min="0.1" max="3.0" step="0.1" value="1.0">
      </div>
      
      <div class="zita-param">
        <div class="zita-param-header">
          <span class="zita-param-label">High Freq Damping</span>
          <span class="zita-param-value" id="zita-hfDamp-value">6000 Hz</span>
        </div>
        <input type="range" id="zita-hfDamp" min="1200" max="23520" step="100" value="6000">
      </div>
    </div>
  `;
  
  this.uiContainer = container;
  this.attachUIListeners();
  
  return container;
}

/**
 * Attach event listeners to UI controls
 */
attachUIListeners() {
  if (!this.uiContainer) return;
  
  // Pre-delay
  const preDelSlider = this.uiContainer.querySelector('#zita-preDel');
  const preDelValue = this.uiContainer.querySelector('#zita-preDel-value');
  preDelSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    preDelValue.textContent = `${val} ms`;
    this.setPreDelay(val);
  });
  
  // Low freq crossover
  const lfFcSlider = this.uiContainer.querySelector('#zita-lfFc');
  const lfFcValue = this.uiContainer.querySelector('#zita-lfFc-value');
  lfFcSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    lfFcValue.textContent = `${val} Hz`;
    this.setLowFreqCrossover(val);
  });
  
  // Low RT60
  const lowRt60Slider = this.uiContainer.querySelector('#zita-lowRt60');
  const lowRt60Value = this.uiContainer.querySelector('#zita-lowRt60-value');
  lowRt60Slider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    lowRt60Value.textContent = `${val.toFixed(1)} s`;
    this.setLowRT60(val);
  });
  
  // Mid RT60
  const midRt60Slider = this.uiContainer.querySelector('#zita-midRt60');
  const midRt60Value = this.uiContainer.querySelector('#zita-midRt60-value');
  midRt60Slider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    midRt60Value.textContent = `${val.toFixed(1)} s`;
    this.setMidRT60(val);
  });
  
  // High freq damping
  const hfDampSlider = this.uiContainer.querySelector('#zita-hfDamp');
  const hfDampValue = this.uiContainer.querySelector('#zita-hfDamp-value');
  hfDampSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    hfDampValue.textContent = `${val} Hz`;
    this.setHighFreqDamping(val);
  });
  
  // Preset selector
  const presetSelect = this.uiContainer.querySelector('#zita-preset');
  presetSelect.addEventListener('change', (e) => {
    const presetName = e.target.value;
    if (!presetName) return;
    
    this.loadPreset(presetName);
    this.updateUIFromPreset(presetName);
    
    setTimeout(() => {
      presetSelect.value = '';
    }, 100);
  });
}

/**
 * Update UI to reflect preset values
 */
updateUIFromPreset(presetName) {
  if (!this.uiContainer) return;
  
  const preset = ZitaReverb.presets[presetName];
  if (!preset) return;
  
  if (preset.preDel !== undefined) {
    this.uiContainer.querySelector('#zita-preDel').value = preset.preDel;
    this.uiContainer.querySelector('#zita-preDel-value').textContent = `${preset.preDel} ms`;
  }
  
  if (preset.lfFc !== undefined) {
    this.uiContainer.querySelector('#zita-lfFc').value = preset.lfFc;
    this.uiContainer.querySelector('#zita-lfFc-value').textContent = `${preset.lfFc} Hz`;
  }
  
  if (preset.lowRt60 !== undefined) {
    this.uiContainer.querySelector('#zita-lowRt60').value = preset.lowRt60;
    this.uiContainer.querySelector('#zita-lowRt60-value').textContent = `${preset.lowRt60.toFixed(1)} s`;
  }
  
  if (preset.midRt60 !== undefined) {
    this.uiContainer.querySelector('#zita-midRt60').value = preset.midRt60;
    this.uiContainer.querySelector('#zita-midRt60-value').textContent = `${preset.midRt60.toFixed(1)} s`;
  }
  
  if (preset.hfDamp !== undefined) {
    this.uiContainer.querySelector('#zita-hfDamp').value = preset.hfDamp;
    this.uiContainer.querySelector('#zita-hfDamp-value').textContent = `${preset.hfDamp} Hz`;
  }
}
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ZitaReverb;
}

// ES6 export for module systems
export { ZitaReverb };
