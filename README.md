# new_website

A personal site that isn't a page — it's a place.

Instead of a navbar and a scroll, the site is a **graph**: a quiet field of
nodes and edges on a warm off-white background. You start at one node and
*travel* between them. Most of the map is hidden until you explore toward it
(a fog of war), and the layout breathes — it's a live force simulation that
gently drifts while holding the shape it was composed in. Some nodes are
substantial (writing, projects); many are sparse landmarks; the distances
between them are deliberate. The reward is exploration, not a sitemap.

It's a static GitHub Pages site with no build step and no framework. The
authoring happens in a small local tool (the **studio**); the published site
is just a handful of files served as-is.

---

## Running the site locally

No install, no build. Serve the repo root with any static server:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

The page loads `index.html` → `js/main.js` (native ES modules), pulls D3 v7
from a CDN, and fetches `graph.json`. That's the whole site.

## Editing the graph (the studio)

The graph is **hand-authored** in a local design studio — placing nodes,
drawing edges, writing content, and organizing nodes into a class hierarchy.
The studio is a dev-only app in `studio/` and is never deployed.

```bash
cd studio
npm install      # requires Node.js
npm run studio   # opens http://localhost:5180
```

The studio reads and writes the real project files (via a tiny local save
server built into its dev server):

- it loads/saves the graph to `graph.json` and named iterations in `graphs/`,
- it writes node content to `content/nodes/*.html`,
- it has a live integrity linter, a cold-start fog-of-war preview, and a
  visual diff between iterations.

**Publishing** is deliberately dumb: the deployed graph is *whatever bytes are
in the repo-root `graph.json`*. The studio's "Save & deploy" writes there;
pushing to GitHub publishes it. `graphs/` keeps the version history of
iterations; `git log graph.json` is the deploy history.

## Project layout

```
index.html            # the site entry point
style.css             # all site styling
graph.json            # THE DEPLOYED GRAPH — single source of truth for the live site
js/                    # the site (vanilla ES modules, D3 via CDN)
  main.js              # wires everything together
  graph.js             # D3 force sim, rendering, seed-then-drift, class colors
  discovery.js         # fog-of-war state (visited / discovered)
  travel.js            # node-to-node traversal animation
  content.js           # the expanding content cards
content/nodes/*.html   # per-node HTML fragments (file-backed node content)
graphs/                # version-controlled graph iterations (see graphs/README.md)
studio/                # local graph design studio (Vite/React, NOT deployed)
tools/gen_sparse*.py   # legacy auto-generators, superseded by the studio
CLAUDE.md              # the deep reference (architecture, schema, devlog)
```

### How the graph is described

`graph.json` has three parts:

- `config` — simulation tuning, the `startNode`, and a **class hierarchy**
  (a tree of named classes rooted at `all`; each `{ parent, color? }`). A
  node's color resolves up the parent chain to the nearest ancestor with a
  color. Class behavior beyond color is intentionally minimal for now.
- `nodes` — `{ id, label, class, x, y, content, r, hint?, mass? }`. Positions
  are authored; the live site seeds its simulation from them and then drifts.
  `content` is a path (fetched as HTML), an inline string, or `null`.
- `edges` — `{ source, target, length?, weight? }`. `length` is an optional
  authored distance; omit it and the edge follows node placement.

## For agents and contributors

**[`CLAUDE.md`](CLAUDE.md) is the canonical reference.** It contains the full
architecture, the exact schema, the design rationale, the per-class color
model, and a session-by-session devlog. Read it before changing the site or
the schema. Its top section is the owner's design intent (do not edit that);
the rest is maintained for whoever — human or agent — works on this next.

Two rules worth stating up front:

1. The deployed site is plain static files. Keep it buildless and
   dependency-light. The studio is the only place Node/tooling lives, and it
   never ships.
2. The graph is composed, not generated. Author it in the studio; don't
   resurrect the old `tools/gen_sparse*.py` generators.
