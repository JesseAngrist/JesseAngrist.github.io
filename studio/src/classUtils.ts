import type { ClassDef, Graph } from './types';

export const FALLBACK_COLOR = '#999999';

// First `color` found walking from `name` toward the root.
export function resolveColor(
  classes: Record<string, ClassDef>,
  name: string | null | undefined,
): string {
  let n = name as string | null | undefined;
  let guard = 0;
  while (n && guard++ < 64) {
    const c = classes[n];
    if (!c) break;
    if (c.color) return c.color;
    n = c.parent;
  }
  return FALLBACK_COLOR;
}

export interface ClassNode {
  name: string;
  depth: number;
  resolved: string;
  ownColor?: string;
}

// Depth-first ordered list of classes (root first), for tree rendering.
export function classTree(classes: Record<string, ClassDef>): ClassNode[] {
  const childrenOf: Record<string, string[]> = {};
  let root: string | null = null;
  for (const [name, def] of Object.entries(classes)) {
    if (def.parent == null) {
      if (root == null) root = name;
    } else {
      (childrenOf[def.parent] ||= []).push(name);
    }
  }
  const out: ClassNode[] = [];
  const seen = new Set<string>();
  const walk = (name: string, depth: number) => {
    if (seen.has(name)) return; // guard against cycles
    seen.add(name);
    out.push({
      name,
      depth,
      resolved: resolveColor(classes, name),
      ownColor: classes[name]?.color,
    });
    (childrenOf[name] || []).sort().forEach((c) => walk(c, depth + 1));
  };
  if (root) walk(root, 0);
  // Append any classes unreachable from the root (broken hierarchy) so they
  // are still editable/visible.
  for (const name of Object.keys(classes)) {
    if (!seen.has(name)) out.push({ name, depth: 0, resolved: resolveColor(classes, name) });
  }
  return out;
}

export function descendants(
  classes: Record<string, ClassDef>,
  name: string,
): string[] {
  const out: string[] = [];
  const stack = [name];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const [n, d] of Object.entries(classes)) {
      if (d.parent === cur && !out.includes(n)) {
        out.push(n);
        stack.push(n);
      }
    }
  }
  return out;
}

// Mirrors js/content.js: a path-looking string is fetched; anything else is
// inline content.
export function isContentPath(s: unknown): boolean {
  if (typeof s !== 'string') return false;
  const v = s.trim();
  return /\.html?$/i.test(v) || v.startsWith('content/');
}

export function edgeKey(s: string, t: string) {
  return `${s}|${t}`;
}

export function emptyGraph(): Graph {
  return {
    config: {
      startNode: 'about',
      travelSpeed: 110.5,
      alphaTarget: 0.04,
      velocityDecay: 0.55,
      chargeStrength: 26,
      linkDistance: 20,
      centerStrength: 0.02,
      anchorStrength: 0.015,
      driftAlpha: 0.06,
      seedAlpha: 0.3,
      edgeLengthScale: 1.0,
      classes: {
        all: { parent: null, color: '#bbb4a8' },
        core: { parent: 'all', color: '#4a7c8c' },
        content: { parent: 'all', color: '#7c6e8a' },
        reference: { parent: 'all', color: '#8a7c4a' },
      },
      meta: { sourceIteration: 'graph.json', generated: new Date().toISOString().slice(0, 10) },
    },
    nodes: [],
    edges: [],
  };
}
