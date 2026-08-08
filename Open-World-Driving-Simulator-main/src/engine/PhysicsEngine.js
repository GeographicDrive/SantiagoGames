import * as THREE from 'three';

/**
 * PhysicsEngine - Handles car physics, automatic/manual gearbox, drifting, 
 * autopilot (Auto-Cruise), and procedural vehicle mesh generation.
 */
export class PhysicsEngine {
  constructor() {
    // Car Physical Parameters
    this.speed = 0; // km/h
    this.velocity = new THREE.Vector3();
    this.yaw = 0; // orientation angle
    this.steerAngle = 0;
    this.rpm = 800; // Idle
    this.gear = 1; // 1-6, 0=N, -1=R
    this.isAutomatic = true;
    this.driftAssist = true;

    // Gear ratios
    this.gearRatios = {
      '-1': 3.5, // Reverse
      '1': 3.2,
      '2': 2.1,
      '3': 1.5,
      '4': 1.15,
      '5': 0.9,
      '6': 0.72
    };

    // Engine specs
    this.idleRpm = 800;
    this.redlineRpm = 7200;
    this.maxSpeed = 220; // km/h
    
    // Drift state
    this.isDrifting = false;
    this.driftAngle = 0;
    this.driftScore = 0;
    
    // Auto-Cruise state
    this.cruiseEnabled = false;
    this.targetCruiseSpeed = 80; // km/h

    // Gear shift lock-out timer
    this.shiftTimer = 0;
    
    // Mesh parameters
    this.carGroup = new THREE.Group();
    this.carBodyMat = null;
    this.neonLight = null;
    this.interiorNeonStrip = null;
    this.doorNeonStripL = null;
    this.doorNeonStripR = null;
    this.speedNeedle = null;
    this.rpmNeedle = null;
    this.brakeLights = [];
    this.headlights = [];
    this.headlightVisuals = [];
    
    // Tire track ribbons variables
    this.skidmarkLeft = [];
    this.skidmarkRight = [];
    this.maxSkidmarkPoints = 300;
    
    // Current road spline reference
    this.roadCurve = null;
    this.uProgress = 0.0; // distance progress along spline (0.0 to 1.0)
    
    // Model state tracking
    this.currentModelType = 'retro';
  }

  /**
   * Generates a 3D Car Model mesh procedurally using Three.js primitives
   * @param {string} modelType 'retro' | 'jdm' | 'vintage' | 'hyper'
   * @param {string} paintColor Hex color string
   * @param {string} underglowColor 'off' | 'cyan' | 'pink' | 'green' | 'purple'
   */
  createCarModel(modelType, paintColor, underglowColor) {
    // Clear old car meshes
    while (this.carGroup.children.length > 0) {
      this.carGroup.remove(this.carGroup.children[0]);
    }

    this.speedNeedle = null;
    this.rpmNeedle = null;
    this.doorNeonStripL = null;
    this.doorNeonStripR = null;
    this.interiorNeonStrip = null;

    // Material configuration
    this.carBodyMat = new THREE.MeshPhysicalMaterial({
      color: paintColor,
      roughness: 0.15,
      metalness: 0.5,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02
    });
    
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x112233,
      roughness: 0.05,
      metalness: 0.1,
      transparent: true,
      opacity: 0.18, // sleeker, premium window glass for interior visibility
      clearcoat: 1.0,
      clearcoatRoughness: 0.02
    });

    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xddeee8, roughness: 0.1, metalness: 0.9 });
    const lightMatActive = new THREE.MeshBasicMaterial({ color: 0xffffff }); // glowing head
    const brakeMatActive = new THREE.MeshBasicMaterial({ color: 0x8b0000 }); // dull red taillight

    // Base chassis size
    let w = 2.0, h = 0.8, l = 4.4;
    this.brakeLights = [];
    this.headlightVisuals = [];

    // --- Procedural Mesh Assembly ---
    if (modelType === 'retro') { // Interceptor Muscle Coupe (Boxy, dual lights)
      // Split Chassis: Rear body and lower front hood
      const rearBody = new THREE.Mesh(new THREE.BoxGeometry(w, 0.7, 2.4), this.carBodyMat);
      rearBody.position.set(0, 0.55, 1.0);
      rearBody.castShadow = true;
      rearBody.receiveShadow = true;
      this.carGroup.add(rearBody);

      const frontHood = new THREE.Mesh(new THREE.BoxGeometry(w, 0.58, 2.0), this.carBodyMat);
      frontHood.position.set(0, 0.49, -1.2);
      frontHood.castShadow = true;
      frontHood.receiveShadow = true;
      this.carGroup.add(frontHood);

      // Supercharger Hood Scoop (Black muscle accent)
      const scoopMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.7 });
      const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.65), scoopMat);
      scoop.position.set(0, 0.82, -1.0);
      scoop.castShadow = true;
      this.carGroup.add(scoop);

      // Cabin roof glass (castShadow = false to prevent pitch black cockpit)
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.5, l * 0.45), glassMat);
      cabin.position.set(0, 1.1, 0.2); // shifted slightly back
      cabin.castShadow = false;
      this.carGroup.add(cabin);

      // A-Pillars & Roof Frame for Retro Model
      const pillarL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.58, 0.06), this.carBodyMat);
      pillarL.position.set(-w * 0.44, 1.1, -0.645);
      pillarL.rotation.x = -0.52;
      pillarL.castShadow = true;
      
      const pillarR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.58, 0.06), this.carBodyMat);
      pillarR.position.set(w * 0.44, 1.1, -0.645);
      pillarR.rotation.x = -0.52;
      pillarR.castShadow = true;

      const header = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.05, 0.06), this.carBodyMat);
      header.position.set(0, 1.33, -0.5);
      header.castShadow = true;

      const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.03, l * 0.3), this.carBodyMat);
      roof.position.set(0, 1.35, 0.25);
      roof.castShadow = true;

      const sideRailL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, l * 0.3), this.carBodyMat);
      sideRailL.position.set(-w * 0.44, 1.35, 0.25);
      sideRailL.castShadow = true;

      const sideRailR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, l * 0.3), this.carBodyMat);
      sideRailR.position.set(w * 0.44, 1.35, 0.25);
      sideRailR.castShadow = true;

      const cPillarL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.58, 0.15), this.carBodyMat);
      cPillarL.position.set(-w * 0.44, 1.1, 1.045);
      cPillarL.rotation.x = 0.52;
      cPillarL.castShadow = true;

      const cPillarR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.58, 0.15), this.carBodyMat);
      cPillarR.position.set(w * 0.44, 1.1, 1.045);
      cPillarR.rotation.x = 0.52;
      cPillarR.castShadow = true;

      this.carGroup.add(pillarL, pillarR, header, roof, sideRailL, sideRailR, cPillarL, cPillarR);

      // Front chrome grill
      const grill = new THREE.Mesh(new THREE.BoxGeometry(w * 0.95, 0.2, 0.1), chromeMat);
      grill.position.set(0, 0.55, -l/2 - 0.02);
      this.carGroup.add(grill);

      // Headlights visual (dual round lights on each side of the grill)
      const headlightL1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.04, 12), new THREE.MeshBasicMaterial({ color: 0x444444 }));
      headlightL1.rotateX(Math.PI / 2);
      headlightL1.position.set(-w * 0.3 - 0.08, 0.55, -l/2 - 0.03);
      const headlightL2 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.04, 12), new THREE.MeshBasicMaterial({ color: 0x444444 }));
      headlightL2.rotateX(Math.PI / 2);
      headlightL2.position.set(-w * 0.3 + 0.08, 0.55, -l/2 - 0.03);
      
      const headlightR1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.04, 12), new THREE.MeshBasicMaterial({ color: 0x444444 }));
      headlightR1.rotateX(Math.PI / 2);
      headlightR1.position.set(w * 0.3 - 0.08, 0.55, -l/2 - 0.03);
      const headlightR2 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.04, 12), new THREE.MeshBasicMaterial({ color: 0x444444 }));
      headlightR2.rotateX(Math.PI / 2);
      headlightR2.position.set(w * 0.3 + 0.08, 0.55, -l/2 - 0.03);

      this.carGroup.add(headlightL1, headlightL2, headlightR1, headlightR2);
      this.headlightVisuals.push(headlightL1, headlightL2, headlightR1, headlightR2);

      // Taillights
      const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.05), brakeMatActive);
      tailL.position.set(-w/2 + 0.3, 0.6, l/2 + 0.01);
      const tailR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.05), brakeMatActive);
      tailR.position.set(w/2 - 0.3, 0.6, l/2 + 0.01);
      this.carGroup.add(tailL);
      this.carGroup.add(tailR);
      this.brakeLights.push(tailL, tailR);

    } else if (modelType === 'jdm') { // Shogun Aero Drift (Spoiler, wedge)
      // Split Chassis: Rear body and sloped front hood
      const rearBody = new THREE.Mesh(new THREE.BoxGeometry(w, 0.65, 2.4), this.carBodyMat);
      rearBody.position.set(0, 0.5, 1.0);
      rearBody.castShadow = true;
      rearBody.receiveShadow = true;
      this.carGroup.add(rearBody);

      const frontHood = new THREE.Mesh(new THREE.BoxGeometry(w, 0.55, 2.0), this.carBodyMat);
      frontHood.position.set(0, 0.45, -1.2);
      frontHood.rotation.x = -0.07; // aerodynamic slope
      frontHood.castShadow = true;
      frontHood.receiveShadow = true;
      this.carGroup.add(frontHood);

      // Black racing front splitter lip
      const splitterMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.8 });
      const splitter = new THREE.Mesh(new THREE.BoxGeometry(w * 1.02, 0.06, 0.3), splitterMat);
      splitter.position.set(0, 0.2, -l/2 - 0.05);
      splitter.castShadow = true;
      this.carGroup.add(splitter);

      // Curved wedge cabin glass (castShadow = false)
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(w * 0.85, 0.5, l * 0.55), glassMat);
      cabin.position.set(0, 1.0, 0.1);
      cabin.castShadow = false;
      this.carGroup.add(cabin);

      // A-Pillars & Roof Frame for JDM Model
      const pillarL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.71, 0.05), this.carBodyMat);
      pillarL.position.set(-w * 0.425, 1.0, -0.855);
      pillarL.rotation.x = -0.8;
      pillarL.castShadow = true;

      const pillarR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.71, 0.05), this.carBodyMat);
      pillarR.position.set(w * 0.425, 1.0, -0.855);
      pillarR.rotation.x = -0.8;
      pillarR.castShadow = true;

      const header = new THREE.Mesh(new THREE.BoxGeometry(w * 0.85, 0.05, 0.05), this.carBodyMat);
      header.position.set(0, 1.23, -0.6);
      header.castShadow = true;

      const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.85, 0.03, l * 0.35), this.carBodyMat);
      roof.position.set(0, 1.25, 0.2);
      roof.castShadow = true;

      const sideRailL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, l * 0.35), this.carBodyMat);
      sideRailL.position.set(-w * 0.425, 1.25, 0.2);
      sideRailL.castShadow = true;

      const sideRailR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, l * 0.35), this.carBodyMat);
      sideRailR.position.set(w * 0.425, 1.25, 0.2);
      sideRailR.castShadow = true;

      const cPillarL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.71, 0.1), this.carBodyMat);
      cPillarL.position.set(-w * 0.425, 1.0, 1.055);
      cPillarL.rotation.x = 0.8;
      cPillarL.castShadow = true;

      const cPillarR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.71, 0.1), this.carBodyMat);
      cPillarR.position.set(w * 0.425, 1.0, 1.055);
      cPillarR.rotation.x = 0.8;
      cPillarR.castShadow = true;

      this.carGroup.add(pillarL, pillarR, header, roof, sideRailL, sideRailR, cPillarL, cPillarR);

      // Sleek modern wedge headlights for JDM (tilted to match hood)
      const headlightL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.08, 0.04), new THREE.MeshBasicMaterial({ color: 0x444444 }));
      headlightL.position.set(-w * 0.35, 0.38, -l/2 - 0.02);
      headlightL.rotation.x = -0.07;
      const headlightR = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.08, 0.04), new THREE.MeshBasicMaterial({ color: 0x444444 }));
      headlightR.position.set(w * 0.35, 0.38, -l/2 - 0.02);
      headlightR.rotation.x = -0.07;
      
      this.carGroup.add(headlightL, headlightR);
      this.headlightVisuals.push(headlightL, headlightR);

      // JDM Spoiler
      const spoilerPoleL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.08), chromeMat);
      spoilerPoleL.position.set(-w/2 + 0.2, 0.95, l/2 - 0.3);
      const spoilerPoleR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.08), chromeMat);
      spoilerPoleR.position.set(w/2 - 0.2, 0.95, l/2 - 0.3);
      const spoilerWing = new THREE.Mesh(new THREE.BoxGeometry(w * 0.95, 0.06, 0.4), this.carBodyMat);
      spoilerWing.position.set(0, 1.15, l/2 - 0.3);
      this.carGroup.add(spoilerPoleL);
      this.carGroup.add(spoilerPoleR);
      this.carGroup.add(spoilerWing);

      // Round taillights
      const tailL = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 8), brakeMatActive);
      tailL.rotateX(Math.PI / 2);
      tailL.position.set(-w/2 + 0.3, 0.5, l/2 + 0.01);
      const tailR = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 8), brakeMatActive);
      tailR.rotateX(Math.PI / 2);
      tailR.position.set(w/2 - 0.3, 0.5, l/2 + 0.01);
      this.carGroup.add(tailL);
      this.carGroup.add(tailR);
      this.brakeLights.push(tailL, tailR);

    } else if (modelType === 'vintage') { // Convertible Roadster (No roof)
      // Split Chassis: Rear body and narrow sloped front hood
      const rearBody = new THREE.Mesh(new THREE.BoxGeometry(w * 0.95, 0.6, 2.4), this.carBodyMat);
      rearBody.position.set(0, 0.5, 1.0);
      rearBody.castShadow = true;
      rearBody.receiveShadow = true;
      this.carGroup.add(rearBody);

      const frontHood = new THREE.Mesh(new THREE.BoxGeometry(w * 0.82, 0.48, 2.0), this.carBodyMat);
      frontHood.position.set(0, 0.44, -1.2);
      frontHood.castShadow = true;
      frontHood.receiveShadow = true;
      this.carGroup.add(frontHood);

      // Retro-curved side fenders flanking the hood
      const fenderL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.54, 2.0), this.carBodyMat);
      fenderL.position.set(-w * 0.43, 0.47, -1.2);
      fenderL.castShadow = true;
      
      const fenderR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.54, 2.0), this.carBodyMat);
      fenderR.position.set(w * 0.43, 0.47, -1.2);
      fenderR.castShadow = true;
      
      this.carGroup.add(fenderL, fenderR);

      // Classic round chrome headlights
      const bezelL = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.02, 8, 24), chromeMat);
      bezelL.position.set(-w * 0.32, 0.58, -l/2 - 0.12);
      const headlightL = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 16), new THREE.MeshBasicMaterial({ color: 0x444444 }));
      headlightL.rotateX(Math.PI / 2);
      headlightL.position.set(-w * 0.32, 0.58, -l/2 - 0.12);
      
      const bezelR = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.02, 8, 24), chromeMat);
      bezelR.position.set(w * 0.32, 0.58, -l/2 - 0.12);
      const headlightR = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 16), new THREE.MeshBasicMaterial({ color: 0x444444 }));
      headlightR.rotateX(Math.PI / 2);
      headlightR.position.set(w * 0.32, 0.58, -l/2 - 0.12);
      
      this.carGroup.add(bezelL, headlightL, bezelR, headlightR);
      this.headlightVisuals.push(headlightL, headlightR);

      // Windshield glass panel (castShadow = false)
      const windshield = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, 0.35, 0.05), glassMat);
      windshield.rotateX(-0.5); // lean windshield
      windshield.position.set(0, 0.95, -0.4);
      windshield.castShadow = false;
      this.carGroup.add(windshield);

      // Classic Chrome windshield frame details
      const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.36, 0.03), chromeMat);
      frameL.position.set(-w * 0.4, 0.95, -0.4);
      frameL.rotation.x = -0.5;
      frameL.castShadow = true;

      const frameR = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.36, 0.03), chromeMat);
      frameR.position.set(w * 0.4, 0.95, -0.4);
      frameR.rotation.x = -0.5;
      frameR.castShadow = true;

      const frameTop = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, 0.03, 0.03), chromeMat);
      frameTop.position.set(0, 1.11, -0.48);
      frameTop.rotation.x = -0.5;
      frameTop.castShadow = true;

      this.carGroup.add(frameL, frameR, frameTop);

      // Dual classic chrome lines
      const stripeL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.02, l * 0.5), chromeMat);
      stripeL.position.set(-0.3, 0.81, -1.0);
      const stripeR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.02, l * 0.5), chromeMat);
      stripeR.position.set(0.3, 0.81, -1.0);
      this.carGroup.add(stripeL);
      this.carGroup.add(stripeR);

      // Taillights
      const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.25, 0.05), brakeMatActive);
      tailL.position.set(-w/2 + 0.3, 0.5, l/2 + 0.01);
      const tailR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.25, 0.05), brakeMatActive);
      tailR.position.set(w/2 - 0.3, 0.5, l/2 + 0.01);
      this.carGroup.add(tailL);
      this.carGroup.add(tailR);
      this.brakeLights.push(tailL, tailR);

    } else if (modelType === 'hyper') { // Volt GT-E (Aerodynamic futuristic)
      // Split Chassis: Rear body and sloped front hood
      const rearBody = new THREE.Mesh(new THREE.BoxGeometry(w * 1.02, 0.52, 2.4), this.carBodyMat);
      rearBody.position.set(0, 0.44, 1.0);
      rearBody.castShadow = true;
      rearBody.receiveShadow = true;
      this.carGroup.add(rearBody);

      const frontHood = new THREE.Mesh(new THREE.BoxGeometry(w * 1.02, 0.4, 2.0), this.carBodyMat);
      frontHood.position.set(0, 0.35, -1.2);
      frontHood.rotation.x = -0.12; // aerodynamic slope nose
      frontHood.castShadow = true;
      frontHood.receiveShadow = true;
      this.carGroup.add(frontHood);

      // Front splitter under sloped nose
      const splitterMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
      const splitter = new THREE.Mesh(new THREE.BoxGeometry(w * 1.04, 0.05, 0.35), splitterMat);
      splitter.position.set(0, 0.16, -l/2 - 0.06);
      splitter.castShadow = true;
      this.carGroup.add(splitter);

      // Low windshield canopy glass (castShadow = false)
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, 0.42, l * 0.65), glassMat);
      cabin.position.set(0, 0.8, -0.1);
      cabin.castShadow = false;
      this.carGroup.add(cabin);

      // A-Pillars & Roof Frame for Hyper model
      const pillarL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.84, 0.04), this.carBodyMat);
      pillarL.position.set(-w * 0.4, 0.8, -1.165);
      pillarL.rotation.x = -1.05;
      pillarL.castShadow = true;

      const pillarR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.84, 0.04), this.carBodyMat);
      pillarR.position.set(w * 0.4, 0.8, -1.165);
      pillarR.rotation.x = -1.05;
      pillarR.castShadow = true;

      const header = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, 0.04, 0.04), this.carBodyMat);
      header.position.set(0, 0.99, -0.8);
      header.castShadow = true;

      const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.75, 0.02, l * 0.35), this.carBodyMat);
      roof.position.set(0, 1.01, -0.05);
      roof.castShadow = true;

      const sideRailL = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, l * 0.35), this.carBodyMat);
      sideRailL.position.set(-w * 0.4, 1.01, -0.05);
      sideRailL.castShadow = true;

      const sideRailR = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, l * 0.35), this.carBodyMat);
      sideRailR.position.set(w * 0.4, 1.01, -0.05);
      sideRailR.castShadow = true;

      const buttressL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.76, 0.08), this.carBodyMat);
      buttressL.position.set(-w * 0.4, 0.8, 1.015);
      buttressL.rotation.x = 1.05;
      buttressL.castShadow = true;

      const buttressR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.76, 0.08), this.carBodyMat);
      buttressR.position.set(w * 0.4, 0.8, 1.015);
      buttressR.rotation.x = 1.05;
      buttressR.castShadow = true;

      this.carGroup.add(pillarL, pillarR, header, roof, sideRailL, sideRailR, buttressL, buttressR);

      // Glowing light strips and front headlights for hyper model (tilted to match nose)
      const lightStripL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.8), new THREE.MeshBasicMaterial({ color: 0x444444 }));
      lightStripL.position.set(-w/2 - 0.01, 0.36, -l/2 + 0.5);
      lightStripL.rotation.x = -0.12;
      const lightStripR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.8), new THREE.MeshBasicMaterial({ color: 0x444444 }));
      lightStripR.position.set(w/2 + 0.01, 0.36, -l/2 + 0.5);
      lightStripR.rotation.x = -0.12;
      
      const frontLightL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.04, 0.05), new THREE.MeshBasicMaterial({ color: 0x444444 }));
      frontLightL.position.set(-w * 0.35, 0.24, -l/2 - 0.01);
      frontLightL.rotation.x = -0.12;
      const frontLightR = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.04, 0.05), new THREE.MeshBasicMaterial({ color: 0x444444 }));
      frontLightR.position.set(w * 0.35, 0.24, -l/2 - 0.01);
      frontLightR.rotation.x = -0.12;

      this.carGroup.add(lightStripL, lightStripR, frontLightL, frontLightR);
      this.headlightVisuals.push(lightStripL, lightStripR, frontLightL, frontLightR);

      // Cyberbar Taillight (Long thin red strip)
      const tailBar = new THREE.Mesh(new THREE.BoxGeometry(w * 0.85, 0.05, 0.05), brakeMatActive);
      tailBar.position.set(0, 0.55, l/2 + 0.01);
      this.carGroup.add(tailBar);
      this.brakeLights.push(tailBar);
    }

    // --- 4 Wheels (Universal) ---
    const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.35, 12);
    wheelGeo.rotateZ(Math.PI / 2);
    
    const wheelOffsets = [
      { x: -w/2 - 0.08, z: -l/2 + 0.8 }, // Front Left
      { x: w/2 + 0.08, z: -l/2 + 0.8 },  // Front Right
      { x: -w/2 - 0.08, z: l/2 - 0.8 },  // Rear Left
      { x: w/2 + 0.08, z: l/2 - 0.8 }    // Rear Right
    ];

    wheelOffsets.forEach(offset => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(offset.x, 0.38, offset.z);
      wheel.castShadow = true;
      this.carGroup.add(wheel);
    });

    // --- 5. Underglow Neon (Universal) ---
    if (underglowColor !== 'off') {
      let colorHex = 0x00f3ff;
      if (underglowColor === 'pink') colorHex = 0xff007f;
      if (underglowColor === 'green') colorHex = 0x39ff14;
      if (underglowColor === 'purple') colorHex = 0xb026ff;

      const neonGeo = new THREE.PlaneGeometry(w * 0.95, l * 0.85);
      neonGeo.rotateX(-Math.PI / 2);
      
      const neonMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.65
      });
      
      this.neonLight = new THREE.Mesh(neonGeo, neonMat);
      this.neonLight.position.set(0, 0.03, 0); // close to floor
      this.carGroup.add(this.neonLight);
    } else {
      this.neonLight = null;
    }

    // --- 6. Immersive Interior Cockpit (Driver's Seat) ---
    const dashMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9, metalness: 0.2 });
    const leatherMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.8, metalness: 0.3 });
    const cherryMat = new THREE.MeshStandardMaterial({ color: 0xd90429, roughness: 0.5, metalness: 0.1 });
    
    // Main Dashboard block
    const dashboard = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.35, 0.4), dashMat);
    dashboard.position.set(0, 0.85, -0.15); // Front of cabin
    dashboard.castShadow = true;
    this.carGroup.add(dashboard);

    // Synced Ambient Interior Dashboard Neon Trim
    let neonColorHex = 0x00f3ff;
    if (underglowColor === 'pink') neonColorHex = 0xff007f;
    if (underglowColor === 'green') neonColorHex = 0x39ff14;
    if (underglowColor === 'purple') neonColorHex = 0xb026ff;

    const interiorNeonMat = new THREE.MeshBasicMaterial({
      color: neonColorHex,
      transparent: true,
      opacity: 0.8
    });
    this.interiorNeonStrip = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.015, 0.015), interiorNeonMat);
    this.interiorNeonStrip.position.set(0, 1.025, 0.04);
    this.interiorNeonStrip.visible = underglowColor !== 'off';
    this.carGroup.add(this.interiorNeonStrip);

    // Side Door Panels
    const leftDoorPanel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.45, 1.4), leatherMat);
    leftDoorPanel.position.set(-w * 0.46, 0.7, 0.3);
    leftDoorPanel.castShadow = true;
    this.carGroup.add(leftDoorPanel);

    const rightDoorPanel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.45, 1.4), leatherMat);
    rightDoorPanel.position.set(w * 0.46, 0.7, 0.3);
    rightDoorPanel.castShadow = true;
    this.carGroup.add(rightDoorPanel);

    // Underglow-synced neon strips on each door panel
    this.doorNeonStripL = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.015, 1.1), interiorNeonMat);
    this.doorNeonStripL.position.set(-w * 0.44, 0.82, 0.3);
    this.doorNeonStripL.visible = underglowColor !== 'off';
    this.carGroup.add(this.doorNeonStripL);

    this.doorNeonStripR = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.015, 1.1), interiorNeonMat);
    this.doorNeonStripR.position.set(w * 0.44, 0.82, 0.3);
    this.doorNeonStripR.visible = underglowColor !== 'off';
    this.carGroup.add(this.doorNeonStripR);

    // Driver & Passenger Sports Bucket Seats with Cherry-Red Stripes
    const seatOffsets = [0.35, -0.35]; // Driver (0.35), Passenger (-0.35)
    seatOffsets.forEach(seatX => {
      // Seat Base
      const seatBase = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.52), leatherMat);
      seatBase.position.set(seatX, 0.52, 0.6);
      seatBase.castShadow = true;
      this.carGroup.add(seatBase);

      // Seat Back
      const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.65, 0.15), leatherMat);
      seatBack.position.set(seatX, 0.88, 0.6 + 0.22);
      seatBack.rotation.x = 0.18;
      seatBack.castShadow = true;
      this.carGroup.add(seatBack);

      // Headrest
      const headrest = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.18, 0.12), leatherMat);
      headrest.position.set(seatX, 1.2, 0.6 + 0.28);
      headrest.rotation.x = 0.18;
      headrest.castShadow = true;
      this.carGroup.add(headrest);

      // Side Bolsters
      const bolsterL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, 0.12), leatherMat);
      bolsterL.position.set(seatX - 0.23, 0.86, 0.6 + 0.2);
      bolsterL.rotation.set(0.18, 0.2, 0);
      bolsterL.castShadow = true;
      this.carGroup.add(bolsterL);

      const bolsterR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, 0.12), leatherMat);
      bolsterR.position.set(seatX + 0.23, 0.86, 0.6 + 0.2);
      bolsterR.rotation.set(0.18, -0.2, 0);
      bolsterR.castShadow = true;
      this.carGroup.add(bolsterR);

      // Cherry-Red Center Stripes
      const stripeBase = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.015, 0.51), cherryMat);
      stripeBase.position.set(seatX, 0.601, 0.6);
      this.carGroup.add(stripeBase);

      const stripeBack = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.64, 0.015), cherryMat);
      stripeBack.position.set(seatX, 0.88, 0.6 + 0.295);
      stripeBack.rotation.x = 0.18;
      this.carGroup.add(stripeBack);
    });
    
    // Center Console
    const centerConsole = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.3, 0.8), dashMat);
    centerConsole.position.set(0, 0.6, 0.3);
    centerConsole.castShadow = true;
    this.carGroup.add(centerConsole);

    // Polished shift gate plate
    const consolePlate = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.01, 0.35), chromeMat);
    consolePlate.position.set(0, 0.751, 0.3);
    this.carGroup.add(consolePlate);

    // Chrome shifter rod
    const shifterRod = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16), chromeMat);
    shifterRod.position.set(0, 0.83, 0.3);
    shifterRod.rotation.x = 0.15;
    shifterRod.castShadow = true;
    this.carGroup.add(shifterRod);

    // Shift Knob
    const shiftKnob = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 12), leatherMat);
    shiftKnob.position.set(0, 0.91, 0.288);
    this.carGroup.add(shiftKnob);

    // Infotainment & Navigation GPS Screen Group
    const infoGroup = new THREE.Group();
    infoGroup.position.set(0, 0.96, -0.04);
    infoGroup.rotation.x = -0.2;
    this.carGroup.add(infoGroup);

    // Screen backing (dark blue)
    const screenBack = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.16), new THREE.MeshBasicMaterial({ color: 0x050818 }));
    infoGroup.add(screenBack);

    // Map Grid Lines
    const gridMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff, transparent: true, opacity: 0.12 });
    // Horizontal lines
    const h1 = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.004), gridMat);
    h1.position.set(0, 0.04, 0.001);
    const h2 = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.004), gridMat);
    h2.position.set(0, -0.04, 0.001);
    // Vertical lines
    const v1 = new THREE.Mesh(new THREE.PlaneGeometry(0.004, 0.16), gridMat);
    v1.position.set(0.07, 0, 0.001);
    const v2 = new THREE.Mesh(new THREE.PlaneGeometry(0.004, 0.16), gridMat);
    v2.position.set(-0.07, 0, 0.001);
    infoGroup.add(h1, h2, v1, v2);

    // GPS Path (Neon green zigzag)
    const pathMat = new THREE.MeshBasicMaterial({ color: 0x39ff14, transparent: true, opacity: 0.8 });
    const seg1 = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.008), pathMat);
    seg1.position.set(-0.05, -0.03, 0.002);
    seg1.rotation.z = 0.5;
    
    const seg2 = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.008), pathMat);
    seg2.position.set(0.04, 0.02, 0.002);
    seg2.rotation.z = -0.4;
    infoGroup.add(seg1, seg2);

    // GPS Arrow (Neon pink cone flat on screen)
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0xff007f });
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.03, 3), arrowMat);
    arrow.position.set(0.0, -0.01, 0.003);
    arrow.rotation.z = 0.5;
    arrow.rotation.x = Math.PI / 2;
    infoGroup.add(arrow);

    // Instrument Cluster & Twin Gauges Group
    const clusterGroup = new THREE.Group();
    clusterGroup.position.set(0.35, 1.0, -0.05);
    clusterGroup.rotation.x = -0.2;
    this.carGroup.add(clusterGroup);

    const clusterBacking = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.05), dashMat);
    clusterGroup.add(clusterBacking);

    // Speedometer Dial
    const speedDialBack = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16), new THREE.MeshBasicMaterial({ color: 0x080808 }));
    speedDialBack.position.set(-0.1, 0, 0.026);
    clusterGroup.add(speedDialBack);

    const speedBezel = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.005, 8, 24), chromeMat);
    speedBezel.position.set(-0.1, 0, 0.027);
    clusterGroup.add(speedBezel);

    // Tachometer Dial
    const rpmDialBack = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16), new THREE.MeshBasicMaterial({ color: 0x080808 }));
    rpmDialBack.position.set(0.1, 0, 0.026);
    clusterGroup.add(rpmDialBack);

    const rpmBezel = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.005, 8, 24), chromeMat);
    rpmBezel.position.set(0.1, 0, 0.027);
    clusterGroup.add(rpmBezel);

    // Ticks for Speed Dial (Cyan)
    const tickMatCyan = new THREE.MeshBasicMaterial({ color: 0x00f3ff, transparent: true, opacity: 0.7 });
    for (let i = 0; i < 7; i++) {
      const tick = new THREE.Mesh(new THREE.PlaneGeometry(0.012, 0.003), tickMatCyan);
      const angle = 2.18 - (i / 6) * 4.36;
      tick.position.set(-0.1 + Math.sin(angle) * 0.048, Math.cos(angle) * 0.048, 0.028);
      tick.rotation.z = -angle;
      clusterGroup.add(tick);
    }

    // Ticks for RPM Dial (Red/White)
    const tickMatRed = new THREE.MeshBasicMaterial({ color: 0xff0033, transparent: true, opacity: 0.7 });
    const tickMatWhite = new THREE.MeshBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0.6 });
    for (let i = 0; i < 7; i++) {
      const isRed = i >= 5;
      const tick = new THREE.Mesh(new THREE.PlaneGeometry(0.012, 0.003), isRed ? tickMatRed : tickMatWhite);
      const angle = 2.18 - (i / 6) * 4.36;
      tick.position.set(0.1 + Math.sin(angle) * 0.048, Math.cos(angle) * 0.048, 0.028);
      tick.rotation.z = -angle;
      clusterGroup.add(tick);
    }

    // Speed needle (offset origin to rotate around base)
    const speedNeedleGeo = new THREE.BoxGeometry(0.005, 0.05, 0.002);
    speedNeedleGeo.translate(0, 0.02, 0); // shift geometry up relative to center origin
    const speedNeedleMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff });
    this.speedNeedle = new THREE.Mesh(speedNeedleGeo, speedNeedleMat);
    this.speedNeedle.position.set(-0.1, 0, 0.029);
    this.speedNeedle.rotation.z = 2.18; // point at 0 speed initially
    clusterGroup.add(this.speedNeedle);

    // RPM needle
    const rpmNeedleGeo = new THREE.BoxGeometry(0.005, 0.05, 0.002);
    rpmNeedleGeo.translate(0, 0.02, 0);
    const rpmNeedleMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });
    this.rpmNeedle = new THREE.Mesh(rpmNeedleGeo, rpmNeedleMat);
    this.rpmNeedle.position.set(0.1, 0, 0.029);
    this.rpmNeedle.rotation.z = 2.18;
    clusterGroup.add(this.rpmNeedle);

    // Steering Wheel Group
    this.steeringWheel = new THREE.Group();
    this.steeringWheel.position.set(0.35, 0.92, 0.05); // LHD position, in front of camera at z=0.2
    this.steeringWheel.rotation.x = -0.4; // tilted up

    // Steering column
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.15), dashMat);
    column.rotation.x = Math.PI / 2;
    this.steeringWheel.add(column);

    // The Wheel itself
    const wheelRing = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 16, 32), leatherMat);
    wheelRing.position.z = 0.08;
    this.steeringWheel.add(wheelRing);
    
    // Wheel spokes
    const spoke1 = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.04, 0.02), dashMat);
    spoke1.position.z = 0.08;
    this.steeringWheel.add(spoke1);
    const spoke2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.02), dashMat);
    spoke2.position.set(0, -0.08, 0.08);
    this.steeringWheel.add(spoke2);

    this.carGroup.add(this.steeringWheel);

    // --- Headlights Setup (Universal) ---
    this.headlights = [];
    
    // Left physical light beam
    const leftHeadlight = new THREE.SpotLight(0xfffaed, 0, 60, Math.PI / 4, 0.6, 1.2);
    leftHeadlight.position.set(-w * 0.35, 0.55, -l / 2 - 0.05);
    const leftTarget = new THREE.Object3D();
    leftTarget.position.set(-w * 0.35, 0.55, -l / 2 - 15);
    this.carGroup.add(leftTarget);
    leftHeadlight.target = leftTarget;
    leftHeadlight.castShadow = false; // Disable shadows to maintain solid 60 fps
    this.carGroup.add(leftHeadlight);
    this.headlights.push(leftHeadlight);

    // Right physical light beam
    const rightHeadlight = new THREE.SpotLight(0xfffaed, 0, 60, Math.PI / 4, 0.6, 1.2);
    rightHeadlight.position.set(w * 0.35, 0.55, -l / 2 - 0.05);
    const rightTarget = new THREE.Object3D();
    rightTarget.position.set(w * 0.35, 0.55, -l / 2 - 15);
    this.carGroup.add(rightTarget);
    rightHeadlight.target = rightTarget;
    rightHeadlight.castShadow = false; // Disable shadows to maintain solid 60 fps
    this.carGroup.add(rightHeadlight);
    this.headlights.push(rightHeadlight);

    this.updateHeadlights(false);

    this.currentModelType = modelType;
    this.carGroup.userData = { modelType: modelType };

    return this.carGroup;
  }

  /**
   * Directly sets the car body paint color material property
   */
  updateCarPaint(paintColor) {
    if (this.carBodyMat) {
      this.carBodyMat.color.set(paintColor);
    }
  }

  /**
   * Adds, removes, or shifts neon underglow dynamically
   */
  updateCarNeon(underglowColor) {
    if (underglowColor === 'off') {
      if (this.neonLight) {
        this.carGroup.remove(this.neonLight);
        this.neonLight = null;
      }
      if (this.interiorNeonStrip) {
        this.interiorNeonStrip.visible = false;
      }
      if (this.doorNeonStripL) {
        this.doorNeonStripL.visible = false;
      }
      if (this.doorNeonStripR) {
        this.doorNeonStripR.visible = false;
      }
    } else {
      let colorHex = 0x00f3ff;
      if (underglowColor === 'pink') colorHex = 0xff007f;
      if (underglowColor === 'green') colorHex = 0x39ff14;
      if (underglowColor === 'purple') colorHex = 0xb026ff;

      if (this.neonLight) {
        this.neonLight.material.color.set(colorHex);
      } else {
        const w = 2.0, l = 4.4;
        const neonGeo = new THREE.PlaneGeometry(w * 0.95, l * 0.85);
        neonGeo.rotateX(-Math.PI / 2);
        
        const neonMat = new THREE.MeshBasicMaterial({
          color: colorHex,
          transparent: true,
          opacity: 0.65
        });
        
        this.neonLight = new THREE.Mesh(neonGeo, neonMat);
        this.neonLight.position.set(0, 0.03, 0);
      }
      
      if (!this.carGroup.children.includes(this.neonLight)) {
        this.carGroup.add(this.neonLight);
      }

      if (this.interiorNeonStrip) {
        this.interiorNeonStrip.visible = true;
        this.interiorNeonStrip.material.color.set(colorHex);
      }
      if (this.doorNeonStripL) {
        this.doorNeonStripL.visible = true;
        this.doorNeonStripL.material.color.set(colorHex);
      }
      if (this.doorNeonStripR) {
        this.doorNeonStripR.visible = true;
        this.doorNeonStripR.material.color.set(colorHex);
      }
    }
  }

  /**
   * Updates headlights intensity and visual bulb material colors
   */
  updateHeadlights(active) {
    const intensity = active ? 8.0 : 0.0;
    if (this.headlights) {
      this.headlights.forEach(light => {
        light.intensity = intensity;
      });
    }
    if (this.headlightVisuals) {
      this.headlightVisuals.forEach(mesh => {
        mesh.material.color.setHex(active ? 0xffffff : 0x444444);
      });
    }
  }

  /**
   * Physics solver iteration step (updates position, velocity, and telemetry)
   * @param {Object} keys Keyboard state
   * @param {number} dt Delta time in seconds
   */
  update(keys, dt) {
    if (dt > 0.1) dt = 0.1; // clamp lag spike dt

    const throttleInput = keys['w'] || keys['arrowup'] ? 1.0 : 0.0;
    const brakeInput = keys['s'] || keys['arrowdown'] ? 1.0 : 0.0;
    const handbrakeInput = keys[' '] ? 1.0 : 0.0;
    
    let steerInput = 0;
    if (keys['a'] || keys['arrowleft']) steerInput = -1.0;
    if (keys['d'] || keys['arrowright']) steerInput = 1.0;

    // Decrement gear shifts lock-out timer
    if (this.shiftTimer > 0) this.shiftTimer -= dt;

    // --- Autopilot / Auto-Cruise Mode Override ---
    let autoThrottle = 0;
    let autoSteer = 0;
    if (this.cruiseEnabled && this.roadCurve) {
      const cruiseOut = this.solveAutopilot();
      autoThrottle = cruiseOut.throttle;
      autoSteer = cruiseOut.steer;
    }

    let throttle = this.cruiseEnabled ? autoThrottle : throttleInput;
    let brake = this.cruiseEnabled ? 0.0 : brakeInput;
    const handbrake = this.cruiseEnabled ? 0.0 : handbrakeInput;
    const steer = this.cruiseEnabled ? autoSteer : steerInput;

    // Swap throttle and brake in reverse for automatic transmission (arcade style)
    if (this.isAutomatic && this.gear === -1 && !this.cruiseEnabled) {
      throttle = brakeInput;
      brake = throttleInput;
    }

    // Save resolved throttle for audio engine
    this.throttle = throttle;

    // --- Dynamic Taillight Brightness ---
    this.brakeLights.forEach(light => {
      if (brake > 0.05 || handbrake > 0.05) {
        light.material.color.setHex(0xff0000); // bright red brake active
      } else {
        light.material.color.setHex(0x500000); // dark tail glow
      }
    });

    // --- Drivetrain Transmission Gearbox Logic ---
    if (this.isAutomatic && this.shiftTimer <= 0) {
      if (this.gear > 0) {
        // Automatic up-shift
        if (this.rpm > 6200 && this.gear < 6) {
          this.gearShift(this.gear + 1);
        }
        // Automatic down-shift
        else if (this.rpm < 2200 && this.gear > 1) {
          this.gearShift(this.gear - 1);
        }
        // Shift to Reverse if stopped and holding brake (S/ArrowDown)
        else if (Math.abs(this.speed) < 1.0 && brakeInput > 0.1) {
          this.gearShift(-1);
        }
      } else if (this.gear === -1) {
        // Shift to Forward if stopped and holding throttle (W/ArrowUp)
        if (Math.abs(this.speed) < 1.0 && throttleInput > 0.1) {
          this.gearShift(1);
        }
      }
    }

    // --- Steering Physics (reduced sensitivity at high speeds) ---
    const speedFactor = Math.max(0.12, 1.0 - (this.speed / 190.0));
    const targetSteerAngle = steer * 0.45 * speedFactor;
    this.steerAngle += (targetSteerAngle - this.steerAngle) * 9 * dt; // damping spring

    // --- Acceleration & Forces ---
    const gearRatio = this.gearRatios[this.gear.toString()] || 1.0;
    
    // Torque climbs, drops as we reach engine RPM peak
    const engineRpmFactor = this.rpm / this.redlineRpm;
    const torque = Math.max(0.2, 1.0 - Math.pow(engineRpmFactor - 0.7, 2) * 1.5);
    
    let force = throttle * torque * 22.0 / gearRatio; // drive force
    if (this.gear === 0) {
      force = 0.0; // Neutral: no engine torque transmitted to wheels
    } else if (this.gear === -1) {
      force = -force; // reverse gear
    }

    // Apply Braking force
    let brakingForce = brake * 35.0 + handbrake * 55.0;

    // Apply Drag & Friction forces
    const dragCoeff = 0.04;
    const windCoeff = 0.0004;
    const rollResistance = 0.6;
    
    const drag = this.speed * dragCoeff + Math.pow(this.speed, 2) * windCoeff + rollResistance;
    
    // Total forward acceleration force
    let forwardAcc = force;
    if (this.speed > 0.01) {
      forwardAcc -= drag + brakingForce;
    } else if (this.speed < -0.01) {
      forwardAcc += drag + brakingForce;
    } else {
      // Static cutoff to rest
      if (Math.abs(force) < rollResistance) {
        this.speed = 0;
        forwardAcc = 0;
      }
    }

    // Update forward speed
    this.speed += forwardAcc * dt * 2.5; // conversion scale
    this.speed = THREE.MathUtils.clamp(this.speed, -35, this.maxSpeed);

    // --- Drift Slide Physics ---
    const lateralVelocity = this.speed * Math.sin(this.steerAngle);
    const slipThreshold = 18.0; // km/h lateral threshold to slide
    
    if (Math.abs(lateralVelocity) > slipThreshold || handbrake > 0.8) {
      this.isDrifting = true;
      // Drift slip angle adds yaw pivot lag
      const driftSlidiness = handbrake > 0.8 ? 0.95 : (this.driftAssist ? 0.72 : 0.85);
      this.driftAngle += (this.steerAngle - this.driftAngle) * (1 - driftSlidiness) * dt * 10;
      
      // Accumulate score
      this.driftScore += Math.abs(lateralVelocity) * dt * 0.15;
    } else {
      this.isDrifting = false;
      this.driftAngle += (0 - this.driftAngle) * 5 * dt;
    }

    // --- Heading yaw (orientation) update ---
    const turnRadiusScale = 0.28;
    this.yaw -= (this.speed / 3.6) * Math.sin(this.steerAngle) * turnRadiusScale * dt;

    // --- Convert heading to velocity vectors ---
    const slipFactor = this.isDrifting ? this.driftAngle * 0.85 : 0;
    this.velocity.set(
      -Math.sin(this.yaw + slipFactor) * (this.speed / 3.6),
      0,
      -Math.cos(this.yaw + slipFactor) * (this.speed / 3.6)
    );

    // Move car position
    this.carGroup.position.addScaledVector(this.velocity, dt);

    // Update car yaw rotation
    this.carGroup.rotation.y = this.yaw;

    // --- Animate Steering Wheel ---
    if (this.steeringWheel) {
      // Multiply by a factor (e.g. 4) so the wheel turns more than the actual tires for realism
      this.steeringWheel.rotation.z = -this.steerAngle * 4.0;
    }

    // --- Animate Cockpit Gauges Needles ---
    if (this.speedNeedle) {
      const speedRatio = Math.min(1.0, Math.max(0.0, Math.abs(this.speed) / this.maxSpeed));
      const speedAngle = 2.18 - speedRatio * 4.36; // Start: 125 degrees, Sweep: 250 degrees
      this.speedNeedle.rotation.z = speedAngle;
    }
    if (this.rpmNeedle) {
      const rpmRatio = Math.min(1.0, Math.max(0.0, (this.rpm - this.idleRpm) / (this.redlineRpm - this.idleRpm)));
      const rpmAngle = 2.18 - rpmRatio * 4.36;
      this.rpmNeedle.rotation.z = rpmAngle;
    }

    // --- Engine RPM Synthesis Simulator ---
    // Simulates dynamic engine acceleration
    if (this.shiftTimer > 0) {
      // RPM drops as clutch is disengaged
      this.rpm += (this.idleRpm - this.rpm) * 8 * dt;
    } else if (this.gear === 0) {
      // Neutral: RPM depends only on throttle, revs up and down quickly
      const targetRpm = this.idleRpm + throttle * (this.redlineRpm - this.idleRpm);
      this.rpm += (targetRpm - this.rpm) * 8 * dt;
      this.rpm = THREE.MathUtils.clamp(this.rpm, this.idleRpm, this.redlineRpm);
    } else {
      const targetRpm = this.idleRpm + (Math.abs(this.speed) / this.maxSpeed) * (this.redlineRpm - this.idleRpm - 2000) * gearRatio * 1.5 + (throttle * 1500);
      this.rpm += (targetRpm - this.rpm) * 5 * dt;
      this.rpm = THREE.MathUtils.clamp(this.rpm, this.idleRpm, this.redlineRpm);
    }

    // --- Road Elevation height locking ---
    this.snapToRoadSpline();
  }

  /**
   * Gear Shift triggers engine disengagement (clutch lag)
   * @param {number} nextGear 
   */
  gearShift(nextGear) {
    this.gear = nextGear;
    this.shiftTimer = 0.15; // disengage throttle for 150ms
    this.rpm -= 1500;       // pitch drop
  }

  /**
   * Locks the car position to the road height y, and rotates pitch/roll along the spline profile
   */
  snapToRoadSpline() {
    if (!this.roadCurve) return;

    // 1. Find closest point on spline (u progress)
    const carPos = this.carGroup.position;
    
    // Sample search
    let bestU = 0;
    let minDist = Infinity;
    const numSamples = 100;
    
    for (let i = 0; i <= numSamples; i++) {
      const u = i / numSamples;
      const p = this.roadCurve.getPointAt(u);
      const d = carPos.distanceTo(p);
      if (d < minDist) {
        minDist = d;
        bestU = u;
      }
    }

    // Local refinement
    let fineU = bestU;
    let step = 0.005;
    for (let iter = 0; iter < 4; iter++) {
      const uLeft = Math.max(0, fineU - step);
      const uRight = Math.min(1, fineU + step);
      const pL = this.roadCurve.getPointAt(uLeft);
      const pR = this.roadCurve.getPointAt(uRight);
      
      const dL = carPos.distanceTo(pL);
      const dR = carPos.distanceTo(pR);
      
      if (dL < dR) {
        fineU = uLeft;
      } else {
        fineU = uRight;
      }
      step *= 0.5;
    }

    this.uProgress = fineU;

    // 2. Adjust y height to match road
    const roadPoint = this.roadCurve.getPointAt(this.uProgress);
    
    // Snap Y position (if near road mesh limit, i.e. 35 meters)
    if (minDist < 35) {
      carPos.y = roadPoint.y;
      
      // Tilt pitch/roll along the tangent slope
      const tangent = this.roadCurve.getTangentAt(this.uProgress);
      const slopePitch = Math.atan2(tangent.y, Math.sqrt(tangent.x * tangent.x + tangent.z * tangent.z));
      
      this.carGroup.rotation.x = slopePitch; // matches slopes
    } else {
      // Off-road gravity / sink on terrain height
      carPos.y = -3.5;
      this.carGroup.rotation.x = 0;
      this.speed *= 0.98; // slow down significantly (rough sand/grass)
    }
  }

  /**
   * Autopilot / Cruise control path solver. Returns { throttle, steer }
   */
  solveAutopilot() {
    // 1. Get a look ahead point on the spline (e.g. current progress + 25 meters)
    const lookAheadMetres = 28;
    const curveLength = this.roadCurve.getLength();
    const uOffset = lookAheadMetres / curveLength;
    
    // Loop around path if we reach the end
    const targetU = (this.uProgress + uOffset) % 1.0;
    const targetP = this.roadCurve.getPointAt(targetU);

    // 2. Project target point into local car coordinate space
    const carPos = this.carGroup.position;
    const dirToTarget = new THREE.Vector3().subVectors(targetP, carPos);
    
    // Rotate to match car orientation yaw
    const localDir = dirToTarget.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -this.yaw);

    // 3. Compute Steering angle (proportional to lateral error)
    const steerGain = 0.95;
    // localDir.x tells us how much to steer left/right
    const targetAngle = Math.atan2(localDir.x, -localDir.z) * steerGain;
    const steer = THREE.MathUtils.clamp(targetAngle, -1.0, 1.0);

    // 4. Compute Throttle to maintain target speed, slowing down in sharp turns
    const currentSpeed = this.speed;
    const curveTightness = Math.abs(steer); // higher steer means sharper curve
    
    const maxCurveSpeed = this.targetCruiseSpeed * (1 - curveTightness * 0.45); // drop speed up to 45% in hairpins
    
    let throttle = 0;
    if (currentSpeed < maxCurveSpeed) {
      throttle = 0.9;
    } else {
      throttle = 0.1;
    }

    return { throttle, steer };
  }

  /**
   * Tracks tires footprint coordinates to build skidmarks ribbons
   * @returns {Object} Left & Right skid coordinates
   */
  getTireSkidPoints() {
    if (!this.isDrifting || this.speed < 10) {
      // If we stop drifting, cap path to start a new one
      this.skidmarkLeft.push(null);
      this.skidmarkRight.push(null);
      return null;
    }

    const quat = this.carGroup.quaternion;
    const pos = this.carGroup.position;
    
    // Rear wheels positions offset
    const wL = new THREE.Vector3(-1.08, 0.05, 1.4).applyQuaternion(quat).add(pos);
    const wR = new THREE.Vector3(1.08, 0.05, 1.4).applyQuaternion(quat).add(pos);

    this.skidmarkLeft.push(wL);
    this.skidmarkRight.push(wR);

    // Cap memory size
    if (this.skidmarkLeft.length > this.maxSkidmarkPoints) {
      this.skidmarkLeft.shift();
      this.skidmarkRight.shift();
    }

    return { left: wL, right: wR };
  }
}
export default PhysicsEngine;
