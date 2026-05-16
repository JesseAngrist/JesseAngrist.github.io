import React from 'react';
import type { Graph, Selection } from '../types';
import { isContentPath } from '../classUtils';

interface Props {
  graph: Graph;
  selection: Selection;
  fileBody: string;
  onPatchNode: (id: string, patch: Record<string, unknown>) => void;
  onRenameNodeId: (oldId: string, newId: string) => void;
  onDeleteNode: (id: string) => void;
  onPatchEdge: (key: string, patch: Record<string, unknown>) => void;
  onDeleteEdge: (key: string) => void;
  onSetStartNode: (id: string) => void;
  onFileBodyChange: (id: string, html: string) => void;
}

export default function Inspector(p: Props) {
  const { selection, graph } = p;

  if (selection.kind === 'node') {
    const n = graph.nodes.find((x) => x.id === selection.id);
    if (!n) return <div className="hint">node not found</div>;
    const fileMode = isContentPath(n.content);
    const filePath = `content/nodes/${n.id}.html`;
    const isStart = graph.config.startNode === n.id;

    return (
      <div>
        <h2>Node</h2>
        <div className="row">
          <label>id</label>
          <input
            type="text"
            defaultValue={n.id}
            key={n.id}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== n.id) p.onRenameNodeId(n.id, v);
            }}
          />
        </div>
        <div className="row">
          <label>label</label>
          <input type="text" value={n.label} onChange={(e) => p.onPatchNode(n.id, { label: e.target.value })} />
        </div>
        <div className="row">
          <label>class</label>
          <select value={n.class} onChange={(e) => p.onPatchNode(n.id, { class: e.target.value })}>
            {Object.keys(graph.config.classes).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="row">
          <label>x / y</label>
          <input type="number" value={n.x} onChange={(e) => p.onPatchNode(n.id, { x: Number(e.target.value) })} />
          <input type="number" value={n.y} onChange={(e) => p.onPatchNode(n.id, { y: Number(e.target.value) })} />
        </div>
        <div className="row">
          <label>r</label>
          <input type="number" value={n.r} onChange={(e) => p.onPatchNode(n.id, { r: Number(e.target.value) })} />
          <label>mass</label>
          <input type="number" step="0.1" value={n.mass ?? 1} onChange={(e) => p.onPatchNode(n.id, { mass: Number(e.target.value) })} />
        </div>
        <div className="row">
          <label>hint</label>
          <input type="text" value={n.hint ?? ''} onChange={(e) => p.onPatchNode(n.id, { hint: e.target.value || null })} />
        </div>

        <h2>Content</h2>
        <div className="row">
          <label>
            <input
              type="checkbox"
              checked={fileMode}
              onChange={(e) => {
                if (e.target.checked) {
                  // inline → file: seed the file body with current inline text
                  p.onFileBodyChange(n.id, typeof n.content === 'string' && !isContentPath(n.content) ? n.content : '');
                  p.onPatchNode(n.id, { content: filePath });
                } else {
                  // file → inline: drop the path, keep edited body inline
                  p.onPatchNode(n.id, { content: p.fileBody || '' });
                }
              }}
            />{' '}
            store as file
          </label>
        </div>
        <div className="hint">
          {fileMode ? `→ ${filePath} (written on save)` : 'inline (stored in graph.json)'}
        </div>
        <textarea
          value={fileMode ? p.fileBody : (typeof n.content === 'string' ? n.content : '')}
          placeholder={fileMode ? '<h2>…</h2><p>…</p>' : 'inline HTML or a line of text'}
          onChange={(e) =>
            fileMode
              ? p.onFileBodyChange(n.id, e.target.value)
              : p.onPatchNode(n.id, { content: e.target.value || null })
          }
        />

        <div className="row" style={{ marginTop: 8 }}>
          <button
            className={isStart ? 'active' : ''}
            onClick={() => p.onSetStartNode(n.id)}
            title="the node a visitor starts at"
          >
            {isStart ? '★ start node' : 'make start node'}
          </button>
          <button className="danger" onClick={() => p.onDeleteNode(n.id)}>Delete node</button>
        </div>
      </div>
    );
  }

  if (selection.kind === 'edge' && selection.id) {
    const [s, t] = selection.id.split('|');
    const e = graph.edges.find((x) => x.source === s && x.target === t);
    if (!e) return <div className="hint">edge not found</div>;
    const sn = graph.nodes.find((n) => n.id === s);
    const tn = graph.nodes.find((n) => n.id === t);
    const derived = sn && tn ? Math.round(Math.hypot(tn.x - sn.x, tn.y - sn.y)) : 0;
    return (
      <div>
        <h2>Edge</h2>
        <div className="hint">{s} → {t}</div>
        <div className="row">
          <label>length</label>
          <input
            type="number"
            value={e.length ?? ''}
            placeholder={`${derived} (auto)`}
            onChange={(ev) =>
              p.onPatchEdge(selection.id!, {
                length: ev.target.value === '' ? undefined : Number(ev.target.value),
              })
            }
          />
        </div>
        <div className="hint">Blank = follows node placement ({derived}px). Pin only for deliberate corridors.</div>
        <div className="row">
          <label>weight</label>
          <input
            type="number" step="0.1"
            value={e.weight ?? 1}
            onChange={(ev) => p.onPatchEdge(selection.id!, { weight: Number(ev.target.value) })}
          />
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="danger" onClick={() => p.onDeleteEdge(selection.id!)}>Delete edge</button>
        </div>
      </div>
    );
  }

  return <div className="hint">Select a node or edge. Use the toolbar to add nodes / draw edges.</div>;
}
