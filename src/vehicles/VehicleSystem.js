import * as THREE from 'three';
import { angleTo, findObbCollision, forwardFromYaw, makeObb, moveTowards, testObbOverlap, wrapAngle } from '../core/collision.js';
import { getVehicleStats } from '../data/vehicleCatalog.js';
import { applyDamage } from '../combat/DamageSystem.js';

function inputAxis(keys) {
  const throttle = keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0;
  const brake = keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0;
  const left = keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0;
  const right = keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0;
  return { throttle, brake, steerTarget: left - right, handbrake: keys.has('Space') };
}

export function updateVehicles(ctx, dt, effects) {
  const vehicles = ctx.ecs.entities.filter((e) => e.vehicle && !e.health.dead);
  for (const entity of vehicles) {
    if (entity.buffs) {
      if (entity.buffs.speed) {
        entity.buffs.speed.timer -= dt;
        if (entity.buffs.speed.timer <= 0) delete entity.buffs.speed;
      }
      if (entity.buffs.armor) {
        entity.buffs.armor.timer -= dt;
        if (entity.buffs.armor.timer <= 0) delete entity.buffs.armor;
      }
    }

    const stats = getVehicleStats(entity);
    if (entity.buffs?.speed) {
      stats.maxForwardSpeed *= 1.5;
      stats.acceleration *= 1.5;
    }
    const isPlayer = entity.vehicle.controlledBy === 'player';
    const stability = entity.stability;
    const recovering = stability?.recovering;
    const controls = recovering ? { throttle: 0, brake: 1, steerTarget: 0, handbrake: true } : isPlayer ? inputAxis(ctx.input.keys) : entity.ai?.controls || { throttle: 0, brake: 0, steerTarget: 0, handbrake: false };
    entity.controls = controls;
    const velocity = entity.velocity;
    const transform = entity.transform;

    velocity.steer = THREE.MathUtils.lerp(velocity.steer, controls.steerTarget, Math.min(1, dt * stats.steerResponse));
    if (controls.throttle) velocity.speed = moveTowards(velocity.speed, stats.maxForwardSpeed, stats.acceleration * dt);
    else if (controls.reverse) velocity.speed = moveTowards(velocity.speed, stats.maxReverseSpeed, stats.reverseAcceleration * dt);
    else if (controls.brake) {
      const target = velocity.speed > 1 ? 0 : stats.maxReverseSpeed;
      const rate = velocity.speed > 1 ? stats.brakeDeceleration : stats.reverseAcceleration;
      velocity.speed = moveTowards(velocity.speed, target, rate * dt);
    } else {
      const coast = stats.rollingFriction + (controls.handbrake ? stats.handbrakeFriction : 0);
      velocity.speed = moveTowards(velocity.speed, 0, coast * dt);
    }

    const speed01 = THREE.MathUtils.clamp(Math.abs(velocity.speed) / 30, 0, 1);
    const reverseSign = velocity.speed >= 0 ? 1 : -1;
    transform.yaw += velocity.steer * stats.steerRate * speed01 * reverseSign * (controls.handbrake ? 1.35 : 1) * dt;
    const forward = forwardFromYaw(transform.yaw);
    const nextX = transform.x + forward.x * velocity.speed * dt;
    const nextZ = transform.z + forward.z * velocity.speed * dt;
    const carObb = makeObb(nextX, nextZ, stats.carHalfWidth * 2, stats.carHalfLength * 2, transform.yaw);
    const collision = findObbCollision(carObb, ctx.collisionShapes);
    velocity.collisionCooldown = Math.max(0, velocity.collisionCooldown - dt);
    for (const [id, time] of velocity.vehicleCollisionCooldowns) {
      const next = time - dt;
      if (next <= 0) velocity.vehicleCollisionCooldowns.delete(id);
      else velocity.vehicleCollisionCooldowns.set(id, next);
    }
    if (collision) {
      transform.x = nextX + collision.normal.x * (collision.depth + 0.04);
      transform.z = nextZ + collision.normal.z * (collision.depth + 0.04);
      const impact = Math.abs(velocity.speed);
      const forwardDot = forward.x * collision.normal.x + forward.z * collision.normal.z;
      velocity.speed = forwardDot < 0 ? -velocity.speed * stats.collisionRestitution : velocity.speed * stats.collisionRestitution;
      velocity.speed = THREE.MathUtils.clamp(velocity.speed * (1 - stats.collisionSpeedLoss), stats.maxReverseSpeed, stats.maxForwardSpeed);
      if (impact > 3 && velocity.collisionCooldown <= 0) {
        effects.emitImpact(transform.x, transform.z, collision.normal, Math.min(18, 5 + Math.round(impact)));
        velocity.collisionCooldown = 0.16;
        stability.angularPitch += THREE.MathUtils.clamp(impact * stats.impactAngularResponse * 0.012, -0.35, 0.35);
        stability.angularRoll += THREE.MathUtils.clamp((Math.random() - 0.5) * impact * stats.impactAngularResponse * 0.02, -0.45, 0.45);
      }
    } else {
      transform.x = nextX;
      transform.z = nextZ;
    }

    if (transform.y === undefined) transform.y = 0;
    if (velocity.y === undefined) velocity.y = 0;

    velocity.y -= dt * 45; // gravity
    transform.y += velocity.y * dt;

    if (transform.y <= 0) {
      if (velocity.y < -15 && velocity.collisionCooldown <= 0) {
        effects.emitImpact(transform.x, transform.z, { x: 0, z: 1 }, Math.min(15, Math.abs(velocity.y) * 0.5));
        ctx.cameraEffects?.add(Math.min(0.2, Math.abs(velocity.y) * 0.01));
        velocity.collisionCooldown = 0.2;
      }
      transform.y = 0;
      velocity.y = 0;
    }

    if (ctx.specialTiles && transform.y < 1) {
      for (const tile of ctx.specialTiles) {
        if (Math.abs(transform.x - tile.x) < tile.w / 2 + 1 && Math.abs(transform.z - tile.z) < tile.d / 2 + 1) {
          if (tile.type === 'turbo') {
            velocity.speed = Math.max(velocity.speed, 140);
            transform.yaw = tile.yaw;
            velocity.steer = 0;
            if (Math.random() < 0.2) effects.emitImpact(transform.x, transform.z, { x: 0, z: 1 }, 3);
          } else if (tile.type === 'jump') {
            if (velocity.y <= 0) {
              velocity.y = 35;
              effects.emitImpact(transform.x, transform.z, { x: 0, z: 1 }, 15);
              ctx.cameraEffects?.add(0.1);
            }
          }
        }
      }
    }

    velocity.wheelSpin += velocity.speed * dt * 2.7;
    velocity.smokeTimer -= dt;
    if ((controls.handbrake || controls.brake || Math.abs(velocity.steer) > 0.55) && Math.abs(velocity.speed) > 5 && velocity.smokeTimer <= 0) {
      effects.emitSmoke(transform.x - forward.x * 1.2, transform.z - forward.z * 1.2, 2 + Math.abs(velocity.steer) * 4);
      velocity.smokeTimer = 0.045;
    }

    const aim = entity.ai?.aimPoint || ctx.input.aimPoint;
    const targetYaw = angleTo({ x: transform.x, z: transform.z }, { x: aim.x, z: aim.z });
    entity.turret.yaw += wrapAngle(targetYaw - entity.turret.yaw) * Math.min(1, dt * stats.turretTurnRate);
    entity.turret.group.rotation.y = entity.turret.yaw - transform.yaw;
  }

  resolveVehicleCollisions(ctx, vehicles, effects);
  updateStabilityAndRender(ctx, vehicles, dt);
}

function vehicleObb(entity) {
  const stats = getVehicleStats(entity);
  return makeObb(entity.transform.x, entity.transform.z, stats.carHalfWidth * 2, stats.carHalfLength * 2, entity.transform.yaw);
}

function resolveVehicleCollisions(ctx, vehicles, effects) {
  for (let i = 0; i < vehicles.length; i += 1) {
    for (let j = i + 1; j < vehicles.length; j += 1) {
      const a = vehicles[i];
      const b = vehicles[j];
      const hit = testObbOverlap(vehicleObb(a), vehicleObb(b));
      if (!hit) continue;
      const statsA = getVehicleStats(a);
      const statsB = getVehicleStats(b);
      const push = Math.min(0.62, hit.depth * 0.52 + 0.025);
      a.transform.x += hit.normal.x * push;
      a.transform.z += hit.normal.z * push;
      b.transform.x -= hit.normal.x * push;
      b.transform.z -= hit.normal.z * push;
      const impact = Math.abs(a.velocity.speed - b.velocity.speed);
      const restitution = (statsA.vehicleCollisionRestitution + statsB.vehicleCollisionRestitution) * 0.5;
      a.velocity.speed *= -restitution;
      b.velocity.speed *= -restitution;
      a.stability.angularRoll += THREE.MathUtils.clamp(hit.normal.x * impact * statsA.impactAngularResponse * 0.025, -0.75, 0.75);
      b.stability.angularRoll -= THREE.MathUtils.clamp(hit.normal.x * impact * statsB.impactAngularResponse * 0.025, -0.75, 0.75);
      a.stability.angularPitch += THREE.MathUtils.clamp(hit.normal.z * impact * statsA.impactAngularResponse * 0.018, -0.55, 0.55);
      b.stability.angularPitch -= THREE.MathUtils.clamp(hit.normal.z * impact * statsB.impactAngularResponse * 0.018, -0.55, 0.55);
      if (impact > 5 && !a.velocity.vehicleCollisionCooldowns.has(b.id)) {
        const damageA = Math.min(8, (impact - 5) * 0.42 / statsA.crashDamageResistance);
        const damageB = Math.min(8, (impact - 5) * 0.42 / statsB.crashDamageResistance);
        applyDamage(a, damageA, 'kinetic', b, effects, { ctx, screenShake: 0.015, cameraEffects: ctx.cameraEffects });
        applyDamage(b, damageB, 'kinetic', a, effects, { ctx, screenShake: 0.015, cameraEffects: ctx.cameraEffects });
        effects.emitImpact((a.transform.x + b.transform.x) * 0.5, (a.transform.z + b.transform.z) * 0.5, hit.normal, 10);
        a.velocity.vehicleCollisionCooldowns.set(b.id, 0.45);
        b.velocity.vehicleCollisionCooldowns.set(a.id, 0.45);
      }
    }
  }
}

function updateStabilityAndRender(ctx, vehicles, dt) {
  for (const entity of vehicles) {
    const stats = getVehicleStats(entity);
    const stability = entity.stability;
    if (stability.recovering) {
      stability.recoveryTimer = Math.max(0, stability.recoveryTimer - dt);
      const t = 1 - stability.recoveryTimer / 0.5;
      stability.pitch = THREE.MathUtils.lerp(stability.pitch, 0, t);
      stability.roll = THREE.MathUtils.lerp(stability.roll, 0, t);
      if (stability.recoveryTimer <= 0) {
        stability.recovering = false;
        stability.pitch = 0;
        stability.roll = 0;
      }
    } else {
      stability.pitch += stability.angularPitch * dt;
      stability.roll += stability.angularRoll * dt;
      stability.angularPitch = THREE.MathUtils.lerp(stability.angularPitch, 0, Math.min(1, dt * 4.2));
      stability.angularRoll = THREE.MathUtils.lerp(stability.angularRoll, 0, Math.min(1, dt * 4.2));
      stability.pitch = THREE.MathUtils.lerp(stability.pitch, 0, Math.min(1, dt * 1.7));
      stability.roll = THREE.MathUtils.lerp(stability.roll, 0, Math.min(1, dt * 1.7));
      const upsideDown = Math.abs(stability.roll) > Math.PI * 0.58 || Math.abs(stability.pitch) > Math.PI * 0.58;
      stability.upsideDownTimer = upsideDown ? stability.upsideDownTimer + dt : 0;
      if (stability.upsideDownTimer >= stats.uprightRecoveryDelay) {
        stability.recovering = true;
        stability.recoveryTimer = 0.5;
        stability.angularPitch = 0;
        stability.angularRoll = 0;
        entity.velocity.speed *= 0.2;
      }
    }

    const group = entity.renderable.group;
    entity.renderable.animTime = (entity.renderable.animTime || 0) + dt;
    const speedBob = Math.min(0.055, Math.abs(entity.velocity.speed) * 0.0018);
    const idleBob = Math.sin(entity.renderable.animTime * 4.5 + entity.transform.x) * speedBob;
    group.position.set(entity.transform.x, stats.rideHeight + idleBob + (entity.transform.y || 0), entity.transform.z);
    group.rotation.set(stability.pitch, entity.transform.yaw, stability.roll);
    entity.renderable.label?.sprite.quaternion.copy(ctx.camera.quaternion);
    entity.renderable.wheelPivots.forEach(({ pivot, front }) => {
      if (front) pivot.rotation.y = entity.velocity.steer * 0.52;
    });
    entity.renderable.wheelMeshes.forEach((wheel) => {
      wheel.rotation.x = entity.velocity.wheelSpin;
    });
    entity.renderable.idleParts?.forEach((part, index) => {
      part.rotation.z += dt * (1.6 + index * 0.35);
    });
    entity.renderable.glowMaterials?.forEach((material, index) => {
      const pulse = 1.8 + Math.sin(entity.renderable.animTime * 5.2 + index) * 0.45;
      material.emissiveIntensity = entity.controls?.throttle ? pulse + 0.55 : pulse;
    });
    entity.renderable.brakeLightMaterial.emissiveIntensity = entity.controls?.brake ? 5.8 : 1.2;
  }
}
