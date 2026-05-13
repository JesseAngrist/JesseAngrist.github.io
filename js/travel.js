// travel.js — edge traversal animation + camera follow

import * as graph from './graph.js';
import * as discovery from './discovery.js';

let config;
let currentNodeId = null;
let traveling = false;
let onArriveCb = null;

const overlay = document.getElementById('travel-overlay');

export function init(cfg, startId) {
  config = cfg;
  currentNodeId = startId;
}

export function getCurrentNode() { return currentNodeId; }
export function isTraveling() { return traveling; }
export function onArrive(cb) { onArriveCb = cb; }

export function canTravel(targetId) {
  if (traveling) return false;
  if (targetId === currentNodeId) return false;
  const reachable = discovery.getReachableFrom(currentNodeId);
  return reachable.includes(targetId);
}

// Single-leg wrapper (kept for simple cases)
export async function travel(sourceId, targetId) {
  if (!canTravel(targetId)) return;
  await travelAlongPath([sourceId, targetId]);
}

// Multi-leg traversal — path must start from currentNode
export async function travelAlongPath(path) {
  if (traveling || path.length < 2) return;
  traveling = true;
  overlay.classList.add('active');

  // Mark final destination for the duration of the trip
  graph.markTarget(path[path.length - 1]);

  for (let i = 0; i < path.length - 1; i++) {
    const src = path[i];
    const tgt = path[i + 1];
    await _animateLeg(src, tgt);
    currentNodeId = tgt;

    // Reveal neighbors at each intermediate stop so subsequent legs can proceed.
    // For the final node, onArriveCb fires after the loop (main.js handles content).
    const isFinal = i === path.length - 2;
    if (!isFinal) {
      discovery.arrive(tgt);
      graph.markCurrent(tgt);
    }
  }

  traveling = false;
  overlay.classList.remove('active');
  graph.clearTarget();
  if (onArriveCb) onArriveCb(currentNodeId);
}

async function _animateLeg(sourceId, targetId) {
  const srcNode = graph.getNodeData(sourceId);
  const tgtNode = graph.getNodeData(targetId);
  if (!srcNode || !tgtNode) return;

  const zoomG = graph.getZoomG();
  const svgEl = graph.getSvg().node();

  // Compute initial distance for duration (nodes may drift a little, but this is close enough)
  const dx0 = tgtNode.x - srcNode.x;
  const dy0 = tgtNode.y - srcNode.y;
  const dist0 = Math.sqrt(dx0 * dx0 + dy0 * dy0);
  const duration = Math.max(700, (dist0 / config.travelSpeed) * 1000);

  // Raise active edge so it draws on top
  zoomG.selectAll('.edge').filter(d => {
    const s = d.source.id ?? d.source;
    const t = d.target.id ?? d.target;
    return (s === sourceId && t === targetId) || (s === targetId && t === sourceId);
  }).raise();

  // Trail line — updates both endpoints every frame to track drifting nodes
  const trailLine = zoomG.append('line')
    .attr('class', 'edge-trail')
    .attr('x1', srcNode.x).attr('y1', srcNode.y)
    .attr('x2', srcNode.x).attr('y2', srcNode.y);

  const traveler = zoomG.append('circle')
    .attr('class', 'traveler')
    .attr('cx', srcNode.x)
    .attr('cy', srcNode.y);

  const startTime = performance.now();

  await new Promise(resolve => {
    function frame() {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      const ease = d3.easeCubicInOut(t);

      // Read CURRENT node positions each frame — nodes drift with the simulation,
      // so this keeps the traveler on the actual edge rather than shooting off toward
      // where the node was when the animation started.
      const sx = srcNode.x, sy = srcNode.y;
      const tx = tgtNode.x, ty = tgtNode.y;

      const cx = sx + (tx - sx) * ease;
      const cy = sy + (ty - sy) * ease;

      traveler.attr('cx', cx).attr('cy', cy);
      trailLine
        .attr('x1', sx).attr('y1', sy)
        .attr('x2', cx).attr('y2', cy);

      // Camera follows traveler with a slight lag
      const camEase = d3.easeCubicInOut(Math.min(elapsed / (duration * 1.12), 1));
      _panToInstant(svgEl, sx + (tx - sx) * camEase, sy + (ty - sy) * camEase);

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        resolve();
      }
    }
    requestAnimationFrame(frame);
  });

  traveler.remove();
  trailLine.remove();
  graph.panTo(tgtNode.x, tgtNode.y, 280);
}

function _panToInstant(svgEl, x, y) {
  const w = svgEl.clientWidth;
  const h = svgEl.clientHeight;
  const k = d3.zoomTransform(svgEl).k;
  graph.getSvg().call(
    graph.getZoom().transform,
    d3.zoomIdentity.translate(w / 2 - k * x, h / 2 - k * y).scale(k)
  );
}
