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
| `graph.json` | **Single source of truth.** All nodes, edges, and simulation config live here. Editing this file is how you change the site structure. |
| `js/graph.js` | D3 force simulation, SVG rendering, zoom/pan, visibility updates. Exposes `getNodePos`, `panTo`, `boostRepulsionAround`, etc. |
| `js/discovery.js` | Fog-of-war state. Tracks `visited` and `discovered` Sets in `sessionStorage`. `arrive(id)` marks a node visited and reveals its neighbors. |
| `js/travel.js` | Traversal animation. Animates a traveler dot along an edge at constant pixel speed; camera follows. `canTravel(id)` checks reachability. |
| `js/content.js` | Loads and displays node content cards. Cards are absolutely-positioned `<div>`s that scale in over the node. Content is fetched from `content/nodes/*.html` and cached. |
| `js/main.js` | Wires everything together. The only file that imports all others. |
| `content/nodes/` | HTML partials — the inner HTML of each node card. No `<html>`, no `<body>` — just the content fragment. |

### How SVG + content cards interact

The SVG renders the graph (nodes, edges, traveler). Content cards are `<div>`s in `#card-layer`, positioned absolutely at the current node's *screen* coordinates (converted from simulation space by `graph.graphToScreen()`). Cards reposition on every simulation tick so they follow the gently drifting nodes. The zoom/pan transform is applied to the SVG `<g>` group, not the SVG itself — so `d3.zoomTransform(svgEl)` gives the current transform at any time.

### Fog-of-war rules

| Node state | Appearance |
|-----------|-----------|
| visited | Full color, label shown |
| discovered + type `core` | Full color, label shown (core nodes are always readable once in range) |
| discovered + type ≠ `core` | Silhouette: shape at 0.22 opacity, no label |
| undiscovered | `opacity: 0`, still in DOM for force simulation |

`discovered` = any node adjacent to any visited node. Discovery persists in `sessionStorage` across page loads.

---

## How to Add a Node

**Step 1**: Add to `graph.json` → `nodes[]`:

```json
{
  "id": "my-node",
  "label": "visible label",
  "type": "content",
  "colorClass": "node-content",
  "hint": "shown as tooltip someday",
  "contentSrc": "content/nodes/my-node.html",
  "mass": 1.5,
  "r": 10
}
```

**Step 2**: Add at least one edge to `graph.json` → `edges[]`:

```json
{ "source": "some-existing-node", "target": "my-node", "weight": 1.0 }
```

**Step 3**: Create `content/nodes/my-node.html` — just an HTML fragment, no boilerplate:

```html
<h2>My Node</h2>
<p>Content here.</p>
```

That's it. The node will appear, be discovered when the user visits a neighbor, and show the card on arrival.

---

## Node Types — Quick Reference

| type | colorClass | visibility | contentSrc |
|------|-----------|-----------|-----------|
| `core` | `node-core` | Always labeled when adjacent to any visited node | Required — rich HTML content |
| `content` | `node-content` | Silhouette until visited | Required |
| `reference` | `node-reference` | Silhouette until visited | Required — typically a short stub or external link |
| `sparse` | `node-sparse` | Silhouette until visited | Omit — uses `sparseText` field instead |

### `mass` and peripheral placement

`mass` directly scales the repulsion force applied to a node:
- `mass: 1.0–1.5` → clusters near center
- `mass: 2.0–2.5` → mid-distance
- `mass: 3.0–5.0` → pushed to periphery (use for sparse/corridor nodes)

Higher mass also increases the `forceLink` distance, so edges to heavy nodes are longer. This naturally creates large spatial gaps in barren regions.

### `r` (node radius in pixels)

- `core` nodes: 12–15
- `content` nodes: 9–12
- `reference` nodes: 7–9
- `sparse` nodes: 4–7

---

## How to Create a Sparse / Barren Region

Chain several sparse nodes together off a peripheral node, with escalating `mass` values:

```json
nodes: [
  { "id": "far-1", "type": "sparse", "mass": 3.5, "r": 6, "sparseText": "the air is different here", ... },
  { "id": "far-2", "type": "sparse", "mass": 4.5, "r": 5, "sparseText": "", ... },
  { "id": "far-3", "type": "sparse", "mass": 5.5, "r": 4, "sparseText": "", ... }
],
edges: [
  { "source": "some-peripheral-node", "target": "far-1", "weight": 2.5 },
  { "source": "far-1", "target": "far-2", "weight": 3.0 },
  { "source": "far-2", "target": "far-3", "weight": 3.5 }
]
```

Leave `sparseText` as `""` for nodes that are truly empty — the card shows nothing, just a dashed border. Use short atmospheric text sparingly for landmarks so users aren't completely lost.

---

## Design Rationale

**Why traversal is slow on purpose.** The travel time is proportional to pixel distance, and heavier/more peripheral nodes are literally further away. This is intentional friction — inspired by Piranesi, where knowing the House means knowing how long it takes to get anywhere. Far nodes should feel *earned*. Don't reduce `travelSpeed` below ~80 or increase it above ~200 without thinking about this.

**Why core nodes are always labeled from neighbors.** The résumé-relevant stuff (projects, writing) should be reliably findable even by a stranger who doesn't want to explore. Core nodes break the fog of war rule to serve as navigation anchors. Sparse and reference nodes don't need this.

**Why positions randomize each load.** The graph topology (connections) is fixed in `graph.json`, but `Math.random()` seeds the initial x/y positions before the simulation runs. The same structure reads differently each visit — some routes feel shorter, some longer, clusters form in different corners. This gives the site *texture* that static navigation lacks.

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