/**
 * MusicEngine - Controls radio streaming, volume, Web Audio analyser, 
 * and a fully-synthesized Procedural music loop fallback for each station.
 */
export class MusicEngine {
  constructor(audioEngine) {
    this.audioEngine = audioEngine; // share context if available
    this.ctx = null;
    
    // HTML Audio player
    this.audioElement = new Audio();
    this.audioElement.crossOrigin = 'anonymous';
    this.audioElement.loop = true;

    // Web Audio Nodes
    this.mediaSource = null;
    this.analyser = null;
    this.musicGain = null;

    // Procedural Synth variables
    this.synthPlaying = false;
    this.bpm = 110;
    this.stepTime = 60 / this.bpm / 4; // 16th notes
    this.currentStep = 0;
    this.chordIndex = 0;
    this.schedulerTimer = null;
    this.nextNoteTime = 0.0;
    
    this.activeStation = 'procedural';
    this.volume = 70;
    this.useProceduralFallback = false;

    // Define procedural audio style profiles for each radio station
    this.styles = {
      synthwave: {
        bpm: 115,
        chords: [
          { root: 'Gm', notes: [196.0, 233.1, 293.7], bass: 49.0 },  // G3, Bb3, D4, G2
          { root: 'Eb', notes: [155.6, 196.0, 233.1], bass: 38.9 }, // Eb3, G3, Bb3, Eb2
          { root: 'F',  notes: [174.6, 220.0, 261.6], bass: 43.7 },  // F3, A3, C4, F2
          { root: 'Dm', notes: [146.8, 174.6, 220.0], bass: 36.7 }   // D3, F3, A3, D2
        ]
      },
      lofi: {
        bpm: 75,
        chords: [
          { root: 'Am9',   notes: [130.8, 164.8, 196.0, 246.9], bass: 55.0 },  // A2, C3, E3, G3, B3
          { root: 'Dm9',   notes: [174.6, 220.0, 261.6, 329.6], bass: 36.7 },  // D2, F3, A3, C4, E4
          { root: 'G7',    notes: [174.6, 246.9, 293.7, 392.0], bass: 49.0 },  // G2, F3, B3, D4, G4
          { root: 'Cmaj7', notes: [164.8, 196.0, 246.9, 293.7], bass: 32.7 }   // C2, E3, G3, B3, D4
        ]
      },
      ambient: {
        bpm: 50,
        chords: [
          { root: 'C9',    notes: [196.0, 293.7, 329.6], bass: 32.7 }, // C2, G3, D4, E4
          { root: 'Fadd9', notes: [220.0, 261.6, 392.0], bass: 43.7 }, // F2, A3, C4, G4
          { root: 'Am9',   notes: [164.8, 246.9, 261.6], bass: 55.0 }, // A2, E3, B3, C4
          { root: 'G6/9',  notes: [246.9, 293.7, 440.0], bass: 49.0 }  // G2, B3, D4, A4
        ]
      },
      classical: {
        bpm: 80,
        chords: [
          { root: 'Dm',    notes: [146.8, 174.6, 220.0], bass: 36.7 }, // D2, D3, F3, A3
          { root: 'Gm/Bb', notes: [146.8, 196.0, 233.1], bass: 58.3 }, // Bb2, D3, G3, Bb3
          { root: 'A7',    notes: [138.6, 164.8, 196.0], bass: 55.0 }, // A2, C#3, E3, G3
          { root: 'Dm',    notes: [146.8, 174.6, 220.0], bass: 36.7 }  // D2, D3, F3, A3
        ]
      }
    };

    // Default to synthwave chords
    this.chords = this.styles.synthwave.chords;

    // Radio stations catalog
    this.stations = {
      procedural: { name: 'Procedural Synthwave', artist: 'VibeDrive Synthesizer', url: null },
      lofi: { name: 'Lofi Chill Cruise', artist: 'Public Chill Radio', url: 'https://icecast.unitedradio.it/Lofi.mp3' },
      synthwave: { name: 'Cyberpunk Skyline', artist: 'Outrun Synth Radio', url: 'https://nightride.fm/stream/synthwave.mp3' },
      ambient: { name: 'Deep Space Scapes', artist: 'Ambient Echoes', url: 'https://nightride.fm/stream/ambient.mp3' },
      classical: { name: 'Symphonic Road', artist: 'Classic FM Stream', url: 'https://media-ssl.musicradio.com/ClassicFM' }
    };

    // Safe error handler for HTML Audio streaming failure
    this.audioElement.onerror = (e) => {
      if (this.activeStation === 'procedural') return;
      console.warn('Audio element stream error, falling back to procedural synth for', this.activeStation, e);
      if (this.fallbackTimer) {
        clearTimeout(this.fallbackTimer);
        this.fallbackTimer = null;
      }
      if (!this.useProceduralFallback) {
        this.useProceduralFallback = true;
        this.audioElement.pause();
        if (this.ctx && this.ctx.state === 'running') {
          this.startProceduralSynth();
        }
      }
    };

    this.fallbackTimer = null;
    this.audioElement.onplaying = () => {
      if (this.fallbackTimer) {
        clearTimeout(this.fallbackTimer);
        this.fallbackTimer = null;
      }
      if (this.useProceduralFallback && this.activeStation !== 'procedural') {
        this.audioElement.pause();
      }
    };
  }

  /**
   * Starts a 1.5 second fallback timer for buffering stream.
   */
  startPlaybackTimeout() {
    if (this.fallbackTimer) {
      clearTimeout(this.fallbackTimer);
    }
    this.fallbackTimer = setTimeout(() => {
      console.warn('Audio stream buffering timeout (1.5s exceeded). Falling back to procedural synth.');
      this.useProceduralFallback = true;
      this.audioElement.pause();
      if (this.ctx && this.ctx.state === 'running') {
        this.startProceduralSynth();
      }
    }, 1500);
  }

  /**
   * Initializes context and links HTML Audio to Web Audio mix bus
   */
  init(audioCtx, masterGainNode) {
    this.ctx = audioCtx;

    // A. Create Analyser Node
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 128; // small FFT for responsive dashboard bars
    
    // B. Create Gain Node for music
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.setValueAtTime(this.volume / 100, this.ctx.currentTime);

    // C. Route HTML Audio through Analyser
    try {
      this.mediaSource = this.ctx.createMediaElementSource(this.audioElement);
      this.mediaSource.connect(this.analyser);
      this.analyser.connect(this.musicGain);
      this.musicGain.connect(masterGainNode);
    } catch (e) {
      console.warn('Media element routing issue (probably already routed):', e);
    }

    // Set volume initial
    this.setVolume(this.volume);
    
    // Auto-start procedural on start
    this.play();
  }

  /**
   * Translates active station to style profile key
   */
  getStyleKey(stationKey) {
    if (stationKey === 'procedural') return 'synthwave';
    return stationKey; // lofi, synthwave, ambient, classical
  }

  /**
   * Set station by key
   * @param {string} stationKey 
   */
  setStation(stationKey) {
    if (!this.stations[stationKey]) return;
    
    // Stop procedural synth if it was active
    if (this.synthPlaying) {
      this.stopProceduralSynth();
    }

    if (this.fallbackTimer) {
      clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }

    this.activeStation = stationKey;
    this.useProceduralFallback = false;
    const station = this.stations[stationKey];
    
    // Update track names in HUD
    const titleEl = document.getElementById('track-title');
    const artistEl = document.getElementById('track-artist');
    if (titleEl) titleEl.innerText = station.name;
    if (artistEl) artistEl.innerText = station.artist;

    if (stationKey === 'procedural') {
      this.audioElement.pause();
      this.audioElement.src = '';
      this.useProceduralFallback = true;
      this.startProceduralSynth();
    } else {
      this.startPlaybackTimeout();
      
      // Connect to online streaming audio
      this.audioElement.src = station.url;
      this.audioElement.load();
      
      const playPromise = this.audioElement.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.warn('Playback blocked or connection failed. Activating custom procedural fallback for station:', stationKey);
          if (this.fallbackTimer) {
            clearTimeout(this.fallbackTimer);
            this.fallbackTimer = null;
          }
          this.useProceduralFallback = true;
          this.startProceduralSynth();
        });
      }
    }
  }

  play() {
    if (this.activeStation === 'procedural' || this.useProceduralFallback) {
      this.startProceduralSynth();
    } else {
      if (this.fallbackTimer) {
        clearTimeout(this.fallbackTimer);
        this.fallbackTimer = null;
      }
      this.startPlaybackTimeout();

      const playPromise = this.audioElement.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          console.warn('Play interrupted or blocked. Reverting to procedural fallback.');
          if (this.fallbackTimer) {
            clearTimeout(this.fallbackTimer);
            this.fallbackTimer = null;
          }
          this.useProceduralFallback = true;
          this.startProceduralSynth();
        });
      }
    }
    document.querySelector('.cassette-deck')?.classList.add('playing');
  }

  pause() {
    if (this.fallbackTimer) {
      clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }
    if (this.activeStation === 'procedural' || this.useProceduralFallback) {
      this.stopProceduralSynth();
    } else {
      this.audioElement.pause();
    }
    document.querySelector('.cassette-deck')?.classList.remove('playing');
  }

  setVolume(val) {
    this.volume = val;
    if (this.musicGain) {
      this.musicGain.gain.setTargetAtTime(this.volume / 100, this.ctx.currentTime, 0.1);
    }
  }

  // ==========================================
  // PROCEDURAL SYNTH MUSIC SEQUENCE GENERATOR
  // ==========================================

  startProceduralSynth() {
    if (this.synthPlaying) return;
    this.synthPlaying = true;
    
    // Load station style profile
    const styleKey = this.getStyleKey(this.activeStation);
    const style = this.styles[styleKey] || this.styles.synthwave;
    this.bpm = style.bpm;
    this.chords = style.chords;
    this.stepTime = 60 / this.bpm / 4; // 16th notes
    
    this.currentStep = 0;
    this.chordIndex = 0;
    this.nextNoteTime = this.ctx.currentTime;
    
    // Start timing scheduler loop
    this.schedulerTimer = setInterval(() => {
      this.scheduler();
    }, 25); // high frequency poll
  }

  stopProceduralSynth() {
    this.synthPlaying = false;
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  /**
   * Schedule notes ahead of time to prevent audio glitches
   */
  scheduler() {
    const scheduleAheadTime = 0.1; // schedule notes 100ms in advance
    while (this.nextNoteTime < this.ctx.currentTime + scheduleAheadTime) {
      this.scheduleNote(this.currentStep, this.nextNoteTime);
      
      // Advance step
      this.nextNoteTime += this.stepTime;
      this.currentStep = (this.currentStep + 1) % 16;
      
      // Advance chord every 16 steps (one full bar)
      if (this.currentStep === 0) {
        this.chordIndex = (this.chordIndex + 1) % this.chords.length;
      }
    }
  }

  /**
   * Schedules synthesizers for a given step index (0-15) and time
   */
  scheduleNote(step, time) {
    const styleKey = this.getStyleKey(this.activeStation);
    const chord = this.chords[this.chordIndex];
    if (!chord) return;

    // Helper to connect to analyser mix bus so that spectrum dashboard displays feedback
    const connectToOutput = (node) => {
      node.connect(this.analyser || this.musicGain);
    };

    if (styleKey === 'synthwave') {
      // ==========================================
      // SYNTHWAVE / RETRO STYLE (Energetic & Driving)
      // ==========================================
      
      // 1. Sawtooth Bass (Driving 8th notes)
      if (step % 2 === 0) {
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(chord.bass, time);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(160, time);
        filter.Q.setValueAtTime(3.0, time);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.70, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + this.stepTime * 1.8);

        osc.connect(filter);
        filter.connect(gain);
        connectToOutput(gain);

        osc.start(time);
        osc.stop(time + this.stepTime * 2);
      }

      // 2. Ambient Sweep Chord Pads (Triggered on step 0 and 8)
      if (step === 0 || step === 8) {
        chord.notes.forEach((freq) => {
          const osc = this.ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, time);

          const filter = this.ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(150, time);
          filter.frequency.exponentialRampToValueAtTime(650, time + this.stepTime * 3.5);

          const gain = this.ctx.createGain();
          gain.gain.setValueAtTime(0.36, time);
          gain.gain.exponentialRampToValueAtTime(0.001, time + this.stepTime * 7.5);

          osc.connect(filter);
          filter.connect(gain);
          connectToOutput(gain);

          osc.start(time);
          osc.stop(time + this.stepTime * 8);
        });
      }

      // 3. Drum Kit
      // A. Kick (Four-on-the-floor)
      if (step === 0 || step === 4 || step === 8 || step === 12) {
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(140, time);
        osc.frequency.exponentialRampToValueAtTime(45, time + 0.1);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.80, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);

        osc.connect(gain);
        connectToOutput(gain);

        osc.start(time);
        osc.stop(time + 0.18);
      }

      // B. Retro Snare (180ms white noise, backbeat)
      if (step === 4 || step === 12) {
        const bufferSize = this.ctx.sampleRate * 0.18;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1000, time);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.40, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);

        noise.connect(filter);
        filter.connect(gain);
        connectToOutput(gain);

        noise.start(time);
        noise.stop(time + 0.18);
      }

      // C. Hi-Hats (Offbeats)
      if (step === 2 || step === 6 || step === 10 || step === 14) {
        const bufferSize = this.ctx.sampleRate * 0.04;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(6000, time);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.14, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);

        noise.connect(filter);
        filter.connect(gain);
        connectToOutput(gain);

        noise.start(time);
        noise.stop(time + 0.04);
      }
      
      // D. Retro Arpeggiator Melody (G Minor)
      if (step % 2 === 1 && step > 6) {
        const arpFreqs = [196.0, 233.1, 293.7, 392.0];
        const freq = arpFreqs[step % 4];
        
        const osc = this.ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, time);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, time);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.12, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + this.stepTime * 0.9);

        osc.connect(filter);
        filter.connect(gain);
        connectToOutput(gain);

        osc.start(time);
        osc.stop(time + this.stepTime * 1.0);
      }

    } else if (styleKey === 'lofi') {
      // ==========================================
      // LOFI STYLE (Relaxed, Dusty Electric Piano)
      // ==========================================
      
      // 1. Warm Triangle Bass
      if (step === 0 || step === 6 || step === 8 || step === 14) {
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(chord.bass, time);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(100, time); // warm low filter

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.80, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + this.stepTime * 2.5);

        osc.connect(filter);
        filter.connect(gain);
        connectToOutput(gain);

        osc.start(time);
        osc.stop(time + this.stepTime * 3);
      }

      // 2. Electric Piano Pad Chords (Blended Sine/Triangle with Tremolo)
      if (step === 0 || step === 8) {
        chord.notes.forEach((freq) => {
          const osc = this.ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, time);

          const octaveOsc = this.ctx.createOscillator();
          octaveOsc.type = 'triangle';
          octaveOsc.frequency.setValueAtTime(freq * 2, time);

          const filter = this.ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(500, time); // lowpass muffle

          // Simulating a tremolo effect using gain scheduling
          const gain = this.ctx.createGain();
          gain.gain.setValueAtTime(0.36, time);
          gain.gain.linearRampToValueAtTime(0.20, time + this.stepTime * 2);
          gain.gain.linearRampToValueAtTime(0.20, time + this.stepTime * 4);
          gain.gain.linearRampToValueAtTime(0.08, time + this.stepTime * 6);
          gain.gain.exponentialRampToValueAtTime(0.001, time + this.stepTime * 7.8);

          osc.connect(filter);
          octaveOsc.connect(filter);
          filter.connect(gain);
          connectToOutput(gain);

          osc.start(time);
          octaveOsc.start(time);
          osc.stop(time + this.stepTime * 8);
          octaveOsc.stop(time + this.stepTime * 8);
        });
      }

      // 3. Drums (Laid back boom-bap)
      // A. Kick (Soft sub kick on step 0 and 10)
      if (step === 0 || step === 10) {
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(90, time);
        osc.frequency.exponentialRampToValueAtTime(40, time + 0.12);

        const gain = this.ctx.createGain();
        const vol = step === 0 ? 0.70 : 0.30;
        gain.gain.setValueAtTime(vol, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

        osc.connect(gain);
        connectToOutput(gain);

        osc.start(time);
        osc.stop(time + 0.16);
      }

      // B. Rimshot-like Filtered Snare (steps 4, 12)
      if (step === 4 || step === 12) {
        const bufferSize = this.ctx.sampleRate * 0.12;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(900, time);
        filter.Q.setValueAtTime(4.0, time);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.24, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

        noise.connect(filter);
        filter.connect(gain);
        connectToOutput(gain);

        noise.start(time);
        noise.stop(time + 0.12);
      }

      // C. Loose Dusty Hi-Hats (steps 2, 6, 8, 14)
      if (step === 2 || step === 6 || step === 8 || step === 14) {
        const bufferSize = this.ctx.sampleRate * 0.03;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(8000, time);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.06, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.02);

        noise.connect(filter);
        filter.connect(gain);
        connectToOutput(gain);

        noise.start(time);
        noise.stop(time + 0.03);
      }

      // D. Vinyl Crackle generator (Randomized pops)
      if (step % 4 === 1) {
        const bufferSize = this.ctx.sampleRate * 0.01;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() > 0.95 ? (Math.random() * 2 - 1) : 0;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(1000, time);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.10, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.008);

        noise.connect(filter);
        filter.connect(gain);
        connectToOutput(gain);

        noise.start(time);
        noise.stop(time + 0.01);
      }

      // E. Lazy Rhodes Melody Pluck (steps 3, 7, 11)
      if (step === 3 || step === 7 || step === 11) {
        const note = chord.notes[step % chord.notes.length] * 2.0; 
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(note, time);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.16, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + this.stepTime * 1.5);

        osc.connect(gain);
        connectToOutput(gain);

        osc.start(time);
        osc.stop(time + this.stepTime * 1.6);
      }

    } else if (styleKey === 'ambient') {
      // ==========================================
      // AMBIENT STYLE (Ethereal Cosmic Drone, No Drums)
      // ==========================================
      
      // 1. Deep Sub Bass Drone (sine wave, triggers on step 0, runs 16 steps)
      if (step === 0) {
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(chord.bass * 0.75, time);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.0, time);
        gain.gain.linearRampToValueAtTime(0.60, time + this.stepTime * 4); // Slow attack
        gain.gain.exponentialRampToValueAtTime(0.001, time + this.stepTime * 15.5); // long decay

        osc.connect(gain);
        connectToOutput(gain);

        osc.start(time);
        osc.stop(time + this.stepTime * 16);
      }

      // 2. Slow Swelling Chord Pads (Overlapping waves, steps 0 and 8)
      if (step === 0 || step === 8) {
        chord.notes.forEach((freq) => {
          const osc = this.ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, time);

          const fifthOsc = this.ctx.createOscillator();
          fifthOsc.type = 'triangle';
          fifthOsc.frequency.setValueAtTime(freq * 1.5, time); // fifth harmonic

          const filter = this.ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(200, time);
          filter.frequency.exponentialRampToValueAtTime(800, time + this.stepTime * 4.0); // slow filter sweep

          const gain = this.ctx.createGain();
          gain.gain.setValueAtTime(0.0, time);
          gain.gain.linearRampToValueAtTime(0.30, time + this.stepTime * 2.0); // very slow attack
          gain.gain.exponentialRampToValueAtTime(0.001, time + this.stepTime * 7.8);

          osc.connect(filter);
          fifthOsc.connect(filter);
          filter.connect(gain);
          connectToOutput(gain);

          osc.start(time);
          fifthOsc.start(time);
          osc.stop(time + this.stepTime * 8);
          fifthOsc.stop(time + this.stepTime * 8);
        });
      }

      // 3. Ethereal High Shimmers (Tiny randomly triggered bells on step 5, 9, 13)
      if (step === 5 || step === 9 || step === 13) {
        const baseNote = chord.notes[1] || 220;
        const freq = baseNote * 4.0; // high register
        
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.0, time);
        gain.gain.linearRampToValueAtTime(0.06, time + 0.05); // soft pluck
        gain.gain.exponentialRampToValueAtTime(0.0001, time + this.stepTime * 2.5);

        osc.connect(gain);
        connectToOutput(gain);

        osc.start(time);
        osc.stop(time + this.stepTime * 2.8);
      }

    } else if (styleKey === 'classical') {
      // ==========================================
      // CLASSICAL STYLE (Symphonic Strings, Harp Plucks)
      // ==========================================

      // 1. Legato Bowed Cello Bass (Triangle, steps 0 and 8)
      if (step === 0 || step === 8) {
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(chord.bass, time);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(250, time);
        filter.Q.setValueAtTime(2.0, time);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.0, time);
        gain.gain.linearRampToValueAtTime(0.40, time + 0.1); // soft attack
        gain.gain.exponentialRampToValueAtTime(0.001, time + this.stepTime * 7.5);

        osc.connect(filter);
        filter.connect(gain);
        connectToOutput(gain);

        osc.start(time);
        osc.stop(time + this.stepTime * 8);
      }

      // 2. Woody Piano / Harp Plucks (8th notes arpeggiation)
      if (step % 2 === 0) {
        const noteIdx = (step / 2) % chord.notes.length;
        const baseFreq = chord.notes[noteIdx];
        
        // Blend sine and triangle for wooden soundboard texture
        const osc1 = this.ctx.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(baseFreq * 2.0, time);

        const osc2 = this.ctx.createOscillator();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(baseFreq * 2.0, time);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1200, time);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.24, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + this.stepTime * 2.2);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        connectToOutput(gain);

        osc1.start(time);
        osc2.start(time);
        osc1.stop(time + this.stepTime * 2.5);
        osc2.stop(time + this.stepTime * 2.5);
      }

      // 3. Solo Violin Legato Lead (Melodic notes on steps 4, 10, 14)
      if (step === 4 || step === 10 || step === 14) {
        const melodyNotes = [329.6, 392.0, 440.0, 523.3]; // E4, G4, A4, C5
        const baseFreq = melodyNotes[(step + this.chordIndex) % melodyNotes.length];

        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(baseFreq, time);

        // Subtle violin-like frequency modulation (vibrato)
        osc.frequency.linearRampToValueAtTime(baseFreq + 3, time + 0.15);
        osc.frequency.linearRampToValueAtTime(baseFreq - 3, time + 0.3);
        osc.frequency.linearRampToValueAtTime(baseFreq + 3, time + 0.45);
        osc.frequency.linearRampToValueAtTime(baseFreq, time + 0.6);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1000, time);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.0, time);
        gain.gain.linearRampToValueAtTime(0.20, time + 0.15); // soft onset
        gain.gain.exponentialRampToValueAtTime(0.001, time + this.stepTime * 3.8);

        osc.connect(filter);
        filter.connect(gain);
        connectToOutput(gain);

        osc.start(time);
        osc.stop(time + this.stepTime * 4.0);
      }
    }
  }

  /**
   * Draws audio frequency bars to the canvas visualizer
   * @param {HTMLCanvasElement} canvas 
   */
  drawVisualizer(canvas) {
    if (!this.analyser) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    this.analyser.getByteFrequencyData(dataArray);

    ctx.clearRect(0, 0, width, height);

    const barWidth = (width / bufferLength) * 1.8;
    let barHeight;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      barHeight = (dataArray[i] / 255) * height * 0.95;

      // Create glowing neon cyan-to-pink gradient for the bars
      const grad = ctx.createLinearGradient(0, height, 0, 0);
      grad.addColorStop(0, '#00f3ff');
      grad.addColorStop(1, '#ff007f');

      ctx.fillStyle = grad;
      ctx.fillRect(x, height - barHeight, barWidth, barHeight);

      x += barWidth + 3.0;
    }
  }
}
export default MusicEngine;

