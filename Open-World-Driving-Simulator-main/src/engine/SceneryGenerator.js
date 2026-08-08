import * as THREE from 'three';

// A simple, fast 2D Noise helper for procedural terrain and heights
class SimpleNoise {
  constructor() {
    this.grad = [
      [1,1], [-1,1], [1,-1], [-1,-1],
      [1,0], [-1,0], [0,1], [0,-1]
    ];
    this.p = Array.from({ length: 256 }, (_, i) => i);
    // Shuffle
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.p[i], this.p[j]] = [this.p[j], this.p[i]];
    }
    this.perm = [...this.p, ...this.p];
  }

  noise2D(x, y) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
    const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);

    const n00 = this.dot(this.perm[X + this.perm[Y]], xf, yf);
    const n10 = this.dot(this.perm[X + 1 + this.perm[Y]], xf - 1, yf);
    const n01 = this.dot(this.perm[X + this.perm[Y + 1]], xf, yf - 1);
    const n11 = this.dot(this.perm[X + 1 + this.perm[Y + 1]], xf - 1, yf - 1);

    const x1 = this.lerp(u, n00, n10);
    const x2 = this.lerp(u, n01, n11);
    return this.lerp(v, x1, x2);
  }

  dot(gIdx, x, y) {
    const g = this.grad[gIdx % 8];
    return g[0] * x + g[1] * y;
  }

  lerp(t, a, b) {
    return a + t * (b - a);
  }
}

const noise = new SimpleNoise();

export class SceneryGenerator {
  constructor() {
    this.instancedMeshes = [];
    this.streetlightPositions = [];
    this.streetlightModel = null;
    this.activeLights = [];
  }

  /**
   * Unified terrain height calculator based on road spline position, distance from center, and noise formulas
   */
  getTerrainHeight(p, dist, v, biomeName) {
    let height = p.y;
    const absDist = Math.abs(dist);
    
    if (absDist > 7.2) {
      const factor = Math.min(1.0, (absDist - 7.2) / 50.0);
      
      if (biomeName === 'coastal') {
        if (dist > 0) {
          // Ocean side: slope down to sea level
          height = THREE.MathUtils.lerp(p.y, -4.5, factor);
        } else {
          // Cliff side: steep rocky cliffs
          const n = noise.noise2D(v.x * 0.006, v.z * 0.006);
          height += Math.max(0, n) * 45.0 * factor;
        }
      } else if (biomeName === 'alpine') {
        // Mountain pass: rolling pine hills
        const n = noise.noise2D(v.x * 0.005, v.z * 0.005);
        height += n * 28.0 * factor;
      } else if (biomeName === 'desert') {
        // Red rock canyons and sand dunes
        const n1 = noise.noise2D(v.x * 0.003, v.z * 0.003);
        const n2 = noise.noise2D(v.x * 0.015, v.z * 0.015) * 0.2;
        height += (n1 + n2) * 20.0 * factor;
      } else if (biomeName === 'tokyo') {
        // Modern flat grid with subtle height variance
        const n = noise.noise2D(v.x * 0.002, v.z * 0.002);
        height += n * 3.0 * factor;
      }
    }
    return height;
  }

  /**
   * Clears old scenery and builds new scenery for a given biome along the road
   * @param {THREE.Scene} scene 
   * @param {THREE.CatmullRomCurve3} curve 
   * @param {string} biomeName 'coastal' | 'alpine' | 'tokyo' | 'desert'
   */
  generateScenery(scene, curve, biomeName) {
    this.clearScenery(scene);
    
    const roadLength = curve.getLength();
    const segmentCount = Math.floor(roadLength / 18); // Check points every 18 meters
    const points = curve.getSpacedPoints(segmentCount);
    const up = new THREE.Vector3(0, 1, 0);

    this.streetlightPositions = [];

    // Define different meshes depending on biome
    if (biomeName === 'alpine') {
      this.buildAlpineScenery(scene, points, curve, segmentCount, up);
    } else if (biomeName === 'coastal') {
      this.buildCoastalScenery(scene, points, curve, segmentCount, up);
    } else if (biomeName === 'tokyo') {
      this.buildTokyoScenery(scene, points, curve, segmentCount, up);
    } else if (biomeName === 'desert') {
      this.buildDesertScenery(scene, points, curve, segmentCount, up);
    }
  }

  /**
   * Helper to register an instanced mesh to the scene
   */
  registerInstancedMesh(scene, instMesh) {
    instMesh.castShadow = true;
    instMesh.receiveShadow = true;
    if (instMesh.instanceMatrix) {
      instMesh.instanceMatrix.needsUpdate = true;
    }
    scene.add(instMesh);
    this.instancedMeshes.push(instMesh);
  }

  /**
   * Clears all instanced meshes and dynamic scenery objects
   */
  clearScenery(scene) {
    this.instancedMeshes.forEach(mesh => {
      scene.remove(mesh);
      if (mesh.geometry) mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(m => m.dispose());
      } else if (mesh.material) {
        mesh.material.dispose();
      }
    });
    this.instancedMeshes = [];

    // Clear dynamic streetlights
    this.activeLights.forEach(light => scene.remove(light));
    this.activeLights = [];
  }

  /**
   * Generates a 3D terrain grid that flows along the road curve and adds noise-based height
   */
  createProceduralTerrain(scene, curve, biomeName, colorHex) {
    const roadLength = curve.getLength();
    const segmentCount = Math.max(100, Math.floor(roadLength / 6)); // denser grid for terrain
    const points = curve.getSpacedPoints(segmentCount);
    const up = new THREE.Vector3(0, 1, 0);

    const offsets = [-300, -150, -60, -20, -7.2, 7.2, 20, 60, 150, 300];
    const C = offsets.length;

    const vertices = [];
    const indices = [];
    const uvs = [];

    for (let i = 0; i <= segmentCount; i++) {
      const p = points[i];
      let t;
      if (i === segmentCount) {
        t = curve.getTangentAt(1);
      } else {
        t = curve.getTangentAt(i / segmentCount);
      }
      const r = new THREE.Vector3().crossVectors(t, up).normalize();

      for (let j = 0; j < C; j++) {
        const dist = offsets[j];
        const v = p.clone().addScaledVector(r, dist);
        
        let height = this.getTerrainHeight(p, dist, v, biomeName);

        vertices.push(v.x, height, v.z);
        uvs.push(i / segmentCount, j / (C - 1));
      }
    }

    // Build indices with CCW winding (facing up)
    for (let i = 0; i < segmentCount; i++) {
      for (let j = 0; j < C - 1; j++) {
        const curr = i * C + j;
        const next = (i + 1) * C + j;
        
        indices.push(curr, curr + 1, next);
        indices.push(next, curr + 1, next + 1);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: colorHex,
      roughness: 0.9,
      metalness: 0.1,
      flatShading: true,
      side: THREE.DoubleSide
    });

    if (biomeName === 'tokyo') {
      mat.color.setHex(0x0a0a0f);
      mat.roughness = 0.85;
      mat.metalness = 0.6;
    }

    const terrainMesh = new THREE.Mesh(geo, mat);
    terrainMesh.receiveShadow = true;
    terrainMesh.castShadow = true;
    
    scene.add(terrainMesh);
    this.instancedMeshes.push(terrainMesh);
  }

  // ==========================================
  // Alpine Biome (Mountains & Pines)
  // ==========================================
  buildAlpineScenery(scene, points, curve, segmentCount, up) {
    this.createProceduralTerrain(scene, curve, 'alpine', 0x1c2b1e);
    
    // 1. Create Pine Tree Geometry
    // Trunk
    const trunkGeo = new THREE.CylinderGeometry(0.15, 0.25, 1.2, 5);
    trunkGeo.translate(0, 0.6, 0); // align bottom to origin
    
    // Foliage
    const foliageGeo1 = new THREE.ConeGeometry(1.2, 2.0, 5);
    foliageGeo1.translate(0, 1.8, 0);
    const foliageGeo2 = new THREE.ConeGeometry(0.9, 1.6, 5);
    foliageGeo2.translate(0, 2.8, 0);
    const foliageGeo3 = new THREE.ConeGeometry(0.6, 1.2, 5);
    foliageGeo3.translate(0, 3.6, 0);

    const mergedPineGeo = this.mergeGeometriesManual([trunkGeo, foliageGeo1, foliageGeo2, foliageGeo3]);
    
    // Pine needle material
    const pineMat = new THREE.MeshStandardMaterial({ color: 0x133d1c, roughness: 0.8 });
    
    // Instanced Trees
    const maxTrees = segmentCount * 12; // 12 trees per 18 meters for dense forest
    const treeMesh = new THREE.InstancedMesh(mergedPineGeo, pineMat, maxTrees);
    
    // 2. Rocks
    const rockGeo = new THREE.DodecahedronGeometry(1.5, 1);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x5a5d64, roughness: 0.9, metalness: 0.1 });
    const rockMesh = new THREE.InstancedMesh(rockGeo, rockMat, segmentCount * 2);

    // 3. Alpine Cabins
    const cabinGeo = this.getAlpineCabinGeometry();
    const cabinMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.8 });
    const cabinMesh = new THREE.InstancedMesh(cabinGeo, cabinMat, Math.floor(segmentCount / 8) + 2);

    // 4. Streetlights
    const lightModel = this.getStreetlightGeometry();
    const streetlightMesh = new THREE.InstancedMesh(lightModel.geo, lightModel.mat, segmentCount / 2);

    let treeIdx = 0;
    let rockIdx = 0;
    let cabinIdx = 0;
    let lightIdx = 0;

    const dummy = new THREE.Object3D();

    for (let i = 0; i < segmentCount; i++) {
      const p = points[i];
      const t = curve.getTangentAt(i / segmentCount);
      const r = new THREE.Vector3().crossVectors(t, up).normalize();

      // Spawn pines along the margins
      for (let j = 0; j < 12; j++) {
        const side = j % 2 === 0 ? 1 : -1;
        const offset = 10 + Math.random() * 35; // wider, denser forest offset
        const spawnP = p.clone().addScaledVector(r, side * offset);
        
        // Align height flush to terrain surface
        spawnP.y = this.getTerrainHeight(p, side * offset, spawnP, 'alpine');

        dummy.position.copy(spawnP);
        const scale = 0.7 + Math.random() * 0.6;
        dummy.scale.set(scale, scale, scale);
        dummy.rotation.set(
          (Math.random() - 0.5) * 0.05,
          Math.random() * Math.PI,
          (Math.random() - 0.5) * 0.05
        );
        dummy.updateMatrix();
        treeMesh.setMatrixAt(treeIdx++, dummy.matrix);
      }

      // Spawn mountain rocks
      if (i % 2 === 0) {
        const side = Math.random() > 0.5 ? 1 : -1;
        const offset = side * (12 + Math.random() * 15);
        const spawnP = p.clone().addScaledVector(r, offset);
        spawnP.y = this.getTerrainHeight(p, offset, spawnP, 'alpine') - 0.5; // sink slightly

        dummy.position.copy(spawnP);
        const scale = 1.0 + Math.random() * 3.0;
        dummy.scale.set(scale, scale * 1.5, scale);
        dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        dummy.updateMatrix();
        rockMesh.setMatrixAt(rockIdx++, dummy.matrix);
      }

      // Spawn Alpine Cabins (every 8 segments)
      if (i % 8 === 0) {
        const side = Math.random() > 0.5 ? 1 : -1;
        const offset = side * (14 + Math.random() * 6);
        const spawnP = p.clone().addScaledVector(r, offset);
        spawnP.y = this.getTerrainHeight(p, offset, spawnP, 'alpine');

        dummy.position.copy(spawnP);
        const scale = 1.0 + Math.random() * 0.4;
        dummy.scale.set(scale, scale, scale);
        // Face the road
        const angle = Math.atan2(t.x, t.z) + (side === 1 ? -Math.PI / 2 : Math.PI / 2);
        dummy.rotation.set(0, angle + (Math.random() - 0.5) * 0.2, 0);
        dummy.updateMatrix();
        cabinMesh.setMatrixAt(cabinIdx++, dummy.matrix);
      }

      // Spawn streetlights on alternating sides (every 36 meters)
      if (i % 2 === 0 && i < segmentCount - 1) {
        const side = (i / 2) % 2 === 0 ? 1 : -1;
        const lightP = p.clone().addScaledVector(r, side * 7.5); // just outside road barrier
        
        dummy.position.copy(lightP);
        // Rotate streetlight to face the road
        const angle = Math.atan2(t.x, t.z) + (side === 1 ? -Math.PI / 2 : Math.PI / 2);
        dummy.rotation.set(0, angle, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        
        streetlightMesh.setMatrixAt(lightIdx++, dummy.matrix);

        // Store positions for real-time light placement (to enable head/spotlights at night)
        this.streetlightPositions.push({
          pos: lightP.clone().add(new THREE.Vector3(0, 5.5, 0)), // lamp source height
          dir: new THREE.Vector3(0, -1, 0)
        });
      }
    }

    treeMesh.count = treeIdx;
    rockMesh.count = rockIdx;
    cabinMesh.count = cabinIdx;
    streetlightMesh.count = lightIdx;

    this.registerInstancedMesh(scene, treeMesh);
    this.registerInstancedMesh(scene, rockMesh);
    this.registerInstancedMesh(scene, cabinMesh);
    this.registerInstancedMesh(scene, streetlightMesh);

    // Large background mountain range planes
    this.createBackgroundMountains(scene, curve, 0x1f2720);
  }

  // ==========================================
  // Coastal Biome (Ocean & Palms)
  // ==========================================
  buildCoastalScenery(scene, points, curve, segmentCount, up) {
    this.createProceduralTerrain(scene, curve, 'coastal', 0xb8986c);
    
    // 1. Palm tree model geometry
    const trunkGeo = new THREE.CylinderGeometry(0.12, 0.22, 4.0, 5);
    trunkGeo.translate(0, 2.0, 0);
    // Add curved bends to palm trunks
    const pos = trunkGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const yVal = pos.getY(i);
      pos.setX(i, pos.getX(i) + Math.pow(yVal / 4.0, 2) * 0.4); // bend trunk slightly
    }
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7c5d3f, roughness: 0.95 });

    // Fronds (leaves)
    const leafGeos = [];
    const numFronds = 6;
    for (let j = 0; j < numFronds; j++) {
      const leafGeo = new THREE.BoxGeometry(0.3, 0.02, 2.0);
      leafGeo.translate(0, 4.0, 1.0); // offset from trunk top
      leafGeo.rotateX(-0.3); // droop down
      leafGeo.rotateY((j * Math.PI * 2) / numFronds);
      leafGeos.push(leafGeo);
    }
    const mergedLeaves = this.mergeGeometriesManual(leafGeos);
    const mergedPalmGeo = this.mergeGeometriesManual([trunkGeo, mergedLeaves]);
    const palmMat = new THREE.MeshStandardMaterial({ color: 0x1c5a24, roughness: 0.8 });

    const maxPalms = segmentCount * 4;
    const palmMesh = new THREE.InstancedMesh(mergedPalmGeo, palmMat, maxPalms);

    // 2. Coastal Villas
    const villaGeo = this.getCoastalVillaGeometry();
    const villaMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.5 });
    const villaMesh = new THREE.InstancedMesh(villaGeo, villaMat, Math.floor(segmentCount / 8) + 2);

    // 3. Streetlights
    const lightModel = this.getStreetlightGeometry();
    const streetlightMesh = new THREE.InstancedMesh(lightModel.geo, lightModel.mat, segmentCount / 2);

    let palmIdx = 0;
    let villaIdx = 0;
    let lightIdx = 0;
    const dummy = new THREE.Object3D();

    for (let i = 0; i < segmentCount; i++) {
      const p = points[i];
      const t = curve.getTangentAt(i / segmentCount);
      const r = new THREE.Vector3().crossVectors(t, up).normalize();

      // Spawn palms (left side is coastal cliffs, right side is ocean beach)
      // Left side: Cliffs & trees
      for (let j = 0; j < 2; j++) {
        const offset = 8.5 + Math.random() * 12;
        const spawnP = p.clone().addScaledVector(r, -offset); // Left side
        spawnP.y = this.getTerrainHeight(p, -offset, spawnP, 'coastal');

        dummy.position.copy(spawnP);
        const scale = 0.8 + Math.random() * 0.5;
        dummy.scale.set(scale, scale, scale);
        dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
        dummy.updateMatrix();
        palmMesh.setMatrixAt(palmIdx++, dummy.matrix);
      }

      // Right side: Beach palms
      if (i % 3 === 0) {
        const offset = 9.0 + Math.random() * 5;
        const spawnP = p.clone().addScaledVector(r, offset); // Right side
        spawnP.y = this.getTerrainHeight(p, offset, spawnP, 'coastal');

        dummy.position.copy(spawnP);
        const scale = 0.8 + Math.random() * 0.4;
        dummy.scale.set(scale, scale, scale);
        dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
        dummy.updateMatrix();
        palmMesh.setMatrixAt(palmIdx++, dummy.matrix);
      }

      // Coastal Villas (every 8 segments on cliff-side distance < 0)
      if (i % 8 === 0) {
        const side = -1;
        const offset = side * (15 + Math.random() * 8);
        const spawnP = p.clone().addScaledVector(r, offset);
        spawnP.y = this.getTerrainHeight(p, offset, spawnP, 'coastal');

        dummy.position.copy(spawnP);
        const scale = 1.0 + Math.random() * 0.3;
        dummy.scale.set(scale, scale, scale);
        const angle = Math.atan2(t.x, t.z) - Math.PI / 2; // face the road
        dummy.rotation.set(0, angle + (Math.random() - 0.5) * 0.1, 0);
        dummy.updateMatrix();
        villaMesh.setMatrixAt(villaIdx++, dummy.matrix);
      }

      // Streetlights (every 36 meters)
      if (i % 2 === 0 && i < segmentCount - 1) {
        const lightP = p.clone().addScaledVector(r, -7.5); // streetlights on cliff side
        dummy.position.copy(lightP);
        const angle = Math.atan2(t.x, t.z) - Math.PI / 2;
        dummy.rotation.set(0, angle, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();

        streetlightMesh.setMatrixAt(lightIdx++, dummy.matrix);

        this.streetlightPositions.push({
          pos: lightP.clone().add(new THREE.Vector3(0, 5.5, 0)),
          dir: new THREE.Vector3(0, -1, 0)
        });
      }
    }

    palmMesh.count = palmIdx;
    villaMesh.count = villaIdx;
    streetlightMesh.count = lightIdx;

    this.registerInstancedMesh(scene, palmMesh);
    this.registerInstancedMesh(scene, villaMesh);
    this.registerInstancedMesh(scene, streetlightMesh);

    // 3. Create Ocean plane (Giant plane on the right side of the road)
    this.createOcean(scene, curve);
  }

  // ==========================================
  // Tokyo Cyber Biome (Neon Skyscrapers)
  // ==========================================
  buildTokyoScenery(scene, points, curve, segmentCount, up) {
    this.createProceduralTerrain(scene, curve, 'tokyo', 0x08080c);
    
    // 1. Skyscraper instances
    // We build 3 classes of buildings to populate the city
    const bldGeo1 = new THREE.BoxGeometry(10, 50, 10);
    bldGeo1.translate(0, 25, 0);
    const bldMat1 = new THREE.MeshStandardMaterial({
      color: 0x11111a,
      roughness: 0.1,
      metalness: 0.8,
      emissive: 0x00ffff,
      emissiveIntensity: 0.35
    });
    const meshBld1 = new THREE.InstancedMesh(bldGeo1, bldMat1, segmentCount * 2);

    const bldGeo2 = new THREE.BoxGeometry(16, 75, 16);
    bldGeo2.translate(0, 37.5, 0);
    const bldMat2 = new THREE.MeshStandardMaterial({
      color: 0x0c0c14,
      roughness: 0.2,
      metalness: 0.8,
      emissive: 0xff00ff,
      emissiveIntensity: 0.25
    });
    const meshBld2 = new THREE.InstancedMesh(bldGeo2, bldMat2, segmentCount);

    const bldGeo3 = new THREE.BoxGeometry(22, 110, 22);
    bldGeo3.translate(0, 55, 0);
    const bldMat3 = new THREE.MeshStandardMaterial({
      color: 0x08080f,
      roughness: 0.2,
      metalness: 0.9,
      emissive: 0x39ff14,
      emissiveIntensity: 0.25
    });
    const meshBld3 = new THREE.InstancedMesh(bldGeo3, bldMat3, Math.floor(segmentCount / 2));

    // 2. Sakura Cherry Blossom Trees
    const sakuraModel = this.getTokyoSakuraGeometry();
    const sakuraTrunkMat = new THREE.MeshStandardMaterial({ color: 0x4d2912, roughness: 0.9 });
    const sakuraFoliageMat = new THREE.MeshStandardMaterial({
      color: 0xffb7c5,
      emissive: 0xff69b4,
      emissiveIntensity: 0.45,
      roughness: 0.6
    });

    const sakuraTrunkMesh = new THREE.InstancedMesh(sakuraModel.trunkGeo, sakuraTrunkMat, segmentCount * 2);
    const sakuraFoliageMesh = new THREE.InstancedMesh(sakuraModel.foliageGeo, sakuraFoliageMat, segmentCount * 2);

    // 3. Cyber highway support poles (Tokyo is elevated)
    const poleGeo = new THREE.CylinderGeometry(0.8, 1.2, 22.0, 6);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x22222b, roughness: 0.7, metalness: 0.5 });
    const poleMesh = new THREE.InstancedMesh(poleGeo, poleMat, Math.floor(segmentCount / 2));

    // 4. Cyber neon arches (overhead wireframes)
    const archGeo = new THREE.TorusGeometry(8.5, 0.15, 6, 16, Math.PI);
    archGeo.rotateZ(-Math.PI / 2);
    archGeo.translate(0, 0, 0); // positioning
    const archMat = new THREE.MeshBasicMaterial({ color: 0xff00ff }); // cyber magenta arches
    const archMesh = new THREE.InstancedMesh(archGeo, archMat, Math.floor(segmentCount / 3));

    let b1Idx = 0, b2Idx = 0, b3Idx = 0, sakuraIdx = 0, poleIdx = 0, archIdx = 0;
    const dummy = new THREE.Object3D();

    for (let i = 0; i < segmentCount; i++) {
      const p = points[i];
      const t = curve.getTangentAt(i / segmentCount);
      const r = new THREE.Vector3().crossVectors(t, up).normalize();

      // Tokyo is elevated, place supporting arches/piers (every 36 meters)
      if (i % 2 === 0 && p.y > 2) {
        dummy.position.copy(p).add(new THREE.Vector3(0, -11.0, 0));
        dummy.scale.set(1, 1, 1);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        poleMesh.setMatrixAt(poleIdx++, dummy.matrix);
      }

      // Overhead glowing neon arches (every 54 meters)
      if (i % 3 === 0) {
        dummy.position.copy(p).add(new THREE.Vector3(0, -0.2, 0));
        const yaw = Math.atan2(t.x, t.z);
        dummy.rotation.set(0, yaw, 0);
        dummy.scale.set(1, 1.1, 1);
        dummy.updateMatrix();
        archMesh.setMatrixAt(archIdx++, dummy.matrix);
      }

      // Spawn skyscrapers flanking the highway
      const spawnBuilding = (mesh, idx, offsetMult, heightScale) => {
        const side = Math.random() > 0.5 ? 1 : -1;
        const offset = 22 + Math.random() * 45;
        const bldP = p.clone().addScaledVector(r, side * offset);
        bldP.y = this.getTerrainHeight(p, side * offset, bldP, 'tokyo');

        dummy.position.copy(bldP);
        dummy.scale.set(1, heightScale, 1);
        dummy.rotation.set(0, Math.random() * Math.PI, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(idx, dummy.matrix);
      };

      spawnBuilding(meshBld1, b1Idx++, 1, 0.7 + Math.random() * 0.6);
      if (i % 2 === 0) spawnBuilding(meshBld2, b2Idx++, 1.5, 0.8 + Math.random() * 0.5);
      if (i % 4 === 0) spawnBuilding(meshBld3, b3Idx++, 2.0, 0.9 + Math.random() * 0.4);

      // Spawn Tokyo Sakura Trees (every 2 segments on both sides)
      if (i % 2 === 0) {
        for (let side of [-1, 1]) {
          const offset = side * 8.5;
          const spawnP = p.clone().addScaledVector(r, offset);
          spawnP.y = this.getTerrainHeight(p, offset, spawnP, 'tokyo');

          dummy.position.copy(spawnP);
          const scale = 0.8 + Math.random() * 0.4;
          dummy.scale.set(scale, scale, scale);
          dummy.rotation.set(
            (Math.random() - 0.5) * 0.05,
            Math.random() * Math.PI,
            (Math.random() - 0.5) * 0.05
          );
          dummy.updateMatrix();

          sakuraTrunkMesh.setMatrixAt(sakuraIdx, dummy.matrix);
          sakuraFoliageMesh.setMatrixAt(sakuraIdx, dummy.matrix);
          sakuraIdx++;
        }
      }

      // Add Tokyo streetlights (every 18 meters)
      const lightP1 = p.clone().addScaledVector(r, 7.5);
      const lightP2 = p.clone().addScaledVector(r, -7.5);
      
      this.streetlightPositions.push({
        pos: lightP1.clone().add(new THREE.Vector3(0, 5.5, 0)),
        dir: new THREE.Vector3(0, -1, 0)
      });
      this.streetlightPositions.push({
        pos: lightP2.clone().add(new THREE.Vector3(0, 5.5, 0)),
        dir: new THREE.Vector3(0, -1, 0)
      });
    }

    meshBld1.count = b1Idx;
    meshBld2.count = b2Idx;
    meshBld3.count = b3Idx;
    sakuraTrunkMesh.count = sakuraIdx;
    sakuraFoliageMesh.count = sakuraIdx;
    poleMesh.count = poleIdx;
    archMesh.count = archIdx;

    this.registerInstancedMesh(scene, meshBld1);
    this.registerInstancedMesh(scene, meshBld2);
    this.registerInstancedMesh(scene, meshBld3);
    this.registerInstancedMesh(scene, sakuraTrunkMesh);
    this.registerInstancedMesh(scene, sakuraFoliageMesh);
    this.registerInstancedMesh(scene, poleMesh);
    this.registerInstancedMesh(scene, archMesh);
  }

  // ==========================================
  // Desert Biome (Canyon Rocks & Cacti)
  // ==========================================
  buildDesertScenery(scene, points, curve, segmentCount, up) {
    this.createProceduralTerrain(scene, curve, 'desert', 0xbf784b);
    
    // 1. Saguaro Cactus Geometry
    // Main column
    const bodyGeo = new THREE.CylinderGeometry(0.18, 0.18, 2.2, 5);
    bodyGeo.translate(0, 1.1, 0);
    // Right arm
    const armRGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.8, 5);
    armRGeo.rotateZ(Math.PI / 2);
    armRGeo.translate(0.4, 1.3, 0);
    const armRUp = new THREE.CylinderGeometry(0.12, 0.12, 0.8, 5);
    armRUp.translate(0.8, 1.7, 0);
    // Left arm
    const armLGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.8, 5);
    armLGeo.rotateZ(-Math.PI / 2);
    armLGeo.translate(-0.4, 0.9, 0);
    const armLUp = new THREE.CylinderGeometry(0.12, 0.12, 0.8, 5);
    armLUp.translate(-0.8, 1.3, 0);

    const mergedCactus = this.mergeGeometriesManual([bodyGeo, armRGeo, armRUp, armLGeo, armLUp]);
    const cactusMat = new THREE.MeshStandardMaterial({ color: 0x486b3e, roughness: 0.9 });
    const cactusMesh = new THREE.InstancedMesh(mergedCactus, cactusMat, segmentCount * 3);

    // 2. Canyon rocks (Giant flat-topped mesas)
    const mesaGeo = new THREE.CylinderGeometry(15, 17, 18, 6, 2);
    const mesaMat = new THREE.MeshStandardMaterial({ color: 0xba6a44, roughness: 0.9 });
    const mesaMesh = new THREE.InstancedMesh(mesaGeo, mesaMat, Math.floor(segmentCount / 2));

    // 3. Desert Adobe Houses
    const desertHouseGeo = this.getDesertHouseGeometry();
    const desertHouseMat = new THREE.MeshStandardMaterial({ color: 0xd2b48c, roughness: 0.9 });
    const desertHouseMesh = new THREE.InstancedMesh(desertHouseGeo, desertHouseMat, Math.floor(segmentCount / 8) + 2);

    // 4. Tumbleweeds / Dry bushes
    const tumbleGeo = new THREE.DodecahedronGeometry(0.6, 1);
    const tumbleMat = new THREE.MeshStandardMaterial({ color: 0x937c68, roughness: 1.0, wireframe: true });
    const tumbleMesh = new THREE.InstancedMesh(tumbleGeo, tumbleMat, segmentCount * 2);

    let cactusIdx = 0, mesaIdx = 0, desertHouseIdx = 0, tumbleIdx = 0;
    const dummy = new THREE.Object3D();

    for (let i = 0; i < segmentCount; i++) {
      const p = points[i];
      const t = curve.getTangentAt(i / segmentCount);
      const r = new THREE.Vector3().crossVectors(t, up).normalize();

      // Cacti (every 18m flanking road)
      for (let j = 0; j < 3; j++) {
        const side = j % 2 === 0 ? 1 : -1;
        const offset = 8.5 + Math.random() * 15;
        const spawnP = p.clone().addScaledVector(r, side * offset);
        spawnP.y = this.getTerrainHeight(p, side * offset, spawnP, 'desert');

        dummy.position.copy(spawnP);
        const scale = 0.8 + Math.random() * 0.6;
        dummy.scale.set(scale, scale, scale);
        dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
        dummy.updateMatrix();
        cactusMesh.setMatrixAt(cactusIdx++, dummy.matrix);
      }

      // Tumbleweeds
      if (i % 2 === 0) {
        const side = Math.random() > 0.5 ? 1 : -1;
        const offset = side * (8.0 + Math.random() * 6);
        const spawnP = p.clone().addScaledVector(r, offset);
        spawnP.y = this.getTerrainHeight(p, offset, spawnP, 'desert');

        dummy.position.copy(spawnP);
        dummy.scale.set(0.6 + Math.random() * 0.5, 0.6 + Math.random() * 0.5, 0.6 + Math.random() * 0.5);
        dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        dummy.updateMatrix();
        tumbleMesh.setMatrixAt(tumbleIdx++, dummy.matrix);
      }

      // Desert Adobe Houses (every 8 segments alternating sides)
      if (i % 8 === 0) {
        const side = (i / 8) % 2 === 0 ? 1 : -1;
        const offset = side * (14 + Math.random() * 6);
        const spawnP = p.clone().addScaledVector(r, offset);
        spawnP.y = this.getTerrainHeight(p, offset, spawnP, 'desert');

        dummy.position.copy(spawnP);
        const scale = 1.0 + Math.random() * 0.3;
        dummy.scale.set(scale, scale, scale);
        const angle = Math.atan2(t.x, t.z) + (side === 1 ? -Math.PI / 2 : Math.PI / 2);
        dummy.rotation.set(0, angle + (Math.random() - 0.5) * 0.15, 0);
        dummy.updateMatrix();
        desertHouseMesh.setMatrixAt(desertHouseIdx++, dummy.matrix);
      }

      // Mesas (Giant mountains, every 36m)
      if (i % 2 === 0) {
        const side = (i / 2) % 2 === 0 ? 1 : -1;
        const offset = side * (50 + Math.random() * 40);
        const spawnP = p.clone().addScaledVector(r, offset);
        spawnP.y = this.getTerrainHeight(p, offset, spawnP, 'desert') - 5; // deep base

        dummy.position.copy(spawnP);
        const scale = 1.0 + Math.random() * 2.0;
        dummy.scale.set(scale, scale * 1.5, scale);
        dummy.rotation.set(0, Math.random() * Math.PI, 0);
        dummy.updateMatrix();
        mesaMesh.setMatrixAt(mesaIdx++, dummy.matrix);
      }
    }

    cactusMesh.count = cactusIdx;
    mesaMesh.count = mesaIdx;
    desertHouseMesh.count = desertHouseIdx;
    tumbleMesh.count = tumbleIdx;

    this.registerInstancedMesh(scene, cactusMesh);
    this.registerInstancedMesh(scene, mesaMesh);
    this.registerInstancedMesh(scene, desertHouseMesh);
    this.registerInstancedMesh(scene, tumbleMesh);

    // Large background desert hills
    this.createBackgroundMountains(scene, curve, 0xd07c4c);
  }

  // ==========================================
  // Helper functions for Background & Scenery
  // ==========================================

  /**
   * Generates structural mesh for streetlights
   */
  getStreetlightGeometry() {
    // Pole
    const poleGeo = new THREE.CylinderGeometry(0.08, 0.12, 5.5, 4);
    poleGeo.translate(0, 2.75, 0);
    // Arm
    const armGeo = new THREE.CylinderGeometry(0.06, 0.08, 1.8, 4);
    armGeo.rotateZ(Math.PI / 2);
    armGeo.translate(0.9, 5.5, 0);
    // Head (bulb casing)
    const headGeo = new THREE.BoxGeometry(0.4, 0.15, 0.25);
    headGeo.translate(1.8, 5.5, 0);

    const merged = this.mergeGeometriesManual([poleGeo, armGeo, headGeo]);
    const mat = new THREE.MeshStandardMaterial({ color: 0x3d4345, roughness: 0.5, metalness: 0.7 });
    return { geo: merged, mat: mat };
  }

  /**
   * Renders background mountain ranges using simple flat triangle strips or displaced planes
   */
  createBackgroundMountains(scene, curve, colorHex) {
    const points = curve.getSpacedPoints(60);
    const mountainGeo = new THREE.BufferGeometry();
    const vertices = [];
    const indices = [];
    const up = new THREE.Vector3(0, 1, 0);
    
    // Build left and right mountain peaks
    // Left peak line
    const mountainL = [];
    // Right peak line
    const mountainR = [];

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      let t;
      if (i === points.length - 1) {
        t = curve.getTangentAt(1);
      } else {
        t = curve.getTangentAt(i / points.length);
      }
      
      const r = new THREE.Vector3().crossVectors(t, up).normalize();
      
      // Calculate background peak position
      const leftMesaP = p.clone().addScaledVector(r, -220);
      const rightMesaP = p.clone().addScaledVector(r, 220);
      
      // Seed height using sine & noise
      const hL = 40 + noise.noise2D(i * 0.15, 12.3) * 60;
      const hR = 40 + noise.noise2D(i * 0.15, 45.6) * 60;
      
      leftMesaP.y += hL;
      rightMesaP.y += hR;
      
      mountainL.push(leftMesaP);
      mountainR.push(rightMesaP);
    }

    // Convert peaks into a 3D wall mesh (triangles between peaks and bases)
    // Left mountain range vertices
    const wallLVerts = [];
    const wallLIndices = [];
    for (let i = 0; i < mountainL.length; i++) {
      const peak = mountainL[i];
      // base of mountain (tucked below ground level)
      const base = peak.clone();
      base.y = -35;
      
      wallLVerts.push(peak.x, peak.y, peak.z);
      wallLVerts.push(base.x, base.y, base.z);

      if (i < mountainL.length - 1) {
        const curr = i * 2;
        const next = (i + 1) * 2;
        wallLIndices.push(curr, curr + 1, next);
        wallLIndices.push(curr + 1, next + 1, next);
      }
    }
    
    const mGeoL = new THREE.BufferGeometry();
    mGeoL.setAttribute('position', new THREE.Float32BufferAttribute(wallLVerts, 3));
    mGeoL.setIndex(wallLIndices);
    mGeoL.computeVertexNormals();

    const mGeoR = new THREE.BufferGeometry();
    const wallRVerts = [];
    const wallRIndices = [];
    for (let i = 0; i < mountainR.length; i++) {
      const peak = mountainR[i];
      const base = peak.clone();
      base.y = -35;
      
      wallRVerts.push(peak.x, peak.y, peak.z);
      wallRVerts.push(base.x, base.y, base.z);

      if (i < mountainR.length - 1) {
        const curr = i * 2;
        const next = (i + 1) * 2;
        wallRIndices.push(curr, curr + 1, next);
        wallRIndices.push(curr + 1, next + 1, next);
      }
    }
    
    mGeoR.setAttribute('position', new THREE.Float32BufferAttribute(wallRVerts, 3));
    mGeoR.setIndex(wallRIndices);
    mGeoR.computeVertexNormals();

    const mMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      roughness: 0.95,
      metalness: 0.05,
      flatShading: true,
      side: THREE.DoubleSide
    });

    const meshL = new THREE.Mesh(mGeoL, mMat);
    const meshR = new THREE.Mesh(mGeoR, mMat);
    
    scene.add(meshL);
    scene.add(meshR);
    this.instancedMeshes.push(meshL);
    this.instancedMeshes.push(meshR);
  }

  getAlpineCabinGeometry() {
    // Cabin base
    const baseGeo = new THREE.BoxGeometry(4.0, 2.5, 4.0);
    baseGeo.translate(0, 1.25, 0);

    // Roof (a cone scaled to look like a prism, or standard Cone/Box)
    const roofGeo = new THREE.CylinderGeometry(0.01, 3.2, 2.0, 4, 1);
    roofGeo.rotateY(Math.PI / 4); // rotate to align boxy corners
    roofGeo.translate(0, 2.5 + 1.0, 0);

    // Chimney
    const chimneyGeo = new THREE.BoxGeometry(0.4, 1.2, 0.4);
    chimneyGeo.translate(1.0, 2.5 + 1.0, 0.8);

    const merged = this.mergeGeometriesManual([baseGeo, roofGeo, chimneyGeo]);
    return merged;
  }

  getCoastalVillaGeometry() {
    // Cubist modern villa
    // Lower level box
    const lowerGeo = new THREE.BoxGeometry(5.5, 2.8, 5.0);
    lowerGeo.translate(0, 1.4, 0);

    // Upper level box (shifted)
    const upperGeo = new THREE.BoxGeometry(4.2, 2.4, 4.2);
    upperGeo.translate(-0.6, 2.8 + 1.2, 0.4);

    // Balcony glass fence
    const glassGeo = new THREE.BoxGeometry(4.0, 0.8, 0.08);
    glassGeo.translate(0.8, 2.8 + 0.4, 2.2);

    const merged = this.mergeGeometriesManual([lowerGeo, upperGeo, glassGeo]);
    return merged;
  }

  getDesertHouseGeometry() {
    // Pueblo style adobe house
    // Main base
    const baseGeo = new THREE.BoxGeometry(4.5, 3.0, 4.5);
    baseGeo.translate(0, 1.5, 0);

    // Small entry portal
    const entryGeo = new THREE.BoxGeometry(1.6, 2.0, 1.2);
    entryGeo.translate(0, 1.0, 2.25);

    // Parapet roof rim
    const rimGeo = new THREE.BoxGeometry(4.7, 0.3, 4.7);
    rimGeo.translate(0, 3.0 + 0.15, 0);

    const merged = this.mergeGeometriesManual([baseGeo, entryGeo, rimGeo]);
    return merged;
  }

  getTokyoSakuraGeometry() {
    // Sakura cherry blossom tree (separating trunk and foliage)
    // Trunk Cylinder
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 3.5, 6);
    trunkGeo.translate(0, 1.75, 0);

    // Overlapping foliage spheres
    const f1 = new THREE.DodecahedronGeometry(1.5, 1);
    f1.translate(0, 3.5 + 0.8, 0);
    
    const f2 = new THREE.DodecahedronGeometry(1.1, 1);
    f2.translate(0.9, 3.5 + 0.4, 0.5);

    const f3 = new THREE.DodecahedronGeometry(1.1, 1);
    f3.translate(-0.8, 3.5 + 0.5, -0.6);

    const foliageGeo = this.mergeGeometriesManual([f1, f2, f3]);
    return { trunkGeo, foliageGeo };
  }

  /**
   * Generates a giant ocean plane
   */
  createOcean(scene, curve) {
    // Generate a massive plane spanning the right side of the road
    const points = curve.getSpacedPoints(10);
    const boundingBox = new THREE.Box3();
    points.forEach(p => boundingBox.expandByPoint(p));
    
    const sizeX = Math.max(1200, boundingBox.max.x - boundingBox.min.x + 800);
    const sizeZ = Math.max(1200, boundingBox.max.z - boundingBox.min.z + 800);
    
    const oceanGeo = new THREE.PlaneGeometry(sizeX, sizeZ, 1, 1);
    oceanGeo.rotateX(-Math.PI / 2);
    
    const oceanMat = new THREE.MeshStandardMaterial({
      color: 0x052e44,
      roughness: 0.1,
      metalness: 0.6,
      transparent: true,
      opacity: 0.85
    });
    
    const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
    // Place ocean slightly below road base level
    oceanMesh.position.set(boundingBox.getCenter(new THREE.Vector3()).x + 300, -3.8, boundingBox.getCenter(new THREE.Vector3()).z);
    
    scene.add(oceanMesh);
    this.instancedMeshes.push(oceanMesh);
  }

  /**
   * Manual geometry merge helper to avoid BufferGeometryUtils dependency overhead
   */
  mergeGeometriesManual(geometries) {
    let totalPosCount = 0;
    geometries.forEach(geo => {
      totalPosCount += geo.attributes.position.count;
    });

    const positions = new Float32Array(totalPosCount * 3);
    const normals = new Float32Array(totalPosCount * 3);
    let offset = 0;

    geometries.forEach(geo => {
      // Ensure normals are computed
      if (!geo.attributes.normal) geo.computeVertexNormals();

      const pos = geo.attributes.position.array;
      const norm = geo.attributes.normal.array;
      
      positions.set(pos, offset * 3);
      normals.set(norm, offset * 3);
      offset += geo.attributes.position.count;
    });

    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    return merged;
  }
}
export { noise };
