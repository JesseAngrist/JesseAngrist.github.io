import type { Graph } from './types';
import { isContentPath, resolveColor, FALLBACK_COLOR } from './classUtils';

export interface LintItem {
  level: 'error' | 'warn';
  msg: string;
  focus?: { kind: 'node' | 'class'; id: string };
}

export function lintGraph(graph: Graph, contentIds: string[]): LintItem[] {
  const out: LintItem[] = [];
  const { nodes, edges, config } = graph;
  const classes = config.classes || {};

  // ── node id integrity ──────────────────────────────────────────────────
  const seenIds = new Set<string>();
  for (const n of nodes) {
    if (seenIds.has(n.id)) out.push({ level: 'error', msg: `Duplicate node id "${n.id}"`, focus: { kind: 'node', id: n.id } });
    seenIds.add(n.id);
    if (!n.label || !n.label.trim())
      out.push({ level: 'warn', msg: `Node "${n.id}" has an empty label`, focus: { kind: 'node', id: n.id } });
    if (!classes[n.class])
      out.push({ level: 'error', msg: `Node "${n.id}" references missing class "${n.class}"`, focus: { kind: 'node', id: n.id } });
    else if (resolveColor(classes, n.class) === FALLBACK_COLOR)
      out.push({ level: 'warn', msg: `Node "${n.id}" class "${n.class}" has no resolvable color`, focus: { kind: 'node', id: n.id } });
  }

  // ── edges reference real nodes ─────────────────────────────────────────
  const idSet = new Set(nodes.map((n) => n.id));
  const degree: Record<string, number> = {};
  for (const e of edges) {
    if (!idSet.has(e.source)) out.push({ level: 'error', msg: `Edge source "${e.source}" is not a node` });
    if (!idSet.has(e.target)) out.push({ level: 'error', msg: `Edge target "${e.target}" is not a node` });
    degree[e.source] = (degree[e.source] || 0) + 1;
    degree[e.target] = (degree[e.target] || 0) + 1;
  }

  // ── orphans + reachability from startNode ──────────────────────────────
  const start = config.startNode;
  if (!idSet.has(start) && nodes.length)
    out.push({ level: 'error', msg: `startNode "${start}" is not a node` });
  for (const n of nodes) {
    if (!degree[n.id] && nodes.length > 1)
      out.push({ level: 'warn', msg: `Node "${n.id}" has no edges (orphan)`, focus: { kind: 'node', id: n.id } });
  }
  if (idSet.has(start)) {
    const adj: Record<string, string[]> = {};
    for (const e of edges) {
      (adj[e.source] ||= []).push(e.target);
      (adj[e.target] ||= []).push(e.source);
    }
    const seen = new Set([start]);
    const q = [start];
    while (q.length) {
      const c = q.shift()!;
      for (const nb of adj[c] || []) if (!seen.has(nb)) { seen.add(nb); q.push(nb); }
    }
    for (const n of nodes)
      if (!seen.has(n.id))
        out.push({ level: 'warn', msg: `Node "${n.id}" is unreachable from startNode`, focus: { kind: 'node', id: n.id } });
  }

  // ── content files ──────────────────────────────────────────────────────
  const idSetForContent = new Set<string>();
  for (const n of nodes) {
    if (isContentPath(n.content)) {
      const m = String(n.content).match(/([a-zA-Z0-9._-]+)\.html?$/i);
      const cid = m ? m[1] : null;
      if (cid) {
        idSetForContent.add(cid);
        if (!contentIds.includes(cid))
          out.push({ level: 'error', msg: `Node "${n.id}" content file "${cid}.html" is missing`, focus: { kind: 'node', id: n.id } });
      }
    }
  }
  for (const cid of contentIds)
    if (!idSetForContent.has(cid))
      out.push({ level: 'warn', msg: `content/nodes/${cid}.html is not referenced by any node` });

  // ── class hierarchy ────────────────────────────────────────────────────
  const roots = Object.entries(classes).filter(([, d]) => d.parent == null).map(([n]) => n);
  if (roots.length === 0) out.push({ level: 'error', msg: 'No root class (need exactly one with parent: null)' });
  if (roots.length > 1) out.push({ level: 'error', msg: `Multiple root classes: ${roots.join(', ')}` });
  if (roots.length === 1 && roots[0] !== 'all')
    out.push({ level: 'warn', msg: `Root class is "${roots[0]}", convention is "all"` });
  for (const [name, def] of Object.entries(classes)) {
    if (def.parent != null && !classes[def.parent])
      out.push({ level: 'error', msg: `Class "${name}" has missing parent "${def.parent}"`, focus: { kind: 'class', id: name } });
    // cycle detection
    let p = def.parent;
    let guard = 0;
    const path = [name];
    while (p && guard++ < 64) {
      if (path.includes(p)) {
        out.push({ level: 'error', msg: `Class cycle: ${path.join(' → ')} → ${p}`, focus: { kind: 'class', id: name } });
        break;
      }
      path.push(p);
      p = classes[p]?.parent ?? null;
    }
  }

  return out;
}
