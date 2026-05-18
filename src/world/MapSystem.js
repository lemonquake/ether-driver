import * as THREE from 'three';
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

export const mapSize = 430;

const baseSafetyZones = [
  { x: -193, z: -193, radius: 92 },
  { x: 193, z: 193, radius: 92 },
  { x: 193, z: -193, radius: 92 },
  { x: -193, z: 193, radius: 92 },
];

function overlapsBaseSafetyZone(x, z, w = 0, d = 0) {
  const padding = Math.max(w, d) * 0.55;
  return baseSafetyZones.some((zone) => Math.hypot(x - zone.x, z - zone.z) <= zone.radius + padding);
}

function register(ctx, type, x, z, w, d, r = 0, padding = 0.2) {
  if (type !== 'wall' && overlapsBaseSafetyZone(x, z, w, d)) return false;
  ctx.collisionShapes.push({ type, x, z, w, d, r, padding });
  ctx.minimapObjects.push({ type: type === 'building' ? 'building' : 'obstacle', x, z, w, d, r });
  return true;
}

function addRoad(ctx, materials, x, z, w, d) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), materials.asphalt);
  mesh.position.set(x, 0.02, z);
  mesh.receiveShadow = true;
  ctx.scene.add(mesh);
  ctx.roads.push({ x, z, w, d });
}

function addBuilding(ctx, materials, x, z, w, h, d, material) {
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
  ctx.scene.add(group);
  register(ctx, 'building', x, z, w, d, 0, 0.35);
}

function addBarrier(ctx, materials, x, z, r = 0) {
  if (overlapsBaseSafetyZone(x, z, 5.4, 0.9)) return;
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.55, 0.42), materials.hazard);
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);
  group.position.set(x, 0.32, z);
  group.rotation.y = r;
  ctx.scene.add(group);
  register(ctx, 'barrier', x, z, 5.4, 0.9, r, 0.2);
}

function addCrateStack(ctx, materials, x, z) {
  if (overlapsBaseSafetyZone(x, z, 5, 3)) return;
  for (let i = 0; i < 3; i += 1) {
    const size = 1.2 + Math.random() * 0.5;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), materials.brick);
    mesh.position.set(x + i * 1.05, size / 2, z + (i % 2) * 0.9);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    ctx.scene.add(mesh);
    register(ctx, 'crate', mesh.position.x, mesh.position.z, size, size, 0, 0.2);
  }
}

function addParkedCar(ctx, materials, x, z, color, r = 0) {
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
  ctx.scene.add(group);
  register(ctx, 'parked-car', x, z, 2.25, 4.05, r, 0.25);
}

function addLamp(ctx, materials, x, z) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 5.4, 12), materials.lamp);
  pole.position.set(x, 2.7, z);
  ctx.scene.add(pole);
  const light = new THREE.PointLight(0xffc77a, 1.2, 28, 2.2);
  light.position.set(x + 1.6, 5.26, z);
  ctx.scene.add(light);
}

function addTurboTile(ctx, materials, x, z, yaw) {
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
  ctx.scene.add(group);
  
  if (!ctx.specialTiles) ctx.specialTiles = [];
  ctx.specialTiles.push({ type: 'turbo', x, z, w: 6, d: 8, yaw, mesh: group, glowMat, animOffset: Math.random() * Math.PI });
}

function addJumpTile(ctx, materials, x, z, yaw) {
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
  ctx.scene.add(group);
  
  if (!ctx.specialTiles) ctx.specialTiles = [];
  ctx.specialTiles.push({ type: 'jump', x, z, w: 6, d: 6, yaw, mesh: group, glowMat, animOffset: Math.random() * Math.PI });
}

export function buildMap(ctx, materials) {
  ctx.specialTiles = [];
  const hemi = new THREE.HemisphereLight(0x9ed7ff, 0x314329, 1.35);
  ctx.scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0c7, 3.1);
  sun.position.set(-72, 110, 58);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  ctx.scene.add(sun);

  const ground = new THREE.Mesh(new THREE.BoxGeometry(mapSize, 1, mapSize), materials.grass);
  ground.position.y = -0.54;
  ground.receiveShadow = true;
  ground.geometry.computeBoundsTree();
  ctx.scene.add(ground);
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
