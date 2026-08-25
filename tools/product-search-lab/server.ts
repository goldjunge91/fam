#!/usr/bin/env bun
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = import.meta.dir;
const PORT = Number(process.env.PRODUCT_SEARCH_LAB_PORT ?? 8765);

async function runSearch(query: string, market: string, limit: string) {
  const child = Bun.spawn(
    ['bun', path.join(ROOT, 'search.ts'), query, '--market', market, '--limit', limit, '--json'],
    { stdout: 'pipe', stderr: 'pipe' },
  );
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (exitCode !== 0) throw new Error(stderr || 'Suche fehlgeschlagen.');
  return JSON.parse(stdout);
}

const server = Bun.serve({
  hostname: '127.0.0.1',
  port: PORT,
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/api/search') {
      const query = url.searchParams.get('q')?.trim() ?? '';
      if (query.length < 2) return Response.json({ query, results: [] });
      try {
        const result = await runSearch(
          query,
          url.searchParams.get('market') ?? 'none',
          url.searchParams.get('limit') ?? '30',
        );
        return Response.json(result);
      } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
      }
    }
    if (url.pathname === '/' || url.pathname === '/index.html') {
      return new Response(await readFile(path.join(ROOT, 'index.html')), {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }
    return new Response('Nicht gefunden', { status: 404 });
  },
});

console.log(`Product Search Lab: http://localhost:${server.port}`);
