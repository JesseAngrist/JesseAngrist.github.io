// graph.js — D3 force simulation, SVG rendering, zoom

const MIN_SCALE = 0.75;
const MAX_SCALE = 1.0;

let simulation, svg, zoomG, zoomBehavior;
let graphData, config;
let nodeMap = {};      // all node definitions (incl. undiscovered)
let _width, _height;
let _discoveredSet = new Set();  // kept in sync via revealNodes()

let onEdgeClickCb = null;
let onTickCb = null;

// ── zoom toast ──────────────────────────────────────────────────────────────
const _zoomToast = document.getElementById('zoom-toast');
let _zoomToastTimer = null;
function _flashZoomToast() {
  _zoomToast.classList.add('visible');
  clearTimeout(_zoomToastTimer);
  _zoomToastTimer = setTimeout(() => _zoomToast.classList.remove('visible'), 1800);
}

// ── bounds force ─────────────────────────────────────────────────────────────
// Soft walls that keep nodes within ~1× viewport of center in simulation space.
// Takes a direct reference to the nodes array so it works during the pre-run,
// before graphData._nodes is assigned.
function _makeBoundsForce(nodesRef) {
  return function boundsForce() {
    const bx = _width * 0.95;
    const by = _height * 0.95;
    const cx = _width / 2, cy = _height / 2;
    nodesRef.forEach(n => {
      if (n.fx !== undefined) return; // pinned nodes ignored
      const dx = n.x - cx, dy = n.y - cy;
      if (Math.abs(dx) > bx) n.vx -= (dx - Math.sign(dx) * bx) * 0.06;
      if (Math.abs(dy) > by) n.vy -= (dy - Math.sign(dy) * by) * 0.06;
    });
  };
}

// ── BFS radial initial layout ────────────────────────────────────────────────
// Seeds positions by BFS depth from start node, minimising edge crossings.
function _bfsRadialLayout(nodes, rawEdges, startId, W, H, discoveredSet) {
  const cx = W / 2, cy = H / 2;
  const byId = {};
  nodes.forEach(n => { byId[n.id] = n; });

  // Adjacency (discovered nodes only)
  const adj = {};
  rawEdges.forEach(e => {
    const s = e.source, t = e.target;
    if (!discoveredSet.has(s) || !discoveredSet.has(t)) return;
    (adj[s] = adj[s] || []).push(t);
    (adj[t] = adj[t] || []).push(s);
  });

  // BFS distances
  const dist = { [startId]: 0 };
  const q = [startId];
  while (q.length) {
    const cur = q.shift();
    (adj[cur] || []).forEach(nb => {
      if (dist[nb] === undefined) { dist[nb] = dist[cur] + 1; q.push(nb); }
    });
  }

  // Place by ring
  const byDist = {};
  nodes.forEach(n => {
    if (!discoveredSet.has(n.id)) return;
    const d = dist[n.id] ?? 99;
    (byDist[d] = byDist[d] || []).push(n.id);
  });

  const spacing = Math.min(W, H) * 0.13;
  if (byId[startId]) { byId[startId].x = cx; byId[startId].y = cy; }

  Object.entries(byDist).forEach(([dStr, ids]) => {
    const d = parseInt(dStr);
    if (d === 0) return;
    const r = d * spacing;
    ids.forEach((id, i) => {
      const angle = (2 * Math.PI * i / ids.length) - Math.PI / 2;
      const n = byId[id];
      if (n) {
        n.x = cx + r * Math.cos(angle) + (Math.random() - 0.5) * 16;
        n.y = cy + r * Math.sin(angle) + (Math.random() - 0.5) * 16;
      }
    });
  });
}

// ── init ─────────────────────────────────────────────────────────────────────
export function init(data, width, height, initialDiscovered) {
  graphData = data;
  config = data.config;
  _width = width;
  _height = height;
  _discoveredSet = new Set(initialDiscovered);

  nodeMap = {};
  data.nodes.forEach(n => { nodeMap[n.id] = n; });

  // SVG
  svg = d3.select('#graph-svg').attr('width', width).attr('height', height);
  const defs = svg.append('defs');
  defs.append('filter').attr('id', 'glow').html(`
    <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
    <feMerge>
      <feMergeNode in="coloredBlur"/>
      <feMergeNode in="SourceGraphic"/>
    </feMerge>
  `);

  zoomG = svg.append('g').attr('class', 'zoom-group');

  zoomBehavior = d3.zoom()
    .scaleExtent([MIN_SCALE, MAX_SCALE])
    .on('zoom', e => {
      zoomG.attr('transform', e.transform);
    });

  svg.call(zoomBehavior);
  svg.on('wheel.limit', e => {
    if (d3.zoomTransform(svg.node()).k <= MIN_SCALE + 0.03 && e.deltaY > 0) _flashZoomToast();
  }, { passive: true });

  // Build node/link arrays (D3 will mutate these)
  const nodes = data.nodes.map(n => ({ ...n }));
  const links = data.edges.map(e => ({ ...e }));

  const cx = width / 2, cy = height / 2;

  // Pin undiscovered nodes at center — zero forces, invisible, topology-neutral
  nodes.forEach(n => {
    if (!_discoveredSet.has(n.id)) {
      n.fx = cx; n.fy = cy;
      n.x = cx; n.y = cy;
    }
  });

  // BFS radial seed positions for discovered nodes (reduces edge crossings)
  _bfsRadialLayout(nodes, data.edges, config.startNode, width, height, _discoveredSet);

  simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links)
      .id(d => d.id)
      .distance(e => {
        const s = nodeMap[e.source?.id ?? e.source];
        const t = nodeMap[e.target?.id ?? e.target];
        // Sparse-sparse links: fixed short distance so the mesh stays compact
        if (s?.type === 'sparse' && t?.type === 'sparse') return config.sparseLinkDistance ?? 10;
        const avgMass = ((s?.mass ?? 1) + (t?.mass ?? 1)) / 2;
        return config.linkDistance * (e.weight ?? 1) * avgMass;
      })
      .strength(l => {
        // Only pull between discovered pairs
        const s = l.source?.id ?? l.source;
        const t = l.target?.id ?? l.target;
        return (_discoveredSet.has(s) && _discoveredSet.has(t)) ? 0.6 : 0;
      })
    )
    .force('charge', d3.forceManyBody()
      .strength(d => {
        if (!_discoveredSet.has(d.id)) return 0;
        // Sparse nodes: minimal mutual repulsion so the mesh can compact.
        // Their peripheral position is maintained by long arm link distances, not charge.
        if (d.type === 'sparse') return -8;
        return -config.chargeStrength * (d.mass ?? 1);
      })
    )
    .force('center', d3.forceCenter(cx, cy).strength(config.centerStrength ?? 0.08))
    .force('collision', d3.forceCollide()
      .radius(d => _discoveredSet.has(d.id) ? (d.r ?? 8) + 5 : 0)
    )
    .force('bounds', _makeBoundsForce(nodes))
    .alphaTarget(config.alphaTarget)
    .velocityDecay(config.velocityDecay);

  // Pre-run silently for stable initial layout
  simulation.stop();
  for (let i = 0; i < 300; i++) simulation.tick();
  simulation.restart();

  // Store D3-mutated arrays for cross-module access
  graphData._nodes = nodes;
  graphData._links = links;
  graphData._nodeById = {};
  nodes.forEach(n => { graphData._nodeById[n.id] = n; });
  graphData._rawEdges = data.edges; // original string-keyed edges for revealNodes

  _render(nodes, links);

  simulation.on('tick', () => {
    _tick();
    if (onTickCb) onTickCb();
  });
}

// ── revealNodes ───────────────────────────────────────────────────────────────
// Called when new nodes become discovered. Unpins them, places near source, re-enables forces.
export function revealNodes(newIds, nearId, currentDiscovered) {
  _discoveredSet = currentDiscovered;
  const nearNode = graphData._nodeById[nearId];

  newIds.forEach(id => {
    const n = graphData._nodeById[id];
    if (!n) return;
    const angle = Math.random() * Math.PI * 2;
    const dist = 45 + Math.random() * 55;
    n.x = (nearNode?.x ?? _width / 2) + Math.cos(angle) * dist;
    n.y = (nearNode?.y ?? _height / 2) + Math.sin(angle) * dist;
    n.vx = 0; n.vy = 0;
    delete n.fx; delete n.fy;
  });

  // Brief alpha boost to let new nodes settle
  simulation.alpha(Math.max(simulation.alpha(), 0.22)).restart();
}

// ── rendering ────────────────────────────────────────────────────────────────
function _render(nodes, links) {
  zoomG.selectAll('.edge')
    .data(links, d => `${d.source?.id ?? d.source}↔${d.target?.id ?? d.target}`)
    .join('line')
    .attr('class', 'edge')
    .attr('data-source', d => d.source?.id ?? d.source)
    .attr('data-target', d => d.target?.id ?? d.target)
    .on('click', (event, d) => {
      if (onEdgeClickCb) onEdgeClickCb(d.source?.id ?? d.source, d.target?.id ?? d.target, event);
    });

  const nodeGroups = zoomG.selectAll('.node-group')
    .data(nodes, d => d.id)
    .join(enter => {
      const g = enter.append('g')
        .attr('class', d => `node-group node-group-${d.id}`)
        .attr('data-id', d => d.id);

      g.append('circle').attr('class', 'node-circle')
        .attr('r', d => d.r ?? 8)
        .attr('fill', d => `var(--${d.colorClass})`);

      // Target indicator ring (hidden until .target class applied)
      g.append('circle').attr('class', 'target-ring')
        .attr('r', d => (d.r ?? 8) + 5);

      g.append('text').attr('class', 'node-label')
        .attr('dy', d => -(d.r ?? 8) - 6)
        .text(d => d.label ?? '');

      g.on('click', (event, d) => {
        if (onEdgeClickCb) onEdgeClickCb(null, d.id, event);
      });

      return g;
    });
}

function _tick() {
  zoomG.selectAll('.edge')
    .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
    .attr('x2', d => d.target.x).attr('y2', d => d.target.y);

  zoomG.selectAll('.node-group')
    .attr('transform', d => `translate(${d.x},${d.y})`);
}

// ── visibility ───────────────────────────────────────────────────────────────
export function applyVisibility(visitedSet, discoveredSet) {
  zoomG.selectAll('.node-group').each(function(d) {
    const g = d3.select(this);
    const circle = g.select('.node-circle');
    const label = g.select('.node-label');
    const isVisited = visitedSet.has(d.id);
    const isDiscovered = discoveredSet.has(d.id);
    const isSparse = d.type === 'sparse';

    if (!isDiscovered) {
      g.style('opacity', 0).style('pointer-events', 'none');
      circle.style('fill', null).style('stroke', null);
      label.classed('visible', false);
      return;
    }

    g.style('opacity', 1).style('pointer-events', null);

    if (isVisited) {
      // Visited: full appearance
      circle.style('fill', `var(--${d.colorClass})`).style('stroke', 'none')
            .style('fill-opacity', isSparse ? 0.55 : 1);
      label.classed('visible', !!(d.label));
    } else if (isSparse) {
      // Discovered unvisited sparse: outline ring — sharper than generic silhouette
      circle.style('fill', 'none')
            .style('stroke', `var(--${d.colorClass})`)
            .style('stroke-width', '1.4px')
            .style('fill-opacity', null);
      label.classed('visible', false);
    } else {
      // Discovered unvisited: silhouette regardless of type
      circle.style('fill', `var(--${d.colorClass})`).style('stroke', 'none')
            .style('fill-opacity', 0.22);
      label.classed('visible', false);
    }
  });

  // Edges: only render when at least one endpoint has been visited.
  // This prevents discovered-but-unvisited nodes from leaking their connections.
  zoomG.selectAll('.edge').each(function(d) {
    const s = d.source?.id ?? d.source;
    const t = d.target?.id ?? d.target;
    const show = visitedSet.has(s) || visitedSet.has(t);
    d3.select(this).style('opacity', show ? 1 : 0)
                   .style('pointer-events', show ? null : 'none');
  });
}

export function markReachable(reachableIds, currentId) {
  const set = new Set(reachableIds);
  zoomG.selectAll('.node-group').classed('reachable', d => set.has(d.id));
  zoomG.selectAll('.edge').classed('reachable', function(d) {
    const s = d.source?.id ?? d.source;
    const t = d.target?.id ?? d.target;
    return (s === currentId && set.has(t)) || (t === currentId && set.has(s));
  });
}

export function markCurrent(id) {
  zoomG.selectAll('.node-group').classed('current', d => d.id === id);
}

export function markTarget(id) {
  zoomG.selectAll('.node-group').classed('target', d => d.id === id);
}

export function clearTarget() {
  zoomG.selectAll('.node-group').classed('target', false);
}

// ── exports ───────────────────────────────────────────────────────────────────
export function getNodePos(id) {
  const n = graphData?._nodeById?.[id];
  return n ? { x: n.x, y: n.y } : null;
}

export function graphToScreen(x, y) {
  const t = d3.zoomTransform(svg.node());
  return { x: t.applyX(x), y: t.applyY(y) };
}

export function panTo(x, y, duration = 600) {
  const el = svg.node();
  const w = el.clientWidth, h = el.clientHeight;
  const k = d3.zoomTransform(el).k;
  svg.transition().duration(duration).ease(d3.easeCubicInOut)
    .call(zoomBehavior.transform,
      d3.zoomIdentity.translate(w / 2 - k * x, h / 2 - k * y).scale(k));
}

export function boostRepulsionAround(id, duration = 1200) {
  const node = graphData._nodeById[id];
  if (!node) return;
  const _chargeFor = d => {
    if (!_discoveredSet.has(d.id)) return 0;
    if (d.type === 'sparse') return -8;
    return -config.chargeStrength * (d.mass ?? 1);
  };
  simulation.force('charge')
    .strength(d => d.id === id ? -config.chargeStrength * (d.mass ?? 1) * 3 : _chargeFor(d));
  simulation.alphaTarget(0.3).restart();
  setTimeout(() => {
    simulation.force('charge').strength(_chargeFor);
    simulation.alphaTarget(config.alphaTarget);
  }, duration);
}

export function getZoom() { return zoomBehavior; }
export function getSvg() { return svg; }
export function getZoomG() { return zoomG; }
export function getSimulation() { return simulation; }
export function getNodeData(id) { return graphData?._nodeById?.[id]; }
export function getLinks() { return graphData._links; }
export function getNodes() { return graphData._nodes; }
export function onEdgeClick(cb) { onEdgeClickCb = cb; }
export function onTick(cb) { onTickCb = cb; }
