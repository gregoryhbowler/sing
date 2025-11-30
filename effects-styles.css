/* effects-styles.css - Effects chain styling */

.effects-chain-panel {
  grid-column: 1 / -1;
  background: linear-gradient(135deg, 
    rgba(247, 228, 212, 0.6) 0%, 
    rgba(224, 212, 247, 0.6) 100%);
}

.effects-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: var(--space-md);
}

.effect-module {
  background: rgba(255, 255, 255, 0.6);
  border: 2px solid var(--border-light);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  transition: all 0.3s ease;
  position: relative;
}

.effect-module:hover {
  background: rgba(255, 255, 255, 0.75);
  border-color: var(--border-medium);
  box-shadow: var(--shadow-lifted);
}

.effect-module.bypassed {
  opacity: 0.5;
}

.effect-module.bypassed::after {
  content: 'BYPASSED';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 2rem;
  font-weight: 700;
  color: rgba(0, 0, 0, 0.1);
  letter-spacing: 0.2em;
  pointer-events: none;
  z-index: 1;
}

.effect-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-md);
  padding-bottom: var(--space-sm);
  border-bottom: 1px solid var(--border-light);
}

.effect-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin: 0;
}

.effect-bypass {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  cursor: pointer;
  user-select: none;
}

.effect-bypass input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: var(--text-primary);
}

.effect-bypass span {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.effect-controls {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.param-control {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.param-control label {
  flex: 0 0 70px;
  font-size: 0.7rem;
  font-weight: 500;
  color: var(--text-secondary);
  text-transform: lowercase;
}

.param-control input[type="range"] {
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: rgba(0, 0, 0, 0.08);
  border-radius: 2px;
  cursor: pointer;
}

.param-control input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  background: var(--text-primary);
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

.param-control input[type="range"]::-webkit-slider-thumb:hover {
  transform: scale(1.15);
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.25);
}

.param-control input[type="range"]::-moz-range-thumb {
  width: 14px;
  height: 14px;
  background: var(--text-primary);
  border: none;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

.param-control .param-value {
  flex: 0 0 70px;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-primary);
  text-align: right;
  font-variant-numeric: tabular-nums;
}

/* DJ Equalizer specific */
.eq-band {
  background: rgba(0, 0, 0, 0.03);
  border-radius: var(--radius-sm);
  padding: var(--space-sm);
  margin-bottom: var(--space-sm);
}

.eq-band:last-of-type {
  margin-bottom: var(--space-md);
}

.eq-band-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-sm);
}

.band-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.kill-btn {
  padding: 4px 12px;
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid var(--border-light);
  border-radius: 4px;
  color: var(--text-secondary);
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.2s ease;
}

.kill-btn:hover {
  background: rgba(255, 255, 255, 0.8);
  border-color: var(--border-medium);
}

.kill-btn.active {
  background: #e74c3c;
  border-color: #e74c3c;
  color: white;
}

.reset-btn {
  padding: var(--space-sm) var(--space-md);
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 0.7rem;
  font-weight: 500;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.2s ease;
}

.reset-btn:hover {
  background: rgba(255, 255, 255, 0.8);
  border-color: var(--border-medium);
}

/* Saturation specific */
.mode-selector {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-xs);
  margin-bottom: var(--space-sm);
}

.mode-btn {
  padding: var(--space-sm);
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid var(--border-light);
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: capitalize;
  cursor: pointer;
  transition: all 0.2s ease;
}

.mode-btn:hover {
  background: rgba(255, 255, 255, 0.8);
  border-color: var(--border-medium);
}

.mode-btn.active {
  background: var(--text-primary);
  border-color: var(--text-primary);
  color: white;
}

.harmonics-selector {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.harmonics-selector label {
  font-size: 0.7rem;
  font-weight: 500;
  color: var(--text-secondary);
  text-transform: lowercase;
}

.harm-btn {
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid var(--border-light);
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: capitalize;
  cursor: pointer;
  transition: all 0.2s ease;
}

.harm-btn:hover {
  background: rgba(255, 255, 255, 0.8);
  border-color: var(--border-medium);
}

.harm-btn.active {
  background: linear-gradient(135deg, #c49ac4, #7eb5d6);
  border-color: #7eb5d6;
  color: white;
}

/* Responsive */
@media (max-width: 1400px) {
  .effects-container {
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  }
}

@media (max-width: 768px) {
  .effects-container {
    grid-template-columns: 1fr;
  }
}
