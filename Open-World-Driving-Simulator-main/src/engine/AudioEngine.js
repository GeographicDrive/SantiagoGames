/**
 * AudioEngine - Programmatic synthesizers for dynamic engine audio, turbo blow-offs, backfires, and weather.
 */
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.started = false;

    // Master Gains
    this.masterGain = null;
    this.engineGain = null;
    this.envGain = null;

    // 1. Engine Synth Nodes
    this.osc1 = null; // low saw rumble
    this.osc2 = null; // mid triangle warm body
    this.osc3 = null; // high saw exhaust buzz
    this.engineFilter = null;
    this.distortion = null;

    // 2. Turbo Synthesizer
    this.turboNoise = null;
    this.turboFilter = null;
    this.turboGain = null;

    // 3. Environmental Sounds (Wind / Rain)
    this.windNoise = null;
    this.windFilter = null;
    this.windGain = null;

    this.rainNoise = null;
    this.rainFilter = null;
    this.rainGain = null;

    // Current levels
    this.engineVolume = 0.35;
    this.envVolume = 0.4;
    this.lastThrottle = 0;
  }

  /**
   * Initializes the AudioContext after user interaction
   */
  init() {
    if (this.started) return;
    
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      
      // Setup Main Mix Bus
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.8, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.setValueAtTime(this.engineVolume, this.ctx.currentTime);
      this.engineGain.connect(this.masterGain);

      this.envGain = this.ctx.createGain();
      this.envGain.gain.setValueAtTime(this.envVolume, this.ctx.currentTime);
      this.envGain.connect(this.masterGain);

      // Start sub-synthesizers
      this.setupEngineSynth();
      this.setupTurboSynth();
      this.setupEnvSynth();

      this.started = true;
      console.log('Audio Engine started successfully');
    } catch (e) {
      console.warn('Web Audio API not supported or blocked:', e);
    }
  }

  /**
   * Main Engine Synthesizer setup
   */
  setupEngineSynth() {
    const ctx = this.ctx;

    // A. Oscillators
    this.osc1 = ctx.createOscillator();
    this.osc1.type = 'sawtooth';
    this.osc1.frequency.setValueAtTime(25, ctx.currentTime); // Base frequency (idle RPM)

    this.osc2 = ctx.createOscillator();
    this.osc2.type = 'triangle';
    this.osc2.frequency.setValueAtTime(37.5, ctx.currentTime); // Mid frequency

    this.osc3 = ctx.createOscillator();
    this.osc3.type = 'sawtooth';
    this.osc3.frequency.setValueAtTime(50, ctx.currentTime); // High exhaust note

    // B. Waveshaper for cylinder rumble distortion
    this.distortion = ctx.createWaveShaper();
    this.distortion.curve = this.makeDistortionCurve(15);

    // C. Biquad filter (simulates engine intake filtering)
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.setValueAtTime(300, ctx.currentTime);
    this.engineFilter.Q.setValueAtTime(2.0, ctx.currentTime);

    // D. Individual gains to layer the sound
    this.osc1Gain = ctx.createGain();
    this.osc1Gain.gain.setValueAtTime(0.35, ctx.currentTime);
    
    this.osc2Gain = ctx.createGain();
    this.osc2Gain.gain.setValueAtTime(0.3, ctx.currentTime);
    
    this.osc3Gain = ctx.createGain();
    this.osc3Gain.gain.setValueAtTime(0.04, ctx.currentTime); // subtle high-end exhaust whir

    // Connect Node path
    this.osc1.connect(this.osc1Gain);
    this.osc2.connect(this.osc2Gain);
    this.osc3.connect(this.osc3Gain);

    this.osc1Gain.connect(this.distortion);
    this.osc2Gain.connect(this.engineFilter);
    this.osc3Gain.connect(this.engineFilter);
    
    this.distortion.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);

    // Start oscillators
    this.osc1.start(0);
    this.osc2.start(0);
    this.osc3.start(0);
  }

  /**
   * High-pitched Turbocharger whistle synthesizer
   */
  setupTurboSynth() {
    const ctx = this.ctx;

    // A. White noise source
    this.turboNoise = this.createNoiseBufferNode();

    // B. Bandpass filter with high resonance (Q) to simulate whir pitch
    this.turboFilter = ctx.createBiquadFilter();
    this.turboFilter.type = 'bandpass';
    this.turboFilter.frequency.setValueAtTime(1000, ctx.currentTime);
    this.turboFilter.Q.setValueAtTime(8.0, ctx.currentTime); // High Q creates a whistle note

    // C. Gain Node
    this.turboGain = ctx.createGain();
    this.turboGain.gain.setValueAtTime(0.0, ctx.currentTime); // off initially

    // Connect path
    this.turboNoise.connect(this.turboFilter);
    this.turboFilter.connect(this.turboGain);
    this.turboGain.connect(this.engineGain);

    this.turboNoise.start(0);
  }

  /**
   * Environmental Audio: Wind & Rain synthesizers
   */
  setupEnvSynth() {
    const ctx = this.ctx;

    // A. Wind Noise (Low pass filtered white noise)
    this.windNoise = this.createNoiseBufferNode();
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.setValueAtTime(250, ctx.currentTime);
    this.windGain = ctx.createGain();
    this.windGain.gain.setValueAtTime(0.1, ctx.currentTime);

    this.windNoise.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.envGain);
    this.windNoise.start(0);

    // B. Rain Noise (Bandpass crackle noise)
    this.rainNoise = this.createNoiseBufferNode();
    this.rainFilter = ctx.createBiquadFilter();
    this.rainFilter.type = 'bandpass';
    this.rainFilter.frequency.setValueAtTime(1200, ctx.currentTime);
    this.rainFilter.Q.setValueAtTime(1.0, ctx.currentTime);
    this.rainGain = ctx.createGain();
    this.rainGain.gain.setValueAtTime(0.0, ctx.currentTime); // Off initially

    this.rainNoise.connect(this.rainFilter);
    this.rainFilter.connect(this.rainGain);
    this.rainGain.connect(this.envGain);
    this.rainNoise.start(0);
  }

  /**
   * Updates audio parameters dynamically in real time
   * @param {number} rpm Engine RPM (800 to 7500)
   * @param {number} throttle Accelerator load (0.0 to 1.0)
   * @param {number} speed Vehicle speed in km/h
   * @param {string} weather Current weather 'clear' | 'overcast' | 'rain' | 'fog'
   */
  updateTelemetry(rpm, throttle, speed, weather) {
    if (!this.started) return;

    const t = this.ctx.currentTime;
    const rpmFactor = rpm / 7500;

    // 1. Calculate Engine Pitch (Frequencies) based on RPM
    const f0 = 15 + rpmFactor * 85; // Base cylinder fire frequency (15Hz to 100Hz)
    this.osc1.frequency.setTargetAtTime(f0, t, 0.05);
    this.osc2.frequency.setTargetAtTime(f0 * 1.5, t, 0.05); // warm harmonic
    this.osc3.frequency.setTargetAtTime(f0 * 2.0, t, 0.04); // high exhaust tone

    // 2. Modulate Low-Pass Filter based on RPM and throttle load
    // Revving the engine opens the filter, letting exhaust growl escape
    const filterCutoff = 180 + rpmFactor * 2500 + throttle * 600;
    this.engineFilter.frequency.setTargetAtTime(filterCutoff, t, 0.05);

    // 3. Modulate Layer Gains (high exhaust note gets louder under throttle load)
    this.osc1Gain.gain.setTargetAtTime(0.25 + throttle * 0.2, t, 0.1);
    this.osc2Gain.gain.setTargetAtTime(0.2 + throttle * 0.15, t, 0.1);
    this.osc3Gain.gain.setTargetAtTime(0.01 + throttle * 0.09, t, 0.05);

    // 4. Turbocharger Whistle
    if (throttle > 0.05) {
      // Whistle frequency climbs with RPM
      const turboFreq = 1200 + rpmFactor * 3200;
      this.turboFilter.frequency.setTargetAtTime(turboFreq, t, 0.1);
      // Volume climbs with throttle load
      const turboVol = throttle * 0.05 * (0.3 + rpmFactor * 0.7);
      this.turboGain.gain.setTargetAtTime(turboVol, t, 0.2);
    } else {
      // Trigger Turbo Blow-Off Valve "Pshhh" if we let off throttle suddenly
      if (this.lastThrottle > 0.6) {
        this.triggerBlowOffValve();
      } else {
        this.turboGain.gain.setTargetAtTime(0.0, t, 0.15);
      }
    }

    // 5. Dynamic Exhaust Backfires (Crackles on high-RPM deceleration)
    if (throttle === 0 && this.lastThrottle > 0.1 && rpm > 4200) {
      if (Math.random() > 0.5) {
        this.triggerExhaustCrackle();
      }
    }

    this.lastThrottle = throttle;

    // 6. Wind noise based on speed
    const windFreq = 150 + (speed / 150) * 350; // Pitch climbs
    const windVol = (speed / 180) * 0.25;      // Volume climbs
    this.windFilter.frequency.setTargetAtTime(windFreq, t, 0.1);
    this.windGain.gain.setTargetAtTime(windVol, t, 0.3);

    // 7. Rain noise based on weather state
    if (weather === 'rain') {
      this.rainGain.gain.setTargetAtTime(0.18, t, 0.5);
    } else {
      this.rainGain.gain.setTargetAtTime(0.0, t, 0.8);
    }
  }

  /**
   * Synthesizes a blow-off valve air release "psshh" sound
   */
  triggerBlowOffValve() {
    const t = this.ctx.currentTime;
    
    // Create temporary high-pass noise burst
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.turboNoise.buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(2000, t);
    filter.frequency.exponentialRampToValueAtTime(800, t + 0.4);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.engineGain);

    noise.start(t);
    noise.stop(t + 0.5);

    // Quickly fade out turbo spooler
    this.turboGain.gain.setValueAtTime(0.0, t);
  }

  /**
   * Synthesizes a sudden metallic exhaust pop/crackle
   */
  triggerExhaustCrackle() {
    const t = this.ctx.currentTime;
    const numPops = 1 + Math.floor(Math.random() * 3); // 1-3 rapid pops

    for (let i = 0; i < numPops; i++) {
      const popTime = t + i * 0.08 + Math.random() * 0.03;
      
      // Oscillator pop pulse (low exhaust pop)
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(80 + Math.random() * 40, popTime);
      osc.frequency.exponentialRampToValueAtTime(20, popTime + 0.04);

      // Noise crackle (high exhaust rattle)
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.turboNoise.buffer;
      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(150 + Math.random() * 200, popTime);

      const popGain = this.ctx.createGain();
      popGain.gain.setValueAtTime(0.15, popTime);
      popGain.gain.exponentialRampToValueAtTime(0.001, popTime + 0.05);

      osc.connect(popGain);
      noise.connect(noiseFilter);
      noiseFilter.connect(popGain);
      popGain.connect(this.engineGain);

      osc.start(popTime);
      osc.stop(popTime + 0.05);
      noise.start(popTime);
      noise.stop(popTime + 0.05);
    }
  }

  /**
   * Math helper to compute Waveshaper curves
   */
  makeDistortionCurve(amount) {
    const k = typeof amount === 'number' ? amount : 50;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  /**
   * Helper generating a 2 second loop buffer of White Noise
   */
  createNoiseBufferNode() {
    const bufferSize = this.ctx.sampleRate * 2; // 2 seconds
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    return source;
  }

  /**
   * Set volume sliders
   */
  setEngineVolume(val) {
    this.engineVolume = val / 100;
    if (this.engineGain) {
      this.engineGain.gain.setTargetAtTime(this.engineVolume, this.ctx.currentTime, 0.1);
    }
  }

  setEnvVolume(val) {
    this.envVolume = val / 100;
    if (this.envGain) {
      this.envGain.gain.setTargetAtTime(this.envVolume, this.ctx.currentTime, 0.1);
    }
  }

  setMute(muteState) {
    if (!this.masterGain) return;
    this.masterGain.gain.setTargetAtTime(muteState ? 0.0 : 0.8, this.ctx.currentTime, 0.1);
  }
}
export default AudioEngine;
