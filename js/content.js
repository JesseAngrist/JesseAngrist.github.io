// content.js — node expansion, content loading + caching

import * as graph from './graph.js';
import { marked } from 'https://cdn.jsdelivr.net/npm/marked@13/+esm';

const cardLayer = document.getElementById('card-layer');
const cache = {};
let currentCardId = null;
let onNodeLinkCb = null;

export function init() {}

// Fires when a link inside a card body points at a node (`[text](#node-id)`).
export function onNodeLink(cb) { onNodeLinkCb = cb; }

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

  // Content. The body — not the card — is the scroll container, so the card's
  // own chrome (close button, bottom fade) stays put while the prose moves.
  const body = document.createElement('div');
  body.className = 'card-body';
  body.innerHTML = html;
  _wireNodeLinks(body);
  card.appendChild(body);

  cardLayer.appendChild(card);
  currentCardId = nodeId;

  _wireOverflow(card, body);

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

// An in-card link whose href is a bare fragment (`[reading](#books)`) is a
// *node* link: clicking it sends the traveler there instead of jumping the URL.
// Anything else (http, mailto, …) is left completely alone.
function _wireNodeLinks(body) {
  body.querySelectorAll('a[href^="#"]').forEach(a => {
    const id = decodeURIComponent(a.getAttribute('href').slice(1));
    if (!id) return;
    a.classList.add('node-link');
    a.dataset.nodeId = id;
    a.title = `travel to ${id}`;
  });

  body.addEventListener('click', e => {
    const a = e.target.closest('a.node-link');
    if (!a) return;
    e.preventDefault();
    if (onNodeLinkCb) onNodeLinkCb(a.dataset.nodeId);
  });
}

// A long body scrolls inside the card. `.overflowing` turns on the bottom fade
// that signals there's more below; it clears once you've reached the end, so a
// fully-read card looks finished rather than perpetually cut off.
function _wireOverflow(card, body) {
  const sync = () => {
    const scrollable = body.scrollHeight - body.clientHeight;
    const atBottom = body.scrollTop >= scrollable - 2;
    card.classList.toggle('overflowing', scrollable > 4 && !atBottom);
  };
  body.addEventListener('scroll', sync, { passive: true });
  // Fonts and images can land after the first measure, so re-check on settle.
  requestAnimationFrame(sync);
  setTimeout(sync, 400);
}

// `content` is one polymorphic field, always Markdown (raw HTML passes
// through unchanged, per CommonMark, for the rare case that needs it):
//   - path-looking ("…​.md"/".html" or "content/…") → fetch the file
//   - any other non-empty string → render inline
//   - null/empty → fall back to `hint`, then an em dash
function _isContentPath(s) {
  if (typeof s !== 'string') return false;
  const v = s.trim();
  return /\.(html?|md)$/i.test(v) || v.startsWith('content/');
}

async function _loadContent(nodeData) {
  const c = nodeData.content;

  if (_isContentPath(c)) {
    if (cache[nodeData.id]) return cache[nodeData.id];
    try {
      const res = await fetch(c.trim());
      if (!res.ok) throw new Error(res.status);
      const md = await res.text();
      const html = marked.parse(md);
      // An empty (or whitespace-only) file is a stub, not content — fall back
      // to the hint rather than opening a blank card, which looks like a bug.
      if (!html.trim()) return _fallback(nodeData);
      cache[nodeData.id] = html;
      return html;
    } catch (_) {
      return `<h2>${nodeData.label ?? ''}</h2><p><em>(content not found)</em></p>`;
    }
  }

  if (typeof c === 'string' && c.trim()) {
    return marked.parse(c);
  }

  return _fallback(nodeData);
}

function _fallback(nodeData) {
  return nodeData.hint ? marked.parse(nodeData.hint) : '<p>—</p>';
}
