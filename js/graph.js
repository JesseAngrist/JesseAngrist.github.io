// graph.js — D3 force simulation, SVG rendering, zoom

const MIN_SCALE = 1.5;
const MAX_SCALE = 2.0;
const DEFAULT_SCALE = 2.0;
const LABEL_GAP = 8; // constant px between a node's top edge and its title

let simulation, svg, zoomG, zoomBehavior;
let edgeLayer, nodeLayer; // explicit paint order: edges/travel under nodes
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

// ── anchor force ─────────────────────────────────────────────────────────────
// Weak spring pulling each node toward its authored position (n._ax/_ay).
// This keeps the graph recognisable as the authored layout while still floppy.
// Pinned (undiscovered) nodes are skipped.
function _makeAnchorForce(nodesRef) {
  return function anchorForce(alpha) {
    const k = (config.anchorStrength ?? 0.05) * alpha;
    nodesRef.forEach(n => {
      if (n.fx !== undefined) return;
      if (n._ax === undefined) return;
      n.vx += (n._ax - n.x) * k;
      n.vy += (n._ay - n.y) * k;
    });
  };
}

// ── class colour resolution ──────────────────────────────────────────────────
// Classes form a hierarchy rooted at `all`. A node's colour is the first
// `color` found walking up the parent chain from its class.
function _resolveColor(className) {
  const classes = config?.classes || {};
  let name = className, guard = 0;
  while (name && guard++ < 64) {
    const c = classes[name];
    if (!c) break;
    if (c.color) return c.color;
    name = c.parent;
  }
  return '#999';
}

function _classColor(d) {
  return _resolveColor(d.class);
}

// True if the node's class is `core` or descends from it (hierarchy-aware).
function _isCoreClass(className) {
  const classes = config?.classes || {};
  let n = className, guard = 0;
  while (n && guard++ < 64) {
    if (n === 'core') return true;
    n = classes[n]?.parent;
  }
  return false;
}

// Emit `--node-<class>: <resolvedColor>;` so CSS (e.g. .node-card a) keeps
// working even though classes are user-defined at runtime. Appended after
// the stylesheet link so it wins source order over the static fallbacks.
function _injectClassColors() {
  const classes = config?.classes || {};
  const lines = Object.keys(classes)
    .map(name => `  --node-${name}: ${_resolveColor(name)};`);
  let style = document.getElementById('class-colors');
  if (!style) {
    style = document.createElement('style');
    style.id = 'class-colors';
    document.head.appendChild(style);
  }
  style.textContent = `:root {\n${lines.join('\n')}\n}`;
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

  _injectClassColors();

  // SVG
  svg = d3.select('#graph-svg').attr('width', width).attr('height', height);

  zoomG = svg.append('g').attr('class', 'zoom-group');

  // Two paint layers so edges (and the travel trail/traveler, which append
  // into the edge layer) are ALWAYS beneath nodes — nodes stay whole and the
  // traveler passes behind them.
  edgeLayer = zoomG.append('g').attr('class', 'edge-layer');
  nodeLayer = zoomG.append('g').attr('class', 'node-layer');

  zoomBehavior = d3.zoom()
    .scaleExtent([MIN_SCALE, MAX_SCALE])
    .on('zoom', e => {
      zoomG.attr('transform', e.transform);
    });

  svg.call(zoomBehavior);
  svg.call(zoomBehavior.transform, d3.zoomIdentity.scale(DEFAULT_SCALE));
  svg.on('wheel.limit', e => {
    if (d3.zoomTransform(svg.node()).k <= MIN_SCALE + 0.03 && e.deltaY > 0) _flashZoomToast();
  }, { passive: true });

  // Build node/link arrays (D3 will mutate these)
  const nodes = data.nodes.map(n => ({ ...n }));
  const links = data.edges.map(e => ({ ...e }));

  const cx = width / 2, cy = height / 2;

  // Authored coordinates are studio-space, centered on the ORIGIN (0,0).
  // The simulation's frame is centered on the viewport (cx,cy) — forceCenter,
  // the bounds wall, and the undiscovered-pin all reference (cx,cy). So map
  // authored (0,0) → (cx,cy): every authored position is offset by (cx,cy).
  // This keeps the authored layout and the simulation frame aligned, so the
  // start node (authored at origin) initializes at the viewport center.
  nodes.forEach(n => {
    n._ax = cx + (n.x ?? 0);
    n._ay = cy + (n.y ?? 0);
  });

  // Pin undiscovered nodes at center — zero forces, invisible, topology-neutral.
  // Discovered nodes are seeded at their (offset) authored position.
  nodes.forEach(n => {
    if (!_discoveredSet.has(n.id)) {
      n.fx = cx; n.fy = cy;
      n.x = cx; n.y = cy;
    } else {
      n.x = n._ax;
      n.y = n._ay;
    }
  });

  simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links)
      .id(d => d.id)
      .distance(e => {
        const s = nodeMap[e.source?.id ?? e.source];
        const t = nodeMap[e.target?.id ?? e.target];
        // Authored edge length (or derived from authored node positions).
        let len = e.length;
        if (len == null) {
          const sx = s?.x ?? 0, sy = s?.y ?? 0;
          const tx = t?.x ?? 0, ty = t?.y ?? 0;
          len = Math.hypot(tx - sx, ty - sy);
        }
        return len * (config.edgeLengthScale ?? 1);
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
        return -config.chargeStrength * (d.mass ?? 1);
      })
    )
    .force('center', d3.forceCenter(cx, cy).strength(config.centerStrength ?? 0.08))
    .force('collision', d3.forceCollide()
      .radius(d => _discoveredSet.has(d.id) ? (d.r ?? 8) + 5 : 0)
    )
    .force('bounds', _makeBoundsForce(nodes))
    .force('anchor', _makeAnchorForce(nodes))
    .alphaTarget(config.driftAlpha ?? config.alphaTarget)
    .velocityDecay(config.velocityDecay);

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

  // No silent pre-run: the authored layout is the seed. Give it one gentle
  // visible settle from that seed, then it drifts at driftAlpha forever.
  simulation.alpha(config.seedAlpha ?? 0.3).restart();

  setInterval(() => {
    if (!graphData?._nodes || !_discoveredSet.size) return;
    const pool = graphData._nodes.filter(n => _discoveredSet.has(n.id) && n.fx === undefined);
    if (!pool.length) return;
    const n = pool[Math.floor(Math.random() * pool.length)];
    n.vx += (Math.random() - 0.5) * 3.0;
    n.vy += (Math.random() - 0.5) * 3.0;
    simulation.alpha(Math.max(simulation.alpha(), 0.09));
  }, 3000);
}

// ── revealNodes — staggered bloom ────────────────────────────────────────────
// Newly-discovered nodes don't all pop at once. Each one is held (inert,
// hidden) at the discovering node, then "blooms" one at a time in quick
// succession: it joins the simulation and glides out to its authored slot.
// Unlocking many neighbors reads as an orderly unfurling, not an explosion.
const _BLOOM_STEP_MS = 300;     // gap between consecutive blooms
const _BLOOM_FIRST_MS = 120;    // delay before the first one
const _BLOOM_LAUNCH = 0.3;      // initial speed toward anchor (fraction of distance)
const _BLOOM_MAX_SPEED = 55;    // px/tick cap so far nodes don't rocket
const _BLOOM_OFFSET = 16;       // spawn this far off the parent (toward anchor)
let _pendingReveal = new Set(); // discovered-but-not-yet-bloomed (rendered hidden)
let _bloomTimer = null;
let _bloomEndsAt = 0;           // performance.now() when the last node blooms

export function revealNodes(newIds, nearId, currentDiscovered) {
  const nearNode = graphData._nodeById[nearId];
  const px = nearNode?.x ?? _width / 2;
  const py = nearNode?.y ?? _height / 2;

  // Already-discovered nodes stay active; everything not yet bloomed (prior
  // leftovers + the new ones) stays deferred until its turn.
  _discoveredSet = new Set(currentDiscovered);
  _pendingReveal.forEach(id => _discoveredSet.delete(id));

  newIds.forEach(id => {
    const n = graphData._nodeById[id];
    if (!n) return;
    _discoveredSet.delete(id);          // no forces until it blooms
    _pendingReveal.add(id);
    n.x = px; n.y = py; n.vx = 0; n.vy = 0;
    n.fx = px; n.fy = py;               // park it on the discovering node
  });

  // Bloom in angular order: sweep around the current node by the angle each
  // newbie's anchor makes with the current node's *current* position. Reads
  // as an unfurling fan rather than a random sequence.
  const queue = [..._pendingReveal].sort((a, b) => {
    const na = graphData._nodeById[a], nb = graphData._nodeById[b];
    const angA = Math.atan2((na?._ay ?? py) - py, (na?._ax ?? px) - px);
    const angB = Math.atan2((nb?._ay ?? py) - py, (nb?._ax ?? px) - px);
    return angA - angB;
  });
  const bloomOne = () => {
    const id = queue.shift();
    if (id == null) { _bloomTimer = null; return; }
    const n = graphData._nodeById[id];
    if (n && _pendingReveal.has(id)) {
      _pendingReveal.delete(id);
      _discoveredSet.add(id);
      // Emerge from the (pinned, stationary) parent, but offset slightly
      // ALONG the path to this node's anchor. Spawning exactly on the parent
      // makes the strong link force degenerate (coincident points → d3
      // jitters in a random direction); the offset gives it a correct,
      // well-defined direction from the first tick.
      const p = graphData._nodeById[nearId];
      const ox = p?.x ?? px, oy = p?.y ?? py;
      const dx = n._ax - ox, dy = n._ay - oy;
      const dist = Math.hypot(dx, dy) || 1;
      const ux = dx / dist, uy = dy / dist;
      n.x = ox + ux * _BLOOM_OFFSET;
      n.y = oy + uy * _BLOOM_OFFSET;
      delete n.fx; delete n.fy;
      // Strong, explicitly-directional launch toward the anchor.
      const speed = Math.min(dist * _BLOOM_LAUNCH, _BLOOM_MAX_SPEED);
      n.vx = ux * speed;
      n.vy = uy * speed;
      simulation.alpha(Math.max(simulation.alpha(), 0.2)).restart();
      _reapplyVisibility();
    }
    _bloomTimer = queue.length ? setTimeout(bloomOne, _BLOOM_STEP_MS) : null;
  };

  clearTimeout(_bloomTimer);
  const count = queue.length;
  _bloomEndsAt = count
    ? performance.now() + _BLOOM_FIRST_MS + (count - 1) * _BLOOM_STEP_MS
    : 0;
  _bloomTimer = count ? setTimeout(bloomOne, _BLOOM_FIRST_MS) : null;
}

// performance.now() timestamp at which the last queued node blooms (0 if
// nothing is blooming). Used to delay the content card until the bloom ends.
export function getBloomEndsAt() { return _bloomEndsAt; }

// ── rendering ────────────────────────────────────────────────────────────────
function _render(nodes, links) {
  edgeLayer.selectAll('line.edge')
    .data(links, d => `${d.source?.id ?? d.source}↔${d.target?.id ?? d.target}`)
    .join('line')
    .attr('class', 'edge')
    .attr('data-source', d => d.source?.id ?? d.source)
    .attr('data-target', d => d.target?.id ?? d.target)
    .on('click', (event, d) => {
      if (onEdgeClickCb) onEdgeClickCb(d.source?.id ?? d.source, d.target?.id ?? d.target, event);
    });

  const nodeGroups = nodeLayer.selectAll('.node-group')
    .data(nodes, d => d.id)
    .join(enter => {
      const g = enter.append('g')
        .attr('class', d => `node-group node-group-${d.id}`)
        .attr('data-id', d => d.id)
        // Put the node's resolved class colour on the group's `color` property
        // so `currentColor` works for anything inside it (the halo, and any
        // future stroke that should take the node's own hue). Without this,
        // `currentColor` in the node CSS resolved to the document default —
        // i.e. black — which is why the old current-node glow read as a grubby
        // dark smudge rather than a coloured halo.
        .style('color', d => _classColor(d));

      // Opaque backing so edges pass *under* the node — the node reads whole.
      g.append('circle').attr('class', 'node-bg')
        .attr('r', d => d.r ?? 8)
        .attr('fill', 'var(--bg)');

      g.append('circle').attr('class', 'node-circle')
        .attr('r', d => d.r ?? 8)
        .attr('fill', d => _classColor(d));

      // Presence halo — a concentric ring, invisible until this node is the
      // one you're standing in (.current). Also the old, never-wired
      // `.target-ring`; the pathfinding target is signalled by the circle
      // blink instead, so the element was inert.
      // `fill`/`stroke` are also set in CSS; they're repeated here as
      // attributes so that a cached style.css can never leave this circle at
      // the SVG default (black, opaque) and blot out the node beneath it.
      g.append('circle').attr('class', 'node-halo')
        .attr('r', d => (d.r ?? 8) + 5)
        .attr('fill', 'none')
        .attr('stroke', 'none');

      g.append('text').attr('class', 'node-label')
        .attr('dy', d => -(d.r ?? 8) - LABEL_GAP)
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
let _lastVisited = null, _lastDiscovered = null;

// Re-run the last visibility pass (used by the staggered bloom as each node
// becomes eligible to show).
function _reapplyVisibility() {
  if (_lastVisited && _lastDiscovered) applyVisibility(_lastVisited, _lastDiscovered);
}

export function applyVisibility(visitedSet, discoveredSet) {
  _lastVisited = visitedSet;
  _lastDiscovered = discoveredSet;
  zoomG.selectAll('.node-group').each(function(d) {
    const g = d3.select(this);
    const circle = g.select('.node-circle');
    const label = g.select('.node-label');
    const isVisited = visitedSet.has(d.id);
    // A discovered node that hasn't bloomed yet stays hidden until its turn.
    const isDiscovered = discoveredSet.has(d.id) && !_pendingReveal.has(d.id);
    const color = _classColor(d);

    if (!isDiscovered) {
      g.style('opacity', 0).style('pointer-events', 'none');
      circle.style('fill', null).style('stroke', null);
      label.classed('visible', false);
      return;
    }

    g.style('opacity', 1).style('pointer-events', null);

    if (isVisited) {
      // Visited: full appearance, real title.
      circle.style('fill', color).style('stroke', 'none')
            .style('fill-opacity', 1);
      label.text(d.label ?? '').classed('visible', !!d.label);
    } else {
      // Discovered, unvisited: dim silhouette. Core nodes still show their
      // real title (navigation anchors); everything else shows its hint, or
      // "...?" if it has none.
      circle.style('fill', color).style('stroke', 'none')
            .style('fill-opacity', 0.22);
      if (_isCoreClass(d.class)) {
        label.text(d.label ?? '').classed('visible', !!d.label);
      } else {
        const h = d.hint != null && String(d.hint).trim() ? String(d.hint) : '...?';
        label.text(h).classed('visible', true);
      }
    }
  });

  zoomG.selectAll('.node-group').classed('visited-node', d => visitedSet.has(d.id));

  // Edges: render only when at least one endpoint has been visited AND
  // neither endpoint is still waiting to bloom. The latter prevents a
  // "phantom edge" reaching to a hidden node parked at the arrival point.
  zoomG.selectAll('.edge').each(function(d) {
    const s = d.source?.id ?? d.source;
    const t = d.target?.id ?? d.target;
    const show = (visitedSet.has(s) || visitedSet.has(t)) &&
                 !_pendingReveal.has(s) && !_pendingReveal.has(t);
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
    return -config.chargeStrength * (d.mass ?? 1);
  };
  simulation.force('charge')
    .strength(d => d.id === id ? -config.chargeStrength * (d.mass ?? 1) * 3 : _chargeFor(d));
  simulation.alphaTarget(0.3).restart();
  setTimeout(() => {
    simulation.force('charge').strength(_chargeFor);
    simulation.alphaTarget(config.driftAlpha ?? config.alphaTarget);
  }, duration);
}

export function getZoom() { return zoomBehavior; }
export function getSvg() { return svg; }
export function getZoomG() { return zoomG; }
export function getTravelLayer() { return edgeLayer; }
export function getSimulation() { return simulation; }
export function getConfig() { return config; }
export function getNodeData(id) { return graphData?._nodeById?.[id]; }
export function getLinks() { return graphData._links; }
export function getNodes() { return graphData._nodes; }
export function onEdgeClick(cb) { onEdgeClickCb = cb; }
export function onTick(cb) { onTickCb = cb; }
