// main.js — initialization and orchestration

import * as graph from './graph.js';
import * as discovery from './discovery.js';
import * as travel from './travel.js';
import * as content from './content.js';

const compass = document.getElementById('compass');
const compassArrow = document.getElementById('compass-arrow');

async function main() {
  const data = await fetch('graph.json').then(r => r.json());

  // Deep link: `#<node-id>` in the URL starts you AT that node rather than
  // walking you there — the point of a shareable link is arrival, not a tour.
  // `now/index.html` redirects into this, which is the whole /now mechanism.
  // An unknown fragment falls back to the authored startNode, silently.
  const hashId = decodeURIComponent(location.hash.slice(1));
  const startId = data.nodes.some(n => n.id === hashId)
    ? hashId
    : data.config.startNode;
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

  // How many brand-new nodes the most recent discovery revealed.
  let lastNewCount = 0;

  // Discovery change: reveal newly found nodes to simulation, re-render state
  discovery.onChange((visited, discovered, newlyDiscovered, fromNodeId) => {
    lastNewCount = newlyDiscovered.length;
    if (newlyDiscovered.length > 0) {
      graph.revealNodes(newlyDiscovered, fromNodeId, discovered);
    }
    _applyState();
  });

  // A card-open can be scheduled to fire after the bloom finishes. If the
  // user sets off again first, cancel it.
  let cardOpenTimer = null;
  function cancelPendingCard() {
    if (cardOpenTimer) { clearTimeout(cardOpenTimer); cardOpenTimer = null; }
  }

  // A trip can be scheduled to start after a reveal-bloom finishes; a new
  // navigation supersedes it.
  let tripTimer = null;
  function cancelPendingTrip() {
    if (tripTimer) { clearTimeout(tripTimer); tripTimer = null; }
  }

  // The one way anything travels: clicks, the compass, and in-card links all
  // come through here. Prefers a route through the fog; if there isn't one yet
  // (only in-card links can ask for that), reveals the real shortest route,
  // lets it bloom in, then walks it.
  function navigateTo(destination) {
    if (travel.isTraveling() || !destination) return;
    const current = travel.getCurrentNode();
    if (destination === current) return;
    if (!graph.getNodeData(destination)) return;   // unknown id → no-op

    const known = discovery.findPath(current, destination);
    if (known && known.length >= 2) {
      content.close();
      cancelPendingCard();
      cancelPendingTrip();
      travel.travelAlongPath(known);
      return;
    }

    const route = discovery.findPathAny(current, destination);
    if (!route || route.length < 2) return;        // disconnected → no-op

    content.close();
    cancelPendingCard();
    cancelPendingTrip();
    discovery.revealPath(route);
    const wait = Math.max(0, graph.getBloomEndsAt() - performance.now()) + 250;
    tripTimer = setTimeout(() => {
      tripTimer = null;
      travel.travelAlongPath(route);
    }, wait);
  }

  // Edge/node clicks → pathfind and travel
  graph.onEdgeClick((srcId, tgtId, event) => {
    if (travel.isTraveling()) return;
    const current = travel.getCurrentNode();

    let destination = tgtId;
    if (tgtId === current && srcId !== null) destination = srcId;
    navigateTo(destination);
  });

  // In-card links (`[check out what i'm reading](#books)`) → travel there
  content.onNodeLink(navigateTo);

  // Arrival → reveal neighbors (staggered bloom), then open the card 0.5s
  // after the final node has bloomed so it doesn't block the effect.
  travel.onArrive(nodeId => {
    cancelPendingCard();
    discovery.arrive(nodeId);          // schedules the bloom
    graph.markCurrent(nodeId);
    _applyState();

    // Defer the card whenever this arrival reveals any brand-new node(s),
    // until 0.7s after the last one blooms. No new nodes → open immediately.
    const now = performance.now();
    const endsAt = graph.getBloomEndsAt();
    const delay = (lastNewCount >= 1 && endsAt > now) ? (endsAt - now) + 700 : 0;
    cardOpenTimer = setTimeout(() => {
      cardOpenTimer = null;
      content.open(nodeId);
    }, delay);
  });

  graph.markCurrent(startId);

  // Compass: click navigates home
  compass.addEventListener('click', () => navigateTo(startId));

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
  const reachable = currentId ? discovery.getAllReachableFrom(currentId) : [];

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
