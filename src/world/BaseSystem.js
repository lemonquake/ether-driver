import * as THREE from 'three';
import { angleTo } from '../core/collision.js';

const baseCorners = [
  { x: -193, z: -193 },
  { x: 193, z: 193 },
  { x: 193, z: -193 },
  { x: -193, z: 193 },
];

function teamColor(team) {
  return new THREE.Color(team.color || '#82ffcf');
}

function spawnPointsForBase(base, count = 7) {
  const yaw = angleTo(base, { x: 0, z: 0 });
  const tangent = yaw + Math.PI / 2;
  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / 2);
    const side = index % 2 === 0 ? -1 : 1;
    const forward = 20 + row * 5;
    const lateral = side * (4 + row * 1.6);
    return {
      x: base.x + Math.sin(yaw) * forward + Math.sin(tangent) * lateral,
      z: base.z + Math.cos(yaw) * forward + Math.cos(tangent) * lateral,
      yaw,
    };
  });
}

function addBaseMarker(ctx, base, x, z, w, d, r = 0) {
  ctx.minimapObjects.push({ type: 'base', baseId: base.id, teamColor: base.color, x, z, w, d, r });
}

function createTower(ctx, materials, base, team, index) {
  const group = new THREE.Group();
  const color = teamColor(team);
  const glowMaterial = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.42,
    metalness: 0.4,
    roughness: 0.42,
  });
  const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x10161a, metalness: 0.5, roughness: 0.34 });
  const padMaterial = new THREE.MeshStandardMaterial({ color: 0x10161a, emissive: color, emissiveIntensity: 0.12, metalness: 0.35, roughness: 0.55 });
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 9.2, 0.16, 32), padMaterial);
  pad.position.y = 0.035;
  pad.receiveShadow = true;
  group.add(pad);

  const coreHeight = 20 + index * 2.5;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.48, coreHeight, 14), darkMaterial);
  pole.position.y = coreHeight / 2 + 0.12;
  pole.castShadow = true;
  group.add(pole);

  const ringCount = 2 + (index % 2);
  for (let i = 0; i < ringCount; i += 1) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.55 + i * 0.34, 0.035, 8, 32), glowMaterial);
    ring.position.y = coreHeight * (0.34 + i * 0.18);
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
  }

  const crown = new THREE.Mesh(index % 2 ? new THREE.BoxGeometry(1.9, 0.52, 1.9) : new THREE.CylinderGeometry(1.15, 0.82, 0.65, 12), glowMaterial);
  crown.position.y = coreHeight + 0.7;
  crown.castShadow = true;
  group.add(crown);

  const beacon = new THREE.PointLight(color, 0.42, 24, 2.4);
  beacon.position.set(0, coreHeight + 1.8, 0);
  group.add(beacon);

  for (let i = 0; i < 4; i += 1) {
    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.12, coreHeight * 0.78, 0.12), glowMaterial);
    const a = i * Math.PI / 2 + Math.PI / 4;
    brace.position.set(Math.sin(a) * 1.18, coreHeight * 0.4, Math.cos(a) * 1.18);
    brace.rotation.y = a;
    group.add(brace);
  }

  group.position.set(base.x, 0, base.z);
  group.rotation.y = base.yaw;
  ctx.scene.add(group);
  base.group = group;
  addBaseMarker(ctx, base, base.x, base.z, 8, 8, base.yaw);
}

export function clearTeamBases(ctx) {
  for (const base of ctx.match?.bases || []) {
    if (base.group) ctx.scene.remove(base.group);
  }
  ctx.collisionShapes = ctx.collisionShapes.filter((shape) => !shape.baseId);
  ctx.minimapObjects = ctx.minimapObjects.filter((obj) => !obj.baseId);
  if (ctx.match) ctx.match.bases = [];
}

export function createTeamBases(ctx, materials, teams) {
  clearTeamBases(ctx);
  const bases = teams.map((team, index) => {
    const corner = baseCorners[index % baseCorners.length];
    const base = {
      id: `base-${team.id}`,
      teamId: team.id,
      color: team.color,
      x: corner.x,
      z: corner.z,
      yaw: angleTo(corner, { x: 0, z: 0 }),
      towerStyle: index,
    };
    base.spawnPoints = spawnPointsForBase(base, Math.max(7, team.playerCount + 2));
    team.baseId = base.id;
    createTower(ctx, materials, base, team, index);
    return base;
  });
  ctx.match.bases = bases;
  return bases;
}

export function findBaseForTeam(ctx, teamId) {
  return ctx.match?.bases?.find((base) => base.teamId === teamId);
}
