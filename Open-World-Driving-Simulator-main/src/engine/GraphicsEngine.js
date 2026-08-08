import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

/**
 * GraphicsEngine - Manages WebGL context, scene setup, lighting, weather, and camera states.
 */
export class GraphicsEngine {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    
    // 2. Camera Setup (must be before RenderPass initialization)
    this.camera = new THREE.PerspectiveCamera(60, this.container.clientWidth / this.container.clientHeight, 0.02, 1000);
    this.activeCameraMode = 'dash'; // 'chase' | 'dash' | 'vibe'
    
    // Camera-mounted fill light to ensure player's car has highlights from camera view
    this.cameraFillLight = new THREE.DirectionalLight(0xffffff, 0.6);
    this.cameraFillLight.target.position.set(0, 0, -1);
    this.camera.add(this.cameraFillLight);
    this.camera.add(this.cameraFillLight.target);
    
    // 1. Core WebGL Objects
    this.scene = new THREE.Scene();
    this.scene.add(this.camera); // Must add camera to scene for its children to render
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.container.appendChild(this.renderer.domElement);

    // Post-Processing
    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);
    
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      1.2,  // strength
      0.5,  // radius
      0.4   // threshold
    );
    this.composer.addPass(this.bloomPass);
    
    // 3. Lighting System
    this.sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 150;
    
    // Shadow bounds flanking the car
    const d = 40;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);
    this.sunLightDirection = new THREE.Vector3();

    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    this.scene.add(this.hemiLight);

    // 4. Night Streetlight Pooling (reuses spot lights on nearest posts to optimize draw calls)
    this.lightPool = [];
    this.maxPoolLights = 6;
    for (let i = 0; i < this.maxPoolLights; i++) {
      const sp = new THREE.SpotLight(0xffdd66, 0, 30, Math.PI / 3, 0.5, 1.5);
      sp.castShadow = false; // Turn off shadows for local lights to double framerate
      this.scene.add(sp);
      this.lightPool.push(sp);
    }

    // 5. Environmental Elements
    this.currentTime = 17.5; // Start at sunset
    this.currentWeather = 'clear'; // 'clear' | 'overcast' | 'rain' | 'fog'
    this.scene.fog = new THREE.Fog(0x1a1c23, 150, 800);
    
    // Rain Particles
    this.rainParticles = null;
    this.rainCount = 2000;
    this.rainSpeed = 2.5;

    // Star Field for night sky
    this.starField = null;
    this.createStarField();

    // 6. Sky Canvas Texture (gradient sky background)
    this.skyCanvas = document.createElement('canvas');
    this.skyCanvas.width = 1;
    this.skyCanvas.height = 256;
    this.skyCtx = this.skyCanvas.getContext('2d');
    this.skyTexture = new THREE.CanvasTexture(this.skyCanvas);
    this.skyTexture.mapping = THREE.EquirectangularReflectionMapping;
    this.scene.background = this.skyTexture;
    // Commented out to prevent WebGL shader compilation failure on THREE.MeshStandardMaterial/MeshPhysicalMaterial
    // with equirectangular canvas textures in current Three.js version.
    // this.scene.environment = this.skyTexture;


    // Window resize handler
    window.addEventListener('resize', this.onWindowResize.bind(this));
    this.updateSkyAndFog();
  }

  /**
   * Resizes WebGL viewport
   */
  onWindowResize() {
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.composer.setSize(this.container.clientWidth, this.container.clientHeight);
  }

  /**
   * Generates a starry background particle system
   */
  createStarField() {
    const starGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(1500 * 3);
    for (let i = 0; i < 1500 * 3; i += 3) {
      // Spawn stars in a dome around origin
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const dist = 400 + Math.random() * 200; // far away
      
      positions[i] = dist * Math.sin(phi) * Math.cos(theta);
      positions[i+1] = Math.abs(dist * Math.cos(phi)); // top dome only
      positions[i+2] = dist * Math.sin(phi) * Math.sin(theta);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.8,
      transparent: true,
      opacity: 0,
      sizeAttenuation: true
    });
    this.starField = new THREE.Points(starGeo, starMat);
    this.scene.add(this.starField);
  }

  /**
   * Creates rain falling particle system
   */
  createRainSystem() {
    if (this.rainParticles) return;

    const rainGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(this.rainCount * 3);
    const velocities = [];

    for (let i = 0; i < this.rainCount * 3; i += 3) {
      // Spawn in a box centered on the car
      positions[i] = (Math.random() - 0.5) * 80;
      positions[i+1] = Math.random() * 45;
      positions[i+2] = (Math.random() - 0.5) * 80;
      
      velocities.push(-0.2 - Math.random() * 0.3, -1.8 - Math.random() * 1.5, 0); // diagonal fall
    }

    rainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    // Thin line geometry style
    const rainMat = new THREE.PointsMaterial({
      color: 0x8ab6d6,
      size: 0.35,
      transparent: true,
      opacity: 0.4
    });

    this.rainParticles = new THREE.Points(rainGeo, rainMat);
    this.rainParticles.userData = { velocities: velocities };
    this.scene.add(this.rainParticles);
  }

  /**
   * Updates rain positions relative to camera center
   */
  updateRain(carPosition) {
    if (!this.rainParticles) return;
    
    const posAttr = this.rainParticles.geometry.attributes.position;
    const vels = this.rainParticles.userData.velocities;

    for (let i = 0; i < posAttr.count; i++) {
      let x = posAttr.getX(i);
      let y = posAttr.getY(i);
      let z = posAttr.getZ(i);

      // Apply downward velocity
      x += vels[i*3];
      y += vels[i*3+1];
      
      // If rain hits ground, respawn above car
      if (y < carPosition.y - 5) {
        x = carPosition.x + (Math.random() - 0.5) * 80;
        y = carPosition.y + 40;
        z = carPosition.z + (Math.random() - 0.5) * 80;
      }

      posAttr.setXYZ(i, x, y, z);
    }
    posAttr.needsUpdate = true;
  }

  /**
   * Updates Skybox Gradients, Sun Position, Fog Color and stars based on time & weather
   */
  updateSkyAndFog() {
    const time = this.currentTime;
    
    // Curated keyframe-based transition timeline mapping time-of-day (0.0 to 24.0)
    const keyframes = [
      { time: 0.0,  top: '#03030f', bottom: '#080825', sunColor: '#809aff', sunIntensity: 0.35, starOpacity: 0.95 },
      { time: 5.0,  top: '#03030f', bottom: '#080825', sunColor: '#809aff', sunIntensity: 0.35, starOpacity: 0.8 },
      { time: 6.2,  top: '#181f3c', bottom: '#ff7e5f', sunColor: '#ffbb93', sunIntensity: 0.6,  starOpacity: 0.2 },
      { time: 7.5,  top: '#20539c', bottom: '#ffaf87', sunColor: '#ffe4b5', sunIntensity: 1.0,  starOpacity: 0.0 },
      { time: 9.0,  top: '#1d74c0', bottom: '#8ec4eb', sunColor: '#ffffff', sunIntensity: 1.2,  starOpacity: 0.0 },
      { time: 12.0, top: '#0f529a', bottom: '#7eb5e6', sunColor: '#ffffff', sunIntensity: 1.4,  starOpacity: 0.0 },
      { time: 16.5, top: '#1860a4', bottom: '#fbd3a8', sunColor: '#fff2dd', sunIntensity: 1.2,  starOpacity: 0.0 },
      { time: 18.0, top: '#2c1654', bottom: '#ff5e36', sunColor: '#ff7b47', sunIntensity: 0.9,  starOpacity: 0.0 },
      { time: 19.2, top: '#110b29', bottom: '#b83b5e', sunColor: '#a34878', sunIntensity: 0.4,  starOpacity: 0.3 },
      { time: 20.5, top: '#04030f', bottom: '#22123b', sunColor: '#3a4878', sunIntensity: 0.2,  starOpacity: 0.7 },
      { time: 22.0, top: '#03030f', bottom: '#080825', sunColor: '#809aff', sunIntensity: 0.35, starOpacity: 0.9 },
      { time: 24.0, top: '#03030f', bottom: '#080825', sunColor: '#809aff', sunIntensity: 0.35, starOpacity: 0.95 }
    ];

    // Find the current keyframe interval
    let k1 = keyframes[0];
    let k2 = keyframes[keyframes.length - 1];
    for (let i = 0; i < keyframes.length - 1; i++) {
      if (time >= keyframes[i].time && time < keyframes[i + 1].time) {
        k1 = keyframes[i];
        k2 = keyframes[i + 1];
        break;
      }
    }

    const factor = (time - k1.time) / (k2.time - k1.time);
    
    // Interpolate keyframe values
    let topColor = this.lerpHexColors(k1.top, k2.top, factor);
    let bottomColor = this.lerpHexColors(k1.bottom, k2.bottom, factor);
    const sunColor = this.lerpHexColors(k1.sunColor, k2.sunColor, factor);
    let sunIntensity = k1.sunIntensity + (k2.sunIntensity - k1.sunIntensity) * factor;
    let starOpacity = k1.starOpacity + (k2.starOpacity - k1.starOpacity) * factor;

    // Sun/Moon position angles
    const angle = ((time - 6) / 24) * Math.PI * 2;
    const sunY = Math.sin(angle);
    const sunX = Math.cos(angle);
    
    // Position sun or moon. If sun is below horizon, moon rises from the opposite side.
    if (sunY > 0) {
      this.sunLightDirection.set(sunX * 120, sunY * 80, 50);
      this.sunLight.intensity = sunY * sunIntensity;
    } else {
      this.sunLightDirection.set(-sunX * 120, -sunY * 80, -50);
      this.sunLight.intensity = sunIntensity; // Cool blue moonlight
    }
    
    this.sunLight.color.set(sunColor);

    // Weather-scaled color modifiers using scaleColor
    const timeBrightness = THREE.MathUtils.mapLinear(Math.max(-0.2, sunY), -0.2, 1.0, 0.08, 1.0);
    
    let weatherBlendFactor = 0;
    let targetGreyTop = '#606878';
    let targetGreyBottom = '#808ba0';
    
    if (this.currentWeather === 'overcast') {
      weatherBlendFactor = 0.85;
      targetGreyTop = '#505868';
      targetGreyBottom = '#788298';
      sunIntensity *= 0.2;
      starOpacity = 0.0;
    } else if (this.currentWeather === 'rain') {
      weatherBlendFactor = 0.9;
      targetGreyTop = '#303440';
      targetGreyBottom = '#485060';
      sunIntensity *= 0.1;
      starOpacity = 0.0;
    } else if (this.currentWeather === 'fog') {
      weatherBlendFactor = 0.9;
      targetGreyTop = '#707a8c';
      targetGreyBottom = '#909db0';
      sunIntensity *= 0.15;
      starOpacity *= 0.05;
    }

    if (weatherBlendFactor > 0) {
      const scaledGreyTop = this.scaleColor(targetGreyTop, timeBrightness);
      const scaledGreyBottom = this.scaleColor(targetGreyBottom, timeBrightness);
      topColor = this.lerpHexColors(topColor, scaledGreyTop, weatherBlendFactor);
      bottomColor = this.lerpHexColors(bottomColor, scaledGreyBottom, weatherBlendFactor);
    }

    const fogColor = bottomColor;

    // Smooth transition for ambient lights
    const ambientBase = sunY > 0 ? (sunY * 0.4) : 0.45;
    this.hemiLight.intensity = Math.max(0.1, ambientBase) + (this.currentWeather === 'rain' ? 0.05 : 0.15);
    this.hemiLight.color.copy(this.sunLight.color);

    // 2. Draw gradient to sky texture
    const grad = this.skyCtx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, topColor);
    grad.addColorStop(1, bottomColor);
    this.skyCtx.fillStyle = grad;
    this.skyCtx.fillRect(0, 0, 1, 256);
    this.skyTexture.needsUpdate = true;

    // 3. Set Fog & Star opacity
    this.scene.fog.color.set(fogColor);
    this.starField.material.opacity = starOpacity;

    // Configure linear fog boundaries dynamically based on weather
    if (this.currentWeather === 'fog') {
      this.scene.fog.near = 10;
      this.scene.fog.far = 120;
    } else if (this.currentWeather === 'rain') {
      this.scene.fog.near = 50;
      this.scene.fog.far = 400;
    } else if (this.currentWeather === 'overcast') {
      this.scene.fog.near = 100;
      this.scene.fog.far = 600;
    } else { // clear
      this.scene.fog.near = 300;
      this.scene.fog.far = 1600;
    }
  }

  /**
   * Helper to blend hex colors smoothly in JS
   */
  lerpHexColors(color1, color2, percentage) {
    const c1 = parseInt(color1.replace('#', ''), 16);
    const c2 = parseInt(color2.replace('#', ''), 16);

    const r1 = (c1 >> 16) & 255, g1 = (c1 >> 8) & 255, b1 = c1 & 255;
    const r2 = (c2 >> 16) & 255, g2 = (c2 >> 8) & 255, b2 = c2 & 255;

    const r = Math.round(r1 + (r2 - r1) * percentage);
    const g = Math.round(g1 + (g2 - g1) * percentage);
    const b = Math.round(b1 + (b2 - b1) * percentage);

    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }

  /**
   * Scales a hex color by a brightness multiplier factor
   */
  scaleColor(hex, factor) {
    const c = parseInt(hex.replace('#', ''), 16);
    let r = (c >> 16) & 255;
    let g = (c >> 8) & 255;
    let b = c & 255;

    r = Math.round(THREE.MathUtils.clamp(r * factor, 0, 255));
    g = Math.round(THREE.MathUtils.clamp(g * factor, 0, 255));
    b = Math.round(THREE.MathUtils.clamp(b * factor, 0, 255));

    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }

  /**
   * Rotates and places a limited pool of spotlight sources on streetlights near the car
   * @param {THREE.Vector3} carPos 
   * @param {Array} streetlightPositions 
   */
  updateLocalStreetlights(carPos, streetlightPositions) {
    const isNight = this.currentTime < 6.2 || this.currentTime > 18.2;
    
    if (!isNight || streetlightPositions.length === 0) {
      // Turn off all pool lights
      this.lightPool.forEach(light => { light.intensity = 0; });
      return;
    }

    // Sort streetlights by proximity to car position
    const sorted = [...streetlightPositions].map(sl => {
      const dist = carPos.distanceTo(sl.pos);
      return { sl, dist };
    });
    sorted.sort((a, b) => a.dist - b.dist);

    // Apply spotlight sources to nearest nodes
    for (let i = 0; i < this.maxPoolLights; i++) {
      const light = this.lightPool[i];
      if (i < sorted.length && sorted[i].dist < 120) { // light up active range (120 meters)
        const targetPost = sorted[i].sl;
        light.position.copy(targetPost.pos);
        light.target.position.copy(targetPost.pos).add(targetPost.dir.clone().multiplyScalar(5));
        light.target.updateMatrixWorld();
        light.intensity = this.currentWeather === 'fog' ? 6.0 : 4.0; // brighter in fog
      } else {
        light.intensity = 0;
      }
    }
  }

  /**
   * Updates camera position smoothly relative to the player's car
   * @param {THREE.Object3D} car 
   * @param {THREE.Vector3} carVelocity 
   */
  updateCamera(car, carVelocity) {
    const carPos = car.position;
    const carQuat = car.quaternion;

    // Center shadow-casting directional sun/moon light on the car
    if (this.sunLightDirection) {
      this.sunLight.target.position.copy(carPos);
      this.sunLight.position.copy(carPos).add(this.sunLightDirection);
      this.sunLight.target.updateMatrixWorld();
    }

    const back = new THREE.Vector3(0, 0, 1).applyQuaternion(carQuat);
    const up = new THREE.Vector3(0, 1, 0);

    if (this.activeCameraMode === 'chase') {
      // Target camera position: behind and above the car
      const targetCamPos = carPos.clone()
        .addScaledVector(back, 9.5) // distance behind
        .addScaledVector(up, 3.2);   // distance above
      
      // Interpolate position smoothly to simulate spring/lag
      this.camera.position.lerp(targetCamPos, 0.08);

      // Camera looks slightly ahead of the car's hood
      const lookTarget = carPos.clone().addScaledVector(new THREE.Vector3(0, 0, -1).applyQuaternion(carQuat), 5);
      lookTarget.y += 0.8;
      
      this.camera.lookAt(lookTarget);
      
    } else if (this.activeCameraMode === 'dash') {
      const modelType = (car.userData && car.userData.modelType) ? car.userData.modelType : 'retro';
      const isLHD = true; // Left Hand Drive
      const seatX = isLHD ? 0.35 : -0.35;
      
      let camY = 1.05;
      let camZ = 0.52;
      let lookY = 0.82;

      if (modelType === 'jdm') {
        camY = 0.98;
        camZ = 0.48;
        lookY = 0.78;
      } else if (modelType === 'vintage') {
        camY = 0.94;
        camZ = 0.42;
        lookY = 0.74;
      } else if (modelType === 'hyper') {
        camY = 0.88;
        camZ = 0.38;
        lookY = 0.68;
      }

      const interiorOffset = new THREE.Vector3(seatX, camY, camZ).applyQuaternion(carQuat);
      this.camera.position.copy(carPos).add(interiorOffset);

      // Looking slightly down and ahead through the windshield
      const lookOffset = new THREE.Vector3(0, lookY, -20).applyQuaternion(carQuat);
      this.camera.lookAt(carPos.clone().add(lookOffset));

    } else if (this.activeCameraMode === 'vibe') {
      // Cinematic slow drone orbit
      const time = performance.now() * 0.0003;
      const radius = 13.0 + Math.sin(time * 0.5) * 3.0; // breathing radius
      
      const targetCamPos = new THREE.Vector3(
        carPos.x + Math.sin(time) * radius,
        carPos.y + 4.0 + Math.cos(time * 0.4) * 2.0, // vertical float
        carPos.z + Math.cos(time) * radius
      );
      
      this.camera.position.lerp(targetCamPos, 0.04);
      this.camera.lookAt(carPos.clone().add(new THREE.Vector3(0, 0.5, 0)));
    }
  }

  /**
   * Sets weather mode
   * @param {string} mode 'clear' | 'overcast' | 'rain' | 'fog'
   */
  setWeather(mode) {
    this.currentWeather = mode;
    
    // Manage rain system loading
    if (mode === 'rain') {
      this.createRainSystem();
      if (this.rainParticles) this.rainParticles.visible = true;
      document.getElementById('raindrops-layer').style.opacity = '0.4'; // HTML overlay
    } else {
      if (this.rainParticles) this.rainParticles.visible = false;
      document.getElementById('raindrops-layer').style.opacity = '0';
    }

    this.updateSkyAndFog();
  }

  /**
   * Sets time of day (0.0 to 24.0)
   * @param {number} t 
   */
  setTime(t) {
    this.currentTime = t;
    this.updateSkyAndFog();
  }

  /**
   * Main render loop draw call
   */
  render() {
    this.composer.render();
  }
}
export default GraphicsEngine;
