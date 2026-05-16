import React from 'react';
import type { Mode } from '../types';

interface Props {
  mode: Mode;
  preview: boolean;
  status: string;
  onMode: (m: Mode) => void;
  onPreview: (v: boolean) => void;
}

export default function Toolbar(p: Props) {
  return (
    <div className="toolbar">
      <h1>GRAPH STUDIO</h1>
      <button className={p.mode === 'select' && !p.preview ? 'active' : ''} disabled={p.preview} onClick={() => p.onMode('select')}>
        Select / Move
      </button>
      <button className={p.mode === 'addNode' && !p.preview ? 'active' : ''} disabled={p.preview} onClick={() => p.onMode('addNode')}>
        + Node
      </button>
      <button className={p.mode === 'addEdge' && !p.preview ? 'active' : ''} disabled={p.preview} onClick={() => p.onMode('addEdge')}>
        + Edge
      </button>
      <span className="spacer" />
      <span className="hint">{p.status}</span>
      <button className={p.preview ? 'active' : ''} onClick={() => p.onPreview(!p.preview)} title="cold-start fog-of-war preview">
        {p.preview ? '◉ Preview' : '○ Preview'}
      </button>
    </div>
  );
}
