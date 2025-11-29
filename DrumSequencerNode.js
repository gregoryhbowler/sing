export class DrumsSequencerNode extends AudioWorkletNode {
    constructor(context) {
        super(context, 'drums-sequencer-processor', {
            numberOfInputs: 1,  // FIXED: Changed from 0 to 1 to receive clock
            numberOfOutputs: 1,
            outputChannelCount: [2] // Stereo output: Left=KickTrigger, Right=SnareTrigger
        });
        
        // Create clock input gain node
        this.clockInput = context.createGain();
        this.clockInput.gain.value = 1.0;
        this.clockInput.connect(this, 0, 0);
    }
    
    /**
     * Get the clock input node
     * Connect your clock source (JF IDENTITY or René clock) to this
     */
    getClockInput() {
        return this.clockInput;
    }
    
    /**
     * Enable/disable external clock
     * @param {boolean} enabled - true for external clock, false for internal tempo
     */
    setExternalClock(enabled) {
        if (this.parameters.has('useExternalClock')) {
            this.parameters.get('useExternalClock').value = enabled ? 1 : 0;
            console.log(`Drum sequencer: ${enabled ? 'External clock' : 'Internal tempo'}`);
        }
    }
    
    /**
     * Set internal tempo (only used when external clock is disabled)
     * @param {number} bpm - Beats per minute
     */
    setTempo(bpm) {
        if (this.parameters.has('tempo')) {
            this.parameters.get('tempo').value = bpm;
            console.log(`Drum sequencer tempo: ${bpm} BPM`);
        }
    }

    /**
     * Randomize kick and snare patterns
     */
    randomizePattern() {
        this.port.postMessage({ type: 'randomizePattern' });
    }

    /**
     * Randomize the groove mask (coherence filter)
     */
    randomizeGroove() {
        this.port.postMessage({ type: 'randomizeGroove' });
    }
}
