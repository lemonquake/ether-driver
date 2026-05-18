import { distance2D } from '../core/collision.js';

export function generateNavigationGraph(ctx) {
  const nodes = [];
  const seen = new Set();
  function addNode(x, z) {
    const key = `${Math.round(x)}:${Math.round(z)}`;
    if (seen.has(key)) return;
    seen.add(key);
    nodes.push({ id: nodes.length, x, z, links: [] });
  }
  ctx.roads.forEach((road) => {
    const step = 42;
    const countX = Math.max(1, Math.floor(road.w / step));
    const countZ = Math.max(1, Math.floor(road.d / step));
    for (let ix = -countX; ix <= countX; ix += 1) {
      for (let iz = -countZ; iz <= countZ; iz += 1) {
        addNode(road.x + ix * step * 0.5, road.z + iz * step * 0.5);
      }
    }
  });
  addNode(0, 0);
  nodes.forEach((node) => {
    node.links = nodes
      .filter((other) => other !== node)
      .map((other) => ({ id: other.id, d: distance2D(node, other) }))
      .filter((link) => link.d <= 68)
      .sort((a, b) => a.d - b.d)
      .slice(0, 5)
      .map((link) => link.id);
  });
  return { nodes };
}

export function findNearestWaypoint(graph, point) {
  if (!graph?.nodes?.length) return null;
  return graph.nodes.reduce((best, node) => {
    const d = distance2D(node, point);
    return !best || d < best.d ? { node, d } : best;
  }, null).node;
}

export function getRouteToTarget(graph, from, to, maxSteps = 10) {
  const start = findNearestWaypoint(graph, from);
  const goal = findNearestWaypoint(graph, to);
  if (!start || !goal) return [];
  const route = [start];
  const visited = new Set([start.id]);
  let current = start;
  for (let i = 0; i < maxSteps && current.id !== goal.id; i += 1) {
    const next = current.links
      .map((id) => graph.nodes[id])
      .filter((node) => !visited.has(node.id))
      .sort((a, b) => distance2D(a, goal) - distance2D(b, goal))[0];
    if (!next) break;
    route.push(next);
    visited.add(next.id);
    current = next;
  }
  if (route[route.length - 1]?.id !== goal.id) route.push(goal);
  return route;
}

export function makePatrolRoute(graph, seed = 0, length = 6) {
  if (!graph?.nodes?.length) return [];
  const nodes = [];
  for (let i = 0; i < length; i += 1) {
    const index = Math.abs((seed * 17 + i * 29) % graph.nodes.length);
    nodes.push(graph.nodes[index]);
  }
  return nodes;
}

export function addLearnedRoutes(graph, sessions = []) {
  graph.learnedRoutes = sessions
    .filter((session) => Array.isArray(session.points) && session.points.length >= 2)
    .map((session, index) => ({
      id: session.id || `learned-${index}`,
      points: session.points
        .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.z))
        .map((point) => ({ ...point, links: [] })),
    }))
    .filter((route) => route.points.length >= 2);
}

export function findLearnedRoute(graph, from, to) {
  if (!graph?.learnedRoutes?.length) return null;
  const candidates = graph.learnedRoutes
    .map((route) => {
      let bestStart = 0;
      let bestStartDistance = Infinity;
      route.points.forEach((point, index) => {
        const d = distance2D(point, from);
        if (d < bestStartDistance) {
          bestStart = index;
          bestStartDistance = d;
        }
      });
      const endpoint = route.points[route.points.length - 1];
      return {
        route,
        bestStart,
        score: bestStartDistance + (to ? distance2D(endpoint, to) * 0.35 : 0),
      };
    })
    .sort((a, b) => a.score - b.score);
  const best = candidates[0];
  if (!best || best.score > 155) return null;
  const points = best.route.points.slice(best.bestStart, best.bestStart + 10);
  return points.length >= 2 ? points : best.route.points.slice(0, 10);
}
