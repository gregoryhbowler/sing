// LFONode.js
// Wrapper for LFO AudioWorkletProcessor
// Each LFO can modulate two destinations independently

export class LFONode extends AudioWorkletNode {
  constructor(context, lfoIndex = 0) {
    super(context, 'lfo-processor', {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      channelCount: 1,
      channelCountMode: 'explicit',
      channelInterpretation: 'discrete'
    });

    this.lfoIndex = lfoIndex;
    this.ctx = context;

    // Store parameter references
    this.params = {
      rate: this.parameters.get('rate'),
      waveform: this.parameters.get('waveform'),
      phase: this.parameters.get('phase')
    };

    // Clock sync state
    this.clockSyncEnabled = false;
    this.clockDivision = 1; // 1 = 1 cycle per clock, 2 = 2 cycles per clock, 0.5 = half cycle, etc.
    this.clockTickCount = 0;
    this.lastClockTime = 0;
    this.clockIntervalMs = 500; // Estimated clock interval (updated on each tick)
    this.freeRunningRate = 1.0; // Store free-running rate when sync is enabled

    // Create output gain
    this.output = context.createGain();
    this.connect(this.output);

    // Create two destination routing chains (A and B)
    this.destinations = [
      this.createDestinationChain(),
      this.createDestinationChain()
    ];

    console.log(`✓ LFO ${lfoIndex + 1} created`);
  }

  createDestinationChain() {
    const offset = this.context.createConstantSource();
    const modeOffset = this.context.createConstantSource();
    const modeSum = this.context.createGain();
    
    // Start ConstantSources once and keep them running
    offset.start();
    modeOffset.start();
    
    // modeSum is used to add the modeOffset to the scaled LFO signal
    modeSum.gain.value = 1.0; // Unity gain for pass-through
    
    return {
      enabled: false,
      param: null,
      depth: this.context.createGain(),
      offset: offset,
      mode: 0, // 0=unipolar, 1=bipolar, 2=inv unipolar, 3=inv bipolar
      modeGain: this.context.createGain(),
      modeOffset: modeOffset,
      modeSum: modeSum  // New: summing node for mode offset
    };
  }

  // ========== PARAMETER SETTERS ==========

  /**
   * Set LFO rate in Hz
   * @param {number} hz - 0.01 to 100 Hz
   */
  setRate(hz) {
    this.params.rate.value = Math.max(0.01, Math.min(100, hz));
  }

  /**
   * Set waveform type
   * @param {number|string} waveform - Index or name
   *   0/'sine', 1/'square', 2/'triangle', 3/'samplehold', 4/'smoothrandom',
   *   5/'rampdown', 6/'rampup', 7/'exprampdown', 8/'exprampup'
   */
  setWaveform(waveform) {
    const waveformMap = {
      'sine': 0,
      'square': 1,
      'triangle': 2,
      'samplehold': 3,
      'smoothrandom': 4,
      'rampdown': 5,
      'rampup': 6,
      'exprampdown': 7,
      'exprampup': 8
    };
    
    const index = typeof waveform === 'string' 
      ? waveformMap[waveform.toLowerCase().replace(/[^a-z]/g, '')] 
      : waveform;
    
    this.params.waveform.value = Math.max(0, Math.min(8, Math.round(index)));
  }

  /**
   * Set phase offset (0-1)
   */
  setPhase(phase) {
    this.params.phase.value = Math.max(0, Math.min(1, phase));
  }

  // ========== DESTINATION CONTROL ==========

  /**
   * Set destination for one of the two routing channels
   * @param {number} destIndex - 0 or 1 (A or B)
   * @param {AudioParam} param - Destination AudioParam
   * @param {number} depth - Modulation depth (0-1)
   * @param {number} offset - Modulation offset (-1 to 1)
   * @param {number} mode - 0=unipolar, 1=bipolar, 2=inv unipolar, 3=inv bipolar
   */
  setDestination(destIndex, param, depth = 0.5, offset = 0, mode = 0) {
    if (destIndex !== 0 && destIndex !== 1) {
      console.error('LFO destination index must be 0 or 1');
      return;
    }
    
    const dest = this.destinations[destIndex];
    
    // Disconnect previous routing
    this.disconnectDestination(destIndex);
    
    if (!param) {
      dest.enabled = false;
      return;
    }
    
    // Store new destination
    dest.param = param;
    dest.enabled = true;
    dest.mode = mode;
    
    // Configure mode transformation
    this.configureModeTransform(destIndex, mode);
    
    // Set depth and offset
    dest.depth.gain.value = depth;
    dest.offset.offset.value = offset;
    
    // Connect signal chain: LFO → modeGain (scale) → modeSum (add offset) → depth → param
    // Note: ConstantSources are already started in createDestinationChain()
    this.output.connect(dest.modeGain);           // LFO to scaling
    dest.modeGain.connect(dest.modeSum);          // Scaled signal to summer
    dest.modeOffset.connect(dest.modeSum);        // Add mode offset (for unipolar, etc.)
    dest.modeSum.connect(dest.depth);             // Combined signal to depth control
    dest.depth.connect(param);                    // Depth-scaled modulation to destination
    dest.offset.connect(param);                   // User offset also to destination
    
    console.log(`LFO ${this.lfoIndex + 1} destination ${destIndex === 0 ? 'A' : 'B'} connected`);
  }

  configureModeTransform(destIndex, mode) {
    const dest = this.destinations[destIndex];
    
    // Signal flow: LFO → (multiply by modeGain) → (add modeOffset) → depth → destination
    // This properly implements the mode transformations using separate scale and offset stages
    
    switch (mode) {
      case 0: // Unipolar (0 → 1): (x + 1) / 2
        dest.modeGain.gain.value = 0.5;
        dest.modeOffset.offset.value = 0.5;
        break;
      
      case 1: // Bipolar (-1 → +1): x
        dest.modeGain.gain.value = 1.0;
        dest.modeOffset.offset.value = 0;
        break;
      
      case 2: // Inv Unipolar (1 → 0): (1 - x) / 2
        dest.modeGain.gain.value = -0.5;
        dest.modeOffset.offset.value = 0.5;
        break;
      
      case 3: // Inv Bipolar (+1 → -1): -x
        dest.modeGain.gain.value = -1.0;
        dest.modeOffset.offset.value = 0;
        break;
    }
  }

  /**
   * Update depth for a destination
   */
  setDepth(destIndex, depth) {
    if (destIndex !== 0 && destIndex !== 1) return;
    this.destinations[destIndex].depth.gain.value = Math.max(0, Math.min(1, depth));
  }

  /**
   * Update offset for a destination
   */
  setOffset(destIndex, offset) {
    if (destIndex !== 0 && destIndex !== 1) return;
    this.destinations[destIndex].offset.offset.value = Math.max(-1, Math.min(1, offset));
  }

  /**
   * Update mode for a destination
   */
  setMode(destIndex, mode) {
    if (destIndex !== 0 && destIndex !== 1) return;
    const dest = this.destinations[destIndex];
    dest.mode = mode;
    this.configureModeTransform(destIndex, mode);
  }

  /**
   * Enable/disable a destination
   */
  setDestinationEnabled(destIndex, enabled) {
    if (destIndex !== 0 && destIndex !== 1) return;
    const dest = this.destinations[destIndex];
    
    if (enabled && dest.param) {
      dest.enabled = true;
      // Reconnect
      this.setDestination(
        destIndex, 
        dest.param, 
        dest.depth.gain.value, 
        dest.offset.offset.value,
        dest.mode
      );
    } else {
      this.disconnectDestination(destIndex);
      dest.enabled = false;
    }
  }

  /**
   * Disconnect a destination (but keep ConstantSources running)
   */
  disconnectDestination(destIndex) {
    if (destIndex !== 0 && destIndex !== 1) return;
    const dest = this.destinations[destIndex];
    
    try {
      this.output.disconnect(dest.modeGain);
      dest.modeGain.disconnect();
      dest.modeSum.disconnect();    // Disconnect the summing node
      dest.depth.disconnect();
      dest.offset.disconnect();
      dest.modeOffset.disconnect();
      // Note: We do NOT stop the ConstantSources - they stay running
    } catch (e) {
      // Already disconnected
    }
  }

  // ========== ACCESSORS ==========

  getOutput() {
    return this.output;
  }

  getDestinationInfo(destIndex) {
    if (destIndex !== 0 && destIndex !== 1) return null;
    const dest = this.destinations[destIndex];
    
    return {
      enabled: dest.enabled,
      hasParam: dest.param !== null,
      depth: dest.depth.gain.value,
      offset: dest.offset.offset.value,
      mode: dest.mode
    };
  }

  // ========== CLOCK SYNC ==========

  /**
   * Enable/disable clock sync
   * When enabled, LFO rate is derived from incoming clock ticks
   */
  setClockSync(enabled) {
    this.clockSyncEnabled = enabled;

    if (enabled) {
      // Store current rate as free-running rate
      this.freeRunningRate = this.params.rate.value;
      this.clockTickCount = 0;
      console.log(`LFO ${this.lfoIndex + 1}: Clock sync enabled (div: ${this.clockDivision})`);
    } else {
      // Restore free-running rate
      this.params.rate.value = this.freeRunningRate;
      console.log(`LFO ${this.lfoIndex + 1}: Clock sync disabled, rate: ${this.freeRunningRate.toFixed(2)} Hz`);
    }
  }

  /**
   * Set clock division (how many base clock ticks per LFO cycle)
   * Base clock ticks at 16th notes (4 ticks per beat)
   * @param {number} division - Ticks per LFO cycle
   *   1 = 1 tick per cycle (1/16 note, fastest)
   *   2 = 2 ticks per cycle (1/8 note)
   *   4 = 4 ticks per cycle (1/4 note / 1 beat)
   *   16 = 16 ticks per cycle (1 bar / 4 beats)
   *   64 = 64 ticks per cycle (4 bars)
   *   128 = 128 ticks per cycle (8 bars, slowest)
   */
  setClockDivision(division) {
    this.clockDivision = Math.max(1, Math.min(256, division));
    console.log(`LFO ${this.lfoIndex + 1}: Clock division set to ${this.clockDivision} ticks/cycle`);

    // Update rate if sync is enabled
    if (this.clockSyncEnabled && this.clockIntervalMs > 0) {
      this.updateSyncedRate();
    }
  }

  /**
   * Called on each clock tick from the main app
   * Updates the LFO rate based on clock tempo
   */
  clockTick() {
    if (!this.clockSyncEnabled) return;

    const now = performance.now();

    if (this.lastClockTime > 0) {
      // Calculate interval between ticks
      const interval = now - this.lastClockTime;
      // Smooth the interval estimation
      this.clockIntervalMs = this.clockIntervalMs * 0.7 + interval * 0.3;
      this.updateSyncedRate();
    }

    this.lastClockTime = now;
    this.clockTickCount++;
  }

  /**
   * Update LFO rate based on clock interval and division
   * Base clock ticks at 16th notes. Division = ticks per LFO cycle.
   *
   * At 120 BPM: tickInterval = 125ms, ticksPerSecond = 8
   *   division 1 (1/16): rate = 8 Hz (one cycle per 16th note)
   *   division 4 (1/4): rate = 2 Hz (one cycle per beat)
   *   division 16 (1 bar): rate = 0.5 Hz (one cycle per bar)
   */
  updateSyncedRate() {
    // Ticks per second based on measured interval
    const ticksPerSecond = 1000 / this.clockIntervalMs;

    // LFO rate = ticksPerSecond / division
    const syncedRate = ticksPerSecond / this.clockDivision;

    // Clamp to valid range
    this.params.rate.value = Math.max(0.001, Math.min(100, syncedRate));
  }

  /**
   * Get current clock sync state
   */
  getClockSyncState() {
    return {
      enabled: this.clockSyncEnabled,
      division: this.clockDivision,
      estimatedIntervalMs: this.clockIntervalMs,
      currentRate: this.params.rate.value
    };
  }

  // ========== CLEANUP ==========

  dispose() {
    this.disconnectDestination(0);
    this.disconnectDestination(1);
    
    // Now we can stop the ConstantSources
    try {
      this.destinations[0].offset.stop();
      this.destinations[0].modeOffset.stop();
      this.destinations[1].offset.stop();
      this.destinations[1].modeOffset.stop();
    } catch (e) {
      // Already stopped
    }
    
    this.disconnect();
    this.output.disconnect();
  }
}
