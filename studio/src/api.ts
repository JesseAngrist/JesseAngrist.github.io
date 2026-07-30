import type { Graph } from './types';

async function j<T>(r: Response): Promise<T> {
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json() as Promise<T>;
}

export const api = {
  listGraphs: () =>
    fetch('/api/graphs').then(j<{ files: { name: string; active: boolean }[]; hasRoot: boolean }>),

  loadGraph: (file: string) =>
    fetch(`/api/graph?file=${encodeURIComponent(file)}`).then(j<{ graph: Graph }>),

  saveGraph: (name: string, graph: Graph, deploy = false) =>
    fetch('/api/graph', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, graph, deploy }),
    }).then(j<{ ok: boolean; deployed: boolean }>),

  loadContent: (id: string) =>
    fetch(`/api/content?id=${encodeURIComponent(id)}`).then(
      j<{ md: string; exists: boolean }>,
    ),

  saveContent: (id: string, md: string) =>
    fetch('/api/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, md }),
    }).then(j<{ ok: boolean }>),

  contentList: () => fetch('/api/content-list').then(j<{ ids: string[] }>),
};
