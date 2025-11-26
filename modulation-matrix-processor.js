// modulation-matrix-processor.js
// Modulation Matrix - AudioWorklet Processor
// Routes Just Friends slopes 2N-6N to any parameter in the system

class ModulationMatrixProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    // 5 modulation slots, each with depth and offset
    const params = [];
    
    for (let i = 0; i < 5; i++) {
      params.push(
        { name: `depth${i}`, defaultValue: 0.5, minValue: 0, maxValue: 1 },
        { name: `offset${i}`, defaultValue: 0, minValue: -1, maxValue: 1 },
        { name: `mode${i}`, defaultValue: 0, minValue: 0, maxValue: 3 }
        // mode: 0=unipolar, 1=bipolar, 2=inverted unipolar, 3=inverted bipolar
      );
    }
    
    return params;
  }

  constructor() {
    super();
    
    // Track enabled slots (controlled from Node)
    this.enabledSlots = [false, false, false, false, false];
    
    this.port.onmessage = (event) => {
      if (event.data.type === 'setEnabled') {
        const { slot, enabled } = event.data;
        this.enabledSlots[slot] = enabled;
      }
    };
    
    console.log('Modulation Matrix processor initialized');
  }

  // Transform signal based on mode
  transformSignal(input, mode) {
    // Input from JF SHAPE range: 0-8V → 0-1.6 in Web Audio
    // Normalize to 0-1 first
    const normalized = Math.max(0, Math.min(1.6, input)) / 1.6;
    
    switch (Math.round(mode)) {
      case 0: // Unipolar (0 → 1)
        return normalized;
      
      case 1: // Bipolar (-1 → +1)
        return (normalized * 2.0) - 1.0;
      
      case 2: // Inverted Unipolar (1 → 0)
        return 1.0 - normalized;
      
      case 3: // Inverted Bipolar (+1 → -1)
        return 1.0 - (normalized * 2.0);
      
      default:
        return normalized;
    }
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    
    if (!input || !output) return true;
    
    // Process each modulation slot (5 total)
    for (let slot = 0; slot < 5; slot++) {
      const inChannel = input[slot];
      const outChannel = output[slot];
      
      if (!inChannel || !outChannel) continue;
      
      // Skip processing if slot is disabled
      if (!this.enabledSlots[slot]) {
        // Output zero signal
        for (let i = 0; i < outChannel.length; i++) {
          outChannel[i] = 0;
        }
        continue;
      }
      
      const depthParam = parameters[`depth${slot}`];
      const offsetParam = parameters[`offset${slot}`];
      const modeParam = parameters[`mode${slot}`];
      
      for (let i = 0; i < outChannel.length; i++) {
        const depth = depthParam[i] ?? depthParam[0];
        const offset = offsetParam[i] ?? offsetParam[0];
        const mode = modeParam[i] ?? modeParam[0];
        
        // Read input from JF slope
        const rawInput = inChannel[i] || 0;
        
        // Transform based on mode
        const transformed = this.transformSignal(rawInput, mode);
        
        // Apply depth scaling
        const scaled = transformed * depth;
        
        // Apply offset
        const final = scaled + offset;
        
        // Clamp to reasonable range
        outChannel[i] = Math.max(-2, Math.min(2, final));
      }
    }
    
    return true;
  }
}

registerProcessor('modulation-matrix-processor', ModulationMatrixProcessor);
