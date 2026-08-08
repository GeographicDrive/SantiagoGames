import * as THREE from 'three';
import './style.css';
import { GraphicsEngine } from './engine/GraphicsEngine.js';
import { AudioEngine } from './engine/AudioEngine.js';
import { MusicEngine } from './engine/MusicEngine.js';
import { PhysicsEngine } from './engine/PhysicsEngine.js';
import { RoadGenerator } from './engine/RoadGenerator.js';
import { SceneryGenerator } from './engine/SceneryGenerator.js';
import { OsmService } from './services/OsmService.js';

// Global Application State Coordinator
class Application {
  constructor() {
    // 1. Instantiating Engine components
    this.graphics = new GraphicsEngine('canvas-container');
    this.audio = new AudioEngine();
    this.music = new MusicEngine(this.audio);
    this.physics = new PhysicsEngine();
    this.roadGen = new RoadGenerator();
    this.sceneryGen = new SceneryGenerator();
    this.osm = new OsmService();

    // 2. Control states
    this.keys = {};
    this.unit = 'KM/H'; // 'KM/H' | 'MPH'
    this.lastTime = performance.now();
    this.odometer = 0.0; // cumulative km driven
    this.isMuted = false;

    // 3. Skidmark visual lines
    this.skidlineLeft = null;
    this.skidlineRight = null;
    this.setupSkidmarksLines();

    // 4. Autocomplete debounce timer
    this.searchDebounceTimer = null;

    // 5. Default route load
    this.activeRouteId = 'pch';
    this.loadRoutePreset(this.activeRouteId);

    // 6. Event bindings & UI configuration
    this.bindKeyboardInput();
    this.bindUIEvents();
    
    // Simulate loading progress
    this.simulateLoading();
  }

  /**
   * Creates 3D line meshes for drift skidmarks
   */
  setupSkidmarksLines() {
    const mat = new THREE.LineBasicMaterial({
      color: 0x08080a,
      linewidth: 3,
      transparent: true,
      opacity: 0.8
    });
    
    const geoL = new THREE.BufferGeometry();
    const geoR = new THREE.BufferGeometry();
    
    this.skidlineLeft = new THREE.Line(geoL, mat);
    this.skidlineRight = new THREE.Line(geoR, mat);
    
    this.graphics.scene.add(this.skidlineLeft);
    this.graphics.scene.add(this.skidlineRight);
  }

  /**
   * Updates skidmark line vertices based on physics data
   */
  updateSkidmarks() {
    const points = this.physics.getTireSkidPoints();
    
    // Render Left skid
    const ptsL = this.physics.skidmarkLeft.filter(p => p !== null);
    if (ptsL.length > 1) {
      const positions = [];
      ptsL.forEach(p => positions.push(p.x, p.y + 0.015, p.z)); // offset vertically to prevent z-fighting
      this.skidlineLeft.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      this.skidlineLeft.geometry.computeBoundingBox();
      this.skidlineLeft.geometry.computeBoundingSphere();
    }
    
    // Render Right skid
    const ptsR = this.physics.skidmarkRight.filter(p => p !== null);
    if (ptsR.length > 1) {
      const positions = [];
      ptsR.forEach(p => positions.push(p.x, p.y + 0.015, p.z));
      this.skidlineRight.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      this.skidlineRight.geometry.computeBoundingBox();
      this.skidlineRight.geometry.computeBoundingSphere();
    }
  }

  /**
   * Simulated loader sequencing
   */
  simulateLoading() {
    const bar = document.getElementById('loading-progress');
    const status = document.getElementById('loading-status');
    const startBtn = document.getElementById('start-btn');
    
    let progress = 0;
    const stages = [
      'Assembling carbon chassis...',
      'Tuning engine cylinders...',
      'Building 3D coastal roads...',
      'Calibrating underglow neons...',
      'Starting radio receivers...',
      'Vibe system online.'
    ];

    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 8) + 4;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        status.innerText = stages[stages.length - 1];
        startBtn.disabled = false;


      } else {
        const stageIdx = Math.floor((progress / 100) * (stages.length - 1));
        status.innerText = stages[stageIdx];
      }
      bar.style.width = `${progress}%`;
    }, 80);
  }

  /**
   * Boots up simulated engines, plays audio and begins loop
   */
  startSimulation() {
    // A. Init Web Audio contexts
    this.audio.init();
    this.music.init(this.audio.ctx, this.audio.masterGain);

    // B. Reconstruct 3D Car model in the scene
    const initialModel = document.querySelector('.model-btn.active').dataset.model;
    const initialPaint = document.querySelector('.color-chip.active').dataset.color;
    const initialNeon = document.querySelector('.neon-btn.active').dataset.neon;
    this.carModelMesh = this.physics.createCarModel(initialModel, initialPaint, initialNeon);
    this.graphics.scene.add(this.carModelMesh);
    
    // Position/rotate car at the start of the spline route path
    this.resetCarToStart(this.physics.roadCurve);

    // C. Dismiss loading overlay
    document.getElementById('loading-overlay').classList.remove('visible');

    // D. Start main game loop animation frame
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop.bind(this));
  }

  /**
   * Keyboard state mappings
   */
  bindKeyboardInput() {
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      this.keys[key] = true;

      // Prevent scrolling page with arrow keys or spacebar
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key)) {
        e.preventDefault();
      }

      // Camera switch hotkey 'C'
      if (key === 'c') {
        this.cycleCamera();
      }

      // Autopilot cruise hotkey 'V'
      if (key === 'v') {
        const cruiseToggle = document.getElementById('cruise-toggle');
        cruiseToggle.checked = !cruiseToggle.checked;
        this.physics.cruiseEnabled = cruiseToggle.checked;
      }

      // Shift Up (manual gear)
      if (e.key === 'Shift') {
        if (!this.physics.isAutomatic && this.physics.gear < 6) {
          this.physics.gearShift(this.physics.gear + 1);
        }
      }

      // Shift Down (manual gear)
      if (e.key === 'Control') {
        if (!this.physics.isAutomatic && this.physics.gear > -1) {
          this.physics.gearShift(this.physics.gear - 1);
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      this.keys[key] = false;
    });
  }

  /**
   * HUD DOM Event bindings
   */
  bindUIEvents() {
    // START ENGINE
    document.getElementById('start-btn').addEventListener('click', () => {
      this.startSimulation();
    });

    // Panel tabs switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        btn.classList.add('active');
        document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
      });
    });

    // Time Slider
    const timeSlider = document.getElementById('time-slider');
    const timeDisplay = document.getElementById('time-display');
    timeSlider.addEventListener('input', () => {
      const t = parseFloat(timeSlider.value);
      this.graphics.setTime(t);
      
      // Update label string
      let label = 'Day';
      if (t >= 5 && t < 7) label = 'Dawn';
      if (t >= 7 && t < 17) label = 'Day';
      if (t >= 17 && t < 19.5) label = 'Sunset';
      if (t >= 19.5 && t < 21) label = 'Twilight';
      if (t < 5 || t >= 21) label = 'Night';

      const hr = Math.floor(t);
      const min = Math.floor((t - hr) * 60).toString().padStart(2, '0');
      timeDisplay.innerText = `${hr}:${min} (${label})`;
    });

    // Weather presets selector
    document.querySelectorAll('.weather-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.weather-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.graphics.setWeather(btn.dataset.weather);
      });
    });

    // Audio Mixer sliders
    document.getElementById('engine-vol-slider').addEventListener('input', (e) => {
      this.audio.setEngineVolume(e.target.value);
    });

    document.getElementById('env-vol-slider').addEventListener('input', (e) => {
      this.audio.setEnvVolume(e.target.value);
    });

    // Mute button
    const muteBtn = document.getElementById('mute-btn');
    const soundOnIcon = document.getElementById('sound-on-icon');
    const soundOffIcon = document.getElementById('sound-off-icon');
    muteBtn.addEventListener('click', () => {
      this.isMuted = !this.isMuted;
      this.audio.setMute(this.isMuted);
      this.music.setVolume(this.isMuted ? 0 : document.getElementById('volume-slider').value);
      
      if (this.isMuted) {
        soundOnIcon.classList.add('hidden');
        soundOffIcon.classList.remove('hidden');
      } else {
        soundOnIcon.classList.remove('hidden');
        soundOffIcon.classList.add('hidden');
      }
    });

    // Media Volume
    document.getElementById('volume-slider').addEventListener('input', (e) => {
      if (!this.isMuted) {
        this.music.setVolume(e.target.value);
      }
    });

    // Radio stations selection
    document.querySelectorAll('.station-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.station-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.music.setStation(btn.dataset.station);
      });
    });

    // Radio Controls Play/Pause
    const playBtn = document.getElementById('play-btn');
    const playIcon = document.getElementById('play-icon');
    const pauseIcon = document.getElementById('pause-icon');
    
    playBtn.addEventListener('click', () => {
      const isPlaying = playBtn.classList.toggle('active');
      if (isPlaying) {
        playIcon.classList.add('hidden');
        pauseIcon.classList.remove('hidden');
        this.music.play();
      } else {
        playIcon.classList.remove('hidden');
        pauseIcon.classList.add('hidden');
        this.music.pause();
      }
    });

    // Next / Prev station selectors
    document.getElementById('next-track-btn').addEventListener('click', () => this.cycleRadioStation(1));
    document.getElementById('prev-track-btn').addEventListener('click', () => this.cycleRadioStation(-1));

    // Vehicle customizer model selector
    document.querySelectorAll('.model-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.model-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.rebuildCar();
      });
    });

    // Paint chips color selector
    document.querySelectorAll('.color-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.color-chip').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        this.rebuildCar();
      });
    });

    // Custom Color Picker input
    const customPaint = document.getElementById('paint-color-custom');
    customPaint.addEventListener('input', () => {
      // Remove preset chip highlight
      document.querySelectorAll('.color-chip').forEach(c => c.classList.remove('active'));
      this.rebuildCar();
    });

    // Neon underglow customizer
    document.querySelectorAll('.neon-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.neon-btn').forEach(n => n.classList.remove('active'));
        btn.classList.add('active');
        this.rebuildCar();
      });
    });

    // Handling Toggles: Drivetrain transmission & drift assist
    document.getElementById('transmission-toggle').addEventListener('change', (e) => {
      this.physics.isAutomatic = e.target.checked;
    });

    document.getElementById('drift-assist-toggle').addEventListener('change', (e) => {
      this.physics.driftAssist = e.target.checked;
    });

    // Featured Preset Route cards selection
    document.querySelectorAll('.route-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.route-card').forEach(rc => rc.classList.remove('active'));
        card.classList.add('active');
        this.loadRoutePreset(card.dataset.routePreset);
      });
    });

    // Auto-Cruise pilot toggle
    document.getElementById('cruise-toggle').addEventListener('change', (e) => {
      this.physics.cruiseEnabled = e.target.checked;
    });

    // Camera hotkeys toggles
    document.getElementById('cam-chase-btn').addEventListener('click', () => this.setCamera('chase'));
    document.getElementById('cam-dash-btn').addEventListener('click', () => this.setCamera('dash'));
    document.getElementById('cam-vibe-btn').addEventListener('click', () => this.setCamera('vibe'));

    // Speed unit toggle button
    const speedUnitToggle = document.getElementById('unit-toggle-btn');
    speedUnitToggle.addEventListener('click', () => {
      this.unit = this.unit === 'KM/H' ? 'MPH' : 'KM/H';
      speedUnitToggle.innerText = this.unit;
    });

    // OSM Travel Search autocomplete
    const searchInput = document.getElementById('destination-search');
    const searchClear = document.getElementById('search-clear-btn');
    const dropdown = document.getElementById('search-results-dropdown');

    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim();
      
      if (q.length > 0) {
        searchClear.classList.remove('hidden');
        dropdown.classList.remove('hidden');
        this.debounceLocationSearch(q);
      } else {
        searchClear.classList.add('hidden');
        dropdown.classList.add('hidden');
      }
    });

    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      searchClear.classList.add('hidden');
      dropdown.classList.add('hidden');
    });

    // Hide dropdown if clicked outside
    document.addEventListener('click', (e) => {
      if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.add('hidden');
      }
    });
  }

  /**
   * Cycle station helper (Next / Prev)
   */
  cycleRadioStation(dir) {
    const keys = Object.keys(this.music.stations);
    let idx = keys.indexOf(this.music.activeStation);
    idx = (idx + dir + keys.length) % keys.length;
    
    const newStationKey = keys[idx];
    
    // Update active visual button
    document.querySelectorAll('.station-btn').forEach(btn => {
      if (btn.dataset.station === newStationKey) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    this.music.setStation(newStationKey);
  }

  /**
   * Camera modes selection helper
   */
  setCamera(mode) {
    this.graphics.activeCameraMode = mode;
    document.querySelectorAll('.cam-btn').forEach(btn => btn.classList.remove('active'));
    
    if (mode === 'chase') document.getElementById('cam-chase-btn').classList.add('active');
    if (mode === 'dash') document.getElementById('cam-dash-btn').classList.add('active');
    if (mode === 'vibe') document.getElementById('cam-vibe-btn').classList.add('active');
  }

  cycleCamera() {
    const modes = ['chase', 'dash', 'vibe'];
    let idx = modes.indexOf(this.graphics.activeCameraMode);
    idx = (idx + 1) % modes.length;
    this.setCamera(modes[idx]);
  }

  /**
   * Rebuilds the car model with updated selections from garage
   */
  rebuildCar() {
    if (!this.carModelMesh) return;
    
    const activeModel = document.querySelector('.model-btn.active').dataset.model;
    
    // Find active color (either custom picker or color chips preset)
    const activePreset = document.querySelector('.color-chip.active');
    const paintColor = activePreset ? activePreset.dataset.color : document.getElementById('paint-color-custom').value;
    
    const activeNeon = document.querySelector('.neon-btn.active').dataset.neon;

    // Optimize: if same chassis model, update paint and underglow in-place
    if (this.physics.currentModelType === activeModel) {
      this.physics.updateCarPaint(paintColor);
      this.physics.updateCarNeon(activeNeon);
      return;
    }

    // Retain current position/rotation vectors
    const pos = this.carModelMesh.position.clone();
    const rotY = this.physics.yaw;

    this.graphics.scene.remove(this.carModelMesh);
    
    this.carModelMesh = this.physics.createCarModel(activeModel, paintColor, activeNeon);
    this.carModelMesh.position.copy(pos);
    this.physics.yaw = rotY;
    this.carModelMesh.rotation.y = rotY;

    this.graphics.scene.add(this.carModelMesh);
  }

  /**
   * Decouples road spline reconstruction and biomes generation
   * @param {string} presetId 
   */
  loadRoutePreset(presetId) {
    const route = this.roadGen.getPresetRoute(presetId);
    
    // Clear old visual skid line points
    this.physics.skidmarkLeft = [];
    this.physics.skidmarkRight = [];

    // 1. Build three curve spline path
    const curvePoints = route.points;
    const curve = new THREE.CatmullRomCurve3(curvePoints);
    curve.curveType = 'catmullrom';
    
    // Wire reference inside physics to track heights
    this.physics.roadCurve = curve;
    this.physics.uProgress = 0.0;
    
    // 2. Build road mesh geometry
    if (this.roadMeshNode) {
      this.graphics.scene.remove(this.roadMeshNode);
    }
    this.roadMeshNode = this.roadGen.createRoadMesh(curve);
    this.graphics.scene.add(this.roadMeshNode);

    // 3. Build flora landscape scenery
    this.sceneryGen.generateScenery(this.graphics.scene, curve, route.biome);

    // 4. Reset car telemetry to spline start
    this.resetCarToStart(curve);

    // 5. Apply environment styles
    this.applyBiomeDefaults(route.biome);

    // 6. Update Status Overlay
    document.getElementById('status-text').innerText = `OFFLINE PRESET: ${route.name.toUpperCase()}`;
  }

  /**
   * Resets car position and velocity vectors back to road start point
   * @param {THREE.CatmullRomCurve3} curve 
   */
  resetCarToStart(curve) {
    if (!this.carModelMesh) return;
    
    const startPoint = curve.getPointAt(0);
    const forwardTangent = curve.getTangentAt(0).normalize();
    
    // Align car yaw along spline tangent forward direction
    const yaw = Math.atan2(-forwardTangent.x, -forwardTangent.z);
    
    this.physics.speed = 0;
    this.physics.velocity.set(0, 0, 0);
    this.physics.yaw = yaw;
    this.physics.gear = 1;
    this.physics.rpm = this.physics.idleRpm;

    this.carModelMesh.position.copy(startPoint);
    this.carModelMesh.rotation.set(0, yaw, 0);
    
    // Teleport camera instantly to prevent massive spring lerp jumps
    this.graphics.updateCamera(this.carModelMesh, this.physics.velocity);
  }

  /**
   * Configures environmental defaults based on biome presets
   */
  applyBiomeDefaults(biome) {
    const timeSlider = document.getElementById('time-slider');
    
    if (biome === 'tokyo') {
      // Midnight cruise preset
      timeSlider.value = 23.5; // 23:30 Night
      this.graphics.setWeather('clear');
      document.querySelector('[data-weather="clear"]').classList.add('active');
    } else if (biome === 'coastal') {
      // Golden hour sunset preset
      timeSlider.value = 17.6; // Sunset
      this.graphics.setWeather('clear');
    } else if (biome === 'alpine') {
      // Overcast / foggy scenic pass
      timeSlider.value = 14.0; // Day
      this.graphics.setWeather('fog');
      document.querySelectorAll('.weather-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.weather === 'fog');
      });
    } else if (biome === 'desert') {
      // Sunny midday desert highway
      timeSlider.value = 12.0; // Midday
      this.graphics.setWeather('clear');
      document.querySelectorAll('.weather-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.weather === 'clear');
      });
    }

    // Trigger input update
    timeSlider.dispatchEvent(new Event('input'));
  }

  /**
   * Debounces Nominatim searches to conserve network queries
   */
  debounceLocationSearch(q) {
    if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);
    
    this.searchDebounceTimer = setTimeout(async () => {
      const dropdown = document.getElementById('search-results-dropdown');
      dropdown.innerHTML = `<div class="search-item status">Searching locations...</div>`;
      
      const results = await this.osm.searchLocation(q);
      
      if (results.length === 0) {
        dropdown.innerHTML = `<div class="search-item status">No locations found.</div>`;
        return;
      }

      dropdown.innerHTML = '';
      results.forEach(item => {
        const row = document.createElement('div');
        row.className = 'search-item';
        
        // Extract a clean primary name and details sub-string
        const parts = item.name.split(',');
        const primary = parts[0].trim();
        const details = parts.slice(1).slice(0, 3).join(',').trim();

        row.innerHTML = `
          <span class="main-name">${primary}</span>
          <span class="details">${details}</span>
        `;

        row.addEventListener('click', () => {
          dropdown.classList.add('hidden');
          document.getElementById('destination-search').value = primary;
          this.travelToLocation(item.lat, item.lon, primary);
        });

        dropdown.appendChild(row);
      });
    }, 450); // 450ms debounce
  }

  /**
   * Triggers OSM Overpass API call to load a custom real world road path
   */
  async travelToLocation(lat, lon, label) {
    const statusPill = document.querySelector('.status-pill');
    const indicator = statusPill.querySelector('.indicator');
    const statusText = document.getElementById('status-text');

    statusText.innerText = `LOADING: ${label.toUpperCase()}`;
    indicator.className = 'indicator'; // remove glowing anim

    try {
      const data = await this.osm.fetchRoadPath(lat, lon);
      
      // Group points as 3D vector array
      const curvePoints = data.points.map(p => new THREE.Vector3(p.x, 0, p.z));
      const curve = new THREE.CatmullRomCurve3(curvePoints);
      
      // Wire reference
      this.physics.roadCurve = curve;
      this.physics.uProgress = 0.0;

      // Build road mesh
      if (this.roadMeshNode) this.graphics.scene.remove(this.roadMeshNode);
      this.roadMeshNode = this.roadGen.createRoadMesh(curve);
      this.graphics.scene.add(this.roadMeshNode);

      // Determine appropriate scenery biome
      let customBiome = 'coastal';
      const labelLower = label.toLowerCase();
      if (labelLower.includes('mountain') || labelLower.includes('alps') || labelLower.includes('pass') || labelLower.includes('valley')) {
        customBiome = 'alpine';
      } else if (labelLower.includes('desert') || labelLower.includes('canyon') || labelLower.includes('dunes') || labelLower.includes('valley')) {
        customBiome = 'desert';
      } else if (labelLower.includes('city') || labelLower.includes('tokyo') || labelLower.includes('highway') || labelLower.includes('paris') || labelLower.includes('road')) {
        customBiome = 'tokyo';
      }

      this.sceneryGen.generateScenery(this.graphics.scene, curve, customBiome);
      this.resetCarToStart(curve);
      this.applyBiomeDefaults(customBiome);

      statusText.innerText = `GPS PATH: ${data.name.toUpperCase()}`;
      indicator.className = 'indicator pulsing';
      
    } catch (err) {
      console.warn(err);
      statusText.innerText = 'GPS OFFLINE - PROCEDURAL ROAD';
      indicator.className = 'indicator error';
    }
  }

  /**
   * Draws a schematic 2D layout map on the dashboard GPS minimap
   */
  drawGPSMinimap() {
    const canvas = document.getElementById('minimap-canvas');
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    
    ctx.clearRect(0, 0, w, h);

    if (!this.physics.roadCurve) return;

    const curve = this.physics.roadCurve;
    const points = curve.getSpacedPoints(80); // sample path points

    // Translate relative to active car position
    const carPos = this.carModelMesh.position;
    const scale = 0.45; // zoom scale factor

    ctx.save();
    ctx.translate(w/2, h/2); // translate canvas origin to center (car pointer location)
    
    // Rotate map opposite to car heading so "Forward" is always UP on GPS screen
    ctx.rotate(this.physics.yaw);

    // A. Draw road path line
    ctx.beginPath();
    points.forEach((p, idx) => {
      // Calculate local meters relative to car position
      const lx = (p.x - carPos.x) * scale;
      const lz = (p.z - carPos.z) * scale;
      
      if (idx === 0) {
        ctx.moveTo(lx, lz);
      } else {
        ctx.lineTo(lx, lz);
      }
    });

    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 6;
    ctx.stroke();

    ctx.strokeStyle = '#00f3ff'; // neon cyan pathway
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.restore();

    // B. Draw stationary Car Pointer (always centered pointing UP)
    ctx.save();
    ctx.translate(w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(5, 5);
    ctx.lineTo(0, 2);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fillStyle = '#ff007f'; // neon pink pointer arrow
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#ff007f';
    ctx.fill();
    ctx.restore();
  }

  /**
   * Syncs telemetry properties to linear gauges and cluster nodes
   */
  updateTelemetryHUD(dt) {
    const speed = Math.abs(this.physics.speed);
    
    // Odometer updates
    const kmPerFrame = (speed / 3600) * dt;
    this.odometer += kmPerFrame;

    // A. Digital Speedometer digits
    let displaySpeed = Math.round(speed);
    if (this.unit === 'MPH') displaySpeed = Math.round(speed * 0.621371);
    document.getElementById('speed-indicator').innerText = displaySpeed;

    // B. Gear Character
    let gearText = this.physics.gear.toString();
    if (this.physics.gear === 0) gearText = 'N';
    if (this.physics.gear === -1) gearText = 'R';
    document.getElementById('gear-indicator').innerText = gearText;

    // C. Digital Odometer label
    document.getElementById('odometer-indicator').innerText = `${this.odometer.toFixed(1)} ${this.unit.split('/')[0].toLowerCase()}`;

    // D. Tachometer RPM dial sweep (uses SVG Dashoffset)
    const rpm = this.physics.rpm;
    document.getElementById('rpm-text-val').innerText = Math.round(rpm);
    
    const rpmBar = document.getElementById('rpm-bar');
    const maxDashoffset = 260; // fully empty
    const minDashoffset = 0;   // fully glowing
    const rpmPercentage = (rpm - this.physics.idleRpm) / (this.physics.redlineRpm - this.physics.idleRpm);
    const newOffset = maxDashoffset - (rpmPercentage * maxDashoffset);
    rpmBar.style.strokeDashoffset = Math.max(0, Math.min(260, newOffset));
  }

  /**
   * Main loops tick (called 60 times a second by requestAnimationFrame)
   */
  loop(time) {
    const dt = (time - this.lastTime) / 1000; // delta seconds
    this.lastTime = time;



    // Update active headlights state based on time and weather
    const isDark = this.graphics.currentTime < 6.2 || this.graphics.currentTime > 18.2;
    const isFoggyOrRainy = this.graphics.currentWeather === 'fog' || this.graphics.currentWeather === 'rain';
    this.physics.updateHeadlights(isDark || isFoggyOrRainy);

    // 1. Solve car movements physics forces
    this.physics.update(this.keys, dt);

    // 2. Sync Web Audio frequencies
    this.audio.updateTelemetry(
      this.physics.rpm, 
      this.physics.throttle || 0.0, 
      Math.abs(this.physics.speed),
      this.graphics.currentWeather
    );

    // 3. Draw radio spectrum visualizer canvas
    if (this.music.synthPlaying || !this.music.audioElement.paused) {
      const visualizerCanvas = document.getElementById('audio-visualizer');
      this.music.drawVisualizer(visualizerCanvas);
    }

    // 4. Update camera spring lag matrices
    this.graphics.updateCamera(this.carModelMesh, this.physics.velocity);

    // 5. Update local streetlight spot illumination mapping
    this.graphics.updateLocalStreetlights(this.carModelMesh.position, this.sceneryGen.streetlightPositions);

    // 6. Rain system movements
    if (this.graphics.currentWeather === 'rain') {
      this.graphics.updateRain(this.carModelMesh.position);
    }

    // 7. Render skidmarks tracks when drifting
    this.updateSkidmarks();

    // 8. Re-draw GPS track map orientation
    this.drawGPSMinimap();

    // 9. Sync HUD Telemetry dials
    this.updateTelemetryHUD(dt);

    // 10. WebGL Draw Call
    this.graphics.render();

    // Loop
    requestAnimationFrame(this.loop.bind(this));
  }
}

// Instantiate on load
window.addEventListener('DOMContentLoaded', () => {
  new Application();
});
