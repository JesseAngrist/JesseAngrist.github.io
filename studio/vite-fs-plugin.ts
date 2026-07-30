// vite-fs-plugin.ts — the "tiny local save server".
// Dev-only Vite middleware that reads/writes the site's graph + content files.
// Resolves everything relative to the repo root (one level above studio/).
// Never shipped: this only runs under `vite` dev.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');
const GRAPHS_DIR = path.join(REPO_ROOT, 'graphs');
const ROOT_GRAPH = path.join(REPO_ROOT, 'graph.json');
const CONTENT_DIR = path.join(REPO_ROOT, 'content', 'nodes');

const SAFE_NAME = /^[a-zA-Z0-9._-]+$/;

function send(res: any, code: number, body: unknown) {
  const json = JSON.stringify(body);
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
  res.end(json);
}

function readBody(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c: Buffer) => (data += c));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function hash(s: string) {
  return crypto.createHash('sha1').update(s).digest('hex');
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function fsPlugin(): Plugin {
  return {
    name: 'graph-studio-fs',
    configureServer(server) {
      server.middlewares.use('/api', async (req, res) => {
        try {
          const url = new URL(req.url || '', 'http://localhost');
          const route = url.pathname.replace(/^\/api/, '') || '/';
          const method = (req.method || 'GET').toUpperCase();

          // ── GET /graphs : list snapshots, flag the active one ──────────────
          if (route === '/graphs' && method === 'GET') {
            ensureDir(GRAPHS_DIR);
            const rootHash = fs.existsSync(ROOT_GRAPH)
              ? hash(fs.readFileSync(ROOT_GRAPH, 'utf8'))
              : null;
            const files = fs
              .readdirSync(GRAPHS_DIR)
              .filter((f) => f.endsWith('.json'))
              .map((f) => {
                const raw = fs.readFileSync(path.join(GRAPHS_DIR, f), 'utf8');
                return { name: f.replace(/\.json$/, ''), active: hash(raw) === rootHash };
              });
            return send(res, 200, { files, hasRoot: !!rootHash });
          }

          // ── GET /graph?file=NAME (or __root__) : read a graph ─────────────
          if (route === '/graph' && method === 'GET') {
            const file = url.searchParams.get('file') || '__root__';
            let target: string;
            if (file === '__root__') {
              target = ROOT_GRAPH;
            } else {
              if (!SAFE_NAME.test(file)) return send(res, 400, { error: 'bad name' });
              target = path.join(GRAPHS_DIR, `${file}.json`);
            }
            if (!fs.existsSync(target)) return send(res, 404, { error: 'not found' });
            return send(res, 200, {
              graph: JSON.parse(fs.readFileSync(target, 'utf8')),
            });
          }

          // ── POST /graph : write a snapshot; optionally deploy to root ─────
          if (route === '/graph' && method === 'POST') {
            const body = await readBody(req);
            const name: string = body.name;
            const graph = body.graph;
            const deploy: boolean = !!body.deploy;
            if (!name || !SAFE_NAME.test(name))
              return send(res, 400, { error: 'bad or missing name' });
            if (!graph || typeof graph !== 'object')
              return send(res, 400, { error: 'missing graph' });
            ensureDir(GRAPHS_DIR);
            const text = JSON.stringify(graph, null, 2) + '\n';
            fs.writeFileSync(path.join(GRAPHS_DIR, `${name}.json`), text);
            if (deploy) fs.writeFileSync(ROOT_GRAPH, text);
            return send(res, 200, { ok: true, deployed: deploy });
          }

          // ── GET /content?id=ID : read a node's Markdown fragment ───────────
          if (route === '/content' && method === 'GET') {
            const id = url.searchParams.get('id') || '';
            if (!SAFE_NAME.test(id)) return send(res, 400, { error: 'bad id' });
            const f = path.join(CONTENT_DIR, `${id}.md`);
            if (!fs.existsSync(f)) return send(res, 200, { md: '', exists: false });
            return send(res, 200, { md: fs.readFileSync(f, 'utf8'), exists: true });
          }

          // ── POST /content : write a node's Markdown fragment ───────────────
          if (route === '/content' && method === 'POST') {
            const body = await readBody(req);
            const id: string = body.id;
            const md: string = body.md ?? '';
            if (!id || !SAFE_NAME.test(id)) return send(res, 400, { error: 'bad id' });
            ensureDir(CONTENT_DIR);
            fs.writeFileSync(path.join(CONTENT_DIR, `${id}.md`), md);
            return send(res, 200, { ok: true });
          }

          // ── GET /content-list : existing fragment ids ─────────────────────
          if (route === '/content-list' && method === 'GET') {
            ensureDir(CONTENT_DIR);
            const ids = fs
              .readdirSync(CONTENT_DIR)
              .filter((f) => f.endsWith('.md'))
              .map((f) => f.replace(/\.md$/, ''));
            return send(res, 200, { ids });
          }

          return send(res, 404, { error: 'unknown route' });
        } catch (err: any) {
          return send(res, 500, { error: String(err && err.message ? err.message : err) });
        }
      });
    },
  };
}
