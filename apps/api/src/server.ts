import { createServer } from 'node:http';
import app from './index.js';
import { setJevAdapter } from './decision/pipeline.js';
import { JevMockAdapter } from './adapters/jev-mock.js';
import { JevRealAdapter } from './adapters/jev-real.js';

const port = Number(process.env['PORT'] ?? 3000);

const jevApiKey = process.env['JEV_API_KEY'];
if (jevApiKey) {
  setJevAdapter(new JevRealAdapter(jevApiKey));
  console.log('[server] Jev adapter: real (TypeSafe AI)');
} else {
  setJevAdapter(new JevMockAdapter());
  console.log('[server] Jev adapter: mock (no JEV_API_KEY set)');
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
  }

  const body = req.method !== 'GET' && req.method !== 'HEAD'
    ? await new Promise<string>((resolve) => {
        let data = '';
        req.on('data', (chunk: Buffer) => { data += chunk.toString(); });
        req.on('end', () => resolve(data));
      })
    : undefined;

  const request = new Request(url.toString(), {
    method: req.method,
    headers,
    body,
  });

  const response = await app.fetch(request);

  res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
  const responseBody = await response.text();
  res.end(responseBody);
});

server.listen(port, () => {
  console.log(`[server] Listening on http://localhost:${port}`);
});
