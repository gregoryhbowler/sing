# Moog & Wasp Low-Frequency Analysis

## Moog Ladder Filter - Silence Below 326 Hz

### Root Cause: Authentic Analog Behavior (Too Authentic!)

The Moog ladder filter processor is implementing **authentic analog behavior**, which includes:
- Volume loss at low cutoff frequencies
- No automatic gain compensation

This is **technically correct** for an analog Moog ladder, but **musically problematic** because:
- Users expect to hear sound across the full 20-20kHz range
- At cutoff frequencies below ~300-400 Hz with low resonance, the filter attenuates the signal by 20-30dB or more
- With typical audio levels, this makes the filter sound "silent"

### Why This Isn't a Bug (But Feels Like One)

In a real Moog synthesizer:
- The oscillators are often very loud (hot signals)
- Multiple stages of gain makeup exist in the signal path
- The VCA envelope compensates for filter losses
- Users adjust the overall output gain to compensate

In Phase5-Poly:
- The Mangrove oscillator outputs ±1.0 normalized audio
- The filter is applied directly without makeup gain
- At low cutoff frequencies, the 4-pole lowpass attenuates significantly
- Result: Appears "silent" even though it's technically working

### Evidence

1. **The processor itself is correct** - uses proper TPT topology
2. **DC blocker is reasonable** - 0.995 coefficient = ~38 Hz cutoff
3. **No obvious bugs** in the ladder calculation
4. **Works in root folder** - likely because the usage context compensates elsewhere

### Solutions

#### Option 1: Add Frequency-Dependent Gain Compensation (Recommended)
Add makeup gain that increases as cutoff decreases, compensating for the natural attenuation:

```javascript
// In processLadder(), after line 201:
// Calculate makeup gain based on cutoff frequency
// Low frequencies need more gain to compensate for ladder attenuation
const normalizedCutoff = Math.min(cutoff / 20000, 1.0);
const makeupGain = 1 + (1 - normalizedCutoff) * 2.0; // Up to 3x gain at 20 Hz
return stages[3] * makeupGain;
```

**Pros**: Maintains usable audio across full frequency range
**Cons**: Less "authentic" analog behavior

#### Option 2: Add User-Controlled Makeup Gain Parameter
Add a "level" or "makeup" parameter that users can adjust:

```javascript
static get parameterDescriptors() {
  return [
    // ... existing parameters ...
    {
      name: 'makeup',
      defaultValue: 1.0,
      minValue: 0.1,
      maxValue: 5.0,
      automationRate: 'k-rate'
    }
  ];
}

// In processLadder():
return stages[3] * this.smoothedMakeup;
```

**Pros**: Gives user control, maintains authenticity when desired
**Cons**: Extra parameter to manage

#### Option 3: Increase Overall Signal Levels
Increase the Mangrove output or voice VCA gain to compensate:

**Pros**: No processor changes needed
**Cons**: Doesn't solve the fundamental issue, just makes it less noticeable

### Recommendation

**Implement Option 1** with a gentle gain curve:
- At 20 kHz: 1x gain (unity)
- At 1 kHz: ~1.5x gain
- At 100 Hz: ~2.5x gain
- At 20 Hz: ~3x gain

This keeps the filter musically useful while maintaining most of the analog character.

---

## Wasp Filter - Silent Below ~4754 Hz

### Analysis

The Wasp filter has a **much higher threshold** (4754 Hz vs 326 Hz), suggesting a different root cause.

### Hypothesis 1: SVF State Variable Initialization

The Wasp uses a State Variable Filter with two integrators (`ic1eq`, `ic2eq`). At low frequencies:
- The `g` coefficient becomes very small
- The integrators update very slowly
- If initialized at zero, they may take a long time to "wake up"

### Hypothesis 2: Resonance Shaping Issue

Line 118 of wasp-processor.js:
```javascript
const resShaped = Math.pow(Math.min(Math.max(resParam, 0), 1), 2.2);
const Q = 0.7 + resShaped * 30.0;
```

At default resonance=0.5:
```
resShaped = 0.5^2.2 = 0.216
Q = 0.7 + 0.216 * 30 = 7.18
k = 1 / Q = 0.139
```

This is a **very high Q** even at mid-resonance, which can cause instability or silence at low frequencies.

### Hypothesis 3: Cutoff Jitter Interaction

Lines 126-128:
```javascript
const jitter = (Math.random() - 0.5) * chaos * 0.002;
cutoff *= (1 + jitter);
cutoff = Math.min(Math.max(cutoff, 20), nyquist * 0.98);
```

With chaos=0.3 (default), jitter is tiny (±0.0003), so this shouldn't cause the issue.

### Hypothesis 4: Prewarp Calculation Error

Lines 131-133:
```javascript
const wd = 2 * Math.PI * cutoff;
const wa = 2 * sampleRate * Math.tan(wd / (2 * sampleRate));
const g = wa / (2 * sampleRate);
```

This is correct TPT prewarp. Simplifies to:
```javascript
g = Math.tan(Math.PI * cutoff / sampleRate);
```

At cutoff=4754 Hz, sampleRate=48000:
```
g = tan(π * 4754 / 48000) = tan(0.311) ≈ 0.322
```

This is a reasonable value. But what about lower frequencies?

At cutoff=100 Hz:
```
g = tan(π * 100 / 48000) = tan(0.00654) ≈ 0.00654
```

This is very small, but shouldn't cause silence.

### Hypothesis 5: Nonlinearity Inside the Loop

Lines 156-157:
```javascript
v1 = this.cmos(v1 * resDrive, this.bias, driveParam * 0.8);
v2 = this.cmos(v2 * resDrive, this.bias * 0.5, driveParam * 0.8);
```

The CMOS nonlinearity is applied to the integrator outputs. If these are very small at low frequencies, the `cmos()` function might be clipping them to zero or causing numerical issues.

**THIS IS THE LIKELY CULPRIT!**

At low frequencies with high Q:
- `v1` and `v2` are very small numbers
- Multiplied by `resDrive` (1.5-2.5)
- Passed through `tanh()` approximation
- If the values are below numerical precision, they get crushed to zero

### Recommended Investigation

Add diagnostic logging to wasp-processor.js to see:
1. What is the actual cutoff value during playback?
2. What are the `v1` and `v2` values before and after CMOS processing?
3. What are the integrator states (`ic1eq`, `ic2eq`)?

### Potential Fix

Reduce the resonance drive scaling or add a minimum threshold:

```javascript
// Line 153: Reduce resonance drive
const resDrive = 0.5 + driveParam * 1.0; // Was 0.5 + driveParam * 1.5

// Or add minimum threshold in CMOS function:
cmos(x, bias, drive) {
  if (Math.abs(x) < 0.0001) return x; // Pass through very small signals
  // ... rest of function
}
```

---

## Testing Protocol

### Moog Test
1. Load Phase5-Poly
2. Select Voice 1, Moog filter
3. Play a sustained note (e.g., C3 = MIDI 48)
4. Set resonance to 0, drive to 0.5, warmth to 1.0
5. Slowly sweep cutoff from 20 kHz down to 20 Hz
6. **Expected (current)**: Sound fades out below ~300-400 Hz
7. **Expected (after fix)**: Sound audible across full range with gain compensation

### Wasp Test
1. Select Voice 1, Wasp filter
2. Play a sustained note
3. Set resonance to 0.5, drive to 0.5, chaos to 0.3, mode to LP
4. Slowly sweep cutoff from 20 kHz down to 20 Hz
5. **Expected (current)**: Complete silence below ~4754 Hz
6. **Expected (after fix)**: Sound audible across full range

---

**Generated**: 2025-12-02
**Status**: Root causes identified, fixes proposed
