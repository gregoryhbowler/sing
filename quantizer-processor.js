// quantizer-processor.js
// CV Quantizer - AudioWorklet Processor
// Converts continuous audio-rate CV into quantized audio-rate CV (1V/oct space)
// NO MIDI, NO TRIGGERS - pure analog-style quantization

class QuantizerProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      // Depth: controls pitch range in octaves (0 = single note, 8 = 8 octaves range)
      { name: 'depth', defaultValue: 1.0, minValue: 0, maxValue: 8.0 },
      
      // Offset: shifts CV after quantization (-4V to +4V for transposition)
      { name: 'offset', defaultValue: 0.0, minValue: -4.0, maxValue: 4.0 }
    ];
  }

  constructor() {
    super();
    
    // Note mask: 12 booleans for C through B
    // Default: chromatic scale (all notes allowed)
    this.noteMask = new Array(12).fill(true);
    
    // Debug counters
    this.sampleCount = 0;
    this.debugInterval = 48000; // Log every second at 48kHz
    
    // Listen for note mask updates from the Node
    this.port.onmessage = (event) => {
      if (event.data.type === 'noteMask') {
        this.noteMask = event.data.mask;
        const activeNotes = this.noteMask.filter(n => n).length;
        console.log(`[Quantizer] Note mask updated: ${activeNotes}/12 notes active`);
      }
    };
  }

  // Find nearest allowed semitone index (0-11) within an octave
  findNearestAllowedNote(fractionalSemitone) {
    // Round to nearest integer semitone first
    let targetIdx = Math.round(fractionalSemitone);
    
    // Wrap to 0-11 range
    targetIdx = ((targetIdx % 12) + 12) % 12;
    
    // If this note is allowed, use it immediately
    if (this.noteMask[targetIdx]) {
      return targetIdx;
    }
    
    // Otherwise, spiral outward to find nearest allowed note
    for (let distance = 1; distance <= 6; distance++) {
      // Check upward
      const upIdx = (targetIdx + distance) % 12;
      if (this.noteMask[upIdx]) {
        // Check downward at same distance
        const downIdx = (targetIdx - distance + 12) % 12;
        if (this.noteMask[downIdx]) {
          // Both directions have allowed notes - pick closest based on fractional part
          const frac = fractionalSemitone - Math.floor(fractionalSemitone);
          return frac >= 0.5 ? upIdx : downIdx;
        }
        return upIdx;
      }
      
      // Check downward
      const downIdx = (targetIdx - distance + 12) % 12;
      if (this.noteMask[downIdx]) {
        return downIdx;
      }
    }
    
    // Fallback: return C (shouldn't happen if at least one note is enabled)
    return 0;
  }

  // Quantize a voltage value to the nearest allowed note
  // Returns voltage in 1V/oct space
  quantizeVoltage(voltsIn) {
    // Convert voltage to semitones (1V/oct = 12 semitones/volt)
    const totalSemitones = voltsIn * 12.0;
    
    // Split into octave and semitone-within-octave
    const octave = Math.floor(totalSemitones / 12.0);
    const semitoneInOctave = totalSemitones - (octave * 12.0);
    
    // Find nearest allowed note within this octave
    const snappedIdx = this.findNearestAllowedNote(semitoneInOctave);
    
    // Reconstruct the quantized semitone value
    const quantizedSemitones = (octave * 12) + snappedIdx;
    
    // Convert back to voltage
    return quantizedSemitones / 12.0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    
    if (!input || !input[0] || !output || !output[0]) {
      return true;
    }
    
    const cvIn = input[0];
    const cvOut = output[0];
    
    // Debug logging
    let debugValues = null;
    if (this.sampleCount % this.debugInterval === 0) {
      debugValues = {
        inputMin: Infinity,
        inputMax: -Infinity,
        outputMin: Infinity,
        outputMax: -Infinity,
        quantizedValues: new Set()
      };
    }
    
    for (let i = 0; i < cvIn.length; i++) {
      // Get parameters
      const depth = parameters.depth[i] ?? parameters.depth[0];
      const offset = parameters.offset[i] ?? parameters.offset[0];
      
      // Read input CV from Just Friends
      // JF SHAPE mode outputs 0-8V, normalized to 0-1.6 in Web Audio
      const cvValue = cvIn[i] || 0;
      
      // Normalize JF output to 0-1 range
      // JF outputs 0-8V which becomes 0-1.6, so divide by 1.6
      const normalized = Math.max(0, Math.min(1.6, cvValue)) / 1.6;
      
      // Apply depth to map to voltage range
      // depth is now in octaves (0-8 range)
      // depth = 0 → 0V (single note)
      // depth = 1.0 → 1V (1 octave = 12 semitones)
      // depth = 2.5 → 2.5V (2.5 octaves = 30 semitones)
      // depth = 8.0 → 8V (8 octaves = 96 semitones)
      const volts = normalized * depth;
      
      // Quantize to nearest allowed note
      const quantizedVolts = this.quantizeVoltage(volts);
      
      // Apply offset AFTER quantization (transposition)
      const finalVolts = quantizedVolts + offset;
      
      // Convert to Web Audio range for Mangrove pitch CV
      // Keep in voltage space, normalize by 5V for Web Audio
      cvOut[i] = finalVolts / 5.0;
      
      // Debug logging
      if (debugValues) {
        debugValues.inputMin = Math.min(debugValues.inputMin, cvValue);
        debugValues.inputMax = Math.max(debugValues.inputMax, cvValue);
        debugValues.outputMin = Math.min(debugValues.outputMin, finalVolts);
        debugValues.outputMax = Math.max(debugValues.outputMax, finalVolts);
        debugValues.quantizedValues.add(quantizedVolts.toFixed(3));
      }
      
      this.sampleCount++;
    }
    
    // Output debug info
    if (debugValues) {
      console.log('[Quantizer Debug]', {
        input: `${debugValues.inputMin.toFixed(3)} to ${debugValues.inputMax.toFixed(3)}`,
        output: `${debugValues.outputMin.toFixed(2)}V to ${debugValues.outputMax.toFixed(2)}V`,
        uniqueNotes: debugValues.quantizedValues.size,
        noteValues: Array.from(debugValues.quantizedValues).slice(0, 8).join(', '),
        depth: parameters.depth[0].toFixed(2),
        offset: parameters.offset[0].toFixed(2),
        activeMask: this.noteMask.map((v, i) => v ? i : -1).filter(v => v >= 0).join(',')
      });
    }
    
    return true;
  }
}

registerProcessor('quantizer-processor', QuantizerProcessor);
