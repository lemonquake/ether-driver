import * as THREE from 'three';
import { distance2D } from '../core/collision.js';
import { weaponCatalog } from '../data/weapons.js';

export function createPickups(ctx, physics) {
  ctx.pickups.forEach((pickup, index) => {
    const weapon = weaponCatalog[pickup.weapon];
    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ color: weapon.color, emissive: weapon.color, emissiveIntensity: 1.4, metalness: 0.3, roughness: 0.25 });
    let core;
    if (weapon.id === 'boom-missile') {
      core = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.2, 12), material);
      body.rotation.x = Math.PI / 2;
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.4, 12), material);
      nose.position.z = 0.8;
      nose.rotation.x = Math.PI / 2;
      core.add(body, nose);
    } else if (weapon.id === 'health-kit') {
      core = new THREE.Group();
      const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
      const crossMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 1 });
      const cross1 = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.3, 0.3), crossMat);
      const cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.05, 0.3), crossMat);
      core.add(box, cross1, cross2);
    } else if (weapon.id === 'armor-pack') {
      core = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.3, 6), material);
      core.rotation.x = Math.PI / 2;
    } else if (weapon.id === 'tool-box') {
      core = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.8), material);
    } else if (weapon.id === 'speed-booster') {
      core = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.5, 3), material);
    } else if (weapon.id === 'bouncy-wouncy') {
      core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 1), material);
    } else if (weapon.id === 'shock-lance') {
      core = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2, 8), material);
      core.rotation.x = Math.PI / 2;
    } else if (weapon.id === 'fire-mine') {
      core = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.2, 16), material);
    } else if (weapon.id === 'swarm-missiles') {
      core = new THREE.Group();
      for (let i = 0; i < 3; i++) {
         const m = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.8, 8), material);
         m.position.set((i-1)*0.3, 0, 0);
         m.rotation.x = Math.PI / 2;
         core.add(m);
      }
    } else if (weapon.id === 'gravity-imploder') {
      core = new THREE.Group();
      core.add(new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 16), material));
      core.add(new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.1, 8, 24), material));
    } else if (weapon.id === 'rail-slug') {
      core = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 1.5), material);
    } else if (weapon.id === 'toxic-cask') {
      core = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.2, 12), material);
    } else if (weapon.id === 'devastator-nuke') {
      core = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.6, 16), material);
      body.rotation.x = Math.PI / 2;
      const tail = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 0.2), material);
      tail.position.z = -0.7;
      core.add(body, tail);
    } else {
      core = new THREE.Mesh(new THREE.OctahedronGeometry(0.75, 0), material);
    }
    group.add(core);
    group.position.set(pickup.x, 0.9, pickup.z);
    ctx.scene.add(group);
    const sensor = physics.createSensorSphere(2.2, pickup.x, 0.9, pickup.z);
    ctx.ecs.add({
      id: `pickup-${index}`,
      pickup: { weaponId: pickup.weapon, respawn: 0, radius: 2.6 },
      transform: { x: pickup.x, y: 0.9, z: pickup.z },
      renderable: { group },
      rapierBody: sensor,
    });
  });
}

function countSpecialWeapons(vehicle) {
  let count = 0;
  if (vehicle.weaponSlots.q) count += 1;
  if (vehicle.weaponSlots.e) count += 1;
  return count;
}

function findEmptySpecialSlot(vehicle) {
  if (!vehicle.weaponSlots.q) return 'q';
  if (!vehicle.weaponSlots.e) return 'e';
  return null;
}

export function removeDepletedWeapons(vehicle) {
  ['q', 'e'].forEach((slotName) => {
    const slot = vehicle.weaponSlots[slotName];
    if (slot && Number.isFinite(slot.ammo) && slot.ammo <= 0) {
      vehicle.weaponSlots[slotName] = null;
    }
  });
}

export function updatePickups(ctx, dt) {
  // Auto-remove depleted weapons from all vehicles each frame
  for (const vehicle of ctx.ecs.entities.filter((e) => e.vehicle && e.weaponSlots)) {
    removeDepletedWeapons(vehicle);
  }

  for (const pickup of ctx.ecs.entities.filter((e) => e.pickup)) {
    const isUtility = weaponCatalog[pickup.pickup.weaponId]?.slot === 'utility';
    const enabled = isUtility || !ctx.match?.enabledWeapons || ctx.match.enabledWeapons.has(pickup.pickup.weaponId);
    pickup.pickup.respawn = Math.max(0, pickup.pickup.respawn - dt);
    pickup.renderable.group.visible = enabled && pickup.pickup.respawn <= 0;
    pickup.renderable.group.rotation.y += dt * 1.7;
    pickup.renderable.group.position.y = 0.9 + Math.sin(performance.now() * 0.004) * 0.18;
    if (!enabled || pickup.pickup.respawn > 0) continue;
    for (const vehicle of ctx.ecs.entities.filter((e) => e.vehicle && !e.health.dead)) {
      if (distance2D(vehicle.transform, pickup.transform) > pickup.pickup.radius) continue;

      if (isUtility) {
        if (pickup.pickup.weaponId === 'health-kit') {
          if (vehicle.health.current >= vehicle.health.max) continue;
          vehicle.health.current = Math.min(vehicle.health.max, vehicle.health.current + 50);
        } else if (pickup.pickup.weaponId === 'armor-pack') {
          if (!vehicle.buffs) vehicle.buffs = {};
          vehicle.buffs.armor = { amount: 100, timer: 30 };
        } else if (pickup.pickup.weaponId === 'speed-booster') {
          if (!vehicle.buffs) vehicle.buffs = {};
          vehicle.buffs.speed = { timer: 20 };
        } else if (pickup.pickup.weaponId === 'tool-box') {
          if (countSpecialWeapons(vehicle) >= 2) continue;
          const slotName = findEmptySpecialSlot(vehicle);
          if (!slotName) continue;
          const availableWeapons = Object.values(weaponCatalog).filter(w => w.slot === 'special' && (!ctx.match?.enabledWeapons || ctx.match.enabledWeapons.has(w.id)));
          if (availableWeapons.length === 0) continue;
          const randomWep = availableWeapons[Math.floor(Math.random() * availableWeapons.length)];
          vehicle.weaponSlots[slotName] = {
            weaponId: randomWep.id,
            ammo: randomWep.ammo,
            cooldown: 0,
          };
        }
        pickup.pickup.respawn = 10;
        break;
      } else {
        // Max 2 special weapons — skip if already full
        if (countSpecialWeapons(vehicle) >= 2) continue;
        const slotName = findEmptySpecialSlot(vehicle);
        if (!slotName) continue;
        const catalogWeapon = weaponCatalog[pickup.pickup.weaponId];
        vehicle.weaponSlots[slotName] = {
          weaponId: pickup.pickup.weaponId,
          ammo: catalogWeapon ? catalogWeapon.ammo : 4,
          cooldown: 0,
        };
        pickup.pickup.respawn = 10;
        break;
      }
    }
  }
}
