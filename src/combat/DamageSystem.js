import { armorMatrix } from '../data/weapons.js';
import { angleTo, distance2D, forwardFromYaw } from '../core/collision.js';
import { formatKillLine, pushKillFeed } from '../match/MatchSystem.js';
import { grantKillReward } from '../core/ProgressionSystem.js';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

const DAMAGE_NUMBER_QUEUE_LIMIT = 48;

function enqueueDamageNumber(ctx, target, amount, damageType, lethal = false) {
  if (!ctx || !target?.transform || amount <= 0) return;
  if (!ctx.damageNumbers) ctx.damageNumbers = { active: [], queue: [] };
  const queue = ctx.damageNumbers.queue;
  queue.push({
    target,
    x: target.transform.x,
    y: target.transform.y || 0,
    z: target.transform.z,
    value: Math.max(1, Math.round(amount)),
    damageType,
    lethal,
    critical: lethal || amount >= 24,
    age: 0,
    life: lethal ? 0.95 : 0.8,
    seed: Math.random(),
  });
  while (queue.length > DAMAGE_NUMBER_QUEUE_LIMIT) {
    const dropIndex = queue.findIndex((entry) => !entry.lethal);
    queue.splice(dropIndex === -1 ? 0 : dropIndex, 1);
  }
}

export function applyImpactPush(target, meta) {
  if (!meta.force) return;
  const yaw = meta.origin ? angleTo(meta.origin, target.transform) : target.transform.yaw;
  const dir = forwardFromYaw(yaw);
  const distanceScale = meta.radius && meta.origin
    ? Math.max(0.18, 1 - distance2D(meta.origin, target.transform) / meta.radius)
    : 1;
  const force = Math.abs(meta.force);
  const isAttract = meta.force < 0;
  const push = force * distanceScale;
  const sign = isAttract ? -1 : 1;

  // Significant positional knockback — vehicles get truly pushed
  target.transform.x += dir.x * push * sign * 0.28;
  target.transform.z += dir.z * push * sign * 0.28;

  // Speed boost from impact — makes vehicles slide/roll away
  target.velocity.speed += push * sign * 0.55;

  // Yaw perturbation — vehicles spin from impacts
  target.transform.yaw += (Math.random() - 0.5) * 0.14 * distanceScale * (force / 5);

  // Dramatic angular destabilization — vehicles tumble and fly
  if (target.stability) {
    const pitchKick = push * 0.065 * (Math.random() > 0.5 ? 1 : -1);
    const rollKick = push * 0.09 * (Math.random() > 0.5 ? 1 : -1);
    target.stability.angularPitch += clamp(pitchKick, -1.8, 1.8);
    target.stability.angularRoll += clamp(rollKick, -2.2, 2.2);

    // Strong hits launch vehicles upward (vertical tumble effect)
    if (force >= 5) {
      target.stability.angularPitch += clamp(force * 0.04 * distanceScale, -0.8, 0.8);
    }
    // Devastating hits cause full flips
    if (force >= 14) {
      target.stability.angularPitch += clamp(force * 0.06 * (Math.random() > 0.5 ? 1 : -1), -2.5, 2.5);
      target.stability.angularRoll += clamp(force * 0.05 * (Math.random() > 0.5 ? 1 : -1), -2.5, 2.5);
    }
  }
}

export function applyDamage(target, amount, damageType, source, effects, meta = {}) {
  if (!target?.health || target.health.dead) return 0;
  if (target.respawn?.invulnerableTimer > 0) return 0;
  const armor = target.vehicle.armorType;
  let finalDamage = amount * (armorMatrix[armor]?.[damageType] ?? 1);

  if (target.buffs?.armor && target.buffs.armor.amount > 0) {
    const absorbed = Math.min(finalDamage, target.buffs.armor.amount);
    target.buffs.armor.amount -= absorbed;
    finalDamage -= absorbed;
  }

  target.health.current = Math.max(0, target.health.current - finalDamage);
  target.health.hitFlash = 0.2;
  const lethal = target.health.current <= 0;
  enqueueDamageNumber(meta.ctx, target, finalDamage, damageType, lethal);

  // Track that this vehicle was hit by a special weapon for minimap effects
  if (meta.force && meta.force >= 1.5) {
    target.health.specialHitFlash = 0.4;
  }

  if (source?.score && source !== target) {
    source.score.damageDealt += finalDamage;
    if (meta.weaponId) {
      if (!source.score.weaponDamage) source.score.weaponDamage = {};
      source.score.weaponDamage[meta.weaponId] = (source.score.weaponDamage[meta.weaponId] || 0) + finalDamage;
    }
    
    // Reward for hitting
    if (source === meta.ctx?.player && meta.ctx?.match?.playerRewards) {
      const isTurret = meta.weaponId === 'turret' || !meta.weaponId || meta.weaponId === 'collision';
      const rewards = meta.ctx.match.playerRewards;
      if (isTurret) {
        rewards.turretHits.exp += 1;
        if (Math.random() > 0.8) rewards.turretHits.gold += 1;
      } else {
        rewards.weaponHits.exp += 3;
        rewards.weaponHits.gold += 1;
      }
    }
  }

  // Enhanced impact push with directional camera shake
  applyImpactPush(target, meta);
  
  // Calculate normal for bullet hit sparks to bounce off the vehicle properly
  const hitNormal = meta.origin ? {
    x: meta.origin.x - target.transform.x,
    z: meta.origin.z - target.transform.z,
  } : { x: 0, z: 1 };
  const hitLen = Math.hypot(hitNormal.x, hitNormal.z) || 1;
  hitNormal.x /= hitLen;
  hitNormal.z /= hitLen;
  
  effects?.emitImpact(target.transform.x, target.transform.z, hitNormal, 14);
  if (finalDamage > 0) effects?.emitDamageFireImpact?.(target.transform.x, target.transform.z, hitNormal, damageType, finalDamage, { lethal });

  // Directional screen shake — shake toward the impact
  if (meta.cameraEffects && meta.screenShake) {
    const shakeDir = meta.origin ? {
      x: Math.sin(angleTo(meta.origin, target.transform)),
      z: Math.cos(angleTo(meta.origin, target.transform)),
    } : null;
    let shakeTrauma = meta.screenShake;
    if (meta.ctx?.player) {
      const dist = distance2D(meta.ctx.player.transform, target.transform);
      if (dist > 5) shakeTrauma *= Math.max(0, 1 - (dist / 40));
    }
    if (shakeTrauma > 0) meta.cameraEffects.add(shakeTrauma, shakeDir);
  }

  if (lethal) {
    const d0 = performance.now();
    const isPlayerDeath = target === meta.ctx?.player;
    target.health.dead = true;
    target.health.current = 0;
    target.health.hitFlash = 0;
    target.health.specialHitFlash = 0;
    if (target.respawn) {
      target.respawn.timer = 3;
      target.respawn.invulnerableTimer = 0;
    }
    const d1 = performance.now();
    if (target.score) target.score.deaths += 1;
    if (target.renderable?.group) {
      // Fix for the massive screen freeze: Hiding a group containing a PointLight forces Three.js to recompile 
      // all shaders in the scene. Moving it far away hides it without triggering a recompile!
      target.renderable.group.position.y = -10000;
    }
    const d2 = performance.now();
    const d3 = performance.now();
    effects?.emitDeathExplosion(target.transform.x, target.transform.z, { playerDeath: isPlayerDeath });
    const d4 = performance.now();
    meta.cameraEffects?.add(isPlayerDeath ? 0.14 : 0.22);
    const d5 = performance.now();
    if (source?.score && source !== target) {
      source.score.kills += 1;
      if (source === meta.ctx?.player) {
        if (meta.ctx.match?.playerRewards) {
          meta.ctx.match.playerRewards.kills.exp += 50;
          meta.ctx.match.playerRewards.kills.gold += Math.floor(10 + Math.random() * 10);
        }
        if (meta.ctx.ui && meta.ctx.ui.showRewardPopup) {
           meta.ctx.ui.showRewardPopup(`+50 EXP`);
        }
      }
      if (meta.ctx?.match) {
        pushKillFeed(meta.ctx, formatKillLine(source, target), source.teamColor || '#82ffcf');
        if (!meta.ctx.match.killLog) meta.ctx.match.killLog = [];
        meta.ctx.match.killLog.push({
          killerName: source.displayName || source.vehicle?.name || '?',
          killerTeamId: source.teamId,
          killerTeamColor: source.teamColor || '#82ffcf',
          victimName: target.displayName || target.vehicle?.name || '?',
          victimTeamId: target.teamId,
          victimTeamColor: target.teamColor || '#ff5f7d',
          weaponId: meta.weaponId || 'collision',
          time: performance.now(),
        });
      }
    }
    const d6 = performance.now();
    console.log(`[DEATH] Total: ${(d6 - d0).toFixed(2)}ms | State: ${(d1 - d0).toFixed(2)}ms | RenderHide: ${(d2 - d1).toFixed(2)}ms | PerfCD: ${(d3 - d2).toFixed(2)}ms | Particles: ${(d4 - d3).toFixed(2)}ms | Camera: ${(d5 - d4).toFixed(2)}ms | KillFeed: ${(d6 - d5).toFixed(2)}ms`);
  }
  return finalDamage;
}

function getFlashMaterials(renderable) {
  if (renderable.flashMaterials) return renderable.flashMaterials;
  const materials = [];
  renderable.group?.traverse((child) => {
    const childMaterials = Array.isArray(child.material) ? child.material : [child.material];
    childMaterials.forEach((material) => {
      if (material?.emissiveIntensity !== undefined) materials.push(material);
    });
  });
  renderable.flashMaterials = materials;
  return materials;
}

export function updateDamageVisuals(ctx, dt) {
  const entities = ctx.ecs.entities;
  for (let i = 0; i < entities.length; i += 1) {
    const entity = entities[i];
    if (!entity.health || !entity.renderable) continue;
    if (entity.health.dead || entity.renderable.group?.visible === false) continue;
    if (entity.health.hitFlash <= 0 && (!entity.health.specialHitFlash || entity.health.specialHitFlash <= 0)) continue;
    entity.health.hitFlash = Math.max(0, entity.health.hitFlash - dt);
    if (entity.health.specialHitFlash !== undefined) {
      entity.health.specialHitFlash = Math.max(0, entity.health.specialHitFlash - dt);
    }
    if (entity.health.hitFlash > 0) {
      const mats = getFlashMaterials(entity.renderable);
      for (let j = 0; j < mats.length; j += 1) {
        mats[j].emissiveIntensity = Math.max(mats[j].emissiveIntensity, 0.5);
      }
    }
  }
}
