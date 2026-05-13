// main.js — initialization and orchestration

import * as graph from './graph.js';
import * as discovery from './discovery.js';
import * as travel from './travel.js';
import * as content from './content.js';

const compass = document.getElementById('compass');
const compassArrow = document.getElementById('compass-arrow');

async function main() {
  const data = await fetch('graph.json').then(r => r.json());
  const startId = data.config.startNode;
  const W = window.innerWidth;
  const H = window.innerHeight;

  // Init discovery first so we know the initial discovered set for graph.init
  discovery.init(data, startId);

  graph.init(data, W, H, discovery.getDiscovered());
  travel.init(data.config, startId);
  content.init();

  // Initial render pass
  _applyState();

  // Center camera on start node
  const startPos = graph.getNodePos(startId);
  if (startPos) graph.panTo(startPos.x, startPos.y, 0);

  // Open start node card
  await content.open(startId);

  // Tick: reposition open card + update compass
  graph.onTick(() => {
    content.updateCardPosition();
    _updateCompass();
  });

  // Discovery change: reveal newly found nodes to simulation, re-render state
  discovery.onChange((visited, discovered, newlyDiscovered, fromNodeId) => {
    if (newlyDiscovered.length > 0) {
      graph.revealNodes(newlyDiscovered, fromNodeId, discovered);
    }
    _applyState();
  });

  // Edge/node clicks → pathfind and travel
  graph.onEdgeClick((srcId, tgtId, event) => {
    if (travel.isTraveling()) return;
    const current = travel.getCurrentNode();

    let destination = tgtId;
    if (tgtId === current && srcId !== null) destination = srcId;
    if (destination === current) return;

    const path = discovery.findPath(current, destination);
    if (!path || path.length < 2) return;

    content.close();
    travel.travelAlongPath(path);
  });

  // Arrival → discovery update + open content
  travel.onArrive(nodeId => {
    discovery.arrive(nodeId);
    content.open(nodeId);
    graph.markCurrent(nodeId);
    _applyState();
  });

  graph.markCurrent(startId);

  // Compass: click navigates home
  compass.addEventListener('click', () => {
    if (travel.isTraveling()) return;
    const current = travel.getCurrentNode();
    if (current === startId) return;
    const path = discovery.findPath(current, startId);
    if (path && path.length >= 2) {
      content.close();
      travel.travelAlongPath(path);
    }
  });

  window.addEventListener('resize', () => {
    graph.getSvg().attr('width', window.innerWidth).attr('height', window.innerHeight);
    graph.getSimulation()
      .force('center', d3.forceCenter(window.innerWidth / 2, window.innerHeight / 2)
        .strength(data.config.centerStrength ?? 0.08));
  });
}

function _applyState() {
  const visited = discovery.getVisited();
  const discovered = discovery.getDiscovered();
  const currentId = travel.getCurrentNode();
  const reachable = currentId ? discovery.getReachableFrom(currentId) : [];

  graph.applyVisibility(visited, discovered);
  graph.markReachable(reachable, currentId);
}

function _updateCompass() {
  const homeId = 'about';
  const pos = graph.getNodePos(homeId);
  if (!pos) return;

  const screen = graph.graphToScreen(pos.x, pos.y);
  const W = window.innerWidth, H = window.innerHeight;
  const pad = 60; // pixels from edge before it's "off screen"

  const inView = screen.x >= -pad && screen.x <= W + pad &&
                 screen.y >= -pad && screen.y <= H + pad;

  compass.classList.toggle('visible', !inView);
  if (inView) return;

  // Find where to place the compass indicator on the screen edge
  const cx = W / 2, cy = H / 2;
  const dx = screen.x - cx, dy = screen.y - cy;
  const angle = Math.atan2(dy, dx);
  const edgePad = 56;
  const halfW = cx - edgePad, halfH = cy - edgePad;

  let ex, ey;
  if (halfW > 0 && halfH > 0 && Math.abs(dx / halfW) > Math.abs(dy / halfH)) {
    ex = Math.sign(dx) * halfW;
    ey = dy * (halfW / Math.abs(dx));
  } else {
    ey = Math.sign(dy) * halfH;
    ex = dx * (halfH / Math.abs(dy));
  }

  compass.style.left = `${cx + ex}px`;
  compass.style.top = `${cy + ey}px`;
  // Arrow points toward home — SVG arrow points right (0°), so offset by 0
  compassArrow.style.transform = `rotate(${angle}rad)`;
}

main().catch(console.error);
