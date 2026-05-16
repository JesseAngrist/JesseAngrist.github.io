import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fsPlugin } from './vite-fs-plugin';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// The studio is a dev-only app. `npm run studio` starts Vite with the
// fs middleware that reads/writes the repo's graph + content files.
export default defineConfig({
  root: HERE,
  plugins: [react(), fsPlugin()],
  server: {
    port: 5180,
    open: true,
  },
});
