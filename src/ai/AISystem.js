import * as YUKA from 'yuka';
import { angleTo, distance2D, findObbCollision, forwardFromYaw, makeObb, wrapAngle } from '../core/collision.js';
import { findLearnedRoute, findNearestWaypoint, getRouteToTarget, makePatrolRoute } from './NavigationSystem.js';

const waypoints = [
  { x: -110, z: -80 },
  { x: 120, z: -90 },
  { x: 120, z: 105 },
  { x: -120, z: 95 },
  { x: 0, z: 0 },
];

export function attachAI(entity, index, ctx) {
  const yukaVehicle = new YUKA.Vehicle();
  yukaVehicle.maxSpeed = 8;
  yukaVehicle.position.set(entity.transform.x, 0, entity.transform.z);
  const route = makePatrolRoute(ctx?.navigation, index + 3, 7);
  entity.ai = {
    yukaVehicle,
    state: 'patrol',
    waypoint: index % waypoints.length,
    controls: { throttle: 0, brake: 0, steerTarget: 0, handbrake: false },
    aimPoint: { x: 0, z: 0 },
    fireTurret: false,
    fireTimer: 0,
    specialTimer: 2 + index,
    useSpecial: null,
    nav: {
      route,
      waypointIndex: index % Math.max(1, route.length),
      repathTimer: 0,
      stuckTimer: 0,
      avoidTimer: 0,
      avoidSide: 1,
      reverseTimer: 0,
      unstuckAttempts: 0,
      probeTimer: 0,
      blocked: false,
      blockedShapeId: null,
      blockedWaypointCooldown: 0,
      lastProbe: null,
      lastPosition: { x: entity.transform.x, z: entity.transform.z },
      lastSafePosition: { x: entity.transform.x, z: entity.transform.z },
      laneOffset: (index % 5 - 2) * 2.3,
    },
  };
}

function steerToward(entity, target, speedBias = 1) {
  const nav = entity.ai?.nav;
  const desiredYaw = angleTo(entity.transform, target) + (nav?.laneOffset || 0) * 0.006;
  const delta = wrapAngle(desiredYaw - entity.transform.yaw);
  entity.ai.controls = {
    throttle: speedBias,
    brake: 0,
    steerTarget: delta > 0 ? 1 : -1,
    handbrake: Math.abs(delta) > 1.15,
  };
  if (Math.abs(delta) < 0.12) entity.ai.controls.steerTarget = 0;
}

export function probeVehiclePath(ctx, entity) {
  const yaw = entity.transform.yaw;
  const forward = forwardFromYaw(yaw);
  const right = { x: Math.cos(yaw), z: -Math.sin(yaw) };
  const probes = [
    { key: 'front', lateral: 0, distance: 5.5, width: 2.2, depth: 6.3 },
    { key: 'left', lateral: -2.9, distance: 4.7, width: 1.9, depth: 5.1 },
    { key: 'right', lateral: 2.9, distance: 4.7, width: 1.9, depth: 5.1 },
  ].map((probe) => {
    const x = entity.transform.x + forward.x * probe.distance + right.x * probe.lateral;
    const z = entity.transform.z + forward.z * probe.distance + right.z * probe.lateral;
    const obb = makeObb(x, z, probe.width, probe.depth, yaw);
    const worldHit = findObbCollision(obb, ctx.collisionShapes);
    const vehicleHit = ctx.ecs.entities.find((other) => other !== entity && other.vehicle && !other.health.dead && distance2D(other.transform, { x, z }) < 4.1);
    return { ...probe, x, z, hit: worldHit || (vehicleHit ? { normal: { x: -forward.x, z: -forward.z }, shape: { type: 'vehicle', id: vehicleHit.id } } : null) };
  });
  const front = probes.find((probe) => probe.key === 'front');
  const left = probes.find((probe) => probe.key === 'left');
  const rightProbe = probes.find((probe) => probe.key === 'right');
  const avoidSide = left.hit && !rightProbe.hit ? 1 : rightProbe.hit && !left.hit ? -1 : front.hit?.normal?.x || front.hit?.normal?.z ? (Math.random() > 0.5 ? 1 : -1) : 1;
  return {
    front,
    left,
    right: rightProbe,
    blocked: Boolean(front.hit),
    boxedIn: Boolean(front.hit && left.hit && rightProbe.hit),
    avoidSide,
    blockedShapeId: front.hit?.shape?.id || front.hit?.shape?.type || null,
  };
}

function updateNavigationSensors(ctx, entity, dt) {
  const nav = entity.ai.nav;
  nav.probeTimer -= dt;
  nav.stuckTimer -= dt;
  nav.blockedWaypointCooldown = Math.max(0, nav.blockedWaypointCooldown - dt);
  nav.avoidTimer = Math.max(0, nav.avoidTimer - dt);
  nav.reverseTimer = Math.max(0, nav.reverseTimer - dt);
  if (nav.probeTimer <= 0) {
    const probe = probeVehiclePath(ctx, entity);
    nav.lastProbe = probe;
    nav.blocked = probe.blocked;
    nav.blockedShapeId = probe.blockedShapeId;
    if (probe.blocked) {
      nav.avoidSide = probe.avoidSide;
      nav.avoidTimer = Math.max(nav.avoidTimer, probe.boxedIn ? 1.8 : 1.2 + Math.random() * 0.6);
      nav.reverseTimer = Math.max(nav.reverseTimer, probe.boxedIn ? 1.55 : 1.2);
      nav.blockedWaypointCooldown = 1.6;
    }
    nav.probeTimer = 0.18 + Math.random() * 0.07;
  }
  if (nav.stuckTimer <= 0) {
    const moved = distance2D(entity.transform, nav.lastPosition);
    const tryingToMove = entity.ai.controls.throttle > 0 || entity.ai.controls.brake > 0;
    if (moved > 2.2) {
      nav.lastSafePosition = { x: entity.transform.x, z: entity.transform.z };
      nav.unstuckAttempts = 0;
    } else if (moved < 0.7 && tryingToMove) {
      nav.unstuckAttempts += 1;
      nav.avoidTimer = Math.max(nav.avoidTimer, 1.25);
      nav.reverseTimer = Math.max(nav.reverseTimer, 1.25);
      nav.avoidSide = nav.lastProbe?.avoidSide || (Math.random() > 0.5 ? 1 : -1);
      if (nav.unstuckAttempts >= 2 && ctx.navigation) {
        const safe = findNearestWaypoint(ctx.navigation, nav.lastSafePosition);
        if (safe) {
          nav.route = getRouteToTarget(ctx.navigation, entity.transform, safe, 4);
          nav.waypointIndex = 0;
        }
      }
    }
    nav.lastPosition = { x: entity.transform.x, z: entity.transform.z };
    nav.stuckTimer = 0.75;
  }
}

export function chooseAvoidanceControls(entity, probeResult = entity.ai.nav.lastProbe) {
  const nav = entity.ai.nav;
  const boxedIn = probeResult?.boxedIn;
  entity.ai.state = boxedIn || nav.unstuckAttempts > 0 ? 'unstuck' : 'avoid';
  entity.ai.controls = {
    throttle: 0,
    brake: 0,
    reverse: 1,
    steerTarget: nav.avoidSide || 1,
    handbrake: Boolean(boxedIn || nav.unstuckAttempts > 0),
  };
}

function routeTarget(ctx, entity, target, dt) {
  const nav = entity.ai.nav;
  nav.repathTimer -= dt;
  if (target && nav.repathTimer <= 0) {
    nav.route = findLearnedRoute(ctx.navigation, entity.transform, target) || getRouteToTarget(ctx.navigation, entity.transform, target, 8);
    nav.waypointIndex = 0;
    nav.repathTimer = 0.8 + Math.random() * 0.4;
  }
  const point = nav.route?.[nav.waypointIndex];
  if (!point) return target || { x: 0, z: 0 };
  if (distance2D(entity.transform, point) < 10) nav.waypointIndex = (nav.waypointIndex + 1) % nav.route.length;
  return nav.route[nav.waypointIndex] || point;
}

function recoverRouteTarget(ctx, entity) {
  const nav = entity.ai.nav;
  const nearest = findNearestWaypoint(ctx.navigation, nav.lastSafePosition) || findNearestWaypoint(ctx.navigation, entity.transform);
  if (nearest) {
    nav.route = getRouteToTarget(ctx.navigation, entity.transform, nearest, 5);
    nav.waypointIndex = Math.min(1, nav.route.length - 1);
  }
  entity.ai.state = 'recover-route';
}

function closestEnemy(ctx, entity) {
  return ctx.ecs.entities
    .filter((candidate) => candidate.vehicle && candidate.teamId !== entity.teamId && !candidate.health.dead)
    .sort((a, b) => distance2D(a.transform, entity.transform) - distance2D(b.transform, entity.transform))[0];
}

export function updateAI(ctx, dt) {
  if (!ctx.match?.active || ctx.match.ended) return;
  for (const entity of ctx.ecs.entities.filter((e) => e.ai && !e.health.dead)) {
    const ai = entity.ai;
    updateNavigationSensors(ctx, entity, dt);
    if (ai.nav.reverseTimer > 0 || ai.nav.avoidTimer > 0) {
      chooseAvoidanceControls(entity);
      ai.fireTurret = false;
      ai.useSpecial = null;
      continue;
    } else if (ai.state === 'unstuck' || ai.state === 'avoid') {
      recoverRouteTarget(ctx, entity);
    }
    ai.yukaVehicle.position.set(entity.transform.x, 0, entity.transform.z);
    const target = closestEnemy(ctx, entity);
    if (!target) {
      ai.controls = { throttle: 0, brake: 1, steerTarget: 0, handbrake: false };
      continue;
    }
    const toTarget = distance2D(entity.transform, target.transform);
    const lowHealth = entity.health.current / entity.health.max < 0.3;
    ai.fireTimer -= dt;
    ai.specialTimer -= dt;

    if (lowHealth && toTarget < 45) ai.state = 'evade';
    else if (toTarget < 62) ai.state = 'attack';
    else if (!entity.weaponSlots.q || !entity.weaponSlots.e) ai.state = 'pickup';
    else ai.state = 'patrol';

    if (ai.state === 'attack') {
      ai.aimPoint = { x: target.transform.x, z: target.transform.z };
      steerToward(entity, routeTarget(ctx, entity, target.transform, dt), toTarget > 22 ? 1 : 0);
      if (ai.fireTimer <= 0) {
        ai.fireTurret = true;
        ai.fireTimer = 0.28 + Math.random() * 0.24;
      }
      if (ai.specialTimer <= 0) {
        ai.useSpecial = entity.weaponSlots.q ? 'q' : 'e';
        ai.specialTimer = 4 + Math.random() * 3;
      }
    } else if (ai.state === 'evade') {
      const away = { x: entity.transform.x + (entity.transform.x - target.transform.x), z: entity.transform.z + (entity.transform.z - target.transform.z) };
      ai.aimPoint = { x: target.transform.x, z: target.transform.z };
      steerToward(entity, routeTarget(ctx, entity, away, dt), 1);
    } else if (ai.state === 'pickup') {
      const pickup = ctx.ecs.entities
        .filter((e) => e.pickup && e.pickup.respawn <= 0)
        .sort((a, b) => distance2D(a.transform, entity.transform) - distance2D(b.transform, entity.transform))[0];
      steerToward(entity, routeTarget(ctx, entity, pickup?.transform || waypoints[ai.waypoint], dt), 1);
      ai.aimPoint = { x: target.transform.x, z: target.transform.z };
    } else {
      if (!ai.nav.route?.length) ai.nav.route = makePatrolRoute(ctx.navigation, ai.waypoint + 5, 7);
      let waypoint = ai.nav.route[ai.nav.waypointIndex] || findNearestWaypoint(ctx.navigation, entity.transform) || waypoints[ai.waypoint];
      if ((ai.nav.lastProbe?.blocked || ai.nav.blockedWaypointCooldown > 0) && ai.nav.route.length > 1) {
        ai.nav.waypointIndex = (ai.nav.waypointIndex + 1) % ai.nav.route.length;
        waypoint = ai.nav.route[ai.nav.waypointIndex];
      }
      if (distance2D(entity.transform, waypoint) < 12) ai.waypoint = (ai.waypoint + 1) % waypoints.length;
      steerToward(entity, waypoint, 0.8);
      if (distance2D(entity.transform, waypoint) < 12) ai.nav.waypointIndex = (ai.nav.waypointIndex + 1) % ai.nav.route.length;
      ai.aimPoint = { x: target.transform.x, z: target.transform.z };
    }
  }
}
