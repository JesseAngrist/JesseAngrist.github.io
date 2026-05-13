#!/usr/bin/env python3
"""
Sparse node network generator.
Reads graph.json, adds a network of sparse nodes, writes result to stdout.

Usage:
  python3 tools/gen_sparse.py \
    --attach about,writing,projects,curiosities \
    --count 30 \
    --mass-min 2.8 --mass-max 5.5 \
    --prefix void- \
    > /tmp/new_graph.json

Inspect /tmp/new_graph.json and copy into graph.json if satisfied.
Add --seed N for a reproducible result.
"""

import json, random, argparse, sys, pathlib


def generate(attach_ids, count, prefix, mass_min, mass_max,
             weight_min, weight_max, texts):
    nodes, edges = [], []
    available = list(attach_ids)

    for i in range(count):
        nid = f"{prefix}{i+1:02d}"
        mass = round(mass_min + random.random() * (mass_max - mass_min), 1)
        r    = round(3.5 + random.random() * 2.5, 1)
        text = random.choice(texts) if texts and random.random() < 0.3 else ""

        nodes.append({
            "id": nid, "label": "", "type": "sparse",
            "colorClass": "node-sparse", "hint": None,
            "contentSrc": None, "sparseText": text,
            "mass": mass, "r": r
        })

        # Primary parent: recent frontier for organic outward growth
        frontier = available[-min(6, len(available)):]
        parent = random.choice(frontier)
        w = round(weight_min + random.random() * (weight_max - weight_min), 2)
        edges.append({"source": parent, "target": nid, "weight": w})

        # Extra cross-edges: ~40% get 1 extra, ~15% get 2 — creates network mesh
        extra = 0
        r2 = random.random()
        if r2 < 0.15 and len(available) > 1:
            extra = 2
        elif r2 < 0.40 and len(available) > 1:
            extra = 1

        for _ in range(extra):
            pool = [x for x in available if x != parent]
            if pool:
                other = random.choice(pool[-8:])
                edges.append({"source": other, "target": nid,
                               "weight": round(weight_min + random.random() * (weight_max - weight_min), 2)})

        available.append(nid)
        if len(available) > 12:
            available.pop(0)

    return nodes, edges


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--attach', default='about',
                   help='Comma-separated IDs of existing nodes to attach to')
    p.add_argument('--count', type=int, default=25)
    p.add_argument('--mass-min', type=float, default=2.8)
    p.add_argument('--mass-max', type=float, default=5.5)
    p.add_argument('--weight-min', type=float, default=1.2)
    p.add_argument('--weight-max', type=float, default=2.5)
    p.add_argument('--prefix', default='void-')
    p.add_argument('--texts', nargs='*', default=[
        "an empty hall", "the tide was here", "marked in charcoal",
        "the light is different here", "a long corridor",
        "", "", "", "", ""
    ])
    p.add_argument('--seed', type=int, default=None,
                   help='Fix random seed for reproducible output')
    p.add_argument('--graph', default='graph.json',
                   help='Path to graph.json (default: graph.json)')
    args = p.parse_args()

    if args.seed is not None:
        random.seed(args.seed)

    graph_path = pathlib.Path(args.graph)
    data = json.loads(graph_path.read_text())

    existing_ids = {n['id'] for n in data['nodes']}
    attach_ids = [x.strip() for x in args.attach.split(',')
                  if x.strip() in existing_ids]
    if not attach_ids:
        print(f"Error: none of --attach IDs found in {args.graph}", file=sys.stderr)
        sys.exit(1)

    new_nodes, new_edges = generate(
        attach_ids, args.count, args.prefix,
        args.mass_min, args.mass_max, args.weight_min, args.weight_max,
        args.texts
    )

    data['nodes'].extend(new_nodes)
    data['edges'].extend(new_edges)
    print(json.dumps(data, indent=2))


if __name__ == '__main__':
    main()
