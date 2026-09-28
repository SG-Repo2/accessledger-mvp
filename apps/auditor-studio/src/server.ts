import { createServer, type IncomingMessage, type Server } from 'node:http';

import type { AuditorStudio, AuditorAction } from './auditor-studio.js';
import { renderReviewPage } from './render-review-page.js';

export function createAuditorStudioServer(studio: AuditorStudio): Server {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      if (request.method === 'GET') {
        const findingId = url.searchParams.get('findingId');
        if (findingId === null) {
          const links = studio
            .listFindingIds()
            .map(
              (id) =>
                `<li><a href="/?findingId=${encodeURIComponent(id)}">${escapeHtml(id)}</a></li>`,
            )
            .join('');
          send(
            response,
            200,
            `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Auditor Studio</title></head><body><main><h1>Findings awaiting review</h1><ul>${links}</ul></main></body></html>`,
          );
          return;
        }
        send(response, 200, renderReviewPage(studio.load(findingId)));
        return;
      }
      if (request.method === 'POST') {
        const body = await readBody(request);
        const fields = Object.fromEntries(new URLSearchParams(body));
        const findingId = required(fields, 'findingId');
        const action = required(fields, 'action') as AuditorAction;
        studio.handle(findingId, action, fields);
        response.statusCode = 303;
        response.setHeader('Location', `/?findingId=${encodeURIComponent(findingId)}`);
        response.end();
        return;
      }
      send(response, 405, 'Method not allowed', 'text/plain; charset=utf-8');
    } catch (error) {
      send(
        response,
        400,
        `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Review error</title></head><body><main><h1>Review action failed</h1><p role="alert">${escapeHtml(error instanceof Error ? error.message : String(error))}</p><p><a href="/">Return to findings</a></p></main></body></html>`,
      );
    }
  });
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk: string) => {
      body += chunk;
      if (body.length > 1_000_000) reject(new Error('Request body is too large.'));
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

function required(fields: Readonly<Record<string, string>>, name: string): string {
  const value = fields[name];
  if (value === undefined || value.length === 0) throw new Error(`${name} is required.`);
  return value;
}

function send(
  response: import('node:http').ServerResponse,
  status: number,
  body: string,
  contentType = 'text/html; charset=utf-8',
): void {
  response.statusCode = status;
  response.setHeader('Content-Type', contentType);
  response.end(body);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
