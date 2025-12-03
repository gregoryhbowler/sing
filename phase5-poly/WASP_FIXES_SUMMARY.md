# Wasp Filter - Attempted Fixes Summary

## Issue Reported
"Wasp has silent dead spots all throughout its cutoff, resonance, and drive parameters."

---

## Fixes Attempted

### Fix #1: Removed Double Saturation
**File**: [wasp-processor.js](../wasp-processor.js) lines 163-167
**Change**: Removed state saturation that was crushing signals
```javascript
// BEFORE:
const stateDrive = 0.3 + driveParam * 0.7;
this.ic1eq = this.tanh(this.ic1eq * (1 + stateDrive * 0.5));
this.ic2eq = this.tanh(this.ic2eq * (1 + stateDrive * 0.5));

// AFTER:
// REMOVED: Double saturation was crushing the signal and creating dead spots
// The CMOS saturation above is sufficient for the Wasp character
// Gentle denormal flush only (no audible effect)
if (Math.abs(this.ic1eq) < 1e-15) this.ic1eq = 0;
if (Math.abs(this.ic2eq) < 1e-15) this.ic2eq = 0;
```

### Fix #2: Reduced Maximum Q Value
**File**: [wasp-processor.js](../wasp-processor.js) line 119-120
**Change**: Reduced max Q from 30 to 15 to prevent SVF instability
```javascript
// BEFORE:
const Q = 0.7 + resShaped * 30.0; // up to pretty wild Q

// AFTER:
const Q = 0.7 + resShaped * 15.0; // Reduced to prevent instability
```

### Fix #3: Added G Coefficient Clamping
**File**: [wasp-processor.js](../wasp-processor.js) lines 136-141
**Change**: Clamp g coefficient to prevent numerical issues
```javascript
// Clamp g to prevent numerical issues at very high or very low cutoff
const gClamped = Math.min(Math.max(g, 0.0001), 1.99);

const a1 = 1 / (1 + gClamped * (gClamped + k));
const a2 = gClamped * a1;
const a3 = gClamped * a2;
```

### Fix #4: Fixed Parameter Initialization
**File**: [main.js](main.js) lines 640-643
**Change**: Added missing parameter initialization to match UI defaults
```javascript
// Initialize Wasp filter to match UI defaults
voice.filters.wasp.setCutoff(sliderToFrequency(0.65));
voice.filters.wasp.setResonance(0.0); // Match UI default
voice.filters.wasp.setDrive(0.5);
voice.filters.wasp.setChaos(0.0); // Match UI default
voice.filters.wasp.setMode(0); // LP mode
```

---

## User Testing Results

**Status**: Dead spots still persist

---

## Next Steps: Diagnostic Information Needed

To further investigate, we need specific details about the dead spots:

### Questions

1. **Which mode are you testing?**
   - LP (0)
   - BP (1)
   - HP (2)
   - Notch (3)

2. **At what specific parameter combinations do dead spots occur?**
   - Example: "Cutoff at 500 Hz, resonance at 0.3, drive at 0.7 = silence"
   - Example: "Cutoff sweep from 100-200 Hz with resonance=0.5 = intermittent silence"

3. **Do the dead spots occur:**
   - At specific frequencies only?
   - When sweeping parameters?
   - In certain parameter ranges?
   - Randomly?

4. **Is the filter:**
   - Completely silent during dead spots?
   - Producing clicks/pops?
   - Producing very quiet but audible sound?

5. **Does the issue occur:**
   - Only when switching to Wasp filter?
   - After playing for a while?
   - Immediately upon loading?

### Diagnostic Test

Please try this specific test:
1. Load Phase5-Poly
2. Select Voice 1
3. Select Wasp filter, LP mode
4. Set: Resonance=0.0, Drive=0.5, Chaos=0.0
5. Play a sustained note (e.g., MIDI note 60 = Middle C)
6. Slowly sweep cutoff from 20 kHz down to 20 Hz
7. **Report**: At what cutoff frequencies do you hear silence or dead spots?

---

## Theory: Possible Remaining Causes

### 1. SVF State Initialization Issue
The integrator states (`ic1eq`, `ic2eq`) might need better initialization or reset logic when parameters change dramatically.

### 2. Coefficient Calculation Edge Cases
Even with clamping, there might be specific combinations of cutoff + Q that produce unstable coefficients.

### 3. CMOS Nonlinearity Issues
The asymmetric soft clip might be producing zero output in certain conditions:
```javascript
cmos(x, bias, drive) {
  const input = x + bias * 0.05;
  const gained = input * (1 + drive * 2);
  const asymm = gained >= 0 ? gained * 1.15 : gained * 0.85;
  return this.tanh(asymm);
}
```

If `bias` wanders to an extreme value, it could offset the signal too far.

### 4. Gain Compensation Issue
The gain compensation at line 197 might be insufficient or incorrect:
```javascript
const gainComp = 1 + resShaped * 2.5;
```

At low resonance, this gives ~1x gain. The filter might be attenuating too much.

### 5. Audio Routing Issue
Though the routing code looks correct, there might be a disconnect/connect timing issue when switching filters.

---

## Potential Next Fixes

### Option A: Add Safety Net Output Gain
Add minimum output level to prevent total silence:
```javascript
const minGain = 0.5; // Never go below 50% volume
const gainComp = Math.max(minGain, 1 + resShaped * 2.5);
```

### Option B: Reset States on Parameter Change
Add state reset when cutoff changes dramatically (might cause clicks):
```javascript
if (Math.abs(cutoff - this.prevCutoff) > 1000) {
  this.ic1eq = 0;
  this.ic2eq = 0;
}
this.prevCutoff = cutoff;
```

### Option C: Reduce CMOS Drive Scaling
Make the CMOS saturation less aggressive:
```javascript
const gained = input * (1 + drive * 1.0); // Was drive * 2
```

### Option D: Add Input Boost
Boost the input signal before processing:
```javascript
const v0 = (inp[i] + noise) * 1.5; // Boost input
```

---

**Generated**: 2025-12-02
**Status**: User reported dead spots persist after 4 fixes
**Next**: Need specific diagnostic information to proceed
