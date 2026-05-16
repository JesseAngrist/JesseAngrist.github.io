import React, { useState } from 'react';

interface Snap { name: string; active: boolean; }

interface Props {
  snapshots: Snap[];
  defaultName: string;
  diffBase: string | null;
  onSave: (name: string, deploy: boolean) => void;
  onLoad: (name: string) => void;
  onDeploy: (name: string) => void;
  onRefresh: () => void;
  onSetDiffBase: (name: string | null) => void;
}

export default function Snapshots(p: Props) {
  const [name, setName] = useState(p.defaultName);

  return (
    <div>
      <h2>Snapshots</h2>
      <div className="row">
        <input
          type="text"
          value={name}
          placeholder="iteration-name"
          onChange={(e) => setName(e.target.value.replace(/[^a-zA-Z0-9._-]/g, '-'))}
        />
      </div>
      <div className="row">
        <button onClick={() => name && p.onSave(name, false)}>Save</button>
        <button className="primary" onClick={() => name && p.onSave(name, true)} title="save + write to root graph.json">
          Save &amp; deploy
        </button>
        <button onClick={p.onRefresh} title="refresh list">↻</button>
      </div>

      {p.snapshots.length === 0 && <div className="hint">no snapshots yet</div>}
      {p.snapshots.map((s) => (
        <div className="snap" key={s.name}>
          <span className="nm">{s.name}</span>
          {s.active && <span className="badge">live</span>}
          <button onClick={() => p.onLoad(s.name)} title="load into editor">load</button>
          <button onClick={() => p.onDeploy(s.name)} title="copy to root graph.json">deploy</button>
          <button
            className={p.diffBase === s.name ? 'active' : ''}
            onClick={() => p.onSetDiffBase(p.diffBase === s.name ? null : s.name)}
            title="diff current against this"
          >
            diff
          </button>
        </div>
      ))}
      {p.diffBase && (
        <div className="legend">
          Diffing against <b>{p.diffBase}</b>:{' '}
          <span style={{ color: '#3aa653' }}>■ added</span>{' '}
          <span style={{ color: '#c25' }}>■ removed</span>{' '}
          <span style={{ color: '#888' }}>■ moved</span>
        </div>
      )}
    </div>
  );
}
