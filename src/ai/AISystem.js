import * as YUKA from 'yuka';
import { angleTo, distance2D, findObbCollision, forwardFromYaw, makeObb, wrapAngle } from '../core/collision.js';
import { findLearnedRoute, findNearestWaypoint, getRouteToTarget, makePatrolRoute } from './NavigationSystem.js';
import { applyDamage } from '../combat/DamageSystem.js';

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
    decision: null,
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
  const carY = entity.transform.y || 0;
  const filteredShapes = ctx.collisionShapes.filter((shape) => {
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
    return carY < obstacleHeight;
  });

  const probes = [
    { key: 'front', lateral: 0, distance: 5.5, width: 2.2, depth: 6.3 },
    { key: 'left', lateral: -2.9, distance: 4.7, width: 1.9, depth: 5.1 },
    { key: 'right', lateral: 2.9, distance: 4.7, width: 1.9, depth: 5.1 },
  ].map((probe) => {
    const x = entity.transform.x + forward.x * probe.distance + right.x * probe.lateral;
    const z = entity.transform.z + forward.z * probe.distance + right.z * probe.lateral;
    const obb = makeObb(x, z, probe.width, probe.depth, yaw);
    const worldHit = findObbCollision(obb, filteredShapes);
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
  if (distance2D(entity.transform, point) < 10) {
    nav.waypointIndex = Math.min(nav.waypointIndex + 1, nav.route.length - 1);
  }
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

function findNearestPickupFiltered(ctx, entity, filterFn, allowInactive = false) {
  const pickups = ctx.ecs.entities.filter(
    (e) => e.pickup && (allowInactive || e.pickup.respawn <= 0) && filterFn(e.pickup)
  );
  if (!pickups.length) return null;
  return pickups.sort(
    (a, b) => distance2D(a.transform, entity.transform) - distance2D(b.transform, entity.transform)
  )[0];
}

function isTargetObstructed(ctx, source, target) {
  if (!ctx.collisionShapes || ctx.collisionShapes.length === 0) return false;

  const x1 = source.transform.x;
  const z1 = source.transform.z;
  const y1 = (source.transform.y || 0) + 1.45; // Turret height approximately

  const x2 = target.transform.x;
  const z2 = target.transform.z;
  const y2 = (target.transform.y || 0) + 1.15; // Target center approximately

  const dx = x2 - x1;
  const dz = z2 - z1;
  const dist2D = Math.hypot(dx, dz);
  if (dist2D < 0.1) return false;

  for (const shape of ctx.collisionShapes) {
    if (shape.isCampaignEnemy) continue;

    // Get shape dimensions and height
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

    // Translate line segment relative to shape's center
    const cx = shape.x;
    const cz = shape.z;
    const rx1 = x1 - cx;
    const rz1 = z1 - cz;
    const rx2 = x2 - cx;
    const rz2 = z2 - cz;

    // Rotate points if the shape is rotated
    let lx1 = rx1, lz1 = rz1;
    let lx2 = rx2, lz2 = rz2;
    if (shape.r) {
      const cos = Math.cos(-shape.r);
      const sin = Math.sin(-shape.r);
      lx1 = rx1 * cos - rz1 * sin;
      lz1 = rx1 * sin + rz1 * cos;
      lx2 = rx2 * cos - rz2 * sin;
      lz2 = rx2 * sin + rz2 * cos;
    }

    const halfW = shape.w / 2;
    const halfD = shape.d / 2;

    // Perform Liang-Barsky line segment vs AABB intersection check
    let t0 = 0;
    let t1 = 1;
    const ldx = lx2 - lx1;
    const ldz = lz2 - lz1;

    let intersects = true;

    // Check X axis clipping
    if (Math.abs(ldx) < 1e-6) {
      if (lx1 < -halfW || lx1 > halfW) intersects = false;
    } else {
      let tMinX = (-halfW - lx1) / ldx;
      let tMaxX = (halfW - lx1) / ldx;
      if (tMinX > tMaxX) {
        const tmp = tMinX;
        tMinX = tMaxX;
        tMaxX = tmp;
      }
      t0 = Math.max(t0, tMinX);
      t1 = Math.min(t1, tMaxX);
      if (t0 > t1) intersects = false;
    }

    if (!intersects) continue;

    // Check Z axis clipping
    if (Math.abs(ldz) < 1e-6) {
      if (lz1 < -halfD || lz1 > halfD) intersects = false;
    } else {
      let tMinZ = (-halfD - lz1) / ldz;
      let tMaxZ = (halfD - lz1) / ldz;
      if (tMinZ > tMaxZ) {
        const tmp = tMinZ;
        tMinZ = tMaxZ;
        tMaxZ = tmp;
      }
      t0 = Math.max(t0, tMinZ);
      t1 = Math.min(t1, tMaxZ);
      if (t0 > t1) intersects = false;
    }

    if (!intersects) continue;

    // Intersection occurred in 2D. Check 3D vertical overlap
    const yAtT0 = y1 + t0 * (y2 - y1);
    const yAtT1 = y1 + t1 * (y2 - y1);
    const minYInObstacle = Math.min(yAtT0, yAtT1);

    if (minYInObstacle < obstacleHeight) {
      return true; // Obstacle blocks the line of sight!
    }
  }

  return false;
}

function makeDecision(ctx, entity) {
  const ai = entity.ai;
  const healthPercent = entity.health.current / entity.health.max;
  const isLowHealth = healthPercent < 0.35;
  const enemy = closestEnemy(ctx, entity);
  const toEnemy = enemy ? distance2D(entity.transform, enemy.transform) : Infinity;

  // 1. Low health crisis: prioritise seeking health
  if (isLowHealth) {
    let healthPickup = findNearestPickupFiltered(ctx, entity, (p) => p.weaponId === 'health-kit' || p.weaponId === 'armor-pack' || p.weaponId === 'tool-box', false);
    if (!healthPickup) {
      // Fallback: search for inactive health pickups if none are active
      healthPickup = findNearestPickupFiltered(ctx, entity, (p) => p.weaponId === 'health-kit' || p.weaponId === 'armor-pack' || p.weaponId === 'tool-box', true);
    }
    if (healthPickup) {
      ai.decision = {
        type: 'seek_health',
        targetPoint: { x: healthPickup.transform.x, z: healthPickup.transform.z },
        targetEntity: healthPickup,
        targetWasActive: healthPickup.pickup.respawn <= 0,
        expiry: 10.0,
      };
      ai.state = 'seek_health';
      return;
    }
  }

  // 2. Hunt enemy if close and healthy
  if (enemy && toEnemy < 80.0) {
    ai.decision = {
      type: 'hunt',
      targetEntity: enemy,
      expiry: 12.0,
    };
    ai.state = 'attack';
    return;
  }

  // 3. Find weapons/ammo if slots are free
  const hasQ = entity.weaponSlots?.q;
  const hasE = entity.weaponSlots?.e;
  if (!hasQ || !hasE) {
    let weaponPickup = findNearestPickupFiltered(ctx, entity, (p) => p.weaponId && !p.weaponId.startsWith('health') && !p.weaponId.startsWith('armor') && !p.weaponId.startsWith('tool'), false);
    if (!weaponPickup) {
      // Fallback: search for inactive weapon pickups
      weaponPickup = findNearestPickupFiltered(ctx, entity, (p) => p.weaponId && !p.weaponId.startsWith('health') && !p.weaponId.startsWith('armor') && !p.weaponId.startsWith('tool'), true);
    }
    if (weaponPickup) {
      ai.decision = {
        type: 'seek_weapon',
        targetPoint: { x: weaponPickup.transform.x, z: weaponPickup.transform.z },
        targetEntity: weaponPickup,
        targetWasActive: weaponPickup.pickup.respawn <= 0,
        expiry: 12.0,
      };
      ai.state = 'pickup';
      return;
    }
  }

  // 4. Explore Hyperdeck vs Patrol Outside
  const numOnHyperdeck = ctx.ecs.entities.filter(other => other.vehicle && other.transform && other.transform.y > 5.0 && !other.health.dead).length;
  const hyperdeckChance = numOnHyperdeck > 0 ? 0.7 : 0.45;

  if (Math.random() < hyperdeckChance) {
    const hyperdeckPoints = [
      { x: 0, z: 0 },
      { x: -35, z: -35 },
      { x: 35, z: -35 },
      { x: -35, z: 35 },
      { x: 35, z: 35 },
      { x: 0, z: 40 },
      { x: 0, z: -40 },
      { x: -40, z: 0 },
      { x: 40, z: 0 },
    ];
    const targetPoint = hyperdeckPoints[Math.floor(Math.random() * hyperdeckPoints.length)];
    ai.decision = {
      type: 'explore_hyperdeck',
      targetPoint,
      expiry: 12.0 + Math.random() * 5.0,
    };
    ai.state = 'explore_hyperdeck';
  } else {
    const outerWaypoints = [
      { x: -160, z: -160 },
      { x: 160, z: -160 },
      { x: -160, z: 160 },
      { x: 160, z: 160 },
      { x: -140, z: 0 },
      { x: 140, z: 0 },
      { x: 0, z: -140 },
      { x: 0, z: 140 },
    ];
    const targetPoint = outerWaypoints[Math.floor(Math.random() * outerWaypoints.length)];
    ai.decision = {
      type: 'patrol_outside',
      targetPoint,
      expiry: 15.0 + Math.random() * 5.0,
    };
    ai.state = 'patrol_outside';
  }
}

export function updateAI(ctx, dt) {
  if (!ctx.match?.active || ctx.match.ended) return;
  for (const entity of ctx.ecs.entities.filter((e) => e.ai && !e.health.dead)) {
    const ai = entity.ai;
    updateNavigationSensors(ctx, entity, dt);

    // Crisis check: immediate redecide if low health on non-survival states
    const healthPercent = entity.health.current / entity.health.max;
    const isLowHealth = healthPercent < 0.35;

    if (isLowHealth && ai.decision && ai.decision.type !== 'seek_health') {
      ai.decision.expiry = 0;
    }

    // Evaluate active decision validity
    if (ai.decision) {
      ai.decision.expiry -= dt;

      // Force repath if targets vanish or if an active pickup was snatched
      if (ai.decision.type === 'seek_health' || ai.decision.type === 'seek_weapon') {
        const targetPickup = ai.decision.targetEntity;
        if (!targetPickup || targetPickup.health?.dead) {
          ai.decision.expiry = 0;
        } else if (ai.decision.targetWasActive && targetPickup.pickup?.respawn > 0) {
          ai.decision.expiry = 0;
        }
      } else if (ai.decision.type === 'hunt') {
        const targetEnemy = ai.decision.targetEntity;
        if (!targetEnemy || targetEnemy.health?.dead) {
          ai.decision.expiry = 0;
        }
      }
    }

    // If decision expired, choose a new one
    if (!ai.decision || ai.decision.expiry <= 0) {
      makeDecision(ctx, entity);
    }

    // Avoidance overrides
    if (ai.nav.reverseTimer > 0 || ai.nav.avoidTimer > 0) {
      chooseAvoidanceControls(entity);
      ai.fireTurret = false;
      ai.useSpecial = null;
      continue;
    } else if (ai.state === 'unstuck' || ai.state === 'avoid') {
      // Avoidance finished. Reset repath timer and restore state from decision.
      ai.nav.repathTimer = 0;
      if (ai.decision) {
        if (ai.decision.type === 'seek_health') ai.state = 'seek_health';
        else if (ai.decision.type === 'seek_weapon') ai.state = 'pickup';
        else if (ai.decision.type === 'hunt') ai.state = 'attack';
        else if (ai.decision.type === 'explore_hyperdeck') ai.state = 'explore_hyperdeck';
        else if (ai.decision.type === 'patrol_outside') ai.state = 'patrol_outside';
      } else {
        ai.state = 'patrol';
      }
    }

    ai.yukaVehicle.position.set(entity.transform.x, 0, entity.transform.z);
    
    // Weapon fire and utility timers
    ai.fireTimer -= dt;
    ai.specialTimer -= dt;

    const target = closestEnemy(ctx, entity);

    if (ai.state === 'seek_health') {
      const targetPoint = ai.decision.targetPoint;
      steerToward(entity, routeTarget(ctx, entity, targetPoint, dt), 1.1);
      if (target) {
        ai.aimPoint = { x: target.transform.x, y: (target.transform.y || 0) + 1.15, z: target.transform.z };
        if (ai.fireTimer <= 0 && !isTargetObstructed(ctx, entity, target)) {
          ai.fireTurret = true;
          ai.fireTimer = 0.35;
        }
      }
    } else if (ai.state === 'pickup') {
      const targetPoint = ai.decision.targetPoint;
      steerToward(entity, routeTarget(ctx, entity, targetPoint, dt), 1.0);
      if (target) {
        ai.aimPoint = { x: target.transform.x, y: (target.transform.y || 0) + 1.15, z: target.transform.z };
        if (ai.fireTimer <= 0 && !isTargetObstructed(ctx, entity, target)) {
          ai.fireTurret = true;
          ai.fireTimer = 0.35;
        }
      }
    } else if (ai.state === 'attack') {
      const attackTarget = ai.decision.targetEntity || target;
      if (!attackTarget) {
        ai.decision.expiry = 0;
        continue;
      }
      const distToAttack = distance2D(entity.transform, attackTarget.transform);
      ai.aimPoint = { x: attackTarget.transform.x, y: (attackTarget.transform.y || 0) + 1.15, z: attackTarget.transform.z };
      steerToward(entity, routeTarget(ctx, entity, attackTarget.transform, dt), distToAttack > 22 ? 1.0 : 0.4);
      
      if (ai.fireTimer <= 0 && !isTargetObstructed(ctx, entity, attackTarget)) {
        ai.fireTurret = true;
        ai.fireTimer = 0.28 + Math.random() * 0.24;
      }
      if (ai.specialTimer <= 0 && !isTargetObstructed(ctx, entity, attackTarget)) {
        ai.useSpecial = entity.weaponSlots?.q ? 'q' : 'e';
        ai.specialTimer = 4.0 + Math.random() * 3.0;
      }
    } else if (ai.state === 'explore_hyperdeck') {
      const targetPoint = ai.decision.targetPoint;
      steerToward(entity, routeTarget(ctx, entity, targetPoint, dt), 0.95);
      
      if (target) {
        ai.aimPoint = { x: target.transform.x, y: (target.transform.y || 0) + 1.15, z: target.transform.z };
        if (ai.fireTimer <= 0 && !isTargetObstructed(ctx, entity, target)) {
          ai.fireTurret = true;
          ai.fireTimer = 0.35;
        }
      }
      
      // Expire if reached exploration target point
      if (distance2D(entity.transform, targetPoint) < 12.0) {
        ai.decision.expiry = 0;
      }
    } else if (ai.state === 'patrol_outside') {
      const targetPoint = ai.decision.targetPoint;
      steerToward(entity, routeTarget(ctx, entity, targetPoint, dt), 0.85);
      
      if (target) {
        ai.aimPoint = { x: target.transform.x, y: (target.transform.y || 0) + 1.15, z: target.transform.z };
        if (ai.fireTimer <= 0 && !isTargetObstructed(ctx, entity, target)) {
          ai.fireTurret = true;
          ai.fireTimer = 0.35;
        }
      }
      
      // Expire if reached outside target point
      if (distance2D(entity.transform, targetPoint) < 12.0) {
        ai.decision.expiry = 0;
      }
    } else {
      // Fallback normal patrol
      if (!ai.nav.route?.length) ai.nav.route = makePatrolRoute(ctx.navigation, ai.waypoint + 5, 7);
      let waypoint = ai.nav.route[ai.nav.waypointIndex] || findNearestWaypoint(ctx.navigation, entity.transform) || waypoints[ai.waypoint];
      if ((ai.nav.lastProbe?.blocked || ai.nav.blockedWaypointCooldown > 0) && ai.nav.route.length > 1) {
        ai.nav.waypointIndex = (ai.nav.waypointIndex + 1) % ai.nav.route.length;
        waypoint = ai.nav.route[ai.nav.waypointIndex];
      }
      if (distance2D(entity.transform, waypoint) < 12) ai.waypoint = (ai.waypoint + 1) % waypoints.length;
      steerToward(entity, waypoint, 0.8);
      if (distance2D(entity.transform, waypoint) < 12) ai.nav.waypointIndex = (ai.nav.waypointIndex + 1) % ai.nav.route.length;
      if (target) ai.aimPoint = { x: target.transform.x, y: (target.transform.y || 0) + 1.15, z: target.transform.z };
    }
  }
}

