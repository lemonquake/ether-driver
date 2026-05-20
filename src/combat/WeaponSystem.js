import * as THREE from 'three';
import { angleTo, distance2D, findObbCollision, forwardFromYaw, makeObb } from '../core/collision.js';
import { weaponCatalog } from '../data/weapons.js';
import { applyDamage, applyImpactPush } from './DamageSystem.js';
import { applyTurretEnhancementVisual } from '../vehicles/VehicleFactory.js';

function slotReady(slot) {
  if (!slot || slot.cooldown > 0 || slot.isReloading) return false;
  if (slot.magazineSize !== undefined) return slot.ammoInMagazine > 0;
  return slot.ammo !== 0;
}

function consumeSlot(slot, weapon) {
  slot.cooldown = weapon.cooldown;
  if (slot.magazineSize !== undefined) {
    slot.ammoInMagazine = Math.max(0, slot.ammoInMagazine - 1);
    return;
  }
  if (Number.isFinite(slot.ammo)) slot.ammo -= 1;
}

function startReload(slot) {
  if (!slot || slot.magazineSize === undefined || slot.isReloading || slot.ammoInMagazine >= slot.magazineSize) return;
  if (Number.isFinite(slot.reserveAmmo) && slot.reserveAmmo <= 0) return;
  slot.isReloading = true;
  slot.reloadRemaining = slot.reloadTime;
}

export function fireWeapon(ctx, physics, owner, slotName, targetPoint, effects) {
  if (!ctx.match?.active || ctx.match.ended || !owner || owner.health?.dead || owner.stability?.recovering) return null;
  const slot = owner.weaponSlots[slotName];
  if (!slot) return null;
  const weapon = weaponCatalog[slot.weaponId];
  if (!weapon) return null;
  if (slot.magazineSize !== undefined && slot.ammoInMagazine <= 0) startReload(slot);
  if (!slotReady(slot)) return null;
  consumeSlot(slot, weapon);

  const yaw = slotName === 'turret' ? owner.turret.yaw : owner.transform.yaw;
  const forward = forwardFromYaw(yaw);
  const start = {
    x: owner.transform.x + forward.x * 2.2,
    y: slotName === 'turret' ? 1.45 : 0.7,
    z: owner.transform.z + forward.z * 2.2,
  };
  if (weapon.id === 'fire-mine') {
    start.x = owner.transform.x - forward.x * 2.1;
    start.z = owner.transform.z - forward.z * 2.1;
  }
  const aimYaw = weapon.id === 'fire-mine' ? owner.transform.yaw : angleTo(start, { x: targetPoint.x, z: targetPoint.z });
  const count = weapon.projectileCount || 1;
  const spread = weapon.spread || 0;
  let lastEntity = null;

  for (let i = 0; i < count; i += 1) {
    const spreadAngle = count > 1 ? (i - (count - 1) / 2) * spread : spread * (Math.random() - 0.5);
    const aimYawSpread = aimYaw + spreadAngle;
    const dir = forwardFromYaw(aimYawSpread);

    const isPlayerControlled = owner.vehicle?.controlledBy === 'player';
    let homingTarget = null;
    if (weapon.homingStrength && isPlayerControlled && ctx.input.lockHeld) {
      homingTarget = ctx.input.lockedTarget;
    }
    if (weapon.homingStrength && !isPlayerControlled && !homingTarget) {
      let bestDist = Infinity;
      for (const e of ctx.ecs.entities.filter((v) => v.vehicle && !v.health.dead && v.teamId !== owner.teamId)) {
        const d = distance2D(start, e.transform);
        if (d < 150) {
          let diff = Math.abs(aimYawSpread - angleTo(start, e.transform));
          while (diff > Math.PI) diff -= Math.PI * 2;
          diff = Math.abs(diff);
          if (diff < 0.8 && d < bestDist) {
            bestDist = d;
            homingTarget = e;
          }
        }
      }
    }

    // Acquire a projectile mesh from the pre-allocated pool (completely zero-lag)
    let mesh = null;
    if (ctx.projectileMeshPool && ctx.projectileMeshPool.length > 0) {
      mesh = ctx.projectileMeshPool.pop();
      mesh.scale.setScalar(weapon.radius);
      mesh.material.color.set(weapon.color);
      mesh.position.set(start.x, start.y, start.z);
      mesh.visible = true;
    } else {
      // Fallback in case the pool is depleted (highly unlikely, but safe)
      mesh = new THREE.Mesh(
        new THREE.SphereGeometry(weapon.radius, 8, 8),
        new THREE.MeshBasicMaterial({ color: weapon.color }),
      );
      mesh.position.set(start.x, start.y, start.z);
      ctx.scene.add(mesh);
    }

    // Acquire and activate a light from the pre-allocated pool (completely zero-lag)
    let pLight = null;
    if (ctx.projectileLightPool && ctx.projectileLightPool.length > 0) {
      pLight = ctx.projectileLightPool.pop();
      pLight.color.set(weapon.color);
      pLight.intensity = 3.6;
      pLight.distance = 15;
      pLight.decay = 1.8;
      pLight.position.set(start.x, start.y, start.z);
    }

    const rapier = physics.createProjectileBody(weapon.radius, start.x, start.y, start.z);
    lastEntity = ctx.ecs.add({
      projectile: {
        weaponId: weapon.id,
        weapon,
        owner,
        team: owner.team,
        teamId: owner.teamId,
        age: 0,
        bounces: weapon.bounces || 0,
        pierce: weapon.pierce || 0,
        armTime: weapon.armTime || 0,
        target: homingTarget,
        pointLight: pLight,
      },
      transform: { x: start.x, y: start.y, z: start.z, yaw: aimYawSpread },
      velocity: { x: dir.x * weapon.speed, y: 0, z: dir.z * weapon.speed },
      renderable: { group: mesh },
      rapierBody: rapier,
    });
  }
  return lastEntity;
}

function explode(ctx, projectile, effects, physics) {
  const { weapon } = projectile.projectile;
  const origin = { x: projectile.transform.x, z: projectile.transform.z };
  const playerDeathNearby = ctx.player?.health?.dead && distance2D(origin, ctx.player.transform) < 14;
  const effectBudgetScale = playerDeathNearby ? 0.38 : 1;
  effects.emitImpact(origin.x, origin.z, { x: 0, z: 1 }, Math.max(3, Math.round((weapon.splashRadius ? 18 : 8) * effectBudgetScale)));
  
  if (weapon.id === 'gravity-imploder') {
    effects.emitGravityImplosion(origin.x, origin.z, weapon.explosionRadius || weapon.splashRadius);
  } else if (weapon.id === 'toxic-cask') {
    effects.emitToxicCloud(origin.x, origin.z, weapon.explosionRadius || weapon.splashRadius);
  } else if (weapon.explosionRadius || weapon.splashRadius) {
    effects.emitExplosion(
      origin.x,
      origin.z,
      weapon.explosionRadius || weapon.splashRadius,
      weapon.id === 'devastator-nuke' ? 40 : 20,
      'fire',
      { budgetScale: effectBudgetScale, smokeAmount: playerDeathNearby ? 1 : 2 },
    );
  }
  
  let shakeTrauma = weapon.screenShake || 0;
  if (ctx.player && ctx.player.renderable && shakeTrauma > 0) {
    const dist = distance2D(origin, ctx.player.transform);
    const maxShakeDist = (weapon.explosionRadius || weapon.splashRadius || 10) * 3;
    if (dist < maxShakeDist) shakeTrauma *= Math.max(0, 1 - (dist / maxShakeDist));
    else shakeTrauma = 0;
  }
  if (shakeTrauma > 0) ctx.cameraEffects?.add(shakeTrauma);
  if (weapon.splashRadius) {
    const entities = ctx.ecs.entities;
    for (let i = 0; i < entities.length; i += 1) {
      const target = entities[i];
      if (!target.vehicle || target.health.dead) continue;
      const d = distance2D(projectile.transform, target.transform);
      if (d <= weapon.splashRadius) {
        const force = weapon.explosionForce || weapon.impactForce || 0;
        const pushScale = 1 - d / weapon.splashRadius * 0.45;
        if (target.teamId !== projectile.projectile.teamId) {
          applyDamage(target, weapon.damage * pushScale, weapon.damageType, projectile.projectile.owner, effects, {
            ctx,
            origin,
            radius: weapon.splashRadius,
            force,
            screenShake: weapon.screenShake || 0,
            cameraEffects: ctx.cameraEffects,
            weaponId: weapon.id,
          });
        } else {
          applyImpactPush(target, { origin, radius: weapon.splashRadius, force });
        }
      }
    }
  }
  removeProjectile(ctx, projectile, physics);
}

export function findProjectileWorldHit(ctx, projectile) {
  const radius = Math.max(projectile.projectile.weapon.radius, 0.18);
  const speed = Math.hypot(projectile.velocity.x, projectile.velocity.z);
  const probeSize = Math.max(radius * 2.2, Math.min(3.8, speed * 0.02 + radius * 2));
  const obb = makeObb(projectile.transform.x, projectile.transform.z, probeSize, probeSize, projectile.transform.yaw || 0);
  const projY = projectile.transform.y ?? 0.7;
  const nearbyShapes = ctx.collisionShapes.filter((shape) => {
    let obstacleHeight = shape.height !== undefined && shape.height > 0 ? shape.height : 0;
    if (obstacleHeight === 0) {
      if (shape.type === 'wall' || shape.type === 'building') {
        obstacleHeight = 35; // Tall obstacles/boundaries
      } else if (shape.type === 'barrier') {
        obstacleHeight = 0.6;
      } else if (shape.type === 'crate') {
        obstacleHeight = 1.8;
      } else if (shape.type === 'parked-car') {
        obstacleHeight = 1.3;
      }
    }
    
    if (projY >= obstacleHeight) return false; // Fly over low obstacles
    
    const reach = Math.max(shape.w || 0, shape.d || 0) * 0.5 + probeSize + 3;
    return distance2D(projectile.transform, shape) <= reach;
  });
  return findObbCollision(obb, nearbyShapes);
}

function reflectVelocity(projectile, normal) {
  const dot = projectile.velocity.x * normal.x + projectile.velocity.z * normal.z;
  projectile.velocity.x -= 2 * dot * normal.x;
  projectile.velocity.z -= 2 * dot * normal.z;
  projectile.transform.x += normal.x * 0.85;
  projectile.transform.z += normal.z * 0.85;
  projectile.transform.yaw = Math.atan2(projectile.velocity.x, projectile.velocity.z);
}

function handleWorldHit(ctx, projectile, hit, effects, physics) {
  const { weapon } = projectile.projectile;
  const normal = hit.normal || { x: 0, z: 1 };
  const materialType = hit.shape?.type || 'building';
  effects.emitWorldImpact(projectile.transform.x, projectile.transform.z, normal, materialType, weapon.splashRadius ? 20 : 10);
  if (weapon.id === 'bouncy-wouncy' && projectile.projectile.bounces > 0) {
    projectile.projectile.bounces -= 1;
    reflectVelocity(projectile, normal);
    ctx.cameraEffects?.add(0.025);
    return false;
  }
  if (weapon.splashRadius || weapon.explosionRadius) {
    explode(ctx, projectile, effects, physics);
    return true;
  }
  removeProjectile(ctx, projectile, physics);
  return true;
}

function removeProjectile(ctx, projectile, physics) {
  const p = projectile.projectile;
  if (p && p.pointLight) {
    p.pointLight.intensity = 0;
    p.pointLight.position.set(0, -1000, 0);
    if (ctx.projectileLightPool) {
      ctx.projectileLightPool.push(p.pointLight);
    }
    p.pointLight = null;
  }
  if (projectile.renderable?.group) {
    const mesh = projectile.renderable.group;
    // Check if this mesh belongs to the pre-allocated pool
    if (mesh.isPooled) {
      mesh.visible = false;
      mesh.position.set(0, -1000, 0);
      if (ctx.projectileMeshPool) {
        ctx.projectileMeshPool.push(mesh);
      }
    } else {
      // If it was a dynamically spawned fallback mesh, remove it from the scene
      ctx.scene.remove(mesh);
    }
    projectile.renderable.group = null;
  }
  if (projectile.rapierBody) physics.remove(projectile.rapierBody);
  ctx.ecs.remove(projectile);
}

export function updateWeapons(ctx, physics, dt, effects) {
  if (!ctx.player || !ctx.match?.active || ctx.match.ended) return;
  for (const entity of ctx.ecs.entities.filter((e) => e.weaponSlots)) {
    Object.entries(entity.weaponSlots).forEach(([slotKey, slot]) => {
      if (!slot) return;
      slot.cooldown = Math.max(0, slot.cooldown - dt);

      // Revert if finite turret ammo is fully depleted (both magazine and reserve)
      if (slotKey === 'turret' && slot.weaponId !== 'turret') {
        if (slot.ammoInMagazine <= 0 && Number.isFinite(slot.reserveAmmo) && slot.reserveAmmo <= 0 && !slot.isReloading) {
          const defaultTurret = entity.defaultTurret || {
            weaponId: 'turret',
            magazineSize: 30,
            reloadTime: 1.5,
            style: 'ring',
          };
          slot.weaponId = defaultTurret.weaponId;
          slot.magazineSize = defaultTurret.magazineSize;
          slot.reloadTime = defaultTurret.reloadTime;
          slot.ammoInMagazine = defaultTurret.magazineSize;
          slot.reserveAmmo = Infinity;
          slot.cooldown = 0;
          slot.isReloading = false;
          slot.reloadRemaining = 0;
          applyTurretEnhancementVisual(entity, defaultTurret.style, entity.teamColor || '#82ffcf', ctx);
        }
      }

      if (slot.isReloading) {
        slot.reloadRemaining = Math.max(0, slot.reloadRemaining - dt);
        if (slot.reloadRemaining <= 0) {
          slot.isReloading = false;
          if (Number.isFinite(slot.reserveAmmo)) {
            const needed = slot.magazineSize - slot.ammoInMagazine;
            const refill = Math.min(needed, slot.reserveAmmo);
            slot.ammoInMagazine += refill;
            slot.reserveAmmo -= refill;
          } else {
            slot.ammoInMagazine = slot.magazineSize;
          }
        }
      } else if (slot.magazineSize !== undefined && slot.ammoInMagazine <= 0) {
        startReload(slot);
      }
    });
  }

  if (ctx.input.keys.has('KeyR')) startReload(ctx.player.weaponSlots.turret);
  if (ctx.input.mouseDown) fireWeapon(ctx, physics, ctx.player, 'turret', ctx.input.aimPoint, effects);
  if (ctx.input.keys.has('KeyQ')) fireWeapon(ctx, physics, ctx.player, 'q', ctx.input.aimPoint, effects);
  if (ctx.input.keys.has('KeyE')) fireWeapon(ctx, physics, ctx.player, 'e', ctx.input.aimPoint, effects);

  for (const ai of ctx.ecs.entities.filter((e) => e.ai && e.ai.fireTurret)) {
    fireWeapon(ctx, physics, ai, 'turret', ai.ai.aimPoint, effects);
    if (ai.ai.useSpecial === 'q') fireWeapon(ctx, physics, ai, 'q', ai.ai.aimPoint, effects);
    if (ai.ai.useSpecial === 'e') fireWeapon(ctx, physics, ai, 'e', ai.ai.aimPoint, effects);
    ai.ai.fireTurret = false;
    ai.ai.useSpecial = null;
  }

  for (const projectile of [...ctx.ecs.entities.filter((e) => e.projectile)]) {
    const p = projectile.projectile;
    const weapon = p.weapon;
    p.age += dt;
    if (weapon.homingStrength && p.target && !p.target.health.dead) {
      const targetYaw = angleTo(projectile.transform, p.target.transform);
      const current = Math.atan2(projectile.velocity.x, projectile.velocity.z);
      const next = current + Math.atan2(Math.sin(targetYaw - current), Math.cos(targetYaw - current)) * Math.min(1, dt * weapon.homingStrength);
      const dir = forwardFromYaw(next);
      projectile.velocity.x = dir.x * weapon.speed;
      projectile.velocity.z = dir.z * weapon.speed;
      
      // Vertical Y tracking
      const currentY = projectile.transform.y ?? 0.7;
      const targetY = (p.target.transform.y || 0) + 0.78; // Target vehicle's center ride height
      projectile.transform.y = THREE.MathUtils.lerp(currentY, targetY, Math.min(1, dt * weapon.homingStrength * 2.0));
    }
    projectile.transform.x += projectile.velocity.x * dt;
    projectile.transform.z += projectile.velocity.z * dt;
    projectile.transform.y = projectile.transform.y ?? 0.7;
    projectile.renderable.group.position.set(projectile.transform.x, projectile.transform.y, projectile.transform.z);
    if (p.pointLight) {
      p.pointLight.position.set(projectile.transform.x, projectile.transform.y, projectile.transform.z);
    }
    physics.setTranslation(projectile.rapierBody.body, projectile.transform.x, projectile.transform.y, projectile.transform.z);
    
    let trailType = 'plasma';
    if (['boom-missile', 'devastator-nuke', 'swarm-missiles'].includes(weapon.id)) trailType = 'smoke';
    if (weapon.id === 'gravity-imploder') trailType = 'gravity';
    if (weapon.id === 'toxic-cask') trailType = 'toxic';
    if (weapon.id === 'rail-slug') trailType = 'spark';
    effects.emitTrail(projectile.transform.x, projectile.transform.y, projectile.transform.z, trailType);

    if (p.age > weapon.lifetime) {
      explode(ctx, projectile, effects, physics);
      continue;
    }

    if (p.age > p.armTime) {
      const worldHit = findProjectileWorldHit(ctx, projectile);
      if (worldHit && handleWorldHit(ctx, projectile, worldHit, effects, physics)) continue;
    }

    if (p.age > p.armTime) {
      const hit = ctx.ecs.entities.find((e) => {
        if ((!e.vehicle && !e.isCampaignEnemy) || e.teamId === p.teamId || e.health.dead) return false;
        
        // 2D distance check
        const dist2D = distance2D(e.transform, projectile.transform);
        const radiusBonus = e.isCampaignEnemy ? (e.campaignEnemyType === 'turret' ? 2.5 : 1.6) : 1.3;
        if (dist2D >= weapon.radius + radiusBonus) return false;
        
        // Vertical height overlap check
        const vehicleY = e.transform.y || 0;
        const vehicleHeight = e.isCampaignEnemy ? (e.campaignEnemyType === 'turret' ? 4.0 : 2.5) : 1.5;
        const projY = projectile.transform.y ?? 0.7;
        const projRadius = weapon.radius || 0.25;
        
        const verticalOverlap = (projY + projRadius >= vehicleY) && (projY - projRadius <= vehicleY + vehicleHeight);
        return verticalOverlap;
      });
      if (hit) {
        applyDamage(hit, weapon.damage, weapon.damageType, p.owner, effects, {
          ctx,
          origin: projectile.transform,
          force: weapon.impactForce || 0,
          screenShake: weapon.screenShake || 0,
          cameraEffects: ctx.cameraEffects,
          weaponId: weapon.id,
        });
        if (p.pierce > 0) p.pierce -= 1;
        else explode(ctx, projectile, effects, physics);
        continue;
      }
    }

    const mapLimit = (ctx.currentMapSize || 430) * 0.5 - 6;
    const outside = Math.abs(projectile.transform.x) > mapLimit || Math.abs(projectile.transform.z) > mapLimit;
    if (outside) {
      if (p.bounces > 0) {
        p.bounces -= 1;
        if (Math.abs(projectile.transform.x) > mapLimit) projectile.velocity.x *= -1;
        if (Math.abs(projectile.transform.z) > mapLimit) projectile.velocity.z *= -1;
      } else explode(ctx, projectile, effects, physics);
    }
  }
}
