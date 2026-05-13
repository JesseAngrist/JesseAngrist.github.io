#!/usr/bin/env python3
"""
Radial sparse node generator — grows evenly from a source node.

Unlike gen_sparse.py (which tends to drift in one direction), this tool
distributes new sparse nodes across multiple arms anchored to the source
node's existing neighbors. Each arm grows independently outward, so the
sparse region expands in as many directions as the source node has connections.

Usage:
  python3 tools/gen_sparse_radial.py \
    --source about \
    --count 40 \
    --prefix void2- \
    --depth 4 \
    --seed 7 \
    > /tmp/new_graph.json

  Then inspect and copy into graph.json if satisfied.

Options:
  --source         Existing node ID to expand from (default: about)
  --count          Total sparse nodes to add (distributed across arms)
  --depth          Max chain depth per arm (default: 4)
  --prefix         ID prefix for new nodes (default: void-)
  --mass-min/max   Sparse node mass range (default: 2.8–5.2)
  --cross-edges    Fraction of nodes to receive an extra cross-arm edge
                   (default: 0.25, i.e. 25%)
  --seed           Fix random seed for reproducibility
  --graph          Path to graph.json (default: graph.json)
"""

import json, random, argparse, pathlib, sys
from collections import defaultdict


def get_neighbors(node_id, edges):
    """Return all neighbor IDs of node_id (undirected)."""
    neighbors = set()
    for e in edges:
        s, t = e['source'], e['target']
        if s == node_id:
            neighbors.add(t)
        elif t == node_id:
            neighbors.add(s)
    return list(neighbors)


def generate_radial(source_id, arm_seeds, count, depth, prefix,
                    mass_min, mass_max, weight_min, weight_max,
                    cross_edge_frac):
    """
    Grow `count` sparse nodes from `source_id`, distributed across `arm_seeds`.
    Each arm seed is an existing neighbor of source — this grounds each arm in
    a different part of the graph, encouraging radial spread.

    If there are fewer arm seeds than desired arms, arms are wrapped around.
    """
    nodes, edges = [], []
    n_arms = max(len(arm_seeds), 1)
    nodes_per_arm = count // n_arms
    extra = count % n_arms

    # arm_id → list of node IDs currently at the frontier of that arm
    arm_frontiers = {i: [arm_seeds[i % len(arm_seeds)]] for i in range(n_arms)}
    # All nodes added so far (for cross-edges)
    all_added = []

    node_counter = [0]

    def new_node(arm_idx, depth_level):
        node_counter[0] += 1
        nid = f"{prefix}{node_counter[0]:02d}"
        m = round(mass_min + random.random() * (mass_max - mass_min), 1)
        # Deeper nodes get slightly higher mass (pushed further out)
        m = round(min(m + depth_level * 0.2, mass_max + 0.5), 1)
        r = round(3.5 + random.random() * 2.5, 1)
        texts = [
            "a long corridor", "the tide was here", "marked in charcoal",
            "the light is different here", "an empty hall",
            "", "", "", "", ""  # blanks weighted higher
        ]
        text = random.choice(texts) if random.random() < 0.28 else ""
        nodes.append({
            "id": nid, "label": "", "type": "sparse",
            "colorClass": "node-sparse", "hint": None,
            "contentSrc": None, "sparseText": text,
            "mass": m, "r": r
        })
        return nid

    for arm_idx in range(n_arms):
        arm_count = nodes_per_arm + (1 if arm_idx < extra else 0)
        frontier = list(arm_frontiers[arm_idx])
        arm_nodes = []

        for step in range(arm_count):
            depth_level = step // max(len(frontier), 1) + 1
            parent = frontier[step % len(frontier)]
            nid = new_node(arm_idx, depth_level)
            w = round(weight_min + random.random() * (weight_max - weight_min), 2)
            edges.append({"source": parent, "target": nid, "weight": w})
            # Advance frontier: replace oldest entry every ~depth steps
            if len(frontier) < depth or step % depth == depth - 1:
                frontier.append(nid)
            if len(frontier) > depth + 1:
                frontier.pop(0)
            arm_nodes.append(nid)
            all_added.append((arm_idx, nid))

    # Cross-edges: randomly link nodes from different arms at similar depths
    n_cross = int(len(all_added) * cross_edge_frac)
    if len(all_added) > 2:
        pool = list(all_added)
        for _ in range(n_cross):
            a = random.choice(pool)
            b = random.choice(pool)
            if a[0] != b[0] and a[1] != b[1]:  # different arms, different nodes
                w = round(weight_min + random.random() * (weight_max - weight_min), 2)
                edges.append({"source": a[1], "target": b[1], "weight": w})

    return nodes, edges


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--source', default='about')
    p.add_argument('--count', type=int, default=30)
    p.add_argument('--depth', type=int, default=4,
                   help='Max chain length per arm before branching')
    p.add_argument('--prefix', default='void-')
    p.add_argument('--mass-min', type=float, default=2.8)
    p.add_argument('--mass-max', type=float, default=5.2)
    p.add_argument('--weight-min', type=float, default=1.1)
    p.add_argument('--weight-max', type=float, default=2.3)
    p.add_argument('--cross-edges', type=float, default=0.25,
                   help='Fraction of nodes to receive cross-arm edges')
    p.add_argument('--seed', type=int, default=None)
    p.add_argument('--graph', default='graph.json')
    args = p.parse_args()

    if args.seed is not None:
        random.seed(args.seed)

    graph_path = pathlib.Path(args.graph)
    data = json.loads(graph_path.read_text())

    existing_ids = {n['id'] for n in data['nodes']}
    if args.source not in existing_ids:
        print(f"Error: --source '{args.source}' not found in {args.graph}", file=sys.stderr)
        sys.exit(1)

    # Get the neighbors of source as arm seeds
    arm_seeds = get_neighbors(args.source, data['edges'])
    arm_seeds = [s for s in arm_seeds if s in existing_ids]

    if not arm_seeds:
        print(f"Warning: '{args.source}' has no neighbors — using it as the sole arm seed",
              file=sys.stderr)
        arm_seeds = [args.source]

    print(f"[gen_sparse_radial] source='{args.source}' → {len(arm_seeds)} arms: {arm_seeds}",
          file=sys.stderr)

    new_nodes, new_edges = generate_radial(
        args.source, arm_seeds, args.count, args.depth, args.prefix,
        args.mass_min, args.mass_max, args.weight_min, args.weight_max,
        args.cross_edges
    )

    data['nodes'].extend(new_nodes)
    data['edges'].extend(new_edges)

    print(f"[gen_sparse_radial] added {len(new_nodes)} nodes, {len(new_edges)} edges "
          f"(total: {len(data['nodes'])} nodes, {len(data['edges'])} edges)",
          file=sys.stderr)

    print(json.dumps(data, indent=2))


if __name__ == '__main__':
    main()
