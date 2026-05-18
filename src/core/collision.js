export function moveTowards(value, target, maxDelta) {
  if (value < target) return Math.min(value + maxDelta, target);
  if (value > target) return Math.max(value - maxDelta, target);
  return target;
}

export function forwardFromYaw(yaw) {
  return { x: Math.sin(yaw), z: Math.cos(yaw) };
}

export function distance2D(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.hypot(dx, dz);
}

export function angleTo(from, to) {
  return Math.atan2(to.x - from.x, to.z - from.z);
}

export function wrapAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export function makeObb(x, z, w, d, rotation = 0) {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return {
    x,
    z,
    halfW: w / 2,
    halfD: d / 2,
    axes: [
      { x: cos, z: sin },
      { x: -sin, z: cos },
    ],
  };
}

function projectObb(obb, axis) {
  const center = obb.x * axis.x + obb.z * axis.z;
  const radius =
    obb.halfW * Math.abs(obb.axes[0].x * axis.x + obb.axes[0].z * axis.z) +
    obb.halfD * Math.abs(obb.axes[1].x * axis.x + obb.axes[1].z * axis.z);
  return { min: center - radius, max: center + radius };
}

export function testObbOverlap(a, b) {
  let minDepth = Infinity;
  let bestAxis = null;
  for (const axis of [...a.axes, ...b.axes]) {
    const pa = projectObb(a, axis);
    const pb = projectObb(b, axis);
    const overlap = Math.min(pa.max, pb.max) - Math.max(pa.min, pb.min);
    if (overlap <= 0) return null;
    if (overlap < minDepth) {
      minDepth = overlap;
      bestAxis = axis;
    }
  }
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  const facing = dx * bestAxis.x + dz * bestAxis.z;
  const normal = facing < 0 ? { x: -bestAxis.x, z: -bestAxis.z } : { x: bestAxis.x, z: bestAxis.z };
  return { depth: minDepth, normal };
}

export function findObbCollision(moving, shapes) {
  let best = null;
  for (const shape of shapes) {
    const obstacle = makeObb(shape.x, shape.z, shape.w + shape.padding * 2, shape.d + shape.padding * 2, shape.r);
    const hit = testObbOverlap(moving, obstacle);
    if (!hit) continue;
    if (!best || hit.depth < best.depth) best = { ...hit, shape };
  }
  return best;
}
