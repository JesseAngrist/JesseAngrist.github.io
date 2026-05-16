export interface ClassDef {
  parent: string | null;
  color?: string;
}

export interface NodeT {
  id: string;
  label: string;
  class: string;
  x: number;
  y: number;
  content: string | null;
  r: number;
  hint?: string | null;
  mass?: number;
}

export interface EdgeT {
  source: string;
  target: string;
  length?: number;
  weight?: number;
}

export interface GraphConfig {
  startNode: string;
  classes: Record<string, ClassDef>;
  meta?: Record<string, unknown>;
  [k: string]: unknown;
}

export interface Graph {
  config: GraphConfig;
  nodes: NodeT[];
  edges: EdgeT[];
}

export type Mode = 'select' | 'addNode' | 'addEdge';

export interface Selection {
  kind: 'node' | 'edge' | 'class' | null;
  id: string | null; // node id, "src|tgt" for edge, class name
}
