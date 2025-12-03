Implementation Stages
## Stage 1: Project Setup & Core Infrastructure
**Goal:** Establish folder structure, base classes, and audio context management
### Tasks:
**1** **Reorganize file structure:**phase5-poly/
2 ├── index.html
3 ├── main.js
4 ├── core/
5 │   ├── Voice.js
6 │   ├── MixerChannel.js
7 │   ├── SendEffect.js
8 │   ├── MIDIManager.js
9 │   └── PatchManager.js
10 ├── oscillators/
11 │   ├── OscillatorInterface.js
12 │   ├── MangroveNode.js
13 │   ├── mangrove-processor.js
14 │   ├── JustFriendsOscNode.js
15 │   └── just-friends-osc-processor.js
16 ├── filters/
17 │   ├── FilterInterface.js
18 │   ├── MoogFilter.js
19 │   ├── moog-processor.js
20 │   ├── WaspFilter.js
21 │   ├── wasp-processor.js
22 │   ├── SEMFilter.js
23 │   ├── sem-processor.js
24 │   ├── ThreeSistersFilter.js
25 │   └── three-sisters-processor.js
26 ├── modulators/
27 │   ├── LFONode.js
28 │   ├── lfo-processor.js
29 │   ├── ADEnvelopeNode.js
30 │   ├── ad-envelope-processor.js
31 │   ├── JustFriendsNode.js
32 │   └── just-friends-processor.js
33 ├── sequencer/
34 │   ├── TransposeSequencerNode.js
35 │   └── transpose-sequencer-processor.js
36 ├── quantizer/
37 │   ├── QuantizerNode.js
38 │   └── quantizer-processor.js
39 ├── effects/
40 │   ├── DJEqualizer.js
41 │   ├── SaturationEffect.js
42 │   ├── StandaloneMimeophon.js
43 │   ├── GreyholeNode.js
44 │   ├── greyhole-processor.js
45 │   ├── ZitaReverb.js
46 │   └── zita-reverb-processor.js
47 ├── recorder/
48 │   └── WavRecorder.js
49 └── styles/
50     ├── main.css
51     ├── voices.css
52     ├── mixer.css
53     ├── lfos.css
54     ├── effects.css
55     └── transport.css
56 
**57** **Create** **OscillatorInterface.js****:**// Abstract interface for oscillators
58 class OscillatorInterface {
59   getPitchCVInput() { throw new Error('Not implemented'); }
60   getFMInput() { throw new Error('Not implemented'); }
61   getOutput() { throw new Error('Not implemented'); }
62   getState() { throw new Error('Not implemented'); }
63   setState(state) { throw new Error('Not implemented'); }
64 }
65 
**66** **Create** **FilterInterface.js****:**// Abstract interface for filters
67 class FilterInterface {
68   getInput() { throw new Error('Not implemented'); }
69   getOutput() { throw new Error('Not implemented'); }
70   getFMInput() { throw new Error('Not implemented'); }
71   setCutoff(value) { throw new Error('Not implemented'); }
72   setResonance(value) { throw new Error('Not implemented'); }
73   getState() { throw new Error('Not implemented'); }
74   setState(state) { throw new Error('Not implemented'); }
75 }
76 
**77** **Create** **Phase5PolyApp.js** **skeleton:**class Phase5PolyApp {
78   constructor() {
79     this.audioContext = null;
80     this.voices = [];           // 4 Voice instances
81     this.mixerChannels = [];    // 4 MixerChannel instances
82     this.fmOscillators = {};    // A, B, C, D
83     this.sendEffects = {};      // mimeophon, greyhole, zita
84     this.lfos = [];             // 12 LFO instances
85     this.jf1 = null;            // Clock source option
86     this.midiManager = null;
87     this.patchManager = null;
88     this.masterGain = null;
89     this.clockSource = 'midi';
90   }
91   
92   async init() { /* ... */ }
93   async loadWorklets() { /* ... */ }
94   createVoices() { /* ... */ }
95   createMixer() { /* ... */ }
96   createSendEffects() { /* ... */ }
97   createFMOscillators() { /* ... */ }
98   createLFOs() { /* ... */ }
99   routeAudio() { /* ... */ }
100   buildDestinationMap() { /* ... */ }
101 }
102 

⠀Deliverables:
* Reorganized folder structure
* OscillatorInterface.js
* FilterInterface.js
* Phase5PolyApp.js skeleton
* Updated import paths

⠀
## Stage 2: Filter Wrappers
**Goal:** Create Node wrapper classes for existing filter processors
### Tasks:
**1** **Create** **MoogFilter.js****:**import { FilterInterface } from './FilterInterface.js';
2 
3 export class MoogFilter extends FilterInterface {
4   constructor(audioContext) {
5     super();
6     this.node = new AudioWorkletNode(audioContext, 'moog-processor');
7     this.params = {
8       cutoff: this.node.parameters.get('cutoff'),
9       resonance: this.node.parameters.get('resonance'),
10       drive: this.node.parameters.get('drive')
11     };
12     this.fmGain = audioContext.createGain();
13     this.fmGain.gain.value = 0;
14     this.fmGain.connect(this.params.cutoff);
15   }
16   
17   getInput() { return this.node; }
18   getOutput() { return this.node; }
19   getFMInput() { return this.fmGain; }
20   setCutoff(value) { this.params.cutoff.value = value; }
21   setResonance(value) { this.params.resonance.value = value; }
22   setDrive(value) { this.params.drive.value = value; }
23   
24   getState() {
25     return {
26       type: 'moog',
27       cutoff: this.params.cutoff.value,
28       resonance: this.params.resonance.value,
29       drive: this.params.drive.value
30     };
31   }
32   
33   setState(state) {
34     this.setCutoff(state.cutoff);
35     this.setResonance(state.resonance);
36     this.setDrive(state.drive);
37   }
38 }
39 
**40** **Create** **WaspFilter.js** (similar structure with mode param)
**41** **Create** **SEMFilter.js** (similar structure with mode param)
**42** **Create** **ThreeSistersFilter.js** (adapt existing ThreeSistersNode)
**43** **Verify each filter loads and produces sound**

⠀Deliverables:
* MoogFilter.js
* WaspFilter.js
* SEMFilter.js
* ThreeSistersFilter.js
* Filter test verification

⠀
## Stage 3: AD Envelope
**Goal:** Create snappy attack-decay envelope for MIDI triggering
### Tasks:
**1** **Create** **ad-envelope-processor.js****:**class ADEnvelopeProcessor extends AudioWorkletProcessor {
2   static get parameterDescriptors() {
3     return [
4       { name: 'attack', defaultValue: 0.005, minValue: 0.001, maxValue: 0.5 },
5       { name: 'decay', defaultValue: 0.2, minValue: 0.01, maxValue: 5.0 },
6       { name: 'gate', defaultValue: 0, minValue: 0, maxValue: 1 }
7     ];
8   }
9   
10   constructor() {
11     super();
12     this.envelope = 0;
13     this.stage = 'idle'; // 'idle', 'attack', 'decay'
14     this.port.onmessage = (e) => {
15       if (e.data.type === 'trigger') this.trigger();
16       if (e.data.type === 'release') this.release();
17     };
18   }
19   
20   trigger() {
21     this.stage = 'attack';
22   }
23   
24   release() {
25     this.stage = 'decay';
26   }
27   
28   process(inputs, outputs, parameters) {
29     const output = outputs[0];
30     const attack = parameters.attack[0];
31     const decay = parameters.decay[0];
32     
33     // Calculate coefficients for exponential curves
34     const attackCoef = Math.exp(-1 / (attack * sampleRate));
35     const decayCoef = Math.exp(-1 / (decay * sampleRate));
36     
37     for (let i = 0; i < output[0].length; i++) {
38       if (this.stage === 'attack') {
39         this.envelope = 1 - (1 - this.envelope) * attackCoef;
40         if (this.envelope > 0.999) {
41           this.envelope = 1;
42           this.stage = 'decay';
43         }
44       } else if (this.stage === 'decay') {
45         this.envelope *= decayCoef;
46         if (this.envelope < 0.001) {
47           this.envelope = 0;
48           this.stage = 'idle';
49         }
50       }
51       
52       for (let ch = 0; ch < output.length; ch++) {
53         output[ch][i] = this.envelope;
54       }
55     }
56     
57     return true;
58   }
59 }
60 
61 registerProcessor('ad-envelope-processor', ADEnvelopeProcessor);
62 
**63** **Create** **ADEnvelopeNode.js****:**export class ADEnvelopeNode {
64   constructor(audioContext) {
65     this.node = new AudioWorkletNode(audioContext, 'ad-envelope-processor');
66     this.params = {
67       attack: this.node.parameters.get('attack'),
68       decay: this.node.parameters.get('decay')
69     };
70   }
71   
72   trigger() {
73     this.node.port.postMessage({ type: 'trigger' });
74   }
75   
76   release() {
77     this.node.port.postMessage({ type: 'release' });
78   }
79   
80   setAttack(seconds) {
81     this.params.attack.value = Math.max(0.001, Math.min(0.5, seconds));
82   }
83   
84   setDecay(seconds) {
85     this.params.decay.value = Math.max(0.01, Math.min(5.0, seconds));
86   }
87   
88   getOutput() {
89     return this.node;
90   }
91   
92   getState() {
93     return {
94       attack: this.params.attack.value,
95       decay: this.params.decay.value
96     };
97   }
98   
99   setState(state) {
100     this.setAttack(state.attack);
101     this.setDecay(state.decay);
102   }
103 }
104 

⠀Deliverables:
* ad-envelope-processor.js
* ADEnvelopeNode.js
* Envelope trigger test

⠀
## Stage 4: Voice Class
**Goal:** Assemble complete voice signal path
### Tasks:
**1** **Create** **Voice.js****:**import { MangroveNode } from '../oscillators/MangroveNode.js';
2 import { JustFriendsOscNode } from '../oscillators/JustFriendsOscNode.js';
3 import { MoogFilter } from '../filters/MoogFilter.js';
4 import { WaspFilter } from '../filters/WaspFilter.js';
5 import { SEMFilter } from '../filters/SEMFilter.js';
6 import { ThreeSistersFilter } from '../filters/ThreeSistersFilter.js';
7 import { ADEnvelopeNode } from '../modulators/ADEnvelopeNode.js';
8 import { QuantizerNode } from '../quantizer/QuantizerNode.js';
9 import { TransposeSequencerNode } from '../sequencer/TransposeSequencerNode.js';
10 
11 export class Voice {
12   constructor(audioContext, index) {
13     this.audioContext = audioContext;
14     this.index = index;
15     this.enabled = true;
16     this.currentNote = -1;
17     
18     // Create components
19     this.transposeSeq = new TransposeSequencerNode(audioContext);
20     this.quantizer = new QuantizerNode(audioContext);
21     this.envelope = new ADEnvelopeNode(audioContext);
22     
23     // Oscillator (default: Mangrove)
24     this.oscillatorType = 'mangrove';
25     this.mangrove = new MangroveNode(audioContext);
26     this.jfOsc = new JustFriendsOscNode(audioContext);
27     this.oscillator = this.mangrove;
28     
29     // Filter (default: Moog)
30     this.filterType = 'moog';
31     this.filters = {
32       moog: new MoogFilter(audioContext),
33       wasp: new WaspFilter(audioContext),
34       sem: new SEMFilter(audioContext),
35       threesisters: new ThreeSistersFilter(audioContext)
36     };
37     this.filter = this.filters.moog;
38     
39     // VCA
40     this.vca = audioContext.createGain();
41     this.vca.gain.value = 0;
42     
43     // Output gain
44     this.output = audioContext.createGain();
45     this.output.gain.value = 1;
46     
47     // FM input gains
48     this.fmOscAGain = audioContext.createGain();
49     this.fmOscBGain = audioContext.createGain();
50     this.fmFilterCGain = audioContext.createGain();
51     this.fmFilterDGain = audioContext.createGain();
52     this.fmOscAGain.gain.value = 0;
53     this.fmOscBGain.gain.value = 0;
54     this.fmFilterCGain.gain.value = 0;
55     this.fmFilterDGain.gain.value = 0;
56     
57     // Transpose gain for sequencer output
58     this.transposeGain = audioContext.createGain();
59     this.transposeGain.gain.value = 12; // semitones
60     
61     this.wireSignalPath();
62   }
63   
64   wireSignalPath() {
65     // Transpose seq → Quantizer transpose
66     this.transposeSeq.getTransposeOutput().connect(this.transposeGain);
67     this.transposeGain.connect(this.quantizer.params.transpose);
68     
69     // Quantizer → Both oscillators (only active one produces sound)
70     this.quantizer.getOutput().connect(this.mangrove.getPitchCVInput());
71     this.quantizer.getOutput().connect(this.jfOsc.getTimeCVInput());
72     
73     // FM → Oscillators
74     this.fmOscAGain.connect(this.mangrove.getFMInput());
75     this.fmOscAGain.connect(this.jfOsc.getFMInput());
76     this.fmOscBGain.connect(this.mangrove.getFMInput());
77     this.fmOscBGain.connect(this.jfOsc.getFMInput());
78     
79     // Wire all filters for FM (even inactive ones receive FM)
80     Object.values(this.filters).forEach(filter => {
81       this.fmFilterCGain.connect(filter.getFMInput());
82       this.fmFilterDGain.connect(filter.getFMInput());
83     });
84     
85     // Envelope → VCA gain
86     this.envelope.getOutput().connect(this.vca.gain);
87     
88     // Initial oscillator/filter routing
89     this.updateOscillatorRouting();
90     this.updateFilterRouting();
91   }
92   
93   updateOscillatorRouting() {
94     // Disconnect current routing
95     this.mangrove.getFormantOutput().disconnect();
96     this.jfOsc.getMixOutput().disconnect();
97     
98     // Connect active oscillator to active filter
99     if (this.oscillatorType === 'mangrove') {
100       this.mangrove.getFormantOutput().connect(this.filter.getInput());
101     } else {
102       this.jfOsc.getMixOutput().connect(this.filter.getInput());
103     }
104   }
105   
106   updateFilterRouting() {
107     // Disconnect all filters from VCA
108     Object.values(this.filters).forEach(f => {
109       try { f.getOutput().disconnect(); } catch(e) {}
110     });
111     
112     // Reconnect oscillator to new filter
113     if (this.oscillatorType === 'mangrove') {
114       this.mangrove.getFormantOutput().disconnect();
115       this.mangrove.getFormantOutput().connect(this.filter.getInput());
116     } else {
117       this.jfOsc.getMixOutput().disconnect();
118       this.jfOsc.getMixOutput().connect(this.filter.getInput());
119     }
120     
121     // Connect active filter to VCA
122     this.filter.getOutput().connect(this.vca);
123     this.vca.connect(this.output);
124   }
125   
126   setOscillatorType(type) {
127     if (type === this.oscillatorType) return;
128     this.oscillatorType = type;
129     this.oscillator = type === 'mangrove' ? this.mangrove : this.jfOsc;
130     this.updateOscillatorRouting();
131   }
132   
133   setFilterType(type) {
134     if (type === this.filterType) return;
135     this.filterType = type;
136     this.filter = this.filters[type];
137     this.updateFilterRouting();
138   }
139   
140   noteOn(note, velocity) {
141     if (!this.enabled) return;
142     this.currentNote = note;
143     
144     // Send note to quantizer
145     // The quantizer will quantize to the current scale
146     // and output the appropriate CV
147     this.quantizer.setInputNote(note);
148     
149     // Trigger envelope
150     this.envelope.trigger();
151   }
152   
153   noteOff(note) {
154     if (note === this.currentNote) {
155       this.envelope.release();
156       this.currentNote = -1;
157     }
158   }
159   
160   clockTick() {
161     this.transposeSeq.advance();
162   }
163   
164   getOutput() {
165     return this.output;
166   }
167   
168   // FM input connections (called by main app)
169   getFMOscAInput() { return this.fmOscAGain; }
170   getFMOscBInput() { return this.fmOscBGain; }
171   getFMFilterCInput() { return this.fmFilterCGain; }
172   getFMFilterDInput() { return this.fmFilterDGain; }
173   
174   setFMOscADepth(value) { this.fmOscAGain.gain.value = value; }
175   setFMOscBDepth(value) { this.fmOscBGain.gain.value = value; }
176   setFMFilterCDepth(value) { this.fmFilterCGain.gain.value = value; }
177   setFMFilterDDepth(value) { this.fmFilterDGain.gain.value = value; }
178   
179   getState() { /* ... */ }
180   setState(state) { /* ... */ }
181 }
182 
**183** **Test voice with direct triggering**

⠀Deliverables:
* Voice.js
* Voice signal path verified

⠀
## Stage 5: MIDI Manager
**Goal:** Handle Web MIDI input and route to voices
### Tasks:
**1** **Create** **MIDIManager.js****:** export class MIDIManager {  constructor() {    this.access = null;    this.inputs = [];    this.voices = [];    this.onClockTick = null;    this.onStart = null;    this.onStop = null;    this.onContinue = null;        this.clockDivision = 6;  // Ticks per step (6 = 1/16)    this.clockCount = 0;    this.isConnected = false;  }    async init() {    try {      this.access = await navigator.requestMIDIAccess();      this.access.onstatechange = (e) => this.handleStateChange(e);      this.scanInputs();      this.isConnected = true;      console.log('✓ MIDI initialized');      return true;    } catch (err) {      console.error('MIDI access denied:', err);      this.isConnected = false;      return false;    }  }    scanInputs() {    this.inputs = [];    for (let input of this.access.inputs.values()) {      input.onmidimessage = (msg) => this.handleMessage(msg);      this.inputs.push(input);      console.log(`MIDI Input: ${input.name}`);    }  }    handleStateChange(e) {    console.log(`MIDI ${e.port.type} ${e.port.state}: ${e.port.name}`);    this.scanInputs();  }    setVoices(voices) {    this.voices = voices;  }    setClockDivision(ticks) {    this.clockDivision = ticks;  }    handleMessage(msg) {    const [status, data1, data2] = msg.data;        // Channel messages    if (status < 0xF0) {      const channel = (status & 0x0F) + 1;      const command = status >> 4;            if (channel >= 1 && channel <= 4) {        const voice = this.voices[channel - 1];        if (!voice) return;                switch (command) {          case 0x9: // Note On            if (data2 > 0) {              voice.noteOn(data1, data2);            } else {              voice.noteOff(data1);            }            break;          case 0x8: // Note Off            voice.noteOff(data1);            break;          case 0xB: // CC            this.handleCC(voice, data1, data2);            break;        }      }    }        // System messages    switch (status) {      case 0xF8: // Clock        this.handleClock();        break;      case 0xFA: // Start        this.clockCount = 0;        if (this.onStart) this.onStart();        break;      case 0xFC: // Stop        if (this.onStop) this.onStop();        break;      case 0xFB: // Continue        if (this.onContinue) this.onContinue();        break;    }  }    handleClock() {    this.clockCount++;    if (this.clockCount >= this.clockDivision) {      this.clockCount = 0;      if (this.onClockTick) this.onClockTick();    }  }    handleCC(voice, cc, value) {    // Optional CC handling    // CC 74 (brightness) → filter cutoff    // CC 1 (mod wheel) → ...  }    getInputNames() {    return this.inputs.map(i => i.name);  }}
2 

⠀Deliverables:
* MIDIManager.js
* MIDI input verified with Ableton Move

⠀
## Stage 6: Mixer Channel & Send Effects
**Goal:** Build mixer infrastructure with per-channel processing and sends
### Tasks:
**1** **Create** **MixerChannel.js****:**import { DJEqualizer } from '../effects/DJEqualizer.js';
2 import { SaturationEffect } from '../effects/SaturationEffect.js';
3 
4 export class MixerChannel {
5   constructor(audioContext, index) {
6     this.audioContext = audioContext;
7     this.index = index;
8     
9     // Input
10     this.input = audioContext.createGain();
11     
12     // Processing chain
13     this.djEQ = new DJEqualizer(audioContext);
14     this.saturation = new SaturationEffect(audioContext);
15     
16     // Send gains (pre-fader)
17     this.preFaderSplit = audioContext.createGain();
18     this.sendAGain = audioContext.createGain();
19     this.sendBGain = audioContext.createGain();
20     this.sendCGain = audioContext.createGain();
21     this.sendAGain.gain.value = 0;
22     this.sendBGain.gain.value = 0;
23     this.sendCGain.gain.value = 0;
24     
25     // Channel strip
26     this.panner = audioContext.createStereoPanner();
27     this.panner.pan.value = 0;
28     this.fader = audioContext.createGain();
29     this.fader.gain.value = 0.8;
30     
31     // Mute
32     this.muteGain = audioContext.createGain();
33     this.muteGain.gain.value = 1;
34     this.isMuted = false;
35     this.isSolo = false;
36     
37     // Output
38     this.output = audioContext.createGain();
39     
40     // Wire it up
41     this.input.connect(this.djEQ.input);
42     this.djEQ.output.connect(this.saturation.input);
43     this.saturation.output.connect(this.preFaderSplit);
44     
45     // Sends (post-EQ/sat, pre-fader)
46     this.preFaderSplit.connect(this.sendAGain);
47     this.preFaderSplit.connect(this.sendBGain);
48     this.preFaderSplit.connect(this.sendCGain);
49     
50     // Main path
51     this.preFaderSplit.connect(this.panner);
52     this.panner.connect(this.fader);
53     this.fader.connect(this.muteGain);
54     this.muteGain.connect(this.output);
55   }
56   
57   // Send outputs (connect to send buses)
58   getSendAOutput() { return this.sendAGain; }
59   getSendBOutput() { return this.sendBGain; }
60   getSendCOutput() { return this.sendCGain; }
61   
62   setSendA(value) { this.sendAGain.gain.value = value; }
63   setSendB(value) { this.sendBGain.gain.value = value; }
64   setSendC(value) { this.sendCGain.gain.value = value; }
65   
66   setPan(value) { this.panner.pan.value = value; }
67   setLevel(value) { this.fader.gain.value = value; }
68   
69   setMute(muted) {
70     this.isMuted = muted;
71     this.updateMuteState();
72   }
73   
74   setSolo(solo) {
75     this.isSolo = solo;
76     // Solo logic handled by mixer parent
77   }
78   
79   updateMuteState(anySolo = false) {
80     if (this.isMuted) {
81       this.muteGain.gain.value = 0;
82     } else if (anySolo && !this.isSolo) {
83       this.muteGain.gain.value = 0;
84     } else {
85       this.muteGain.gain.value = 1;
86     }
87   }
88   
89   getInput() { return this.input; }
90   getOutput() { return this.output; }
91   
92   getState() { /* ... */ }
93   setState(state) { /* ... */ }
94 }
95 
**96** **Create** **SendEffect.js****:**export class SendEffect {
97   constructor(audioContext, effect) {
98     this.audioContext = audioContext;
99     this.effect = effect;
100     
101     // Input bus (receives from all channel sends)
102     this.inputBus = audioContext.createGain();
103     this.inputBus.gain.value = 1;
104     
105     // Return level
106     this.returnGain = audioContext.createGain();
107     this.returnGain.gain.value = 1;
108     
109     // Wire: input → effect → return
110     // (Actual connection depends on effect type)
111   }
112   
113   getInputBus() { return this.inputBus; }
114   getReturnOutput() { return this.returnGain; }
115   
116   setReturnLevel(value) {
117     this.returnGain.gain.value = value;
118   }
119 }
120 
**121** **Wire sends in main app**

⠀Deliverables:
* MixerChannel.js
* SendEffect.js
* Send routing verified

⠀
## Stage 7: FM Oscillators & Routing
**Goal:** Set up 4 FM Mangroves with per-voice depth control
### Tasks:
**1** **Create FM oscillators in main app:**createFMOscillators() {
2   this.fmOscA = new MangroveNode(this.audioContext);
3   this.fmOscB = new MangroveNode(this.audioContext);
4   this.fmOscC = new MangroveNode(this.audioContext);
5   this.fmOscD = new MangroveNode(this.audioContext);
6 }
7 
8 routeFMToVoices() {
9   this.voices.forEach(voice => {
10     // Osc FM
11     this.fmOscA.getFormantOutput().connect(voice.getFMOscAInput());
12     this.fmOscB.getFormantOutput().connect(voice.getFMOscBInput());
13     // Filter FM
14     this.fmOscC.getFormantOutput().connect(voice.getFMFilterCInput());
15     this.fmOscD.getFormantOutput().connect(voice.getFMFilterDInput());
16   });
17 }
18 
**19** **Add FM depth controls to voice UI**

⠀Deliverables:
* FM oscillator instances
* FM routing to all voices
* FM depth controls per voice

⠀
## Stage 8: LFO Expansion
**Goal:** Create 12 LFOs with expanded destination map
### Tasks:
**1** **Create 12 LFO instances**
**2** **Build comprehensive destination map:**buildDestinationMap() {
3   this.destinationMap = {};
4   
5   // Per-voice destinations
6   this.voices.forEach((voice, i) => {
7     const v = `v${i + 1}`;
8     
9     // Quantizer
10     this.destinationMap[`${v}.quant.depth`] = voice.quantizer.params.depth;
11     this.destinationMap[`${v}.quant.offset`] = voice.quantizer.params.offset;
12     
13     // Oscillator (Mangrove)
14     this.destinationMap[`${v}.osc.pitch`] = voice.mangrove.params.pitchKnob;
15     this.destinationMap[`${v}.osc.barrel`] = voice.mangrove.params.barrelKnob;
16     this.destinationMap[`${v}.osc.formant`] = voice.mangrove.params.formantKnob;
17     this.destinationMap[`${v}.osc.air`] = voice.mangrove.params.airKnob;
18     
19     // Oscillator (JF Osc)
20     this.destinationMap[`${v}.jfosc.time`] = voice.jfOsc.params.time;
21     this.destinationMap[`${v}.jfosc.intone`] = voice.jfOsc.params.intone;
22     this.destinationMap[`${v}.jfosc.ramp`] = voice.jfOsc.params.ramp;
23     this.destinationMap[`${v}.jfosc.curve`] = voice.jfOsc.params.curve;
24     
25     // Filter (common)
26     this.destinationMap[`${v}.filter.cutoff`] = voice.filter.params?.cutoff;
27     this.destinationMap[`${v}.filter.resonance`] = voice.filter.params?.resonance;
28     
29     // Envelope
30     this.destinationMap[`${v}.env.attack`] = voice.envelope.params.attack;
31     this.destinationMap[`${v}.env.decay`] = voice.envelope.params.decay;
32     
33     // FM depths (gain nodes)
34     this.destinationMap[`${v}.fmA.depth`] = voice.fmOscAGain.gain;
35     this.destinationMap[`${v}.fmB.depth`] = voice.fmOscBGain.gain;
36     this.destinationMap[`${v}.fmC.depth`] = voice.fmFilterCGain.gain;
37     this.destinationMap[`${v}.fmD.depth`] = voice.fmFilterDGain.gain;
38     
39     // Mixer
40     this.destinationMap[`${v}.mixer.level`] = this.mixerChannels[i].fader.gain;
41     this.destinationMap[`${v}.mixer.pan`] = this.mixerChannels[i].panner.pan;
42     this.destinationMap[`${v}.mixer.sendA`] = this.mixerChannels[i].sendAGain.gain;
43     this.destinationMap[`${v}.mixer.sendB`] = this.mixerChannels[i].sendBGain.gain;
44     this.destinationMap[`${v}.mixer.sendC`] = this.mixerChannels[i].sendCGain.gain;
45   });
46   
47   // FM Oscillators
48   ['A', 'B', 'C', 'D'].forEach(letter => {
49     const fm = this[`fmOsc${letter}`];
50     this.destinationMap[`fm${letter}.pitch`] = fm.params.pitchKnob;
51     this.destinationMap[`fm${letter}.barrel`] = fm.params.barrelKnob;
52     this.destinationMap[`fm${letter}.formant`] = fm.params.formantKnob;
53     this.destinationMap[`fm${letter}.air`] = fm.params.airKnob;
54   });
55   
56   // Global
57   this.destinationMap['master.volume'] = this.masterGain.gain;
58   
59   // LFO cross-modulation
60   this.lfos.forEach((lfo, i) => {
61     this.destinationMap[`lfo${i + 1}.rate`] = lfo.params.rate;
62     this.destinationMap[`lfo${i + 1}.phase`] = lfo.params.phase;
63   });
64 }
65 
**66** **Update LFO UI for 12 LFOs**

⠀Deliverables:
* 12 LFOs
* Complete destination map
* Updated LFO UI grid

⠀
## Stage 9: Clock Source & Transpose Sequencers
**Goal:** Implement clock source selection and per-voice transpose sequencing
### Tasks:
**1** **Add clock source toggle:**setClockSource(source) {
2   this.clockSource = source;
3   
4   if (source === 'jf1') {
5     // Use JF1 zero crossings
6     this.jf1.getIdentityOutput().connect(/* clock detector */);
7   } else {
8     // Use MIDI clock via MIDIManager
9   }
10 }
11 
**12** **Clock distribution to transpose sequencers:**// In main app
13 this.midiManager.onClockTick = () => {
14   if (this.clockSource === 'midi') {
15     this.voices.forEach(voice => voice.clockTick());
16   }
17 };
18 
**19** **Per-voice transpose sequencer UI**

⠀Deliverables:
* Clock source selector
* Independent transpose sequencers per voice
* Clock division setting

⠀
## Stage 10: UI Assembly
**Goal:** Build complete expandable voice panel UI
### Tasks:
**1** **Create voice panel component:**<div class="voice-panel collapsed" data-voice="0">
2   <div class="voice-header" onclick="toggleVoicePanel(0)">
3     <span class="expand-icon">▶</span>
4     <span class="voice-title">VOICE 1 [CH1]</span>
5     <span class="voice-summary">
6       Osc: <span class="osc-type">Mangrove</span> | 
7       Filter: <span class="filter-type">Moog</span>
8     </span>
9     <label class="voice-enable">
10       <input type="checkbox" checked>
11       <span>Active</span>
12     </label>
13   </div>
14   
15   <div class="voice-content">
16     <!-- Transpose Sequencer -->
17     <div class="voice-section transpose-section">
18       <h4>Transpose Sequencer</h4>
19       <!-- 16-step grid -->
20     </div>
21     
22     <!-- Quantizer -->
23     <div class="voice-section quantizer-section">
24       <h4>Quantizer</h4>
25       <!-- Root, scale, depth, offset, keyboard -->
26     </div>
27     
28     <!-- Oscillator -->
29     <div class="voice-section oscillator-section">
30       <h4>Oscillator</h4>
31       <select class="osc-type-select">
32         <option value="mangrove">Mangrove</option>
33         <option value="justfriends">Just Friends Osc</option>
34       </select>
35       <!-- Dynamic params based on type -->
36     </div>
37     
38     <!-- FM Depths -->
39     <div class="voice-section fm-section">
40       <h4>FM (Oscillator)</h4>
41       <!-- FM A/B depth sliders -->
42     </div>
43     
44     <!-- Filter -->
45     <div class="voice-section filter-section">
46       <h4>Filter</h4>
47       <select class="filter-type-select">
48         <option value="moog">Moog</option>
49         <option value="wasp">Wasp</option>
50         <option value="sem">SEM</option>
51         <option value="threesisters">Three Sisters</option>
52       </select>
53       <!-- Dynamic params based on type -->
54     </div>
55     
56     <!-- Filter FM Depths -->
57     <div class="voice-section filter-fm-section">
58       <h4>FM (Filter)</h4>
59       <!-- FM C/D depth sliders -->
60     </div>
61     
62     <!-- Envelope -->
63     <div class="voice-section envelope-section">
64       <h4>Envelope (AD)</h4>
65       <!-- Attack/Decay sliders -->
66     </div>
67   </div>
68 </div>
69 
**70** **Create expand/collapse JavaScript**
**71** **Create mixer UI with solo/mute logic**
**72** **Create send effects expandable panels**
**73** **Create 12-LFO grid layout**
**74** **Style all components**

⠀Deliverables:
* Complete index.html
* voices.css
* mixer.css
* lfos.css
* Expand/collapse functionality

⠀
## Stage 11: Patch Management
**Goal:** Save/load complete 4-voice patches
### Tasks:
**1** **Update** **PatchManager.js****:** export class PatchManager {  constructor(app) {    this.app = app;  }    getFullState() {    return {      version: "2.0",      name: this.currentPatchName || "Untitled",      created: new Date().toISOString(),            clock: {        source: this.app.clockSource,        division: this.app.midiManager.clockDivision,        jf1: this.app.jf1?.getState()      },            voices: this.app.voices.map(v => v.getState()),            fmOscillators: {        a: this.app.fmOscA.getState(),        b: this.app.fmOscB.getState(),        c: this.app.fmOscC.getState(),        d: this.app.fmOscD.getState()      },            mixer: this.app.mixerChannels.map(ch => ch.getState()),            sends: {        mimeophon: this.app.mimeophon.getState(),        greyhole: this.app.greyhole.getState(),        zita: this.app.zitaReverb.getState()      },            lfos: this.app.lfos.map(lfo => lfo.getState()),            master: {        volume: this.app.masterGain.gain.value      }    };  }    loadFullState(state) {    // Validate version    if (!state.version?.startsWith('2.')) {      console.warn('Patch version mismatch');    }        // Clock    this.app.setClockSource(state.clock.source);    this.app.midiManager.setClockDivision(state.clock.division);    if (state.clock.jf1) this.app.jf1.setState(state.clock.jf1);        // Voices    state.voices.forEach((vs, i) => {      this.app.voices[i].setState(vs);    });        // FM Oscillators    this.app.fmOscA.setState(state.fmOscillators.a);    this.app.fmOscB.setState(state.fmOscillators.b);    this.app.fmOscC.setState(state.fmOscillators.c);    this.app.fmOscD.setState(state.fmOscillators.d);        // Mixer    state.mixer.forEach((ms, i) => {      this.app.mixerChannels[i].setState(ms);    });        // Sends    this.app.mimeophon.setState(state.sends.mimeophon);    this.app.greyhole.setState(state.sends.greyhole);    this.app.zitaReverb.setState(state.sends.zita);        // LFOs    state.lfos.forEach((ls, i) => {      this.app.lfos[i].setState(ls);    });        // Master    this.app.masterGain.gain.value = state.master.volume;        // Update all UI    this.app.syncUIWithState();  }    savePatch(name) {    const state = this.getFullState();    state.name = name;        const json = JSON.stringify(state, null, 2);    const blob = new Blob([json], { type: 'application/json' });    const url = URL.createObjectURL(blob);        const a = document.createElement('a');    a.href = url;    a.download = `${name}.phase5poly`;    a.click();        URL.revokeObjectURL(url);  }    async loadPatch(file) {    const text = await file.text();    const state = JSON.parse(text);    this.loadFullState(state);    this.currentPatchName = state.name;    return state.name;  }}
2 

⠀Deliverables:
* Updated PatchManager.js
* Save/load UI
* .phase5poly file format

⠀
## Stage 12: Testing & Polish
**Goal:** Full integration testing and optimization
### Tasks:
**1** **Test MIDI routing with Ableton Move channels 1-4**
**2** **Test all oscillator types in each voice**
**3** **Test all filter types in each voice**
**4** **Test FM routing (osc FM A/B, filter FM C/D)**
**5** **Test per-voice transpose sequencers with both clock sources**
**6** **Test mixer sends to all three effects**
**7** **Test LFO modulation to all destination types**
**8** **Test patch save/load preserves all state**
**9** **Profile CPU usage, optimize if needed**
**10** **Fix any audio glitches or routing issues**
**11** **Polish UI transitions and responsiveness**

⠀Deliverables:
* Bug fixes
* Performance optimizations
* Final documentation

⠀
## Summary: File Deliverables by Stage
| **Stage** | **Files Created/Modified** |
|:-:|:-:|
| 1 | OscillatorInterface.js, FilterInterface.js, Phase5PolyApp.js |
| 2 | MoogFilter.js, WaspFilter.js, SEMFilter.js, ThreeSistersFilter.js |
| 3 | ad-envelope-processor.js, ADEnvelopeNode.js |
| 4 | Voice.js |
| 5 | MIDIManager.js |
| 6 | MixerChannel.js, SendEffect.js |
| 7 | FM routing in Phase5PolyApp.js |
| 8 | LFO expansion, destination map |
| 9 | Clock source handling, transpose seq updates |
| 10 | index.html, all CSS files |
| 11 | PatchManager.js |
| 12 | Bug fixes, optimization |

Ready to begin Stage 1?