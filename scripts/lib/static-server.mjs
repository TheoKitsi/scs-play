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
    let filePath;
    try {
      filePath = resolveRequest(publicRoot, req.url || '/');
    } catch {
      res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Bad request');
      return;
    }
    if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    const size = statSync(filePath).size;
    const headers = {
      'accept-ranges': 'bytes',
      'cache-control': 'no-store',
      'content-type': MIME_TYPES[extname(filePath)] || 'application/octet-stream',
      'content-length': size,
    };
    let start = 0;
    let end = size - 1;
    const range = req.method === 'GET' ? req.headers.range : null;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/i.exec(range.trim());
      start = match?.[1] ? Number(match[1]) : 0;
      end = match?.[2] ? Number(match[2]) : size - 1;
      if (match && !match[1] && match[2]) {
        const suffix = Number(match[2]);
        start = Number.isSafeInteger(suffix) && suffix > 0 ? Math.max(0, size - suffix) : size;
        end = size - 1;
      }
      if (!match || (!match[1] && !match[2]) || !Number.isSafeInteger(start) ||
          !Number.isSafeInteger(end) || start >= size || end < start) {
        res.writeHead(416, { ...headers, 'content-range': `bytes */${size}`, 'content-length': 0 });
        res.end();
        return;
      }
      end = Math.min(end, size - 1);
      headers['content-range'] = `bytes ${start}-${end}/${size}`;
      headers['content-length'] = end - start + 1;
    }
    res.writeHead(range ? 206 : 200, headers);
    if (req.method === 'HEAD' || !size) {
      res.end();
      return;
    }
    const stream = createReadStream(filePath, { start, end });
    stream.on('error', () => res.destroy());
    res.on('close', () => stream.destroy());
    stream.pipe(res);
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
