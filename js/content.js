// content.js — node expansion, content loading + caching

import * as graph from './graph.js';

const cardLayer = document.getElementById('card-layer');
const cache = {};
let currentCardId = null;

export function init() {}

export async function open(nodeId) {
  if (nodeId === currentCardId) return;
  close();

  const nodeData = graph.getNodeData(nodeId);
  if (!nodeData) return;

  const html = await _loadContent(nodeData);

  const card = document.createElement('div');
  card.className = 'node-card';
  card.dataset.nodeId = nodeId;

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'card-close';
  closeBtn.textContent = '×';
  closeBtn.title = 'close';
  closeBtn.addEventListener('click', e => { e.stopPropagation(); close(); });
  card.appendChild(closeBtn);

  // Content
  const body = document.createElement('div');
  body.innerHTML = html;
  card.appendChild(body);

  cardLayer.appendChild(card);
  currentCardId = nodeId;

  // Position at node coords
  _positionCard(card, nodeId);

  // Trigger open animation
  requestAnimationFrame(() => card.classList.add('open'));
}

export function close() {
  if (!currentCardId) return;
  const card = cardLayer.querySelector('.node-card.open');
  if (card) {
    card.classList.remove('open');
    card.addEventListener('transitionend', () => card.remove(), { once: true });
  }
  currentCardId = null;
}

export function updateCardPosition() {
  if (!currentCardId) return;
  const card = cardLayer.querySelector('.node-card');
  if (card) _positionCard(card, currentCardId);
}

function _positionCard(card, nodeId) {
  const pos = graph.getNodePos(nodeId);
  if (!pos) return;
  const screen = graph.graphToScreen(pos.x, pos.y);
  card.style.left = `${screen.x}px`;
  card.style.top = `${screen.y}px`;
}

// `content` is one polymorphic field:
//   - path-looking ("…​.html" or "content/…") → fetch the file
//   - any other non-empty string → render inline (HTML or plain text)
//   - null/empty → fall back to `hint`, then an em dash
function _isContentPath(s) {
  if (typeof s !== 'string') return false;
  const v = s.trim();
  return /\.html?$/i.test(v) || v.startsWith('content/');
}

async function _loadContent(nodeData) {
  const c = nodeData.content;

  if (_isContentPath(c)) {
    if (cache[nodeData.id]) return cache[nodeData.id];
    try {
      const res = await fetch(c.trim());
      if (!res.ok) throw new Error(res.status);
      const html = await res.text();
      cache[nodeData.id] = html;
      return html;
    } catch (_) {
      return `<h2>${nodeData.label ?? ''}</h2><p><em>(content not found)</em></p>`;
    }
  }

  if (typeof c === 'string' && c.trim()) {
    // Inline: pass HTML through; wrap bare text in a paragraph.
    return /<[a-z][\s\S]*>/i.test(c) ? c : `<p>${c}</p>`;
  }

  return nodeData.hint ? `<p>${nodeData.hint}</p>` : '<p>—</p>';
}
