/**
 * DJEqualizerUI - DJ Equalizer with UI generation
 */
import { DJEqualizer } from './DJEqualizer.js';

export class DJEqualizerUI {
    constructor(audioContext) {
        this.context = audioContext;
        this.eq = new DJEqualizer(audioContext);
        this.bypassed = true;
        this.uiContainer = null;
        
        // Bypass routing
        this.input = audioContext.createGain();
        this.output = audioContext.createGain();
        this.dryGain = audioContext.createGain();
        this.wetGain = audioContext.createGain();
        
        // Initial routing (bypassed)
        this.input.connect(this.dryGain);
        this.dryGain.connect(this.output);
        this.dryGain.gain.value = 1;
        this.wetGain.gain.value = 0;
        
        this.input.connect(this.eq.input);
        this.eq.output.connect(this.wetGain);
        this.wetGain.connect(this.output);
    }
    
    setBypass(bypassed) {
        this.bypassed = bypassed;
        const now = this.context.currentTime;
        
        if (bypassed) {
            this.dryGain.gain.linearRampToValueAtTime(1, now + 0.02);
            this.wetGain.gain.linearRampToValueAtTime(0, now + 0.02);
        } else {
            this.dryGain.gain.linearRampToValueAtTime(0, now + 0.02);
            this.wetGain.gain.linearRampToValueAtTime(1, now + 0.02);
        }
        
        if (this.uiContainer) {
            this.uiContainer.classList.toggle('bypassed', bypassed);
        }
    }
    
    createUI() {
        if (this.uiContainer) return this.uiContainer;
        
        const container = document.createElement('div');
        container.className = 'effect-module dj-eq';
        container.classList.toggle('bypassed', this.bypassed);
        
        container.innerHTML = `
            <div class="effect-header">
                <h3 class="effect-title">DJ Equalizer</h3>
                <label class="effect-bypass">
                    <input type="checkbox" class="bypass-toggle" ${this.bypassed ? 'checked' : ''}>
                    <span>Bypass</span>
                </label>
            </div>
            
            <div class="effect-controls">
                <div class="eq-band">
                    <div class="eq-band-header">
                        <span class="band-label">Low</span>
                        <button class="kill-btn" data-band="low">Kill</button>
                    </div>
                    <div class="param-control">
                        <label>Gain</label>
                        <input type="range" class="low-gain" min="-24" max="12" step="0.1" value="0">
                        <span class="param-value">0.0 dB</span>
                    </div>
                    <div class="param-control">
                        <label>Freq</label>
                        <input type="range" class="low-freq" min="50" max="300" step="1" value="100">
                        <span class="param-value">100 Hz</span>
                    </div>
                </div>
                
                <div class="eq-band">
                    <div class="eq-band-header">
                        <span class="band-label">Mid</span>
                        <button class="kill-btn" data-band="mid">Kill</button>
                    </div>
                    <div class="param-control">
                        <label>Gain</label>
                        <input type="range" class="mid-gain" min="-24" max="12" step="0.1" value="0">
                        <span class="param-value">0.0 dB</span>
                    </div>
                    <div class="param-control">
                        <label>Freq</label>
                        <input type="range" class="mid-freq" min="200" max="5000" step="10" value="1000">
                        <span class="param-value">1000 Hz</span>
                    </div>
                    <div class="param-control">
                        <label>Q</label>
                        <input type="range" class="mid-q" min="0.1" max="10" step="0.1" value="1">
                        <span class="param-value">1.0</span>
                    </div>
                </div>
                
                <div class="eq-band">
                    <div class="eq-band-header">
                        <span class="band-label">High</span>
                        <button class="kill-btn" data-band="high">Kill</button>
                    </div>
                    <div class="param-control">
                        <label>Gain</label>
                        <input type="range" class="high-gain" min="-24" max="12" step="0.1" value="0">
                        <span class="param-value">0.0 dB</span>
                    </div>
                    <div class="param-control">
                        <label>Freq</label>
                        <input type="range" class="high-freq" min="2000" max="16000" step="100" value="5000">
                        <span class="param-value">5000 Hz</span>
                    </div>
                </div>
                
                <button class="reset-btn">Reset All</button>
            </div>
        `;
        
        this.uiContainer = container;
        this.attachListeners();
        return container;
    }
    
    attachListeners() {
        const container = this.uiContainer;
        
        // Bypass
        container.querySelector('.bypass-toggle').addEventListener('change', (e) => {
            this.setBypass(e.target.checked);
        });
        
        // Low band
        const lowGain = container.querySelector('.low-gain');
        lowGain.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this.eq.setLowGain(val);
            e.target.nextElementSibling.textContent = `${val.toFixed(1)} dB`;
        });
        
        const lowFreq = container.querySelector('.low-freq');
        lowFreq.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this.eq.setLowFrequency(val);
            e.target.nextElementSibling.textContent = `${Math.round(val)} Hz`;
        });
        
        // Mid band
        const midGain = container.querySelector('.mid-gain');
        midGain.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this.eq.setMidGain(val);
            e.target.nextElementSibling.textContent = `${val.toFixed(1)} dB`;
        });
        
        const midFreq = container.querySelector('.mid-freq');
        midFreq.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this.eq.setMidFrequency(val);
            e.target.nextElementSibling.textContent = `${Math.round(val)} Hz`;
        });
        
        const midQ = container.querySelector('.mid-q');
        midQ.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this.eq.setMidQ(val);
            e.target.nextElementSibling.textContent = val.toFixed(1);
        });
        
        // High band
        const highGain = container.querySelector('.high-gain');
        highGain.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this.eq.setHighGain(val);
            e.target.nextElementSibling.textContent = `${val.toFixed(1)} dB`;
        });
        
        const highFreq = container.querySelector('.high-freq');
        highFreq.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this.eq.setHighFrequency(val);
            e.target.nextElementSibling.textContent = `${Math.round(val)} Hz`;
        });
        
        // Kill buttons
        container.querySelectorAll('.kill-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const band = e.target.dataset.band;
                const isActive = btn.classList.toggle('active');
                
                if (band === 'low') this.eq.setLowKill(isActive);
                if (band === 'mid') this.eq.setMidKill(isActive);
                if (band === 'high') this.eq.setHighKill(isActive);
            });
        });
        
        // Reset
        container.querySelector('.reset-btn').addEventListener('click', () => {
            this.eq.reset();
            container.querySelectorAll('.kill-btn').forEach(b => b.classList.remove('active'));
            lowGain.value = 0;
            lowGain.nextElementSibling.textContent = '0.0 dB';
            lowFreq.value = 100;
            lowFreq.nextElementSibling.textContent = '100 Hz';
            midGain.value = 0;
            midGain.nextElementSibling.textContent = '0.0 dB';
            midFreq.value = 1000;
            midFreq.nextElementSibling.textContent = '1000 Hz';
            midQ.value = 1;
            midQ.nextElementSibling.textContent = '1.0';
            highGain.value = 0;
            highGain.nextElementSibling.textContent = '0.0 dB';
            highFreq.value = 5000;
            highFreq.nextElementSibling.textContent = '5000 Hz';
        });
    }
}
