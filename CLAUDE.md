USER SECTION: AGENTS DO NOT EDIT UNTIL "AGENTS SECTION"

This directory contains my *static, personal GitHub Pages site.* It is meant to be much more personal, expressive, interactive, and multipurpose than my previous site. This document should be your reference point for its artistic design and architecture

I'm not looking for this to be purely professional. In fact, it should only feel *incidentally* professional, like a future employer looking at it would be impressed, but only by my force of character and what I find interesting. The vibe should be that this website could only have been created by this guy.

Here's a good personal website model, which inspires me, although you shouldn't take any given element of it as inspiration: https://aliciaguo.com/ - I like that this site is highly navigable, caters to friends, strangers, and professional interests, has devoted a majority of its space to art, has a unique color scheme and background that "only she" would choose, and has a **nonlinear structure which rewards exploration**

My principal idea is this: it is an (off-)white background with some kind of graph, the mathematical kind with nodes and edges. It should be visually elegant and crisp, where nodes represent meaningful units of the site that one can visit. Importantly, the parts of the graph that the users can't see should be hidden to them until they explore. I would like the graph to be "floppy," or rather, it shouldn't be inanimate; anything to indicate that it isn't static, but in motion. The structure of the graph, though, being the architecture of the site, will likely have to remain constant. I don't know to what extent this would be possible if the connections between nodes are fixed, but it would be cool if the graph was oriented in a different way each time you loaded the site; similar enough to be recognizable, different enough to have novel texture.

The user will start in some kind of "about" node which may be kind of sparse - it'll quickly lead them to neighboring nodes where one can learn more about me in standard ways (akin to the tabs of the old_website), which should branch further out to new nodes in the graph. Nodes should be color coded in a simple, memorable way, with nothing too obnoxious. I'm envisioning a significant number of nodes to serve as references to other things; poetry, articles, movies, songs, that I treasure. Moreover, I'm imagining large parts of the graph are "sparse," nodes with no or only barren content, which create distance and a sense of "landscape" that the user explores. I guess those nodes will need to be "nonbarren" enough that they provide landmarks so users don't literally get lost. The goal is to actively reward a thorough exploration of the site, while keeping "critical" information pretty easily available. I think traversing between the nodes should take "travel time" proportional to their distance, to introduce some artificial difficulty to exploration.

A kind of stylistic inspiration here is the setup in Susanna Clarke's fantasy novel Piranesi, where the protagonist lives in a nigh-infinite complex of rooms, whose topography he has intimate knowledge of. There are also periodic floods. Don't lean on this imagery too hard, but have it in the back of your head, like I do. 

As far as software architecture goes, this setup is obviously highly amenable to modular design. That is, it should be easy to add nodes at a specific place in the graph, and you should also create tooling to create "sparse" or "barren" regions of the graph in a directed way. Anticipate that I might want to toy with this graph structure more (a la the way Alicia Guo has a "roof" and "basement" to her otherwise semi traditional site structure). 

Be liberal about leaving notes for yourself in the section below. Oftentimes I will not be the one adding nodes (unless they're particularly special) and instead you or another agent will, so make sure it's obvious to everyone how to do so.




AGENTS SECTION: USERS WILL NOT INTERACT WITH THIS SECTION

---

## Architecture Overview

This is a static GitHub Pages site — no build step, no framework, no bundler. The entire thing loads from `index.html` and a set of ES module JS files.

**The graph is the navigation.** There is no navbar, no routes, no URL changes (yet). Users travel between nodes, which are HTML content cards that expand in place on the SVG canvas.

### File roles

| File | Role |
|------|------|
| `graph.json` | **The deployed graph** (single source of truth for the live site). New schema: authored node `x`/`y`, edge `length`, and a `classes` hierarchy. Hand-authored in the studio, not edited by hand. |
| `graphs/` | Version-controlled graph iterations. The deployed graph is whatever bytes are in root `graph.json`; `graphs/*.json` are saved snapshots. See `graphs/README.md`. |
| `studio/` | **The primary authoring tool** — a local editor (run it, build the graph, deploy a snapshot to root `graph.json`). Never deployed to Pages. |
| `js/graph.js` | D3 force simulation, SVG rendering, zoom/pan, visibility updates. Seeds from authored `x`/`y` then gently drifts (anchor force). Resolves node color through the class hierarchy. Exposes `getNodePos`, `panTo`, `getConfig`, etc. |
| `js/discovery.js` | Fog-of-war state. Tracks `visited` and `discovered` Sets in memory (no persistence — every visit is cold). `arrive(id)` marks a node visited and reveals its neighbors. Pure topology — no class/type awareness. |
| `js/travel.js` | Traversal animation. Animates a traveler dot along an edge at constant pixel speed; camera follows. `canTravel(id)` checks reachability. |
| `js/content.js` | Loads and displays node content cards. The node `content` field is polymorphic: a path → fetched HTML; any other string → inline; null → `hint`/em-dash. |
| `js/main.js` | Wires everything together. The only file that imports all others. |
| `content/nodes/` | HTML partials — the inner HTML of file-backed node cards. No `<html>`, no `<body>` — just the fragment. |
| `tools/gen_sparse*.py` | **Legacy.** The old auto-generation workflow, superseded by the studio. Kept for reference only. |

### How SVG + content cards interact

The SVG renders the graph (nodes, edges, traveler). Content cards are `<div>`s in `#card-layer`, positioned absolutely at the current node's *screen* coordinates (converted from simulation space by `graph.graphToScreen()`). Cards reposition on every simulation tick so they follow the gently drifting nodes. The zoom/pan transform is applied to the SVG `<g>` group, not the SVG itself — so `d3.zoomTransform(svgEl)` gives the current transform at any time.

### Fog-of-war rules

Fog-of-war is **universal** — conceptually the behavior of the root `all` class
that every class inherits. It is uniform across all nodes (no per-class
variants today; concrete per-class behavior is hardcoded later if/when needed).

| Node state | Appearance |
|-----------|-----------|
| visited | Full color (resolved class color), label shown |
| discovered, not visited | Silhouette: class color at 0.22 opacity, no label |
| undiscovered | `opacity: 0`, still in DOM for force simulation |

`discovered` = any node adjacent to any visited node. **No persistence** —
every page load starts cold (only `startNode` visited, its neighbors
discovered). Intentional friction; the map is re-earned each visit.

---

## How to Add a Node

**Use the studio.** Run it (`studio/` — see its README), place the node on the
canvas, draw its edges, write its label and content, pick its class, then save
a snapshot and deploy it to root `graph.json`. Hand-editing `graph.json` is no
longer the workflow; the studio owns positions, edge lengths, and the class
hierarchy.

For reference, a node in the new schema looks like:

```json
{
  "id": "my-node",
  "label": "visible label",
  "class": "reference",
  "x": 1180.0,
  "y": 640.0,
  "content": "content/nodes/my-node.html",
  "r": 10.0,
  "hint": null,
  "mass": 1.5
}
```

- `class` references a class in `config.classes` (see below).
- `x`/`y` are authored simulation-space coordinates. The live site seeds the
  D3 sim from them, then a weak anchor spring keeps the layout recognizable
  while it gently drifts ("seed-then-drift").
- `content`: a path (`…​.html` or `content/…`) is fetched as the card body; any
  other non-empty string renders inline (short atmospheric text gets the
  centered/dashed treatment); `null` falls back to `hint`, then an em dash.
- Edges: `{ "source", "target", "length"?, "weight"? }`. `length` is the
  authored target distance; omit it to let the edge follow node placement.

---

## Node Classes — hierarchy & color

Classes form a **tree rooted at `all`**, declared in `config.classes`:

```json
"classes": {
  "all":       { "parent": null,  "color": "#bbb4a8" },
  "core":      { "parent": "all", "color": "#4a7c8c" },
  "reference": { "parent": "all", "color": "#8a7c4a" },
  "poem":      { "parent": "reference" }
}
```

- Every class except `all` has a `parent`; the chain must reach `all`.
- **Color resolves up the chain**: a node's color is the first `color` found
  walking from its class toward `all` (so `poem` above inherits `reference`'s
  ochre). `all` must always have a `color` (ultimate fallback).
- A node's `class` may be any class — leaf or interior. A "class of one" is
  just a class with a single member; the hierarchy already supports it.
- **Only color is implemented as a class semantic today.** Fog-of-war is the
  universal `all` behavior. Any other per-class behavior is *hardcoded later*
  against the hierarchy when a concrete case exists — don't add speculative
  capability flags to the schema.
- `js/graph.js` injects `--node-<class>: <resolvedColor>;` at init so CSS that
  references class colors keeps working though classes are user-defined.

### `mass` and `r`

`mass` (optional, default 1) scales node repulsion; with authored positions it
is a fine-tuning knob, not the primary layout driver. `r` is the node radius in
pixels (rough guide: hubs 14–18, normal 9–12, minor 5–8).

---

## How to Create a Sparse / Barren Region

In the studio, place a chain of small, content-light nodes far out on the
canvas and connect them with long edges. Distance is now *authored directly*
(node positions + edge `length`), not coaxed out of mass/charge tuning. Give
barren nodes empty or short inline `content` (a line of atmospheric text as a
landmark) so explorers aren't completely lost.

---

## Design Rationale

**Why traversal is slow on purpose.** The travel time is proportional to pixel distance, and heavier/more peripheral nodes are literally further away. This is intentional friction — inspired by Piranesi, where knowing the House means knowing how long it takes to get anywhere. Far nodes should feel *earned*. Don't reduce `travelSpeed` below ~80 or increase it above ~200 without thinking about this.

**Why fog-of-war is universal (no core exemption).** Earlier builds let `core`
nodes stay labeled when merely adjacent. That special-case was removed — every
node, regardless of class, is silhouette-until-visited. The map must be
explored to be read; nothing is handed over for free.

**Why positions are authored (seed-then-drift).** Positions are no longer
randomized at load. They are hand-placed in the studio and stored as `x`/`y`.
The site seeds the simulation from them and a weak anchor spring holds the
shape, so the layout is *recognizable every visit* — deliberate composition,
not emergent accident — while the live force sim still gives it gentle,
floppy motion. The texture now comes from authorship, not RNG.

**Why positioned `<div>`s and not SVG `foreignObject`.** `foreignObject` is inconsistently supported and hard to style across browsers. Content cards as `<div>`s get full CSS, smooth transitions, and reliable behavior. They're repositioned on every tick to follow their node.

---

## Future Ideas (not yet implemented)

- **Flood event** (Piranesi reference): A slow visual wash that temporarily dims visited nodes back toward silhouette — fades over ~10 seconds on a timer or interaction trigger. Resets the fog-of-war aesthetic without resetting state.
- **URL fragment routing** (`#node-id`): Deep-link directly to a node. On load, auto-travel to the fragment target. Lets people share specific nodes.
- **Seasonal graph mutations**: New sparse nodes appear on certain calendar dates. Implemented by conditionally including extra nodes from `graph.json` based on `new Date()`.
- **Roof / basement clusters** (à la Alicia Guo's site): A meta-layer of nodes off the main graph — accessible via a special edge from a specific node, like a portal. Could hold more experimental or personal content.
- **Node age**: Label opacity could fade slightly for nodes not visited in >N days (via `localStorage` timestamps). The graph *ages*.
- **Sound design**: Very subtle ambient tone (Web Audio API, not a file) that shifts register or timbre based on which region of the graph you're in.
- **Canvas upgrade path**: If node count grows beyond ~100, swap SVG rendering in `graph.js` for a Canvas renderer — the force simulation code in `discovery.js`, `travel.js`, and `content.js` doesn't need to change.

---

## Devlog

### Session 1 — Initial build

Built the full skeleton from scratch: `index.html`, `style.css`, `graph.json` as data source of truth, and four JS modules (`graph.js`, `discovery.js`, `travel.js`, `content.js`) wired by `main.js`. D3 v7 loaded via CDN. ES modules with no bundler (GitHub Pages compatible).

Core decisions made in this session:
- **Node-expands-in-place** as the content display model (vs. sidebar or full-screen takeover)
- **Two-tier fog of war**: `core` nodes always visible+labeled when adjacent; non-core show as silhouettes
- **Traversal highlight**: a traveler dot moves at constant pixel speed, camera follows with a slight lag; travel time is proportional to distance and intentionally slow
- **Warm off-white palette** (`#f5f2ec`) with muted teal/mauve/gold/stone for node types

Initial graph: 10 nodes — about, projects, writing, curiosities, piranesi, reed-song, and 4 linear sparse corridor nodes. `graph.json` is the only file that needs to change to add content.

First generator tool: `tools/gen_sparse.py` — attaches N sparse nodes from given attachment points with random branching.

### Session 2 — Five feedback fixes

**1. Pathfinding (BFS):** Clicking any discovered node now pathfinds via BFS through the discovered subgraph. `discovery.findPath(from, to)` returns the full node path; `travel.travelAlongPath(path)` chains legs sequentially. Intermediate arrivals call `discovery.arrive()` (so subsequent legs can proceed) but don't open a content card — only the final destination does.

**2. Path animation discrepancy:** The traveler was shooting toward where the node *was* at animation start, then diverging as the simulation drifted the nodes. Fixed by reading `srcNode.x/y` and `tgtNode.x/y` fresh on every animation frame (D3 mutates these in place). The trail line's start point also updates each frame.

**3. Zoom scale compensation:** Added partial inverse-scale compensation (`Math.pow(1/k, 0.65)`) applied on every zoom event — node circles, labels, and edges all grow slightly when zoomed out so they don't vanish. A min-scale toast ("that's as far out as it goes") fires when the user tries to zoom out past the limit.

**4. Denser layout:** Tightened `linkDistance` (90→52), `chargeStrength` (380→230), increased `centerStrength` (0.05→0.10).

**5. Radial sparse generator:** `tools/gen_sparse_radial.py` distributes sparse nodes evenly across a source node's existing neighbors as arm seeds. Each arm grows independently with configurable depth and cross-edge density, replacing the original linear-chain tendency of `gen_sparse.py`. The flag `--cross-edges 0.25` adds mesh connections between arms at random.

### Session 3 — Eight feedback fixes

**1. Node drift bounding (`_makeBoundsForce`):** A custom D3 force applies a soft wall at ±0.95× viewport from center. Nodes outside the box get a velocity correction proportional to their overshoot. Pinned nodes (undiscovered, temporarily fixed) are skipped.

**2. Pathfinding target indicator:** While `travelAlongPath` is running, the final destination node gets a `.target` CSS class that makes its `node-circle` blink via CSS animation (`target-blink` keyframe, 0.85s). Cleared in `travelAlongPath` on completion.

**3. Edge crossing reduction (BFS radial layout):** Initial node positions are no longer random. Instead, `_bfsRadialLayout()` places discovered nodes in concentric rings by BFS distance from the start node. Since edges connect adjacent rings, crossings are geometrically minimized from the start. The force simulation refines from this already-clean seed.

**4. Unknown nodes removed from simulation:** Previously, undiscovered nodes participated in the simulation with invisible edges — creating "ghost pulls" that distorted the visible graph. Fix: all undiscovered nodes start pinned at center (`n.fx = cx; n.fy = cy`) with zero charge, zero link strength, and zero collision radius (dynamic strength functions check `_discoveredSet`). On discovery, `revealNodes()` unpins them and places them near the discovering node, triggering a mild alpha bump. The graph literally grows.

**5. Zoom limit tightened:** `MIN_SCALE` raised from 0.18 → 0.46.

**6. Compass/lighthouse:** When the `about` node drifts off-screen, a pill-shaped indicator (`#compass`) appears at the screen edge pointing toward it (arrow rotates, `atan2` geometry). Clicking navigates home via pathfinding. Fades when `about` returns to view. Updated every simulation tick.

**7. Sharper sparse node distinction:** Discovered-but-unvisited sparse nodes now render as **outline rings** (stroke only, no fill). Visited sparse nodes are semi-transparent filled dots. Non-sparse silhouettes remain at 0.22 opacity. The distinction between "I've been here (empty)" and "I haven't been here" is now unambiguous.

**8. Radial generator:** `tools/gen_sparse_radial.py` replaced the previous linear graph with a 44-node, 48-edge network distributed across 3 arms (anchored to `projects`, `writing`, `curiosities`), with 25% cross-arm mesh edges. Current `graph.json` is the output of `--source about --count 38 --depth 5 --seed 31`.

### Known bugs fixed this session

- **`_makeBoundsForce` crash during pre-run:** The bounds force closed over `graphData._nodes`, but `graphData._nodes` is set *after* the 300-tick silent pre-run. Fix: `_makeBoundsForce(nodesRef)` now takes the nodes array directly as a parameter, avoiding the ordering dependency entirely.

### Current graph.json state (end of session 3)

44 nodes total: 3 core (`about`, `projects`, `writing`), 1 content (`curiosities`), 2 reference (`piranesi`, `reed-song`), 38 sparse (`void-01` through `void-38`). 48 edges. Generated with `gen_sparse_radial.py --source about --count 38 --depth 5 --seed 31`. Config: `linkDistance: 52`, `chargeStrength: 230`, `centerStrength: 0.10`, `travelSpeed: 130`.

### Session 4 — Exploration polish

**1. No session persistence.** Removed `sessionStorage` save/restore from `discovery.js` entirely. Every visit starts cold — only `about` visited, only its immediate neighbors discovered. Intentional friction; the graph must be re-earned each time.

**2. Hover response.** All node circles respond to hover with `brightness(1.25)` on a 0.12s ease, giving the graph tactile responsiveness without adding UI chrome.

**3. Zoom clamped to 0.75–1.0.** Removed scale compensation (`_compensateScale`) entirely — nodes and edges now scale exactly in proportion to the zoom transform. The zoom window is tight: you can only pull back 25%, no zooming in past default. The toast still fires at the zoom floor.

**4. Scale compensation removed.** Previously nodes/edges counter-scaled on zoom. Now they scale proportionally with D3's transform — cleaner and more readable.

**5. Sparse mesh denser.** Regenerated sparse region with `--depth 3 --cross-edges 0.55 --seed 17`. Old graph had ~10 cross-edges; new has 50, avg degree 2.63. Still 44 nodes total.

**6. Sparse node spacing fixed.** Root cause: `chargeStrength * mass` was giving sparse nodes (mass 3–5) repulsion of up to −230, overwhelming the 10px link distance target. Fix: sparse nodes now get a flat −8 charge regardless of mass. Their peripheral position is maintained by the long arm link distances (core→sparse edges still use avgMass scaling), not by mutual repulsion. Core node link distance raised back to `linkDistance: 20`; `sparseLinkDistance: 10` added as a separate config key for sparse-sparse edges.

**7. Edge visibility rule tightened.** Edges now render only when at least one endpoint has been **visited** (not just discovered). Previously, discovering node B from visiting A would cascade B's edges into view — revealing B's connection to, say, `writing` — even if you'd never been near either. The new rule: `visitedSet.has(s) || visitedSet.has(t)`.

**8. Core nodes democratized.** Removed the special rule that gave `core` nodes full color and labels when merely adjacent to a visited node. All nodes — core included — are now equal: silhouette when discovered, full appearance only when visited. The user must explore to find everything.

**9. All nodes and edges 33% larger.** Node `r` values in `graph.json` multiplied by 1.33. Edge stroke widths scaled up in `style.css` (1.5→2px base, 2→2.7px reachable). Traveler dot 5→7px.

**10. Visited nodes breathe.** A CSS keyframe animation (`node-breathe`, 7s, alternate) applies a slow 1.0→1.18 scale pulse to visited node circles. The explored territory feels alive.

**11. Ambient stir.** A `setInterval` (3.8s) in `graph.js` nudges one random discovered node with a small random velocity (±1.1 px/tick). The simulation never fully settles. Keeps the graph feeling like a living place rather than a static diagram.

### Current graph.json state (end of session 4)

44 nodes total (unchanged). 61 edges. Config: `linkDistance: 20`, `sparseLinkDistance: 10`, `chargeStrength: 46`, `centerStrength: 0.10`, `travelSpeed: 130`. Sparse region regenerated with `gen_sparse_radial.py --graph /tmp/base_graph.json --source about --count 38 --depth 3 --cross-edges 0.55 --seed 17`.

### Session 5 — Authoring pivot: hand-built graph + design studio

The big direction change: **auto-generation is dead.** The graph is now
hand-authored in a local **design studio** (`studio/`), which is the primary
way the site is created. `tools/gen_sparse*.py` are legacy.

**1. New `graph.json` schema.** Nodes carry authored `x`/`y` and a single
polymorphic `content` field; edges carry an optional authored `length`.
`type`/`colorClass`/`contentSrc`/`sparseText` are gone.

**2. Hierarchical classes replace `type`.** `config.classes` is a tree rooted
at `all`; each class is `{ parent, color? }`. Color resolves up the parent
chain. Fog-of-war is the universal `all` behavior. Concrete per-class behavior
is intentionally *not* designed yet — hardcode it later against the hierarchy
when a real case exists (no speculative capability flags).

**3. Seed-then-drift (`js/graph.js`).** Deleted `_bfsRadialLayout`. The sim now
seeds from authored `x`/`y` (captured as `_ax/_ay` per node before
center-pinning undiscovered ones). New `_makeAnchorForce` is a weak spring
toward each node's authored anchor. `forceLink.distance` uses authored edge
`length` (or derived from authored positions). Sparse charge/`sparseLinkDistance`
special cases removed. Alpha lifecycle: no silent pre-run; one visible
`seedAlpha` settle, then steady `driftAlpha`. New config keys: `anchorStrength`,
`driftAlpha`, `seedAlpha`, `edgeLengthScale`. `chargeStrength` 46→26,
`centerStrength` 0.10→0.02. `revealNodes` now spawns nodes at the discovering
node and lets the anchor+link forces glide them to their authored slot.

**4. Class color resolution.** `_resolveColor`/`_classColor` walk the hierarchy;
`_injectClassColors` writes `--node-<class>` CSS vars at init. All
`var(--${colorClass})` usages replaced. `applyVisibility` simplified to uniform
fog (no sparse outline branch).

**5. `js/content.js`.** `_loadContent` dispatches on the `content` field
(path → fetch, string → inline, null → hint). `.sparse-card` styling now keyed
on "is the content inline" rather than `type === 'sparse'`.

**6. No migration.** The old 44-node generated graph was discarded. Root
`graph.json` is now a minimal new-schema starter (classes `all`/`core`/
`content`/`reference`; one node `about`). The real graph is rebuilt in the
studio. Iterations live in `graphs/`; the deployed graph is whatever is in
root `graph.json`.

**7. The studio (`studio/`).** Local editor: stationary canvas (place/move
nodes, draw edges), hierarchical class editor (tree + colors + inheritance),
node inspector (label/class/content/r/hint/mass), live integrity linter, lite
static fog preview, snapshots + visual diff, deploy-to-root. Saves via a tiny
local server handling `/api/*` file writes. (Stack finalized with the user;
build pending Node.js availability on the machine.)

`js/discovery.js` and `js/travel.js` unchanged (pure topology/geometry).

### Current graph.json state (start of session 5)

Minimal new-schema starter: 4 classes (`all`, `core`, `content`, `reference`),
1 node (`about`, class `core`), 0 edges. Config: `chargeStrength: 26`,
`linkDistance: 20`, `centerStrength: 0.02`, `anchorStrength: 0.05`,
`driftAlpha: 0.035`, `seedAlpha: 0.3`, `edgeLengthScale: 1.0`,
`travelSpeed: 130`. The real graph is authored in the studio.