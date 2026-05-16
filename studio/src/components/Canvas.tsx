import React, { useEffect, useRef, useState } from 'react';
import type { Graph, Mode, Selection } from '../types';
import { resolveColor, edgeKey } from '../classUtils';

interface Props {
  graph: Graph;
  selection: Selection;
  mode: Mode;
  preview: boolean;
  pendingEdgeSource: string | null;
  diffBase: Graph | null;
  focusNodeId: string | null;
  onFocusHandled: () => void;
  onSelect: (kind: Selection['kind'], id: string | null) => void;
  onAddNodeAt: (x: number, y: number) => void;
  onMoveNode: (id: string, x: number, y: number) => void;
  onEdgeClickNode: (id: string) => void;
}

interface View { tx: number; ty: number; k: number; }

export default function Canvas(p: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [view, setView] = useState<View>({ tx: 0, ty: 0, k: 1 });
  const drag = useRef<{ id: string; moved: boolean } | null>(null);
  const pan = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  const classes = p.graph.config.classes || {};

  function toWorld(clientX: number, clientY: number) {
    const r = svgRef.current!.getBoundingClientRect();
    return {
      x: (clientX - r.left - view.tx) / view.k,
      y: (clientY - r.top - view.ty) / view.k,
    };
  }

  // Center the view on a node when the linter requests focus.
  useEffect(() => {
    if (!p.focusNodeId || !svgRef.current) return;
    const n = p.graph.nodes.find((x) => x.id === p.focusNodeId);
    if (n) {
      const r = svgRef.current.getBoundingClientRect();
      setView((v) => ({ ...v, tx: r.width / 2 - n.x * v.k, ty: r.height / 2 - n.y * v.k }));
    }
    p.onFocusHandled();
  }, [p.focusNodeId]);

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const r = svgRef.current!.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    setView((v) => {
      const k = Math.max(0.15, Math.min(4, v.k * factor));
      // keep the point under the cursor fixed
      return {
        k,
        tx: mx - ((mx - v.tx) * k) / v.k,
        ty: my - ((my - v.ty) * k) / v.k,
      };
    });
  }

  function bgPointerDown(e: React.PointerEvent) {
    if (p.preview) return;
    if (p.mode === 'addNode') {
      const w = toWorld(e.clientX, e.clientY);
      p.onAddNodeAt(Math.round(w.x), Math.round(w.y));
      return;
    }
    // start panning
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pan.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
    p.onSelect(null, null);
  }

  function onPointerMove(e: React.PointerEvent) {
    // Capture refs into locals BEFORE any state update. The setView updater
    // runs asynchronously; if pointerup/leave nulls these refs in between,
    // reading them inside the updater would throw during React's render
    // phase and unmount the whole app.
    const pc = pan.current;
    if (pc) {
      const tx = pc.tx + (e.clientX - pc.x);
      const ty = pc.ty + (e.clientY - pc.y);
      setView((v) => ({ ...v, tx, ty }));
      return;
    }
    const dg = drag.current;
    if (dg && !p.preview) {
      const w = toWorld(e.clientX, e.clientY);
      dg.moved = true;
      p.onMoveNode(dg.id, Math.round(w.x), Math.round(w.y));
    }
  }

  function onPointerUp() {
    pan.current = null;
    drag.current = null;
  }

  function nodePointerDown(e: React.PointerEvent, id: string) {
    e.stopPropagation();
    if (p.preview) return;
    if (p.mode === 'addEdge') {
      p.onEdgeClickNode(id);
      return;
    }
    p.onSelect('node', id);
    drag.current = { id, moved: false };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  // ── preview fog computation ────────────────────────────────────────────
  const start = p.graph.config.startNode;
  const discovered = new Set<string>();
  const visited = new Set<string>();
  if (p.preview) {
    visited.add(start);
    discovered.add(start);
    for (const e of p.graph.edges) {
      if (e.source === start) discovered.add(e.target);
      if (e.target === start) discovered.add(e.source);
    }
  }
  const nodeVisible = (id: string) => !p.preview || discovered.has(id);
  const nodeOpacity = (id: string) =>
    !p.preview ? 1 : visited.has(id) ? 1 : discovered.has(id) ? 0.22 : 0;

  // ── diff sets ──────────────────────────────────────────────────────────
  const baseNodes = new Map((p.diffBase?.nodes || []).map((n) => [n.id, n]));
  const curIds = new Set(p.graph.nodes.map((n) => n.id));
  const baseEdgeKeys = new Set((p.diffBase?.edges || []).map((e) => edgeKey(e.source, e.target)));
  const curEdgeKeys = new Set(p.graph.edges.map((e) => edgeKey(e.source, e.target)));

  function lenOf(e: { source: string; target: string; length?: number }) {
    if (e.length != null) return Math.round(e.length);
    const s = p.graph.nodes.find((n) => n.id === e.source);
    const t = p.graph.nodes.find((n) => n.id === e.target);
    if (!s || !t) return 0;
    return Math.round(Math.hypot(t.x - s.x, t.y - s.y));
  }

  return (
    <div className="canvas-wrap">
      <svg
        ref={svgRef}
        className={'canvas' + (p.mode === 'addNode' && !p.preview ? ' adding' : '')}
        onWheel={onWheel}
        onPointerDown={bgPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <g transform={`translate(${view.tx},${view.ty}) scale(${view.k})`}>
          {/* edges */}
          {p.graph.edges.map((e) => {
            const s = p.graph.nodes.find((n) => n.id === e.source);
            const t = p.graph.nodes.find((n) => n.id === e.target);
            if (!s || !t) return null;
            if (p.preview && !(nodeVisible(s.id) && nodeVisible(t.id))) return null;
            const k = edgeKey(e.source, e.target);
            const sel = p.selection.kind === 'edge' && p.selection.id === k;
            const added = p.diffBase && !baseEdgeKeys.has(k);
            return (
              <g key={k}>
                <line
                  className={'edge-line' + (sel ? ' sel' : '')}
                  x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                  stroke={added ? '#3aa653' : undefined}
                  onPointerDown={(ev) => { ev.stopPropagation(); if (!p.preview) p.onSelect('edge', k); }}
                />
                {!p.preview && (
                  <text className="edge-len" x={(s.x + t.x) / 2} y={(s.y + t.y) / 2}>
                    {lenOf(e)}{e.length != null ? '' : '~'}
                  </text>
                )}
              </g>
            );
          })}

          {/* removed edges (diff ghost) */}
          {p.diffBase && p.diffBase.edges.filter((e) => !curEdgeKeys.has(edgeKey(e.source, e.target))).map((e) => {
            const s = baseNodes.get(e.source); const t = baseNodes.get(e.target);
            if (!s || !t) return null;
            return <line key={'rm' + edgeKey(e.source, e.target)} x1={s.x} y1={s.y} x2={t.x} y2={t.y}
              stroke="#c25" strokeDasharray="4 4" strokeWidth={1.5} opacity={0.6} />;
          })}

          {/* moved-node vectors (diff) */}
          {p.diffBase && p.graph.nodes.map((n) => {
            const b = baseNodes.get(n.id);
            if (!b || (b.x === n.x && b.y === n.y)) return null;
            return <line key={'mv' + n.id} x1={b.x} y1={b.y} x2={n.x} y2={n.y}
              stroke="#888" strokeDasharray="2 3" strokeWidth={1} />;
          })}

          {/* removed nodes (diff ghost) */}
          {p.diffBase && p.diffBase.nodes.filter((n) => !curIds.has(n.id)).map((n) => (
            <circle key={'rmn' + n.id} cx={n.x} cy={n.y} r={n.r || 10}
              fill="none" stroke="#c25" strokeDasharray="3 3" opacity={0.7} />
          ))}

          {/* nodes */}
          {p.graph.nodes.map((n) => {
            if (!nodeVisible(n.id)) return null;
            const sel = p.selection.kind === 'node' && p.selection.id === n.id;
            const isPending = p.pendingEdgeSource === n.id;
            const added = p.diffBase && !baseNodes.has(n.id);
            return (
              <g key={n.id} opacity={nodeOpacity(n.id)}>
                <circle
                  className={'node-c' + (sel ? ' sel' : '')}
                  cx={n.x} cy={n.y} r={n.r || 10}
                  fill={resolveColor(classes, n.class)}
                  stroke={added ? '#3aa653' : isPending ? '#e08a2b' : undefined}
                  strokeWidth={isPending ? 3 : undefined}
                  onPointerDown={(e) => nodePointerDown(e, n.id)}
                />
                {(!p.preview || visited.has(n.id)) && n.label && (
                  <text className="node-label" x={n.x} y={n.y - (n.r || 10) - 5} textAnchor="middle">
                    {n.label}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
