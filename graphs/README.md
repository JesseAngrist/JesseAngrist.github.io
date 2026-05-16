# graphs/ — version-controlled graph iterations

Each `*.json` here is a saved iteration of the site graph, authored in the
studio (`studio/`, run with `npm run studio`).

## What's deployed

The **deployed graph is the file at the repo root: `../graph.json`**.
GitHub Pages serves whatever bytes are there — there is no manifest, index,
or build step. The "active" iteration is simply whichever snapshot's contents
currently match root `graph.json`.

## Workflow

- The studio writes named snapshots here (`graphs/<name>.json`).
- "Deploy this" in the studio copies a snapshot's contents into root
  `graph.json` — that, and pushing to GitHub, is the entire publish step.
- `git log graph.json` is the deploy history.
- Each graph carries an optional `config.meta` (`sourceIteration`, `generated`)
  for human/git provenance. The live site ignores it.

## Schema (summary)

- `config` — D3 sim tuning + a `classes` hierarchy (a tree of named classes
  rooted at `all`; each `{ parent, color? }`; node color resolves up the
  parent chain to the nearest ancestor with a `color`).
- `nodes` — `{ id, label, class, x, y, content, r, hint?, mass? }`. Positions
  are authored; the live site seeds its simulation from them and gently
  drifts ("seed-then-drift").
- `edges` — `{ source, target, length?, weight? }`. `length` is the authored
  target distance; omit it to let the edge follow node placement.

Legacy `tools/gen_sparse*.py` are no longer the authoring path — kept only
for reference.
