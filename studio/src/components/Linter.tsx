import React from 'react';
import type { LintItem } from '../lint';

interface Props {
  items: LintItem[];
  onFocus: (f: NonNullable<LintItem['focus']>) => void;
}

export default function Linter(p: Props) {
  const errors = p.items.filter((i) => i.level === 'error').length;
  const warns = p.items.filter((i) => i.level === 'warn').length;
  return (
    <div>
      <h2>Integrity {errors > 0 ? `· ${errors} err` : ''}{warns > 0 ? ` · ${warns} warn` : ''}</h2>
      {p.items.length === 0 && <div className="lint-ok">✓ no problems</div>}
      {p.items.map((it, i) => (
        <div
          key={i}
          className={'lint-item ' + it.level}
          onClick={() => it.focus && p.onFocus(it.focus)}
          title={it.focus ? 'click to focus' : ''}
        >
          {it.msg}
        </div>
      ))}
    </div>
  );
}
