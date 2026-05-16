// discovery.js — fog-of-war state (visited / discovered sets)

let visited = new Set();
let discovered = new Set();
let neighborsOf = {};   // id → Set<id>
let onChangeCb = null;

export function init(graphData, startId) {
  // Build adjacency map
  neighborsOf = {};
  graphData.nodes.forEach(n => { neighborsOf[n.id] = new Set(); });
  graphData.edges.forEach(e => {
    const s = typeof e.source === 'object' ? e.source.id : e.source;
    const t = typeof e.target === 'object' ? e.target.id : e.target;
    neighborsOf[s]?.add(t);
    neighborsOf[t]?.add(s);
  });

  visited.add(startId);

  // Rebuild discovered from all visited
  discovered = new Set(visited);
  visited.forEach(id => {
    (neighborsOf[id] ?? new Set()).forEach(n => discovered.add(n));
  });
}

export function arrive(nodeId) {
  visited.add(nodeId);
  discovered.add(nodeId);

  const newlyDiscovered = [];
  (neighborsOf[nodeId] ?? new Set()).forEach(n => {
    if (!discovered.has(n)) { newlyDiscovered.push(n); discovered.add(n); }
  });

  if (onChangeCb) onChangeCb(visited, discovered, newlyDiscovered, nodeId);
}

export function getVisited() { return visited; }
export function getDiscovered() { return discovered; }

export function getReachableFrom(id) {
  return [...(neighborsOf[id] ?? [])].filter(n => discovered.has(n));
}

// Every discovered node reachable from `id` through the discovered subgraph
// (i.e. anywhere findPath could take you), excluding `id` itself.
export function getAllReachableFrom(id) {
  const seen = new Set([id]);
  const queue = [id];
  while (queue.length > 0) {
    const cur = queue.shift();
    for (const nb of neighborsOf[cur] ?? []) {
      if (!discovered.has(nb) || seen.has(nb)) continue;
      seen.add(nb);
      queue.push(nb);
    }
  }
  seen.delete(id);
  return [...seen];
}

// BFS through discovered nodes only; returns full path or null
export function findPath(fromId, toId) {
  if (fromId === toId) return [fromId];
  const queue = [[fromId]];
  const seen = new Set([fromId]);
  while (queue.length > 0) {
    const path = queue.shift();
    const cur = path[path.length - 1];
    for (const neighbor of neighborsOf[cur] ?? []) {
      if (!discovered.has(neighbor)) continue;
      if (neighbor === toId) return [...path, neighbor];
      if (!seen.has(neighbor)) {
        seen.add(neighbor);
        queue.push([...path, neighbor]);
      }
    }
  }
  return null;
}

export function onChange(cb) { onChangeCb = cb; }
