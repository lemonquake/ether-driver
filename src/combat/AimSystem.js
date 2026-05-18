import * as THREE from 'three';
import { distance2D } from '../core/collision.js';

const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const LOCK_RANGE = 420;
const ACQUIRE_RADIUS_PX = 130;
const RELEASE_MARGIN_PX = 180;

const _targetWorld = new THREE.Vector3();
const _projected = new THREE.Vector3();
const _cursorNDC = new THREE.Vector2();

function targetCenter(entity) {
  const y = (entity.transform.y || 0) + 1.15;
  _targetWorld.set(entity.transform.x, y, entity.transform.z);
  return _targetWorld;
}

function projectTarget(ctx, entity, out) {
  _projected.copy(targetCenter(entity)).project(ctx.camera);
  if (_projected.z < -1 || _projected.z > 1) return false;
  if (Math.abs(_projected.x) > 1.08 || Math.abs(_projected.y) > 1.08) return false;
  out.set(_projected.x, _projected.y);
  return true;
}

function screenDistancePx(a, b) {
  const dx = (a.x - b.x) * window.innerWidth * 0.5;
  const dy = (a.y - b.y) * window.innerHeight * 0.5;
  return Math.hypot(dx, dy);
}

function validEnemy(ctx, player, entity) {
  return entity?.vehicle
    && entity.teamId !== player.teamId
    && !entity.health?.dead
    && distance2D(player.transform, entity.transform) <= LOCK_RANGE;
}

function findAcquiredTarget(ctx, player) {
  let best = null;
  let bestScore = Infinity;
  const targetNDC = ctx.input.targetScreenNDC;
  _cursorNDC.copy(ctx.mouse);

  for (const enemy of ctx.ecs.entities) {
    if (!validEnemy(ctx, player, enemy)) continue;
    if (!projectTarget(ctx, enemy, targetNDC)) continue;

    const cursorDistance = screenDistancePx(targetNDC, _cursorNDC);
    const wasHover = enemy === ctx.input.hoverTarget || enemy === ctx.input.lockedTarget;
    const radius = wasHover ? RELEASE_MARGIN_PX : ACQUIRE_RADIUS_PX;
    if (cursorDistance > radius) continue;

    const worldBias = distance2D(player.transform, enemy.transform) * 0.045;
    const score = cursorDistance + worldBias;
    if (score < bestScore) {
      best = enemy;
      bestScore = score;
    }
  }

  if (best) projectTarget(ctx, best, targetNDC);
  return best;
}

function clearLock(input) {
  input.lockedTarget = null;
  input.hoverTarget = null;
  input.lockState = 'idle';
  input.lockLostTimer = 0;
}

function updateGroundAim(ctx) {
  ctx.raycaster.setFromCamera(ctx.input.crosshairNDC, ctx.camera);
  const hits = ctx.aimMeshes ? ctx.raycaster.intersectObjects(ctx.aimMeshes, false) : [];
  if (hits.length) ctx.input.aimPoint.copy(hits[0].point);
  else ctx.raycaster.ray.intersectPlane(groundPlane, ctx.input.aimPoint);
}

export function updateAim(ctx, dt = 0.016) {
  const { input } = ctx;
  const player = ctx.player;
  const previousTarget = input.lockedTarget || input.hoverTarget;
  const previousState = input.lockState;
  if (!input.crosshairNDC) input.crosshairNDC = new THREE.Vector2();
  if (!input.targetScreenNDC) input.targetScreenNDC = new THREE.Vector2();
  input.lockPulse = (input.lockPulse || 0) + dt;

  if (!player || player.health?.dead) {
    clearLock(input);
    input.crosshairNDC.lerp(ctx.mouse, Math.min(1, 12 * dt));
    updateGroundAim(ctx);
    return;
  }

  if (!input.lockHeld) {
    clearLock(input);
    input.crosshairNDC.lerp(ctx.mouse, Math.min(1, 12 * dt));
    updateGroundAim(ctx);
    return;
  }

  let lockedTarget = input.lockedTarget;
  const lockStillValid = lockedTarget
    && validEnemy(ctx, player, lockedTarget)
    && projectTarget(ctx, lockedTarget, input.targetScreenNDC);

  if (!lockStillValid) lockedTarget = null;

  const acquiredTarget = lockedTarget || findAcquiredTarget(ctx, player);
  if (input.lockHeld && acquiredTarget) {
    input.lockedTarget = acquiredTarget;
    input.hoverTarget = acquiredTarget;
    input.lockState = 'locked';
    projectTarget(ctx, acquiredTarget, input.targetScreenNDC);
  } else {
    input.lockedTarget = null;
    input.hoverTarget = acquiredTarget;
    input.lockState = acquiredTarget ? 'acquired' : 'idle';
  }

  if (!acquiredTarget && previousTarget && previousState !== 'idle') {
    input.lockLostTimer = 0.18;
  }
  if (!acquiredTarget && input.lockLostTimer > 0) {
    input.lockLostTimer = Math.max(0, input.lockLostTimer - dt);
    input.lockState = 'lost';
  }

  if (input.lockState === 'locked' || input.lockState === 'acquired') {
    const rate = input.lockState === 'locked' ? 34 : 24;
    input.crosshairNDC.lerp(input.targetScreenNDC, Math.min(1, rate * dt));
  } else {
    input.crosshairNDC.lerp(ctx.mouse, Math.min(1, 12 * dt));
  }

  if (input.lockedTarget) {
    const center = targetCenter(input.lockedTarget);
    input.aimPoint.copy(center);
  } else {
    updateGroundAim(ctx);
  }
}
