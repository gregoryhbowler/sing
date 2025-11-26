// just-friends-test.js
// Test code showing how to instantiate and use Just Friends
// This demonstrates the different modes and how JF will be integrated into the larger system

import { JustFriendsNode } from './JustFriendsNode.js';

/*
 * INTEGRATION NOTES FOR THE FINAL SEMI-MODULAR SYSTEM:
 * 
 * We will have TWO instances of Just Friends:
 * 
 * JF #1: Pitch Modulation Source
 * - Mode: cycle (looping LFOs/envelopes)
 * - Range: shape (control-rate)
 * - Output: One slope (e.g., IDENTITY) → Scope 1 → Quantizer → Mangrove A pitch CV
 * 
 * JF #2: Amplitude Modulation Source
 * - Mode: cycle or transient (depending on desired envelope behavior)
 * - Range: shape (control-rate)
 * - Output: One slope → VCA CV input
 */

class JustFriendsTest {
  constructor() {
    this.audioContext = null;
    this.jf1 = null; // Pitch modulation instance
    this.jf2 = null; // Amplitude modulation instance
  }

  async init() {
    // Create audio context
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Load the AudioWorklet processor
    await this.audioContext.audioWorklet.addModule('./just-friends-processor.js');
    
    console.log('Just Friends AudioWorklet loaded successfully');
  }

  // ========== TEST 1: CYCLE MODE LFO ==========
  // This configuration creates looping envelopes/LFOs for pitch modulation
  testCycleLFO() {
    this.jf1 = new JustFriendsNode(this.audioContext);
    
    // Configure as LFO in cycle/shape mode
    this.jf1.setMode(2); // cycle
    this.jf1.setRange(0); // shape (control-rate)
    this.jf1.setTime(0.3); // Slowish rate
    this.jf1.setIntone(0.5); // All slopes at same frequency (noon)
    this.jf1.setRamp(0.5); // Balanced triangle (noon)
    this.jf1.setCurve(0.5); // Linear (noon)
    
    // Connect IDENTITY output to speakers for testing
    // In the final system, this would go to: Scope 1 → Quantizer → Mangrove A pitch
    this.jf1.getIdentityOutput().connect(this.audioContext.destination);
    
    console.log('JF #1 configured as looping LFO');
    console.log('- IDENTITY output will produce a continuous triangle wave');
    console.log('- This will be used for pitch modulation via the quantizer');
  }

  // ========== TEST 2: TRIGGERED ENVELOPES ==========
  // This configuration creates AR envelopes for amplitude shaping
  testTriggeredEnvelopes() {
    this.jf2 = new JustFriendsNode(this.audioContext);
    
    // Configure as triggered envelope in transient/shape mode
    this.jf2.setMode(0); // transient
    this.jf2.setRange(0); // shape (control-rate)
    this.jf2.setTime(0.5); // Medium envelope time
    this.jf2.setIntone(0.5); // All slopes at same duration
    this.jf2.setRamp(0.3); // Slightly more attack than release
    this.jf2.setCurve(0.6); // Slightly exponential
    
    // Create a simple trigger source (LFO crossing zero)
    const triggerLFO = this.audioContext.createOscillator();
    triggerLFO.frequency.value = 2; // 2 Hz = trigger every 0.5 seconds
    triggerLFO.type = 'square';
    triggerLFO.start();
    
    // Connect trigger to IDENTITY trigger input
    triggerLFO.connect(this.jf2.getTriggerInput(0));
    
    // Connect IDENTITY output to speakers for testing
    // In the final system, this would go to VCA CV input
    this.jf2.getIdentityOutput().connect(this.audioContext.destination);
    
    console.log('JF #2 configured as triggered AR envelope');
    console.log('- Triggering at 2 Hz');
    console.log('- This will be used to shape VCA amplitude');
  }

  // ========== TEST 3: AUDIO-RATE WAVESHAPED VCOs ==========
  // This demonstrates cycle/sound mode for testing overtone/undertone series
  testAudioVCOs() {
    const jfSound = new JustFriendsNode(this.audioContext);
    
    // Configure as audio-rate VCOs in cycle/sound mode
    jfSound.setMode(2); // cycle
    jfSound.setRange(1); // sound (audio-rate)
    jfSound.setTime(0.5); // A4 (440 Hz) region
    jfSound.setIntone(0.75); // Partial overtone series
    jfSound.setRamp(0.5); // Triangle
    jfSound.setCurve(0.5); // Linear
    
    // Mix output to speakers
    const gain = this.audioContext.createGain();
    gain.gain.value = 0.3; // Reduce volume
    jfSound.getMixOutput().connect(gain);
    gain.connect(this.audioContext.destination);
    
    console.log('JF Sound configured as waveshaped VCO');
    console.log('- MIX output contains a chord with partial overtone relationships');
  }

  // ========== TEST 4: QUADRATURE LFOS ==========
  // Demonstrates phase-shifted LFOs with trigger reset
  testQuadratureLFOs() {
    const jfQuad = new JustFriendsNode(this.audioContext);
    
    // Configure for quadrature pattern
    jfQuad.setMode(2); // cycle
    jfQuad.setRange(0); // shape
    jfQuad.setTime(0.4);
    jfQuad.setIntone(0.5); // All same frequency
    jfQuad.setRamp(0.5);
    jfQuad.setCurve(0.5);
    
    // Create periodic reset trigger to sync phases
    const resetOsc = this.audioContext.createOscillator();
    resetOsc.frequency.value = 0.5; // Reset every 2 seconds
    resetOsc.type = 'square';
    resetOsc.start();
    
    // Reset all slopes together
    jfQuad.connectTriggerToAll(resetOsc);
    
    // Monitor multiple outputs
    // In practice, these would go to different modulation destinations
    const merger = this.audioContext.createChannelMerger(6);
    for (let i = 0; i < 6; i++) {
      jfQuad.getSlopeOutput(i).connect(merger, 0, i);
    }
    
    const gain = this.audioContext.createGain();
    gain.gain.value = 0.2;
    merger.connect(gain);
    gain.connect(this.audioContext.destination);
    
    console.log('JF Quadrature configured');
    console.log('- 6 phase-related LFOs resetting together every 2 seconds');
  }

  // ========== INTEGRATION EXAMPLE ==========
  // Shows how JF will connect to other modules in the final system
  demonstrateIntegration() {
    console.log('\n========== FINAL SYSTEM INTEGRATION ==========');
    console.log('\nJF #1 (Pitch Modulation):');
    console.log('  JF1.getIdentityOutput() → Scope1 → Quantizer.input');
    console.log('  Quantizer.output → MangroveA.getPitchCVInput()');
    console.log('\nJF #2 (Amplitude Modulation):');
    console.log('  JF2.getIdentityOutput() → VCA.cvInput');
    console.log('  MangroveA.getFormantOutput() → ThreeSisters.input');
    console.log('  ThreeSisters.output → Scope2 → VCA.audioInput');
    console.log('  VCA.output → audioContext.destination');
    
    // Example pseudo-code for final integration:
    /*
    // JF #1 for pitch modulation
    const jf1 = new JustFriendsNode(context);
    jf1.setMode(2); // cycle
    jf1.setRange(0); // shape
    jf1.setTime(0.2);
    
    // JF #1 → Quantizer → Mangrove A
    jf1.getIdentityOutput().connect(quantizer.getInput());
    quantizer.getOutput().connect(mangroveA.getPitchCVInput());
    
    // JF #2 for amplitude envelopes
    const jf2 = new JustFriendsNode(context);
    jf2.setMode(0); // transient
    jf2.setRange(0); // shape
    jf2.setTime(0.5);
    
    // Trigger source for JF #2
    triggerSource.connect(jf2.getTriggerInput(0));
    
    // JF #2 → VCA
    jf2.getIdentityOutput().connect(vca.getCVInput());
    
    // Audio path: Mangrove A → Filter → VCA → Out
    mangroveA.getFormantOutput().connect(filter.getInput());
    filter.getOutput().connect(vca.getAudioInput());
    vca.getOutput().connect(context.destination);
    */
  }

  // ========== CV RANGE NOTES ==========
  showCVRangeInfo() {
    console.log('\n========== CV RANGES ==========');
    console.log('SHAPE range (range=0):');
    console.log('  Output: 0-8V unipolar (normalized to 0-1.6 in Web Audio)');
    console.log('  Use for: Envelopes, LFOs, modulation sources');
    console.log('\nSOUND range (range=1):');
    console.log('  Output: ±5V bipolar (normalized to ±1 in Web Audio)');
    console.log('  Use for: Audio-rate VCOs, waveshaping');
    console.log('\nFor 1V/oct pitch control:');
    console.log('  Quantizer will output CV in 1V/oct space');
    console.log('  This connects directly to Mangrove pitch CV input');
  }

  // Cleanup
  dispose() {
    if (this.jf1) this.jf1.dispose();
    if (this.jf2) this.jf2.dispose();
    if (this.audioContext) this.audioContext.close();
  }
}

// Export for use in main application
export { JustFriendsTest };

// Example usage:
/*
const test = new JustFriendsTest();
await test.init();
test.testCycleLFO();
test.testTriggeredEnvelopes();
test.demonstrateIntegration();
test.showCVRangeInfo();
*/
