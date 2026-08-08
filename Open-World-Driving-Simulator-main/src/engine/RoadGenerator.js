import * as THREE from 'three';

/**
 * RoadGenerator - Computes spline paths and generates detailed 3D road geometries.
 */
export class RoadGenerator {
  constructor() {
    this.roadWidth = 14; // total road width in meters
    this.barrierWidth = 0.5;
    this.barrierHeight = 0.8;
  }

  /**
   * Returns pre-baked road coordinates for featured presets
   * @param {string} presetId 
   * @returns {Object} { points: Array, name: string, biome: string }
   */
  getPresetRoute(presetId) {
    let points = [];
    let name = '';
    let biome = '';

    switch (presetId) {
      case 'pch':
        name = 'Pacific Coast Highway';
        biome = 'coastal';
        points = this.generatePchCoordinates();
        break;
      case 'stelvio':
        name = 'Stelvio Pass';
        biome = 'alpine';
        points = this.generateStelvioCoordinates();
        break;
      case 'tokyo':
        name = 'Shuto Expressway';
        biome = 'tokyo';
        points = this.generateTokyoCoordinates();
        break;
      case 'desert':
        name = 'Historic Route 66';
        biome = 'desert';
        points = this.generateDesertCoordinates();
        break;
      case 'transf':
        name = 'Transfăgărășan';
        biome = 'alpine';
        points = this.generateTransfagarasanCoordinates();
        break;
      default:
        name = 'Custom Destination';
        biome = 'coastal';
        points = this.generatePchCoordinates();
    }

    return { points, name, biome };
  }

  /**
   * Builds the complete 3D road mesh hierarchy
   * @param {THREE.CatmullRomCurve3} curve 
   * @returns {THREE.Group} Group containing road surface, markings, barriers, and reflectors
   */
  createRoadMesh(curve) {
    const group = new THREE.Group();
    const segments = Math.max(200, Math.floor(curve.getLength() / 3)); // 3 meters per segment
    const points = curve.getSpacedPoints(segments);
    
    // We will build:
    // 1. Asphalt road deck
    // 2. Center double yellow lines
    // 3. Side white borders
    // 4. Metal guard rails
    // 5. Active Cat-eye reflectors
    
    const roadVertices = [];
    const roadIndices = [];
    const roadUVs = [];
    
    const lineVertices = [];
    const lineIndices = [];

    const barrierLVertices = [];
    const barrierRVertices = [];
    const barrierIndices = [];
    
    const reflectors = [];

    const up = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i <= segments; i++) {
      const p = points[i];
      let t;
      if (i === segments) {
        t = curve.getTangentAt(1);
      } else {
        t = curve.getTangentAt(i / segments);
      }
      
      // Calculate right vector
      const r = new THREE.Vector3().crossVectors(t, up).normalize();
      // Recalculate up to ensure orthogonality
      const u = new THREE.Vector3().crossVectors(r, t).normalize();

      // --- 1. Road Surface (Asphalt) ---
      // Left and right vertices
      const pL = p.clone().addScaledVector(r, -this.roadWidth / 2);
      const pR = p.clone().addScaledVector(r, this.roadWidth / 2);
      
      roadVertices.push(pL.x, pL.y, pL.z);
      roadVertices.push(pR.x, pR.y, pR.z);
      
      const vProgress = i / 10; // tile texture along the road length
      roadUVs.push(0, vProgress);
      roadUVs.push(1, vProgress);

      if (i < segments) {
        const curr = i * 2;
        const next = (i + 1) * 2;
        // Triangle 1
        roadIndices.push(curr, curr + 1, next);
        // Triangle 2
        roadIndices.push(curr + 1, next + 1, next);
      }

      // --- 2. Center Lines & Side Markings ---
      // Center lines: slightly raised to prevent z-fighting
      const pC_raised = p.clone().addScaledVector(u, 0.02);
      const pL_raised = pL.clone().addScaledVector(u, 0.015);
      const pR_raised = pR.clone().addScaledVector(u, 0.015);

      const wLine = 0.15; // line width
      
      // We will define points for left side line, center lines, right side line
      const wSideLineOffset = 0.5; // distance from road edge
      const pL_lineL = pL_raised.clone().addScaledVector(r, wSideLineOffset);
      const pL_lineR = pL_lineL.clone().addScaledVector(r, wLine);
      
      const pC_lineL1 = pC_raised.clone().addScaledVector(r, -wLine - 0.05);
      const pC_lineR1 = pC_raised.clone().addScaledVector(r, -0.05);
      const pC_lineL2 = pC_raised.clone().addScaledVector(r, 0.05);
      const pC_lineR2 = pC_raised.clone().addScaledVector(r, wLine + 0.05);
      
      const pR_lineR = pR_raised.clone().addScaledVector(r, -wSideLineOffset);
      const pR_lineL = pR_lineR.clone().addScaledVector(r, -wLine);

      // Store marking vertices (L side, C line 1, C line 2, R side)
      // To keep it simple, we draw:
      // Left border white line
      lineVertices.push(pL_lineL.x, pL_lineL.y, pL_lineL.z);
      lineVertices.push(pL_lineR.x, pL_lineR.y, pL_lineR.z);
      // Center yellow line 1
      lineVertices.push(pC_lineL1.x, pC_lineL1.y, pC_lineL1.z);
      lineVertices.push(pC_lineR1.x, pC_lineR1.y, pC_lineR1.z);
      // Center yellow line 2
      lineVertices.push(pC_lineL2.x, pC_lineL2.y, pC_lineL2.z);
      lineVertices.push(pC_lineR2.x, pC_lineR2.y, pC_lineR2.z);
      // Right border white line
      lineVertices.push(pR_lineL.x, pR_lineL.y, pR_lineL.z);
      lineVertices.push(pR_lineR.x, pR_lineR.y, pR_lineR.z);

      if (i < segments) {
        const currLine = i * 8;
        const nextLine = (i + 1) * 8;
        for (let l = 0; l < 8; l += 2) {
          lineIndices.push(currLine + l, currLine + l + 1, nextLine + l);
          lineIndices.push(currLine + l + 1, nextLine + l + 1, nextLine + l);
        }
      }

      // --- 3. Guard Rails (Barriers) ---
      // Left barrier points
      const bL_base = pL.clone().addScaledVector(r, -0.2);
      const bL_top = bL_base.clone().addScaledVector(u, this.barrierHeight);
      barrierLVertices.push(bL_base.x, bL_base.y, bL_base.z);
      barrierLVertices.push(bL_top.x, bL_top.y, bL_top.z);

      // Right barrier points
      const bR_base = pR.clone().addScaledVector(r, 0.2);
      const bR_top = bR_base.clone().addScaledVector(u, this.barrierHeight);
      barrierRVertices.push(bR_base.x, bR_base.y, bR_base.z);
      barrierRVertices.push(bR_top.x, bR_top.y, bR_top.z);

      if (i < segments) {
        const currBar = i * 2;
        const nextBar = (i + 1) * 2;
        barrierIndices.push(currBar, currBar + 1, nextBar);
        barrierIndices.push(currBar + 1, nextBar + 1, nextBar);
      }

      // --- 4. Reflectors (Every 18 meters) ---
      if (i % 6 === 0 && i < segments) {
        reflectors.push({
          pos: pC_raised.clone().addScaledVector(u, 0.05),
          dir: t.clone()
        });
      }
    }

    // A. Road surface mesh
    const roadGeo = new THREE.BufferGeometry();
    roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadVertices, 3));
    roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(roadUVs, 2));
    roadGeo.setIndex(roadIndices);
    roadGeo.computeVertexNormals();
    
    // Create procedurally styled asphalt texture
    const asphaltMaterial = new THREE.MeshStandardMaterial({
      color: 0x18181c,
      roughness: 0.85,
      metalness: 0.1,
      side: THREE.DoubleSide
    });
    const roadMesh = new THREE.Mesh(roadGeo, asphaltMaterial);
    roadMesh.receiveShadow = true;
    group.add(roadMesh);

    // B. Markings (Lines) mesh
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(lineVertices, 3));
    lineGeo.setIndex(lineIndices);
    lineGeo.computeVertexNormals();
    const lineMaterial = new THREE.MeshBasicMaterial({
      color: 0xe5a93c, // warm yellow line
      side: THREE.DoubleSide
    });
    const lineMesh = new THREE.Mesh(lineGeo, lineMaterial);
    group.add(lineMesh);

    // C. Barriers (Guardrails) meshes
    const barrierMaterial = new THREE.MeshStandardMaterial({
      color: 0x8a9296, // steel/aluminum grey
      roughness: 0.4,
      metalness: 0.8,
      side: THREE.DoubleSide
    });

    const barLGeo = new THREE.BufferGeometry();
    barLGeo.setAttribute('position', new THREE.Float32BufferAttribute(barrierLVertices, 3));
    barLGeo.setIndex(barrierIndices);
    barLGeo.computeVertexNormals();
    const barLMesh = new THREE.Mesh(barLGeo, barrierMaterial);
    barLMesh.castShadow = true;
    group.add(barLMesh);

    const barRGeo = new THREE.BufferGeometry();
    barRGeo.setAttribute('position', new THREE.Float32BufferAttribute(barrierRVertices, 3));
    barRGeo.setIndex(barrierIndices);
    barRGeo.computeVertexNormals();
    const barRMesh = new THREE.Mesh(barRGeo, barrierMaterial);
    barRMesh.castShadow = true;
    group.add(barRMesh);

    // D. Reflector light/dots
    const refGroup = new THREE.Group();
    const refGeo = new THREE.BoxGeometry(0.12, 0.08, 0.12);
    const refMatActive = new THREE.MeshBasicMaterial({ color: 0xffdd00 }); // glowing amber
    reflectors.forEach(ref => {
      const mesh = new THREE.Mesh(refGeo, refMatActive);
      mesh.position.copy(ref.pos);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), ref.dir);
      refGroup.add(mesh);
    });
    group.add(refGroup);

    return group;
  }

  // ==========================================
  // Preset Road Coordinate Generators
  // ==========================================

  /**
   * PCH: Sweeping coastal curve
   */
  generatePchCoordinates() {
    const points = [];
    const len = 120;
    const spacing = 50;
    
    for (let i = 0; i < len; i++) {
      const z = -i * spacing;
      // Large sweeping curve towards left then right
      const x = Math.sin(i * 0.06) * 140 + Math.cos(i * 0.02) * 220 - 220;
      // Gentle slope
      const y = Math.sin(i * 0.04) * 8 + 8;
      points.push(new THREE.Vector3(x, y, z));
    }
    return points;
  }

  /**
   * Stelvio: Winding alpine climb with 180 hairpins
   */
  generateStelvioCoordinates() {
    const points = [];
    const numHairpins = 12;
    const legLength = 120; // length between switchbacks
    const spacing = 15;
    
    let x = 0;
    let z = 0;
    let y = 0;
    let dir = 1; // 1 = right, -1 = left

    points.push(new THREE.Vector3(x, y, z));

    for (let h = 0; h < numHairpins; h++) {
      // Straight leg climbing up
      for (let j = 0; j < 8; j++) {
        z -= spacing * 0.8;
        x += dir * spacing * 2.2;
        y += 1.8;
        points.push(new THREE.Vector3(x, y, z));
      }

      // Hairpin curve
      const hpCenterZ = z - spacing;
      const hpCenterX = x + dir * spacing;
      const hpRadius = spacing * 1.5;

      for (let angle = 0; angle <= Math.PI; angle += Math.PI / 6) {
        const a = dir === 1 ? -Math.PI / 2 + angle : Math.PI / 2 + angle;
        const curX = hpCenterX + Math.cos(a) * hpRadius;
        const curZ = hpCenterZ + Math.sin(a) * hpRadius;
        y += 0.8;
        points.push(new THREE.Vector3(curX, y, curZ));
      }

      z = hpCenterZ - spacing;
      x = hpCenterX - dir * hpRadius;
      dir = -dir; // reverse direction
    }
    return points;
  }

  /**
   * Tokyo Shuto: City elevated loop
   */
  generateTokyoCoordinates() {
    const points = [];
    const len = 150;
    const spacing = 35;
    
    let x = 0;
    let z = 0;
    let angle = 0;
    
    points.push(new THREE.Vector3(x, 15, z)); // Elevated deck

    for (let i = 1; i < len; i++) {
      // Generate loops, flyovers and grids
      const phase = i / 12;
      
      // Tokyo features sharp turns and split highways
      let turn = 0;
      if (i > 20 && i < 35) turn = -0.06; // Loop left
      if (i > 50 && i < 65) turn = 0.08;  // Loop right
      if (i > 80 && i < 90) turn = -0.15; // Hard left junction
      if (i > 110 && i < 125) turn = 0.05;

      angle += turn;
      x += Math.sin(angle) * spacing;
      z -= Math.cos(angle) * spacing;
      
      // Height profile: high bridges, low tunnels
      let y = 15; // bridge base
      if (i > 35 && i < 75) y = 15 - (i - 35) * 0.6; // ramp down to tunnel
      if (i >= 75 && i < 100) y = -9; // deep tunnel
      if (i >= 100 && i < 120) y = -9 + (i - 100) * 1.2; // ramp back up

      points.push(new THREE.Vector3(x, y, z));
    }
    return points;
  }

  /**
   * Desert: Long straight dusty roads
   */
  generateDesertCoordinates() {
    const points = [];
    const len = 100;
    const spacing = 60;
    
    for (let i = 0; i < len; i++) {
      const z = -i * spacing;
      // Minor winding (almost straight)
      const x = Math.sin(i * 0.025) * 20;
      // Dips and crests (rollercoaster sand dunes)
      const y = Math.cos(i * 0.08) * 4 + Math.sin(i * 0.02) * 12;
      points.push(new THREE.Vector3(x, y, z));
    }
    return points;
  }

  /**
   * Transfagarasan: Sweeping mountain ridge climb
   */
  generateTransfagarasanCoordinates() {
    const points = [];
    const len = 130;
    const spacing = 45;
    
    let x = 0;
    let z = 0;
    let y = 0;
    
    points.push(new THREE.Vector3(x, y, z));

    for (let i = 1; i < len; i++) {
      // Winding mountain pass
      const sweep = Math.sin(i * 0.08) * 0.12 + Math.cos(i * 0.03) * 0.05;
      x += Math.sin(i * 0.07) * spacing * 1.2;
      z -= Math.cos(i * 0.04) * spacing * 0.9;
      y += 1.1 + Math.sin(i * 0.1) * 0.8; // climbing and rolling
      points.push(new THREE.Vector3(x, y, z));
    }
    return points;
  }
}
