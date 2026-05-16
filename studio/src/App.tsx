import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Graph, Mode, Selection } from './types';
import { api } from './api';
import { emptyGraph, isContentPath } from './classUtils';
import { lintGraph } from './lint';
import Toolbar from './components/Toolbar';
import Canvas from './components/Canvas';
import ClassTree from './components/ClassTree';
import Inspector from './components/Inspector';
import Linter from './components/Linter';
import Snapshots from './components/Snapshots';

function uniqueId(base: string, taken: Set<string>) {
  if (!taken.has(base)) return base;
  let i = 1;
  while (taken.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

export default function App() {
  const [graph, setGraph] = useState<Graph>(emptyGraph());
  const [selection, setSelection] = useState<Selection>({ kind: null, id: null });
  const [mode, setMode] = useState<Mode>('select');
  const [preview, setPreview] = useState(false);
  const [pendingEdgeSource, setPendingEdgeSource] = useState<string | null>(null);
  const [contentIds, setContentIds] = useState<string[]>([]);
  const [snapshots, setSnapshots] = useState<{ name: string; active: boolean }[]>([]);
  const [fileBodies, setFileBodies] = useState<Record<string, string>>({});
  const [diffBaseName, setDiffBaseName] = useState<string | null>(null);
  const [diffBaseGraph, setDiffBaseGraph] = useState<Graph | null>(null);
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [lastName, setLastName] = useState('iteration-1');
  const [toast, setToast] = useState('');
  const toastTimer = useRef<any>(null);

  const flash = (m: string) => {
    setToast(m);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2200);
  };

  const refreshSnapshots = useCallback(() => {
    api.listGraphs().then((r) => setSnapshots(r.files)).catch(() => {});
  }, []);
  const refreshContent = useCallback(() => {
    api.contentList().then((r) => setContentIds(r.ids)).catch(() => {});
  }, []);

  // initial load
  useEffect(() => {
    api
      .loadGraph('__root__')
      .then((r) => setGraph(r.graph))
      .catch(() => flash('no root graph.json yet — starting empty'));
    refreshSnapshots();
    refreshContent();
  }, []);

  // lazily load a file-backed node's HTML when selected
  useEffect(() => {
    if (selection.kind !== 'node' || !selection.id) return;
    const n = graph.nodes.find((x) => x.id === selection.id);
    if (n && isContentPath(n.content) && fileBodies[n.id] === undefined) {
      api
        .loadContent(n.id)
        .then((r) => setFileBodies((m) => ({ ...m, [n.id]: r.html })))
        .catch(() => {});
    }
  }, [selection, graph]);

  // diff base loader
  useEffect(() => {
    if (!diffBaseName) { setDiffBaseGraph(null); return; }
    api.loadGraph(diffBaseName).then((r) => setDiffBaseGraph(r.graph)).catch(() => setDiffBaseGraph(null));
  }, [diffBaseName]);

  const select = (kind: Selection['kind'], id: string | null) => {
    setSelection({ kind, id });
    if (kind === 'class') {/* keep node selection panel hidden */}
  };

  // ── node mutations ──────────────────────────────────────────────────────
  const patchNode = (id: string, patch: Record<string, unknown>) =>
    setGraph((g) => ({ ...g, nodes: g.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) }));

  const moveNode = (id: string, x: number, y: number) =>
    setGraph((g) => ({ ...g, nodes: g.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)) }));

  const renameNodeId = (oldId: string, newId: string) => {
    newId = (newId || '').trim();
    if (!newId || newId === oldId) return;
    if (graph.nodes.some((n) => n.id === newId)) { flash(`id "${newId}" already exists`); return; }
    setGraph((g) => ({
      ...g,
      config: { ...g.config, startNode: g.config.startNode === oldId ? newId : g.config.startNode },
      nodes: g.nodes.map((n) => (n.id === oldId ? { ...n, id: newId } : n)),
      edges: g.edges.map((e) => ({
        ...e,
        source: e.source === oldId ? newId : e.source,
        target: e.target === oldId ? newId : e.target,
      })),
    }));
    // Keep any loaded file body and the selection pointed at the renamed node
    // so the editor doesn't blank out ("node not found") on blur.
    setFileBodies((m) => {
      if (m[oldId] === undefined) return m;
      const { [oldId]: body, ...rest } = m;
      return { ...rest, [newId]: body };
    });
    setSelection((s) => (s.kind === 'node' && s.id === oldId ? { kind: 'node', id: newId } : s));
  };

  const deleteNode = (id: string) => {
    setGraph((g) => ({
      ...g,
      nodes: g.nodes.filter((n) => n.id !== id),
      edges: g.edges.filter((e) => e.source !== id && e.target !== id),
    }));
    setSelection({ kind: null, id: null });
  };

  const addNodeAt = (x: number, y: number) => {
    const id = uniqueId('node', new Set(graph.nodes.map((n) => n.id)));
    const cls = graph.config.classes['core']
      ? 'core'
      : Object.keys(graph.config.classes).find((c) => graph.config.classes[c].parent == null) || 'all';
    const node = { id, label: id, class: cls, x, y, content: null, r: 10, hint: null, mass: 1 };
    setGraph((g) => ({ ...g, nodes: [...g.nodes, node] }));
    setSelection({ kind: 'node', id });
  };

  // ── edge mutations ──────────────────────────────────────────────────────
  const edgeExists = (s: string, t: string, g: Graph) =>
    g.edges.some((e) => (e.source === s && e.target === t) || (e.source === t && e.target === s));

  const addEdge = (s: string, t: string) =>
    setGraph((g) => (s === t || edgeExists(s, t, g) ? g : { ...g, edges: [...g.edges, { source: s, target: t, weight: 1 }] }));

  const patchEdge = (key: string, patch: Record<string, unknown>) => {
    const [s, t] = key.split('|');
    setGraph((g) => ({
      ...g,
      edges: g.edges.map((e) => {
        if (e.source !== s || e.target !== t) return e;
        const next = { ...e, ...patch };
        if (next.length === undefined) delete (next as any).length;
        return next;
      }),
    }));
  };

  const deleteEdge = (key: string) => {
    const [s, t] = key.split('|');
    setGraph((g) => ({ ...g, edges: g.edges.filter((e) => !(e.source === s && e.target === t)) }));
    setSelection({ kind: null, id: null });
  };

  const onEdgeClickNode = (id: string) => {
    if (pendingEdgeSource == null) { setPendingEdgeSource(id); return; }
    if (pendingEdgeSource !== id) addEdge(pendingEdgeSource, id);
    setPendingEdgeSource(null);
  };

  const setStartNode = (id: string) =>
    setGraph((g) => ({ ...g, config: { ...g.config, startNode: id } }));

  // ── class mutations ─────────────────────────────────────────────────────
  const addClass = (parent: string) => {
    const name = uniqueId('class', new Set(Object.keys(graph.config.classes)));
    setGraph((g) => ({
      ...g,
      config: { ...g.config, classes: { ...g.config.classes, [name]: { parent } } },
    }));
    setSelection({ kind: 'class', id: name });
  };

  const renameClass = (oldName: string, newName: string) => {
    newName = (newName || '').trim();
    if (!newName || graph.config.classes[newName]) { flash(`class "${newName}" exists`); return; }
    setGraph((g) => {
      const classes: Record<string, any> = {};
      for (const [k, v] of Object.entries(g.config.classes)) {
        classes[k === oldName ? newName : k] = {
          ...v,
          parent: v.parent === oldName ? newName : v.parent,
        };
      }
      return {
        ...g,
        config: { ...g.config, classes },
        nodes: g.nodes.map((n) => (n.class === oldName ? { ...n, class: newName } : n)),
      };
    });
    setSelection({ kind: 'class', id: newName });
  };

  const deleteClass = (name: string) => {
    const def = graph.config.classes[name];
    if (!def || def.parent == null) { flash('cannot delete the root class'); return; }
    const reTo = def.parent;
    setGraph((g) => {
      const classes: Record<string, any> = {};
      for (const [k, v] of Object.entries(g.config.classes)) {
        if (k === name) continue;
        classes[k] = { ...v, parent: v.parent === name ? reTo : v.parent };
      }
      return {
        ...g,
        config: { ...g.config, classes },
        nodes: g.nodes.map((n) => (n.class === name ? { ...n, class: reTo } : n)),
      };
    });
    setSelection({ kind: null, id: null });
  };

  const setClassColor = (name: string, color: string | undefined) =>
    setGraph((g) => {
      const c = { ...g.config.classes[name] };
      if (color) c.color = color; else delete c.color;
      return { ...g, config: { ...g.config, classes: { ...g.config.classes, [name]: c } } };
    });

  // ── save / deploy / load ────────────────────────────────────────────────
  const persistFiles = async () => {
    const jobs: Promise<unknown>[] = [];
    for (const n of graph.nodes) {
      if (isContentPath(n.content) && fileBodies[n.id] !== undefined) {
        jobs.push(api.saveContent(n.id, fileBodies[n.id]));
      }
    }
    await Promise.all(jobs);
  };

  const save = async (name: string, deploy: boolean) => {
    try {
      await persistFiles();
      await api.saveGraph(name, graph, deploy);
      setLastName(name);
      refreshSnapshots();
      refreshContent();
      flash(deploy ? `saved & deployed "${name}"` : `saved "${name}"`);
    } catch (e: any) {
      flash('save failed: ' + e.message);
    }
  };

  const loadSnapshot = async (name: string) => {
    try {
      const { graph: g } = await api.loadGraph(name);
      setGraph(g);
      setFileBodies({});
      setSelection({ kind: null, id: null });
      setLastName(name);
      refreshContent();
      flash(`loaded "${name}"`);
    } catch (e: any) {
      flash('load failed: ' + e.message);
    }
  };

  const deploySnapshot = async (name: string) => {
    try {
      const { graph: g } = await api.loadGraph(name);
      await api.saveGraph(name, g, true);
      refreshSnapshots();
      flash(`deployed "${name}" → graph.json`);
    } catch (e: any) {
      flash('deploy failed: ' + e.message);
    }
  };

  // ── keyboard: delete selection ──────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selection.id) {
        if (selection.kind === 'node') deleteNode(selection.id);
        if (selection.kind === 'edge') deleteEdge(selection.id);
      }
      if (e.key === 'Escape') { setPendingEdgeSource(null); setSelection({ kind: null, id: null }); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selection]);

  const lint = useMemo(() => lintGraph(graph, contentIds), [graph, contentIds]);

  const status = preview
    ? 'preview: cold-start fog-of-war (editing disabled)'
    : mode === 'addEdge'
    ? pendingEdgeSource
      ? `edge from "${pendingEdgeSource}" — click target (Esc to cancel)`
      : 'click a source node'
    : mode === 'addNode'
    ? 'click canvas to place a node'
    : `${graph.nodes.length} nodes · ${graph.edges.length} edges · start: ${graph.config.startNode}`;

  return (
    <div className="app">
      <Toolbar
        mode={mode}
        preview={preview}
        status={status}
        onMode={(m) => { setMode(m); setPendingEdgeSource(null); }}
        onPreview={setPreview}
      />
      <div className="main">
        <div className="panel">
          <ClassTree
            classes={graph.config.classes}
            selected={selection.kind === 'class' ? selection.id : null}
            onSelect={(n) => select('class', n)}
            onAddClass={addClass}
            onRenameClass={renameClass}
            onDeleteClass={deleteClass}
            onSetColor={setClassColor}
          />
          <Snapshots
            snapshots={snapshots}
            defaultName={lastName}
            diffBase={diffBaseName}
            onSave={save}
            onLoad={loadSnapshot}
            onDeploy={deploySnapshot}
            onRefresh={refreshSnapshots}
            onSetDiffBase={setDiffBaseName}
          />
        </div>

        <Canvas
          graph={graph}
          selection={selection}
          mode={mode}
          preview={preview}
          pendingEdgeSource={pendingEdgeSource}
          diffBase={diffBaseGraph}
          focusNodeId={focusNodeId}
          onFocusHandled={() => setFocusNodeId(null)}
          onSelect={select}
          onAddNodeAt={addNodeAt}
          onMoveNode={moveNode}
          onEdgeClickNode={onEdgeClickNode}
        />

        <div className="panel right">
          <Inspector
            graph={graph}
            selection={selection}
            fileBody={selection.kind === 'node' && selection.id ? fileBodies[selection.id] ?? '' : ''}
            onPatchNode={patchNode}
            onRenameNodeId={renameNodeId}
            onDeleteNode={deleteNode}
            onPatchEdge={patchEdge}
            onDeleteEdge={deleteEdge}
            onSetStartNode={setStartNode}
            onFileBodyChange={(id, html) => setFileBodies((m) => ({ ...m, [id]: html }))}
          />
          <Linter
            items={lint}
            onFocus={(f) => {
              if (f.kind === 'node') { setSelection({ kind: 'node', id: f.id }); setFocusNodeId(f.id); }
              else setSelection({ kind: 'class', id: f.id });
            }}
          />
        </div>
      </div>
      <div className={'toast' + (toast ? ' show' : '')}>{toast}</div>
    </div>
  );
}
