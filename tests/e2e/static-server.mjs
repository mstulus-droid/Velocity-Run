// Tiny static file server that serves a folder as-is — simulates a plain
// static host (no build step) for the vendored-three import map, or serves
// the production build:
//   node tests/e2e/static-server.mjs          # project root on :8950
//   node tests/e2e/static-server.mjs dist     # built site on :8950
//   PORT=8951 node tests/e2e/static-server.mjs dist
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const ROOT = resolve(process.argv[2] ?? process.cwd());
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const port = Number(process.env.PORT || 8950);
http
  .createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (p.endsWith('/')) p += 'index.html';
      const file = normalize(join(ROOT, p));
      if (!file.startsWith(ROOT)) throw new Error('nope');
      const data = await readFile(file);
      res.setHeader('content-type', MIME[extname(file)] ?? 'application/octet-stream');
      res.end(data);
    } catch {
      res.statusCode = 404;
      res.end('not found');
    }
  })
  .listen(port, () => console.log(`static server for ${ROOT} on http://localhost:${port}`));
