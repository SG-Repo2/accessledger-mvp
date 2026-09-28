import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const fixturesDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  'data',
  'fixtures',
);

const fixtureNames = new Set([
  'accessibility-semantics.html',
  'good-form.html',
  'unlabeled-input.html',
  'empty-button.html',
  'broken-aria.html',
]);

export type FixtureServer = {
  origin: string;
  closed: boolean;
  close(): Promise<void>;
};

export async function startFixtureServer(): Promise<FixtureServer> {
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://fixture.local').pathname;

    if (pathname === '/redirect') {
      response.writeHead(302, { location: '/good-form.html' });
      response.end();
      return;
    }

    if (pathname === '/close-connection') {
      request.socket.destroy();
      return;
    }

    const fixtureName = pathname.slice(1);
    if (!fixtureNames.has(fixtureName)) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    try {
      const html = await readFile(join(fixturesDirectory, fixtureName));
      response.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      });
      response.end(html);
    } catch (error) {
      response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      response.end(error instanceof Error ? error.message : String(error));
    }
  });

  await listen(server);
  const address = server.address();
  if (address === null || typeof address === 'string') {
    await closeServer(server);
    throw new Error('Fixture server did not bind to a TCP port.');
  }

  let closed = false;
  return {
    origin: `http://127.0.0.1:${address.port}`,
    get closed() {
      return closed;
    },
    async close() {
      if (closed) {
        return;
      }
      closed = true;
      await closeServer(server);
    },
  };
}

function listen(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
    server.closeAllConnections();
  });
}
