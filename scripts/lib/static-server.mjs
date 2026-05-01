import { createServer } from 'http';
import { createReadStream, existsSync, statSync } from 'fs';
import { extname, resolve, sep } from 'path';

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.mp3': 'audio/mpeg',
};

function resolveRequest(root, requestUrl) {
  const url = new URL(requestUrl, 'http://local.test');
  const decodedPath = decodeURIComponent(url.pathname);
  const relativePath = decodedPath.endsWith('/') ? `${decodedPath}index.html` : decodedPath;
  const candidate = resolve(root, `.${relativePath}`);
  const rootWithSep = root.endsWith(sep) ? root : root + sep;
  if (candidate !== root && !candidate.startsWith(rootWithSep)) return null;
  return candidate;
}

export async function startStaticServer({ root, host = '127.0.0.1', port = 3000 } = {}) {
  const publicRoot = resolve(root || 'docs');
  if (!existsSync(publicRoot)) {
    throw new Error(`Static server root does not exist: ${publicRoot}. Run npm run build:prod first.`);
  }

  const server = createServer((req, res) => {
    const filePath = resolveRequest(publicRoot, req.url || '/');
    if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    res.writeHead(200, {
      'cache-control': 'no-store',
      'content-type': MIME_TYPES[extname(filePath)] || 'application/octet-stream',
    });
    createReadStream(filePath).pipe(res);
  });

  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(port, host, () => {
      server.off('error', rejectListen);
      resolveListen();
    });
  });

  return {
    baseUrl: `http://${host}:${server.address().port}`,
    async close() {
      await new Promise((resolveClose, rejectClose) => {
        server.close((err) => err ? rejectClose(err) : resolveClose());
      });
    },
  };
}