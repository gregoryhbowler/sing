// WavRecorder.js - Inline WAV recorder for Web Audio
// Records audio passing through the signal chain and exports as WAV

export class WavRecorder {
  constructor(audioContext) {
    this.audioContext = audioContext;
    this.sampleRate = audioContext.sampleRate;
    
    // Audio nodes for inline routing
    this.inputGain = audioContext.createGain();
    this.outputGain = audioContext.createGain();
    this.inputGain.gain.value = 1.0;
    this.outputGain.gain.value = 1.0;
    
    // Recording state
    this.isRecording = false;
    this.isPaused = false;
    this.recordedChunks = [];
    this.startTime = 0;
    this.pausedDuration = 0;
    this.pauseStartTime = 0;
    
    // ScriptProcessor for capturing samples (works universally)
    this.bufferSize = 4096;
    this.scriptProcessor = null;
    
    // Callbacks
    this.onTimeUpdate = null;
    this.onStateChange = null;
    
    // Timer for UI updates
    this.updateTimer = null;
    
    // Connect input directly to output (pass-through)
    this.inputGain.connect(this.outputGain);
    
    this._setupProcessor();
  }
  
  _setupProcessor() {
    // Create ScriptProcessorNode for sample capture
    // Note: ScriptProcessorNode is deprecated but widely supported
    // AudioWorklet would be cleaner but requires more setup
    this.scriptProcessor = this.audioContext.createScriptProcessor(
      this.bufferSize, 
      2,  // input channels (stereo)
      2   // output channels (stereo)
    );
    
    this.scriptProcessor.onaudioprocess = (e) => {
      if (!this.isRecording || this.isPaused) return;
      
      // Capture both channels
      const leftChannel = e.inputBuffer.getChannelData(0);
      const rightChannel = e.inputBuffer.getChannelData(1);
      
      // Clone the data (it gets reused)
      this.recordedChunks.push({
        left: new Float32Array(leftChannel),
        right: new Float32Array(rightChannel)
      });
    };
    
    // Connect processor in parallel (doesn't interrupt signal)
    this.inputGain.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.audioContext.destination);
    
    // Mute the script processor output (we just want to capture)
    // Actually, disconnect from destination and connect to a silent gain
    this.scriptProcessor.disconnect();
    const silentGain = this.audioContext.createGain();
    silentGain.gain.value = 0;
    this.scriptProcessor.connect(silentGain);
    silentGain.connect(this.audioContext.destination);
  }
  
  getInput() {
    return this.inputGain;
  }
  
  getOutput() {
    return this.outputGain;
  }
  
  start() {
    if (this.isRecording) return;
    
    this.isRecording = true;
    this.isPaused = false;
    this.recordedChunks = [];
    this.startTime = this.audioContext.currentTime;
    this.pausedDuration = 0;
    
    this._startUpdateTimer();
    this._notifyStateChange('recording');
    
    console.log('🔴 Recording started');
  }
  
  pause() {
    if (!this.isRecording || this.isPaused) return;
    
    this.isPaused = true;
    this.pauseStartTime = this.audioContext.currentTime;
    
    this._stopUpdateTimer();
    this._notifyStateChange('paused');
    
    console.log('⏸ Recording paused');
  }
  
  resume() {
    if (!this.isRecording || !this.isPaused) return;
    
    this.isPaused = false;
    this.pausedDuration += this.audioContext.currentTime - this.pauseStartTime;
    
    this._startUpdateTimer();
    this._notifyStateChange('recording');
    
    console.log('▶ Recording resumed');
  }
  
  stop() {
    if (!this.isRecording) return null;
    
    this.isRecording = false;
    this.isPaused = false;
    
    this._stopUpdateTimer();
    
    // Calculate final duration
    const duration = this._getRecordingDuration();
    
    // Generate WAV blob
    const wavBlob = this._createWavBlob();
    
    this._notifyStateChange('stopped');
    
    console.log(`⏹ Recording stopped - ${this.formatDuration(duration)}`);
    
    return wavBlob;
  }
  
  cancel() {
    this.isRecording = false;
    this.isPaused = false;
    this.recordedChunks = [];
    
    this._stopUpdateTimer();
    this._notifyStateChange('stopped');
    
    console.log('✕ Recording cancelled');
  }
  
  _getRecordingDuration() {
    if (!this.isRecording && this.recordedChunks.length === 0) return 0;
    
    if (this.isRecording) {
      let elapsed = this.audioContext.currentTime - this.startTime - this.pausedDuration;
      if (this.isPaused) {
        elapsed -= (this.audioContext.currentTime - this.pauseStartTime);
      }
      return Math.max(0, elapsed);
    }
    
    // Calculate from recorded samples
    const totalSamples = this.recordedChunks.reduce(
      (sum, chunk) => sum + chunk.left.length, 
      0
    );
    return totalSamples / this.sampleRate;
  }
  
  _startUpdateTimer() {
    this._stopUpdateTimer();
    
    this.updateTimer = setInterval(() => {
      if (this.onTimeUpdate) {
        this.onTimeUpdate(this._getRecordingDuration());
      }
    }, 50); // 20fps update
  }
  
  _stopUpdateTimer() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }
  
  _notifyStateChange(state) {
    if (this.onStateChange) {
      this.onStateChange(state);
    }
  }
  
  _createWavBlob() {
    if (this.recordedChunks.length === 0) return null;
    
    // Calculate total length
    const totalSamples = this.recordedChunks.reduce(
      (sum, chunk) => sum + chunk.left.length, 
      0
    );
    
    // Interleave stereo channels
    const interleaved = new Float32Array(totalSamples * 2);
    let offset = 0;
    
    for (const chunk of this.recordedChunks) {
      for (let i = 0; i < chunk.left.length; i++) {
        interleaved[offset++] = chunk.left[i];
        interleaved[offset++] = chunk.right[i];
      }
    }
    
    // Convert to 16-bit PCM
    const pcmData = this._floatTo16BitPCM(interleaved);
    
    // Create WAV file
    const wavBuffer = this._encodeWav(pcmData, 2, this.sampleRate);
    
    return new Blob([wavBuffer], { type: 'audio/wav' });
  }
  
  _floatTo16BitPCM(float32Array) {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    
    for (let i = 0; i < float32Array.length; i++) {
      // Clamp to [-1, 1]
      let sample = Math.max(-1, Math.min(1, float32Array[i]));
      // Convert to 16-bit signed integer
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(i * 2, sample, true); // little-endian
    }
    
    return buffer;
  }
  
  _encodeWav(pcmBuffer, numChannels, sampleRate) {
    const pcmData = new Uint8Array(pcmBuffer);
    const wavBuffer = new ArrayBuffer(44 + pcmData.length);
    const view = new DataView(wavBuffer);
    
    // WAV header
    // "RIFF" chunk descriptor
    this._writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + pcmData.length, true);
    this._writeString(view, 8, 'WAVE');
    
    // "fmt " sub-chunk
    this._writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Sub-chunk size (16 for PCM)
    view.setUint16(20, 1, true);  // Audio format (1 = PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true); // Byte rate
    view.setUint16(32, numChannels * 2, true); // Block align
    view.setUint16(34, 16, true); // Bits per sample
    
    // "data" sub-chunk
    this._writeString(view, 36, 'data');
    view.setUint32(40, pcmData.length, true);
    
    // Write PCM data
    const wavBytes = new Uint8Array(wavBuffer);
    wavBytes.set(pcmData, 44);
    
    return wavBuffer;
  }
  
  _writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }
  
  formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const centis = Math.floor((seconds % 1) * 100);
    
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${centis.toString().padStart(2, '0')}`;
  }
  
  downloadRecording(blob, filename = 'recording.wav') {
    if (!blob) {
      console.warn('No recording to download');
      return;
    }
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log(`💾 Downloaded: ${filename}`);
  }
}
