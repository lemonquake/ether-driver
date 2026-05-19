import * as THREE from 'three';
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

export const mapSize = 430;

export const baseSafetyZones = [
  { x: -193, z: -193, radius: 92 },
  { x: 193, z: 193, radius: 92 },
  { x: 193, z: -193, radius: 92 },
  { x: -193, z: 193, radius: 92 },
];

export function overlapsBaseSafetyZone(x, z, w = 0, d = 0) {
  const padding = Math.max(w, d) * 0.55;
  return baseSafetyZones.some((zone) => Math.hypot(x - zone.x, z - zone.z) <= zone.radius + padding);
}

export function register(ctx, type, x, z, w, d, r = 0, padding = 0.2, height = 0) {
  if (type !== 'wall' && overlapsBaseSafetyZone(x, z, w, d)) return false;
  ctx.collisionShapes.push({ type, x, z, w, d, r, padding, height });
  ctx.minimapObjects.push({ type: type === 'building' ? 'building' : 'obstacle', x, z, w, d, r });
  return true;
}

function createWedgeGeometry(w, d, hStart, hEnd) {
  const geom = new THREE.BufferGeometry();
  const x1 = -w / 2, x2 = w / 2;
  const z1 = -d / 2, z2 = d / 2;
  
  const vertices = new Float32Array([
    x1, 0, z1, // 0
    x2, 0, z1, // 1
    x2, 0, z2, // 2
    x1, 0, z2, // 3
    x1, hStart, z1, // 4
    x2, hStart, z1, // 5
    x2, hEnd, z2,   // 6
    x1, hEnd, z2    // 7
  ]);
  
  const indices = [
    0, 2, 1,  0, 3, 2, // bottom
    4, 5, 6,  4, 6, 7, // top slope
    0, 1, 5,  0, 5, 4, // back
    2, 3, 7,  2, 7, 6, // front
    0, 4, 7,  0, 7, 3, // left
    1, 2, 6,  1, 6, 5  // right
  ];
  
  geom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

export function addRamp(ctx, materials, x, z, w, d, yaw, hStart, hEnd) {
  if (!ctx.ramps) ctx.ramps = [];
  ctx.ramps.push({ x, z, w, d, yaw, hStart, hEnd });

  const geom = createWedgeGeometry(w, d, hStart, hEnd);
  const material = new THREE.MeshStandardMaterial({
    color: 0x3e4247,
    roughness: 0.88,
    metalness: 0.15,
    side: THREE.DoubleSide
  });

  const mesh = new THREE.Mesh(geom, material);
  mesh.position.set(x, 0.02, z);
  mesh.rotation.y = yaw;
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  (ctx.mapGroup || ctx.scene).add(mesh);
  ctx.minimapObjects.push({ type: 'ramp', x, z, w, d, r: yaw });
}

export function addRoad(ctx, materials, x, z, w, d) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), materials.asphalt);
  mesh.position.set(x, 0.02, z);
  mesh.receiveShadow = true;
  (ctx.mapGroup || ctx.scene).add(mesh);
  ctx.roads.push({ x, z, w, d });
}

export function addBuilding(ctx, materials, x, z, w, h, d, material, collisionHeight = 0) {
  if (overlapsBaseSafetyZone(x, z, w, d)) return;
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  body.position.y = h / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  const front = new THREE.Mesh(new THREE.BoxGeometry(w * 0.82, h * 0.82, 0.04), materials.windows);
  front.position.set(0, h * 0.52, -d / 2 - 0.024);
  group.add(front);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 1.04, 0.22, d * 1.04), materials.concrete);
  roof.position.y = h + 0.12;
  group.add(roof);
  group.position.set(x, 0, z);
  (ctx.mapGroup || ctx.scene).add(group);
  register(ctx, 'building', x, z, w, d, 0, 0.35, collisionHeight);
}

export function addBarrier(ctx, materials, x, z, r = 0) {
  if (overlapsBaseSafetyZone(x, z, 5.4, 0.9)) return;
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.55, 0.42), materials.hazard);
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);
  group.position.set(x, 0.32, z);
  group.rotation.y = r;
  (ctx.mapGroup || ctx.scene).add(group);
  register(ctx, 'barrier', x, z, 5.4, 0.9, r, 0.2);
}

export function addCrateStack(ctx, materials, x, z) {
  if (overlapsBaseSafetyZone(x, z, 5, 3)) return;
  for (let i = 0; i < 3; i += 1) {
    const size = 1.2 + Math.random() * 0.5;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), materials.brick);
    mesh.position.set(x + i * 1.05, size / 2, z + (i % 2) * 0.9);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    (ctx.mapGroup || ctx.scene).add(mesh);
    register(ctx, 'crate', mesh.position.x, mesh.position.z, size, size, 0, 0.2);
  }
}

export function addParkedCar(ctx, materials, x, z, color, r = 0) {
  if (overlapsBaseSafetyZone(x, z, 2.25, 4.05)) return;
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.45 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.55, 3.7), paint);
  base.position.y = 0.62;
  group.add(base);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.7, 1.45), materials.glass);
  cabin.position.set(0, 1.15, -0.15);
  group.add(cabin);
  group.position.set(x, 0, z);
  group.rotation.y = r;
  (ctx.mapGroup || ctx.scene).add(group);
  register(ctx, 'parked-car', x, z, 2.25, 4.05, r, 0.25);
}

export function addLamp(ctx, materials, x, z) {
  const group = new THREE.Group();

  // 1. Vertical metallic pole
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 5.4, 12), materials.lamp);
  pole.position.y = 2.7;
  pole.castShadow = true;
  pole.receiveShadow = true;
  group.add(pole);

  // 2. Horizontal support arm extending to x + 1.6
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.08), materials.lamp);
  arm.position.set(0.8, 5.3, 0);
  arm.castShadow = true;
  group.add(arm);

  // 3. Futuristic lamp head hood cover
  const hood = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.35), materials.concrete);
  hood.position.set(1.6, 5.2, 0);
  hood.castShadow = true;
  group.add(hood);

  // 4. Emissive glowing bulb
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffeab3 });
  const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.05, 0.25), bulbMat);
  bulb.position.set(1.6, 5.12, 0);
  group.add(bulb);

  // 5. Light source
  const light = new THREE.PointLight(0xffc77a, 2.5, 32, 1.8);
  light.position.set(1.6, 4.7, 0);
  group.add(light);

  group.position.set(x, 0, z);
  (ctx.mapGroup || ctx.scene).add(group);
}

export function addBorderWalls(ctx, size, wallColor, materials) {
  const limit = size * 0.5;
  const wallHeight = 8;
  const wallThickness = 2.5;

  const bordersGroup = new THREE.Group();
  bordersGroup.name = 'borderWalls';

  const borderMat = materials.concrete;
  const metalMat = materials.lamp;
  const neonMat = new THREE.MeshStandardMaterial({
    color: wallColor,
    emissive: wallColor,
    emissiveIntensity: 2.8,
    transparent: true,
    opacity: 0.95
  });

  // Helper to build a single boundary wall segment
  const buildOneSideWall = (length, x, z, angle) => {
    const sideGroup = new THREE.Group();
    sideGroup.position.set(x, 0, z);
    sideGroup.rotation.y = angle;

    // Concrete base wall
    const base = new THREE.Mesh(new THREE.BoxGeometry(length, 2.8, wallThickness), borderMat);
    base.position.y = 1.4;
    base.castShadow = true;
    base.receiveShadow = true;
    sideGroup.add(base);

    // Decorative support pillars
    const pillarSpacing = 30;
    const halfLen = length * 0.5;
    for (let pos = -halfLen; pos <= halfLen; pos += pillarSpacing) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.65, 7.5, 8), metalMat);
      pillar.position.set(pos, 3.75, 0);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      sideGroup.add(pillar);

      // Glowing power cap
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 8), neonMat);
      cap.position.set(pos, 7.5, 0);
      sideGroup.add(cap);

      // Accent warning bands on the pillars
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.08, 4, 8), neonMat);
      band.position.set(pos, 4.0, 0);
      band.rotation.x = Math.PI * 0.5;
      sideGroup.add(band);
    }

    // Horizontal neon guardrails running along the top
    const railUpper = new THREE.Mesh(new THREE.BoxGeometry(length, 0.22, 0.22), neonMat);
    railUpper.position.set(0, 5.0, wallThickness * 0.45 + 0.12);
    sideGroup.add(railUpper);

    const railLower = new THREE.Mesh(new THREE.BoxGeometry(length, 0.22, 0.22), neonMat);
    railLower.position.set(0, 3.2, wallThickness * 0.45 + 0.12);
    sideGroup.add(railLower);

    // Screen panels with hazard striping in between the pillars
    for (let pos = -halfLen + pillarSpacing * 0.5; pos < halfLen; pos += pillarSpacing) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(pillarSpacing - 2.5, 1.25, 0.12), materials.hazard);
      panel.position.set(pos, 2.02, wallThickness * 0.5 + 0.08);
      panel.castShadow = true;
      sideGroup.add(panel);
    }

    bordersGroup.add(sideGroup);
  };

  // Build North, South, East, West borders
  buildOneSideWall(size, 0, -limit, 0); // North
  buildOneSideWall(size, 0, limit, Math.PI); // South
  buildOneSideWall(size, -limit, 0, Math.PI * 0.5); // West
  buildOneSideWall(size, limit, 0, -Math.PI * 0.5); // East

  (ctx.mapGroup || ctx.scene).add(bordersGroup);

  // Register physical collision boundaries
  register(ctx, 'wall', 0, -limit, size, wallThickness, 0, 0);
  register(ctx, 'wall', 0, limit, size, wallThickness, 0, 0);
  register(ctx, 'wall', -limit, 0, wallThickness, size, 0, 0);
  register(ctx, 'wall', limit, 0, wallThickness, size, 0, 0);
}

export function addTrafficArch(ctx, x, z, angle, materials) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = angle;

  const metal = materials.lamp;

  // Left supporting pillar
  const poleL = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7.8, 8), metal);
  poleL.position.set(-11.5, 3.9, 0);
  poleL.castShadow = true;
  group.add(poleL);

  // Right supporting pillar
  const poleR = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7.8, 8), metal);
  poleR.position.set(11.5, 3.9, 0);
  poleR.castShadow = true;
  group.add(poleR);

  // Overhead horizontal beam
  const beam = new THREE.Mesh(new THREE.BoxGeometry(23, 0.22, 0.22), metal);
  beam.position.set(0, 7.6, 0);
  beam.castShadow = true;
  group.add(beam);

  // Tech details: glowing energy core in center of beam
  const coreMat = new THREE.MeshBasicMaterial({ color: 0x82ffcf });
  const core = new THREE.Mesh(new THREE.BoxGeometry(3, 0.1, 0.3), coreMat);
  core.position.set(0, 7.6, 0);
  group.add(core);

  // Traffic lights hanging above each lane
  const boxMat = new THREE.MeshStandardMaterial({ color: 0x14181c, roughness: 0.35 });
  const redGlow = new THREE.MeshBasicMaterial({ color: 0xff1f4f });
  const greenGlow = new THREE.MeshBasicMaterial({ color: 0x00ff66 });

  // 3 Lanes of traffic lights
  const offsets = [-7, 0, 7];
  offsets.forEach((offsetX, idx) => {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.1, 0.4), boxMat);
    box.position.set(offsetX, 6.9, 0);
    box.castShadow = true;
    group.add(box);

    // Glowing signal lens
    const isGreen = idx % 2 === 0;
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), isGreen ? greenGlow : redGlow);
    lens.position.set(offsetX, isGreen ? 6.6 : 7.2, 0.21);
    group.add(lens);

    // Soft light projection from signal
    const sLight = new THREE.PointLight(isGreen ? 0x00ff66 : 0xff1f4f, 2.0, 7, 2);
    sLight.position.set(offsetX, isGreen ? 6.6 : 7.2, 0.4);
    group.add(sLight);
  });

  (ctx.mapGroup || ctx.scene).add(group);
}

export function addPipeline(ctx, x1, z1, x2, z2, height, materials) {
  const dist = Math.hypot(x2 - x1, z2 - z1);
  const yaw = Math.atan2(x2 - x1, z2 - z1);

  const group = new THREE.Group();
  group.position.set((x1 + x2) * 0.5, height, (z1 + z2) * 0.5);
  group.rotation.y = yaw + Math.PI * 0.5; // align along direction

  const metal = materials.lamp;
  const glowMat = new THREE.MeshStandardMaterial({
    color: 0xff4f00,
    emissive: 0xff4f00,
    emissiveIntensity: 2.2,
    roughness: 0.2
  });

  // 1. Thick main industrial tube
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.68, dist, 16), metal);
  pipe.rotation.z = Math.PI * 0.5; // lay flat along local X
  pipe.castShadow = true;
  pipe.receiveShadow = true;
  group.add(pipe);

  // 2. Glowing coupling rings spaced out along the pipeline
  const spacing = 18;
  const halfLen = dist * 0.5;
  for (let offset = -halfLen + 5; offset <= halfLen - 5; offset += spacing) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.09, 6, 16), glowMat);
    ring.position.x = offset; // aligned along X axis because of rotation
    ring.rotation.y = Math.PI * 0.5;
    group.add(ring);
  }

  // 3. Concrete vertical ground supports
  for (let offset = -halfLen + 2; offset <= halfLen - 2; offset += spacing) {
    const support = new THREE.Mesh(new THREE.BoxGeometry(0.6, height + 0.2, 1.2), materials.concrete);
    support.position.set(offset, -height * 0.5 - 0.1, 0);
    support.castShadow = true;
    support.receiveShadow = true;
    group.add(support);

    // Metal collar connecting pipe to support
    const collar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.3, 1.4), metal);
    collar.position.set(offset, 0, 0);
    group.add(collar);
  }

  (ctx.mapGroup || ctx.scene).add(group);

  // Register physical collision shape for the pipeline (so cars don't pass through supports)
  // Register each support column separately to allow passing between them!
  for (let offset = -halfLen + 2; offset <= halfLen - 2; offset += spacing) {
    // Transform support coordinates to world space
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    // local offset vector along local X is: (offset, 0, 0)
    // local coordinates transformed to world:
    const worldX = (x1 + x2) * 0.5 + offset * sin;
    const worldZ = (z1 + z2) * 0.5 + offset * cos;
    register(ctx, 'building', worldX, worldZ, 1.4, 1.4);
  }
}

export function addTeslaCoil(ctx, x, z, height, materials) {
  if (overlapsBaseSafetyZone(x, z, 5, 5)) return;

  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const metal = materials.lamp;
  const cyanGlow = new THREE.MeshStandardMaterial({
    color: 0x00ffcc,
    emissive: 0x00ffcc,
    emissiveIntensity: 3.5,
    roughness: 0.15
  });

  // 1. Concrete platform base
  const base = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 3.3, 0.9, 8), materials.concrete);
  base.position.y = 0.45;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  // 2. High-tech hazard striped bumper ring on base
  const hazardRing = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 2.9, 0.3, 8), materials.hazard);
  hazardRing.position.y = 0.45;
  hazardRing.castShadow = true;
  group.add(hazardRing);

  // 3. Tapered metallic spire tower
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 1.1, height, 8), metal);
  spire.position.y = height * 0.5 + 0.9;
  spire.castShadow = true;
  spire.receiveShadow = true;
  group.add(spire);

  // 4. Stacked glowing torus coils (representing electromagnetic transformers)
  const ringCount = Math.floor(height / 2.2);
  for (let i = 0; i < ringCount; i += 1) {
    const yOffset = 2.2 + i * 2.2;
    const radius = 0.9 - i * 0.12;
    const coil = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.14, 6, 16), cyanGlow);
    coil.position.y = yOffset + 0.9;
    coil.rotation.x = Math.PI * 0.5;
    group.add(coil);
  }

  // 5. Giant plasma emitter capacitor sphere on top
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 16), cyanGlow);
  sphere.position.y = height + 1.6;
  group.add(sphere);

  // 6. Horizontal orbiting capacitor rings on top
  const topRing = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.08, 4, 16), cyanGlow);
  topRing.position.y = height + 1.6;
  topRing.rotation.x = Math.PI * 0.5;
  group.add(topRing);

  // 7. Light source radiating electromagnetic energy
  const light = new THREE.PointLight(0x00ffcc, 4.5, 38, 1.8);
  light.position.set(0, height + 1.6, 0);
  group.add(light);

  (ctx.mapGroup || ctx.scene).add(group);

  // Register physical collision shape (representing the concrete base block)
  register(ctx, 'building', x, z, 5.0, 5.0);
}

export function addTurboTile(ctx, materials, x, z, yaw) {
  const group = new THREE.Group();
  
  const base = new THREE.Mesh(new THREE.BoxGeometry(6, 0.1, 8), materials.concrete);
  base.position.y = 0.05;
  group.add(base);

  const glowMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0xffaa00, emissiveIntensity: 2.5, transparent: true, opacity: 0.8 });
  const arrow1 = new THREE.Mesh(new THREE.ConeGeometry(2, 2, 3), glowMat);
  arrow1.rotation.x = -Math.PI / 2;
  arrow1.position.set(0, 0.15, 1);
  const arrow2 = new THREE.Mesh(new THREE.ConeGeometry(2, 2, 3), glowMat);
  arrow2.rotation.x = -Math.PI / 2;
  arrow2.position.set(0, 0.15, -1.5);

  group.add(arrow1, arrow2);
  
  group.position.set(x, 0.02, z);
  group.rotation.y = yaw;
  (ctx.mapGroup || ctx.scene).add(group);
  
  if (!ctx.specialTiles) ctx.specialTiles = [];
  ctx.specialTiles.push({ type: 'turbo', x, z, w: 6, d: 8, yaw, mesh: group, glowMat, animOffset: Math.random() * Math.PI });
}

export function addJumpTile(ctx, materials, x, z, yaw) {
  const group = new THREE.Group();
  
  const base = new THREE.Mesh(new THREE.BoxGeometry(6, 0.1, 6), materials.concrete);
  base.position.y = 0.05;
  group.add(base);

  const glowMat = new THREE.MeshStandardMaterial({ color: 0x00ffcc, emissive: 0x00ffcc, emissiveIntensity: 2.0, transparent: true, opacity: 0.8 });
  const circle = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.3, 16, 32), glowMat);
  circle.rotation.x = -Math.PI / 2;
  circle.position.y = 0.15;
  
  const core = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.2, 16), glowMat);
  core.position.y = 0.15;

  group.add(circle, core);

  group.position.set(x, 0.02, z);
  group.rotation.y = yaw;
  (ctx.mapGroup || ctx.scene).add(group);
  
  if (!ctx.specialTiles) ctx.specialTiles = [];
  ctx.specialTiles.push({ type: 'jump', x, z, w: 6, d: 6, yaw, mesh: group, glowMat, animOffset: Math.random() * Math.PI });
}

export function buildMap(ctx, materials) {
  ctx.specialTiles = [];
  const hemi = new THREE.HemisphereLight(0x9ed7ff, 0x314329, 1.35);
  (ctx.mapGroup || ctx.scene).add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0c7, 3.1);
  sun.position.set(-72, 110, 58);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  (ctx.mapGroup || ctx.scene).add(sun);

  const ground = new THREE.Mesh(new THREE.BoxGeometry(mapSize, 1, mapSize), materials.grass);
  ground.position.y = -0.54;
  ground.receiveShadow = true;
  ground.geometry.computeBoundsTree();
  (ctx.mapGroup || ctx.scene).add(ground);
  ctx.aimMeshes = [ground];

  addRoad(ctx, materials, 0, 0, 24, 370);
  addRoad(ctx, materials, 0, 0, 370, 24);
  addRoad(ctx, materials, -92, -86, 22, 170);
  addRoad(ctx, materials, 98, 74, 22, 170);
  addRoad(ctx, materials, -88, 112, 178, 20);
  addRoad(ctx, materials, 114, -112, 178, 20);

  register(ctx, 'wall', 0, -mapSize / 2, mapSize, 3, 0, 0);
  register(ctx, 'wall', 0, mapSize / 2, mapSize, 3, 0, 0);
  register(ctx, 'wall', -mapSize / 2, 0, 3, mapSize, 0, 0);
  register(ctx, 'wall', mapSize / 2, 0, 3, mapSize, 0, 0);

  [
    [-54, -54, 24, 18, 34, materials.brick],
    [52, -52, 30, 34, 26, materials.concrete],
    [-150, -32, 32, 26, 44, materials.windows],
    [145, 34, 36, 30, 42, materials.brick],
    [-58, 60, 34, 42, 28, materials.windows],
    [58, 62, 26, 22, 34, materials.concrete],
    [-146, 132, 42, 25, 30, materials.concrete],
    [122, -154, 36, 40, 36, materials.windows],
    [-22, 148, 24, 18, 36, materials.brick],
    [32, -146, 30, 22, 28, materials.concrete],
    [-160, -152, 32, 18, 32, materials.brick],
    [160, 150, 42, 36, 26, materials.windows],
  ].forEach((b) => addBuilding(ctx, materials, ...b));

  addBarrier(ctx, materials, -11, -82, 0.12);
  addBarrier(ctx, materials, 22, 94, -0.24);
  addBarrier(ctx, materials, -94, 29, Math.PI / 2 + 0.12);
  addBarrier(ctx, materials, 116, -42, Math.PI / 2 - 0.18);
  addCrateStack(ctx, materials, 42, 104);
  addCrateStack(ctx, materials, -138, -88);
  addCrateStack(ctx, materials, 132, 90);
  addParkedCar(ctx, materials, -34, -18, 0xffc857, Math.PI * 0.5);
  addParkedCar(ctx, materials, 76, 18, 0x5bd3ff, -Math.PI * 0.5);
  addParkedCar(ctx, materials, -116, 116, 0xd4416a, 0.08);
  addParkedCar(ctx, materials, 112, -126, 0xeeeeee, Math.PI);

  for (let z = -155; z <= 155; z += 62) addLamp(ctx, materials, -17, z);
  for (let x = -155; x <= 155; x += 62) addLamp(ctx, materials, x, 17);

  addTurboTile(ctx, materials, 0, 80, 0);
  addTurboTile(ctx, materials, 0, -80, Math.PI);
  addTurboTile(ctx, materials, 80, 0, Math.PI / 2);
  addTurboTile(ctx, materials, -80, 0, -Math.PI / 2);
  
  addJumpTile(ctx, materials, 0, 110, 0);
  addJumpTile(ctx, materials, 0, -110, 0);
  addJumpTile(ctx, materials, 110, 0, 0);
  addJumpTile(ctx, materials, -110, 0, 0);

  ctx.pickups.push(
    { x: -86, z: 0, weapon: 'swarm-missiles' },
    { x: 86, z: 0, weapon: 'rail-slug' },
    { x: 0, z: -86, weapon: 'devastator-nuke' },
    { x: 0, z: 86, weapon: 'gravity-imploder' },
    { x: -148, z: 70, weapon: 'toxic-cask' },
    { x: 150, z: -74, weapon: 'boom-missile' },
    { x: -74, z: -150, weapon: 'bouncy-wouncy' },
    { x: 74, z: 150, weapon: 'shock-lance' },
    { x: 0, z: 0, weapon: 'health-kit' },
    { x: -50, z: -50, weapon: 'armor-pack' },
    { x: 50, z: 50, weapon: 'tool-box' },
    { x: -50, z: 50, weapon: 'speed-booster' },
    { x: 50, z: -50, weapon: 'health-kit' },
    // New Weapons
    { x: 100, z: 100, weapon: 'phantom-seeker' },
    { x: -100, z: -100, weapon: 'plasma-wraith' },
    { x: -100, z: 100, weapon: 'magma-drone' },
    { x: 100, z: -100, weapon: 'volt-hunter' },
    { x: -130, z: 0, weapon: 'void-stalker' },
    { x: 130, z: 0, weapon: 'void-stalker' }
  );
}
