# PHASE 5 POLY

## 4-Voice Polyphonic Modular Synthesis System

Phase 5 Poly is a comprehensive web-based polyphonic synthesizer featuring 4 independent voices controlled via MIDI channels 1-4, each with its own oscillator, filter, envelope, quantizer, and transpose sequencer.

---

## Features

### 🎹 **4-Voice Polyphony**
- MIDI channels 1-4 map directly to Voices 1-4
- Independent oscillator and filter selection per voice
- Per-voice quantization with customizable scales
- Per-voice transpose sequencing with up to 16 steps

### 🎛️ **Flexible Signal Path**
Each voice includes:
- **Oscillator Selection**: Mangrove (formant oscillator) OR Just Friends (6-slope waveshaper)
- **Filter Selection**: Moog Ladder, Wasp, SEM State Variable, OR Three Sisters
- **AD Envelope**: Fast attack-decay envelope for snappy responses
- **Quantizer**: Per-voice scale quantization with root note and depth control
- **Transpose Sequencer**: 16-step sequencer with multiple playback modes

### 🌊 **FM Synthesis**
- **4 FM Oscillators** (Mangrove A, B, C, D) with independent controls
- **FM A & B** → Oscillator FM (per-voice depth control)
- **FM C & D** → Filter FM (per-voice depth control)
- Each voice can independently set FM depth from each FM source

### 🎚️ **Professional Mixer**
- **4 Channels** with DJ-style EQ and saturation per channel
- **3 Send Effects**: Mimeophon (color delay), Greyhole (diffuse reverb), Zita (plate reverb)
- Per-channel send levels with independent return control
- Mute/Solo functionality
- Stereo panning and level control

### 🔄 **Advanced Modulation**
- **12 Global LFOs** with dual destinations each
- Comprehensive destination matrix covering all voice parameters
- LFO cross-modulation support
- Multiple waveforms and polarity modes

### ⏱️ **Flexible Clocking**
- **MIDI Clock**: 24 ppqn from DAW with configurable division (1/16, 1/8, 1/4)
- **Just Friends #1**: Internal clock generator for standalone operation
- Clock advances all 4 transpose sequencers simultaneously

---

## Architecture Overview

```
MIDI INPUT (CH 1-4)
      ↓
┌─────────────────────────────────┐
│  VOICE (×4)                     │
│  ┌──────────────────────────┐  │
│  │ Transpose Seq (16 steps) │  │
│  │         ↓                │  │
│  │     Quantizer            │  │
│  │         ↓                │  │
│  │     Oscillator           │ ←──── FM A & B
│  │         ↓                │  │
│  │      Filter              │ ←──── FM C & D
│  │         ↓                │  │
│  │   AD Envelope → VCA      │  │
│  └──────────┬───────────────┘  │
└─────────────┼──────────────────┘
              ↓
┌─────────────────────────────────┐
│  MIXER CHANNEL (×4)             │
│  ┌──────────────────────────┐  │
│  │ DJ EQ → Saturation       │  │
│  │         ↓                │  │
│  │ Sends A/B/C → Effects    │  │
│  │         ↓                │  │
│  │ Pan → Fader → Mute       │  │
│  └──────────┬───────────────┘  │
└─────────────┼──────────────────┘
              ↓
         MASTER BUS
              ↓
          OUTPUT
```

---

## Getting Started

### Requirements
- Modern web browser with Web Audio API support (Chrome, Firefox, Edge, Safari)
- MIDI controller or DAW with MIDI output (e.g., Ableton Move, Push, etc.)
- Audio interface recommended for low latency

### Installation
1. Clone or download this repository
2. Open `index.html` in a web browser
3. Click "Start Audio" to initialize the audio engine
4. Connect your MIDI controller when prompted

### Quick Start
1. **Connect MIDI**: Ensure your MIDI controller is connected and sends on channels 1-4
2. **Start Audio**: Click the "Start Audio" button
3. **Play Notes**: Send MIDI notes on channels 1-4 to trigger voices
4. **Adjust Voices**: Expand voice panels to configure oscillators, filters, and envelopes
5. **Add Effects**: Use mixer sends to route signals to delay and reverb

---

## MIDI Implementation

### Note Messages
- **Channels 1-4** map to Voices 1-4
- **Note On (0x9n)**: Triggers voice envelope and sets pitch
- **Note Off (0x8n)**: Releases voice envelope
- **Pitch Bend**: ±2 semitones applied to quantizer offset

### Control Changes
| CC | Parameter | Description |
|----|-----------|-------------|
| 1  | Mod Wheel | Filter cutoff |
| 71 | Resonance | Filter resonance |
| 74 | Brightness | Filter cutoff |

### MIDI Clock
- **0xF8 (Clock)**: 24 ppqn, advances transpose sequencers
- **0xFA (Start)**: Reset all sequencers to step 1
- **0xFC (Stop)**: Hold current position
- **0xFB (Continue)**: Resume from current position

---

## Voice Configuration

### Oscillator Types

#### **Mangrove** (Formant Oscillator)
- **Pitch**: Coarse tuning
- **Barrel**: Timbre control (square → triangle)
- **Formant**: Formant frequency
- **Air**: Harmonic content
- **FM Index**: FM modulation depth

#### **Just Friends** (6-Slope Waveshaper)
- **Time**: Frequency (1V/oct tracking)
- **Intone**: Harmonic relationships (unison/overtones/undertones)
- **Ramp**: Wave shape (saw/triangle/ramp)
- **Curve**: Wave curvature (sine/triangle/square)
- **Mode**: Transient/Sustain/Cycle
- **Range**: Shape/Sound
- **RUN**: Enable RUN modes (SHIFT, STRATA, VOLLEY, SPILL, PLUME, FLOOM)

### Filter Types

#### **Moog Ladder** (4-pole lowpass)
- Classic 24dB/oct with self-oscillation
- Warm, fat character
- **Parameters**: Cutoff, Resonance, Drive, Warmth

#### **Wasp** (OTA multimode)
- 12dB/oct with LP/BP/HP/Notch modes
- Aggressive, gritty character
- **Parameters**: Cutoff, Resonance, Mode, Drive, Chaos

#### **SEM** (State Variable)
- 12dB/oct, smooth morphing between modes
- Clean, Oberheim-style character
- **Parameters**: Cutoff, Resonance, Morph (-1 to +1: LP → BP → HP → Notch), Drive

#### **Three Sisters** (Formant Filter)
- Three bandpass peaks with FM
- Complex, vocal-like character
- **Parameters**: Freq, Span, Quality, Mode (Crossover/Formant), FM Atten

---

## Transpose Sequencer

### Features
- **16 steps** per voice, independently programmable
- **Playback Modes**:
  - **→ Forward**: Steps 1 → 16
  - **← Backward**: Steps 16 → 1
  - **⇄ Ping-Pong**: 1 → 16 → 1
  - **✳ Random**: Random step selection
- **Per-step settings**:
  - Transpose amount (-24 to +24 semitones)
  - Repeats (1-64 clock cycles per step)
  - Active/Inactive toggle

### Clock Sources
- **MIDI Clock**: Synchronized to external DAW (24 ppqn)
- **Just Friends #1**: Internal LFO-based clock

---

## Patch Management

### Saving Patches
1. Click "💾 Save Patch"
2. Patch downloads as JSON file
3. Filename: `phase5-poly-[timestamp].json`

### Loading Patches
1. Click "📂 Load Patch"
2. Select `.json` patch file
3. All parameters restored instantly

### Patch Format
```json
{
  "version": "2.0",
  "name": "My Patch",
  "clockSource": "midi",
  "masterVolume": 0.3,
  "voices": [ /* 4 voice states */ ],
  "mixerChannels": [ /* 4 mixer states */ ],
  "fmOscillators": { /* FM A, B, C, D */ },
  "sendEffects": { /* Mimeophon, Greyhole, Zita */ },
  "lfos": [ /* 12 LFO states */ ]
}
```

---

## Performance Tips

### Reducing Latency
- Use a dedicated audio interface
- Close unnecessary browser tabs
- Increase browser audio buffer size if glitching occurs

### CPU Optimization
- Disable unused LFOs
- Reduce filter oversampleing (SEM filter)
- Lower effect wet/dry mixes when not needed

### MIDI Optimization
- Use MIDI channels 1-4 only for optimal performance
- Avoid sending rapid CC messages
- Use MIDI clock at lower divisions (1/8 or 1/4) if CPU-limited

---

## Known Issues & Limitations

### Current Limitations
- Maximum 4 voices (cannot be expanded)
- LFO destination routing UI is minimal (use `app.lfos[n].setDestination()` in console)
- No polyphonic aftertouch support yet
- MIDI CC mapping is fixed (customization requires code changes)

### Browser Compatibility
- **Chrome/Edge**: Full support ✅
- **Firefox**: Full support ✅
- **Safari**: Mostly supported (some AudioWorklet quirks)
- **Mobile**: Limited support (high latency, unstable)

---

## Development

### File Structure
```
phase5-poly/
├── index.html                 # Main HTML file
├── main.js                    # Application entry point
├── core/
│   ├── Phase5PolyApp.js       # Main app class
│   ├── Voice.js               # Voice signal path
│   ├── MIDIManager.js         # MIDI handling
│   ├── MixerChannel.js        # Mixer channel
│   └── SendEffect.js          # Send effect wrapper
├── oscillators/
│   └── OscillatorInterface.js # Oscillator abstract interface
├── filters/
│   ├── FilterInterface.js     # Filter abstract interface
│   ├── MoogFilter.js          # Moog wrapper
│   ├── WaspFilter.js          # Wasp wrapper
│   ├── SEMFilter.js           # SEM wrapper
│   └── ThreeSistersFilter.js  # Three Sisters wrapper
├── modulators/
│   ├── ad-envelope-processor.js  # AD envelope worklet
│   └── ADEnvelopeNode.js         # AD envelope wrapper
└── styles/
    └── main.css               # Main stylesheet
```

### Debugging
```javascript
// Access app instance from console
window.app

// Get current state
window.app.getState()

// Access specific voice
window.app.voices[0]

// Trigger voice manually
window.app.voices[0].noteOn(60, 127) // C4, max velocity

// Set LFO destination manually
window.app.lfos[0].setDestination(
  0,                                  // Destination slot A
  window.app.voices[0].filter.params.cutoff,  // Target parameter
  0.5,                                // Depth
  0,                                  // Offset
  0                                   // Mode (unipolar)
)
```

---

## Credits

**Phase 5 Poly** is built using:
- Web Audio API (AudioWorkletProcessor)
- Existing filter processors: Moog, Wasp, SEM
- Make Noise module emulations: Mangrove, Just Friends, Three Sisters
- Reverb algorithms: Greyhole, Zita
- Delay: Mimeophon (color delay)

Inspired by modular synthesis workflows and hardware polyphonic synthesizers.

---

## License

MIT License - Feel free to use, modify, and distribute.

---

## Support & Contact

- **Issues**: Report bugs or request features via GitHub Issues
- **Documentation**: See design doc for detailed architecture

---

**Happy Synthesizing! 🎹🎛️🌊**
