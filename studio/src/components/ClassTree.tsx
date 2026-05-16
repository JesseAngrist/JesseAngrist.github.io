import React, { useState } from 'react';
import type { ClassDef } from '../types';
import { classTree } from '../classUtils';

interface Props {
  classes: Record<string, ClassDef>;
  selected: string | null;
  onSelect: (name: string) => void;
  onAddClass: (parent: string) => void;
  onRenameClass: (oldName: string, newName: string) => void;
  onDeleteClass: (name: string) => void;
  onSetColor: (name: string, color: string | undefined) => void;
}

export default function ClassTree(p: Props) {
  const tree = classTree(p.classes);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const sel = p.selected && p.classes[p.selected] ? p.selected : null;
  const selDef = sel ? p.classes[sel] : null;

  return (
    <div>
      <h2>Classes</h2>
      <div className="hint">Hierarchy rooted at <b>all</b>. Color inherits up the tree.</div>
      {tree.map((c) => (
        <div
          key={c.name}
          className={'ctree-row' + (sel === c.name ? ' sel' : '')}
          style={{ paddingLeft: 4 + c.depth * 14 }}
          onClick={() => p.onSelect(c.name)}
        >
          <span className="swatch" style={{ background: c.resolved }} />
          {renaming === c.name ? (
            <input
              autoFocus
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onBlur={() => { if (draft && draft !== c.name) p.onRenameClass(c.name, draft.trim()); setRenaming(null); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { if (draft && draft !== c.name) p.onRenameClass(c.name, draft.trim()); setRenaming(null); }
                if (e.key === 'Escape') setRenaming(null);
              }}
            />
          ) : (
            <span
              className="ctree-name"
              onDoubleClick={(e) => { e.stopPropagation(); setRenaming(c.name); setDraft(c.name); }}
              title="double-click to rename"
            >
              {c.name}{' '}
              <span className="ctree-own">{c.ownColor ? c.ownColor : '(inherits)'}</span>
            </span>
          )}
        </div>
      ))}

      <div className="row" style={{ marginTop: 8 }}>
        <button onClick={() => p.onAddClass(sel || 'all')}>
          + child of {sel || 'all'}
        </button>
      </div>

      {sel && (
        <div style={{ marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
          <h2>Class: {sel}</h2>
          <div className="row">
            <label>Color</label>
            <input
              type="color"
              value={selDef?.color || '#bbb4a8'}
              onChange={(e) => p.onSetColor(sel, e.target.value)}
            />
            <button onClick={() => p.onSetColor(sel, undefined)} title="clear → inherit">
              inherit
            </button>
          </div>
          <div className="row">
            <button onClick={() => { setRenaming(sel); setDraft(sel); }}>Rename</button>
            <button
              className="danger"
              disabled={selDef?.parent == null}
              title={selDef?.parent == null ? 'cannot delete the root' : 'reparents children & nodes'}
              onClick={() => p.onDeleteClass(sel)}
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
