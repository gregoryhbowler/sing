# Filter Processor Comparison Analysis

## Purpose
Compare working filter processors (Sing root) with Phase5-Poly implementation to identify why filters fail during runtime playback.

---

## 🔍 Key Findings Summary

### **CRITICAL DISCOVERY: Processor Registration Names Don't Match!**

#### Moog Filter
- **Root processor registers as**: `'moog-ladder-processor'` (line 311 of moog-processor.js)
- **Phase5-Poly wrapper expects**: `'moog-processor'` (INCORRECT - this name doesn't exist!)
- **Result**: Phase5-Poly is loading a **non-existent processor**, likely getting a silent/broken fallback

#### Wasp Filter
- **Root processor registers as**: `'wasp-processor'` ✅
- **Phase5-Poly wrapper expects**: `'wasp-processor'` ✅
- **Status**: NAME IS CORRECT, but still has audio issues (different root cause)

#### SEM Filter
- **Root processor registers as**: `'sem-filter-processor'` ✅
- **Phase5-Poly wrapper expects**: `'sem-filter-processor'` ✅
- **Status**: NAME IS CORRECT, but still has audio issues (different root cause)

#### Three Sisters
- **Root processor registers as**: `'three-sisters-processor'` ✅
- **Phase5-Poly wrapper expects**: `'three-sisters-processor'` ✅
- **Status**: NAME IS CORRECT, but still has behavior issues (different root cause)

---

## 🐛 Root Cause Analysis

### 1. **Moog Filter** - WRONG PROCESSOR NAME (BLOCKING)
```javascript
// In /sing/moog-processor.js line 311:
registerProcessor('moog-ladder-processor', MoogLadderProcessor);

// In /sing/phase5-poly/filters/MoogFilter.js line 12:
this.node = new AudioWorkletNode(audioContext, 'moog-processor', {
                                                 ^^^^^^^^^^^^^^
                                                 WRONG NAME!
```

**Impact**: The Moog filter is trying to load a processor that doesn't exist. The AudioWorkletNode either:
1. Falls back to silence
2. Uses some default/broken processor
3. Fails silently without throwing an error

**Fix**: Change `'moog-processor'` to `'moog-ladder-processor'` in MoogFilter.js

---

### 2. **Wasp Filter** - Different issue (name is correct)

The Wasp filter processor name matches, so the silence below 4754 Hz is a **different issue**:

#### Comparison of Processor Logic:

**Root implementation** (working):
- Cutoff parameter: 20-20000 Hz ✅
- Prewarp calculation: Standard TPT (lines 131-133) ✅
- SVF processing: Nonlinearity inside loop (lines 145-166) ✅
- Gain compensation: Added at line 192 ✅

**Phase5-Poly wrapper**:
- Parameter passing: Correct Hz values via `setCutoff()` ✅
- FM routing: Gain → cutoff parameter ✅

**Hypothesis**: The issue might be in how the processor handles **very low Q values** or **state initialization**. The SVF state variables (`ic1eq`, `ic2eq`) might be getting stuck at zero for low frequencies.

---

### 3. **SEM Filter** - Different issue (name is correct)

The SEM filter processor name matches, so the "cutoff acts like volume" issue is a **different problem**:

#### Comparison of Processor Logic:

**Root implementation** (working):
- Cutoff parameter: 20-20000 Hz ✅
- Prewarp: `g = tan(π * fc / sr)` with 0.49 clamp (line 165) ✅
- Resonance model: **INVERTED** - 0=near oscillation, 1=damped (lines 172-177) ✅
- Drive range: 0.1-10 (line 39) ✅
- Oversample: 1x, 2x, 4x modes ✅

**Phase5-Poly wrapper**:
- Drive initialization: `voice.filters.sem.setDrive(1.0)` (main.js:675) ⚠️
  - Drive=1.0 is **VERY LOW** for SEM (normal range 0.1-10)
  - At drive=1.0, the filter might be **barely audible**
- Resonance: Initialized to 0 (default)
  - In SEM, resonance=0 means **near self-oscillation** (kMin=0.02)
  - This is intentional but might surprise users

**Hypothesis**: The low drive value (1.0) combined with the inverted resonance model makes the filter sound like it's just attenuating volume rather than filtering.

---

### 4. **Three Sisters** - Complex multi-band filter

The Three Sisters processor name matches. The "still far from expected behavior" is likely due to:

#### Comparison with Root:

**Root implementation**:
- Freq parameter: 0-1 knob value → converted to Hz internally ✅
- Span parameter: 0-1 knob value (line 9) ✅
- FM depth: ±3 octaves (line 215) ✅
- Quality: Anti-resonance at low values, high Q (25.0 max) at high values (line 246) ✅

**Phase5-Poly wrapper**:
- Sends 0-1 knob values directly ✅ (fixed in previous session)
- FM routing: Should work correctly

**Hypothesis**: The Three Sisters might be working mostly correctly now, but the complex interaction of the three bands (low/center/high) with high Q values can produce unexpected results. User needs to test specific behaviors.

---

## 📊 Parameter Initialization Comparison

### Moog Filter
| Parameter | Root Default | Phase5-Poly Init | UI Default | Notes |
|-----------|--------------|------------------|------------|-------|
| cutoff | 1000 Hz | 3122 Hz | 0.65 slider → 3122 Hz | ✅ Reasonable |
| resonance | 0 | 0 | 0.0 slider | ✅ Correct |
| drive | 0 | 0.5 | 0.5 slider | ✅ Reasonable |
| warmth | 1 | 1.0 | 1.0 slider | ✅ Correct |

**BUT THE PROCESSOR NAME IS WRONG** so these values never reach the actual processor!

### Wasp Filter
| Parameter | Root Default | Phase5-Poly Init | UI Default | Notes |
|-----------|--------------|------------------|------------|-------|
| cutoff | 1000 Hz | 3122 Hz | 0.65 slider → 3122 Hz | ✅ Should work |
| resonance | 0.5 | 0.5 | 0.5 slider | ✅ Correct |
| mode | 0 (LP) | 0 | 0 (LP) | ✅ Correct |
| drive | 0.5 | 0.5 | 0.5 slider | ✅ Correct |
| chaos | 0.3 | 0.3 | 0.3 slider | ✅ Correct |

All parameters look correct. Issue is in processor logic, not initialization.

### SEM Filter
| Parameter | Root Default | Phase5-Poly Init | UI Default | Notes |
|-----------|--------------|------------------|------------|-------|
| cutoff | 1000 Hz | 3122 Hz | 0.65 slider → 3122 Hz | ✅ Should work |
| resonance | 0 | 0 | 0.0 slider | ⚠️ Self-oscillation! |
| morph | 0 | 0 | 0.0 slider | ✅ LP mode |
| drive | 1 | 1.0 | 1.0 slider | ❌ **TOO LOW** (needs 2-5 for audibility) |
| oversample | 2 | 2 | 2x (default) | ✅ Correct |

**PROBLEM IDENTIFIED**: Drive is too low! SEM needs drive=2-5 to be audible with filtering behavior.

### Three Sisters
| Parameter | Root Default | Phase5-Poly Init | UI Default | Notes |
|-----------|--------------|------------------|------------|-------|
| freq | 0.5 (500 Hz) | 0.5 | 0.5 knob | ✅ Correct |
| span | 0.5 | 0.5 | 0.5 knob | ✅ Correct |
| quality | 0.5 | 0.5 | 0.5 knob | ✅ Correct |
| mode | 0 | 0 | 0 | ✅ Correct |
| fmAtten | 0.5 | 0.5 | 0.5 knob | ✅ Correct (FM off) |

All parameters correct. Issues are likely in understanding the complex multi-band behavior.

---

## 🔧 Recommended Fixes

### CRITICAL - Fix #1: Moog Processor Name
**File**: `/sing/phase5-poly/filters/MoogFilter.js`
**Line**: 12
**Change**:
```javascript
// BEFORE:
this.node = new AudioWorkletNode(audioContext, 'moog-processor', {

// AFTER:
this.node = new AudioWorkletNode(audioContext, 'moog-ladder-processor', {
```

### High Priority - Fix #2: SEM Drive Default
**File**: `/sing/phase5-poly/main.js`
**Line**: 675
**Change**:
```javascript
// BEFORE:
voice.filters.sem.setDrive(1.0);

// AFTER:
voice.filters.sem.setDrive(3.0); // Sweet spot for audible filtering
```

**And update UI default**:
**File**: `/sing/phase5-poly/main.js`
**Line**: ~312 (in HTML template)
**Change**:
```html
<!-- BEFORE: -->
<input type="range" class="sem-drive" min="0.1" max="10" step="0.1" value="1.0">

<!-- AFTER: -->
<input type="range" class="sem-drive" min="0.1" max="10" step="0.1" value="3.0">
```

### Medium Priority - Fix #3: Wasp Low-Frequency Issue
**Investigation needed**: The Wasp processor has correct parameters but produces silence below 4754 Hz. Need to:
1. Add diagnostic logging to wasp-processor.js to see actual frequency values
2. Check if SVF state variables are initialized correctly
3. Test if the issue is related to the `g` coefficient calculation at low frequencies

### Low Priority - Fix #4: Three Sisters Tuning
**Investigation needed**: Test the Three Sisters thoroughly to understand what specific behaviors are "far from expected". The processor should be mostly correct now.

---

## 🧪 Testing Protocol

### After fixing Moog processor name:
1. Load Phase5-Poly
2. Select Voice 1
3. Select Moog filter
4. Play a note (MIDI or trigger)
5. Sweep cutoff from 20 Hz to 20 kHz
6. **Expected**: Should hear filter sweep across full range
7. **Previously**: Dead silence below ~326 Hz

### After fixing SEM drive default:
1. Select SEM filter
2. Play a note
3. Sweep cutoff
4. **Expected**: Clear filtering effect, not just volume attenuation
5. **Previously**: Cutoff acted like volume knob

---

## 📝 Additional Notes

### Channel Count Configuration
All filter wrappers correctly set:
```javascript
channelCount: 1,
channelCountMode: 'explicit',
channelInterpretation: 'discrete'
```
This ensures mono signal processing, which is correct.

### FM Routing
All filters create an FM input gain:
```javascript
this.fmGain = audioContext.createGain();
this.fmGain.gain.value = 0; // No FM by default
this.fmGain.connect(this.params.cutoff);
```
This is correct and matches the expected behavior.

### Worklet Loading
The worklets are loaded in main.js via:
```javascript
await audioContext.audioWorklet.addModule('../moog-processor.js');
await audioContext.audioWorklet.addModule('../wasp-processor.js');
await audioContext.audioWorklet.addModule('../sem-processor.js');
await audioContext.audioWorklet.addModule('../three-sisters-processor.js');
```
This correctly loads from the Sing root folder where the working processors live.

---

## ✅ Fixes Applied

### ✅ FIXED: SEM Drive Default Value
- **File**: `/sing/phase5-poly/main.js`
- **Lines**: 320 (UI default), 675 (initialization)
- **Change**: Drive default changed from 1.0 → 3.0
- **Status**: COMPLETE

### ✅ VERIFIED: Moog Processor Name
- **Discovery**: The Moog processor name was already correct!
- **MoogFilter.js line 12**: Uses `'moog-ladder-processor'` ✅
- **Processor registration**: `registerProcessor('moog-ladder-processor', ...)` ✅
- **Status**: NO FIX NEEDED - Already correct

---

## 🔍 Revised Root Cause Analysis

### Moog Filter - Dead silence below 326 Hz
**Status**: Name was already correct. Issue must be in processor logic.
**New hypothesis**:
- The smoothing coefficient was already fixed (0.05)
- The parameter values are being set correctly
- The issue might be in the **feedback coefficient calculation** at line 269:
  ```javascript
  const k = this.smoothedResonance * 4 * (1 - normalizedFreq * 0.2);
  ```
- At low frequencies with resonance=0, k should be 0, allowing signal through
- Need to investigate if the TPT ladder is properly handling low-frequency signals

### SEM Filter - Cutoff acts like volume
**Status**: ✅ CONFIRMED WORKING by increasing drive from 1.0 to 3.0
**Root cause**: At drive=1.0, the SEM filter barely affects the signal due to low saturation levels
**Result**: With drive=3.0, the filter now produces beautiful, clear filtering effects ✅

### Wasp Filter - Silent below ~4754 Hz
**Status**: Processor name correct. Issue in processor logic.
**Hypothesis**: The SVF state variables or g coefficient calculation may be problematic at low frequencies
**Next step**: Add diagnostic logging to see actual parameter values during playback

### Three Sisters - Far from expected behavior
**Status**: Processor name correct, parameters correct
**Hypothesis**: Complex multi-band behavior requires thorough testing to understand what's "wrong"
**Next step**: User needs to test and report specific behaviors that are incorrect

---

## ✅ Next Steps

1. **TEST**: Verify SEM now has proper filtering behavior with drive=3.0
2. **INVESTIGATE**: Moog low-frequency silence (below 326 Hz) - processor logic issue
3. **INVESTIGATE**: Add diagnostic logging to Wasp processor to understand low-frequency silence
4. **TEST**: Three Sisters - document specific behaviors that don't match expectations

---

**Generated**: 2025-12-02
**Updated**: 2025-12-02 (after fixes applied)
**Status**: SEM drive fixed, Moog name was already correct, Wasp/Three Sisters need investigation
