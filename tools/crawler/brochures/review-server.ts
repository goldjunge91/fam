import { readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { ReviewCandidate, ReviewDecision } from './verify-versions';

type StoredDecision = {
  decision: ReviewDecision;
  decidedAt: string;
  note?: string;
};

type DecisionsFile = {
  version: 1;
  decisions: Record<string, StoredDecision>;
};

type VerificationReport = {
  version: 1 | 2;
  decisionsPath: string;
  summary: {
    reviewCandidates: number;
    reviewed: number;
    unreviewed: number;
    [key: string]: number;
  };
  candidates: ReviewCandidate[];
};

function argument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(value, null, 2), 'utf8');
  await rename(temporaryPath, path);
}

function isDecision(value: unknown): value is ReviewDecision {
  return (
    value === 'identical' ||
    value === 'different' ||
    value === 'wrong-ad-page' ||
    value === 'regional-variant'
  );
}

function html(): string {
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Prospekt Review</title>
  <style>
    :root { color-scheme: dark; font-family: ui-sans-serif, system-ui, sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #151217; color: #f8edf3; }
    header { position: sticky; top: 0; z-index: 2; display: flex; gap: 24px; align-items: center; padding: 14px 20px; background: #211b22; border-bottom: 1px solid #4b3c48; }
    header strong { font-size: 18px; }
    #progress { color: #d8bacb; }
    main { max-width: 1500px; margin: 0 auto; padding: 20px; }
    .meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px 20px; margin-bottom: 18px; }
    .meta div { min-width: 0; }
    .label { color: #b99aaa; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; }
    .value { overflow-wrap: anywhere; }
    .pages { display: grid; gap: 16px; }
    .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding-bottom: 16px; border-bottom: 1px solid #3d313b; }
    .ocr { grid-column: 1 / -1; color: #d8bacb; font-size: 13px; }
    figure { margin: 0; min-width: 0; }
    img { display: block; width: 100%; max-height: 760px; object-fit: contain; background: #0e0c0f; }
    figcaption { display: flex; justify-content: space-between; gap: 10px; padding: 7px 2px; color: #cdb4c2; font-size: 13px; }
    .actions { position: sticky; bottom: 0; display: flex; flex-wrap: wrap; gap: 10px; padding: 16px 0; background: linear-gradient(transparent, #151217 20%); }
    button { appearance: none; border: 1px solid #705566; border-radius: 8px; padding: 11px 15px; color: #fff; background: #352832; font: inherit; cursor: pointer; }
    button:hover { background: #4a3543; }
    button.primary { background: #7a3f64; border-color: #a85f89; }
    textarea { flex: 1 1 260px; min-height: 44px; resize: vertical; border: 1px solid #705566; border-radius: 8px; padding: 10px; color: #fff; background: #211b22; font: inherit; }
    .empty { padding: 80px 20px; text-align: center; color: #d8bacb; }
    @media (max-width: 760px) { .pair { grid-template-columns: 1fr; } header { align-items: flex-start; flex-direction: column; gap: 4px; } }
  </style>
</head>
<body>
  <header><strong>Prospekt Review</strong><span id="progress">Lädt …</span></header>
  <main id="app"></main>
  <script>
    let state;
    let current;
    const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
    const asset = (page) => page ? '/' + page.assetPath : '';
    const formatDate = (value) => new Intl.DateTimeFormat('de-DE', {dateStyle:'medium'}).format(new Date(value));

    function nextCandidate() {
      return state.candidates.find((candidate) => !candidate.decision);
    }

    function render() {
      const reviewed = state.candidates.filter((candidate) => candidate.decision).length;
      document.querySelector('#progress').textContent = reviewed + ' / ' + state.candidates.length + ' geprüft · ' + (state.candidates.length - reviewed) + ' ungeprüft';
      current = current && !current.decision ? current : nextCandidate();
      const app = document.querySelector('#app');
      if (!current) {
        app.innerHTML = '<div class="empty"><h1>Review vollständig</h1><p>unreviewed = 0</p></div>';
        return;
      }

      const pagePairs = current.previewPages.map((comparison) => {
        const left = comparison.left;
        const right = comparison.right;
        const leftFigure = left
          ? '<figure><img src="' + escapeHtml(asset(left)) + '"><figcaption><span>Links · Quellposition ' + left.pageNumber + '</span><span>' + escapeHtml(left.perceptualHash) + '</span></figcaption></figure>'
          : '<figure><div class="empty">Seite fehlt</div></figure>';
        const rightFigure = right
          ? '<figure><img src="' + escapeHtml(asset(right)) + '"><figcaption><span>Rechts · Quellposition ' + right.pageNumber + '</span><span>' + escapeHtml(right.perceptualHash) + '</span></figcaption></figure>'
          : '<figure><div class="empty">Seite fehlt</div></figure>';
        const ocr = comparison.ocr
          ? '<div class="ocr">OCR ' + (comparison.ocr.similarity * 100).toFixed(2) + ' % · Abweichend: ' + escapeHtml(comparison.ocr.changedTokens.join(', ') || 'keine Tokens') + '</div>'
          : '';
        return '<section class="pair">' + leftFigure + rightFigure + ocr + '</section>';
      }).join('');

      const ocrSummary = current.ocr
        ? '<div><div class="label">OCR</div><div class="value">Ø ' + (current.ocr.averageTextSimilarity * 100).toFixed(2) + ' % · Minimum ' + (current.ocr.lowestTextSimilarity * 100).toFixed(2) + ' % · ' + current.ocr.textDifferentPages + ' abweichende Seiten</div></div>' +
          '<div><div class="label">REWE-Code</div><div class="value">' + escapeHtml(current.ocr.leftRegionCode || '–') + '<br>' + escapeHtml(current.ocr.rightRegionCode || '–') + '</div></div>'
        : '';

      app.innerHTML =
        '<section class="meta">' +
          '<div><div class="label">Händler</div><div class="value">' + escapeHtml(current.storeName) + '</div></div>' +
          '<div><div class="label">Gültigkeit</div><div class="value">' + formatDate(current.validFrom) + ' bis ' + formatDate(current.validUntil) + '</div></div>' +
          '<div><div class="label">Ähnlichkeit</div><div class="value">' + (current.similarity * 100).toFixed(2) + ' %</div></div>' +
          '<div><div class="label">Prospekt-IDs</div><div class="value">' + escapeHtml(current.left.id) + '<br>' + escapeHtml(current.right.id) + '</div></div>' +
          '<div><div class="label">Standorte links</div><div class="value">' + escapeHtml(current.left.locations.slice(0, 8).join(', ')) + '</div></div>' +
          '<div><div class="label">Standorte rechts</div><div class="value">' + escapeHtml(current.right.locations.slice(0, 8).join(', ')) + '</div></div>' +
          ocrSummary +
        '</section>' +
        '<section class="pages">' + pagePairs + '</section>' +
        '<section class="actions">' +
          '<textarea id="note" placeholder="Optionale Notiz"></textarea>' +
          '<button class="primary" data-decision="identical">Identisch</button>' +
          '<button data-decision="different">Unterschiedlich</button>' +
          '<button data-decision="regional-variant">Regional abweichend</button>' +
          '<button data-decision="wrong-ad-page">Falsche Werbeseite</button>' +
        '</section>';
      app.querySelectorAll('button[data-decision]').forEach((button) => button.addEventListener('click', decide));
    }

    async function decide(event) {
      const decision = event.currentTarget.dataset.decision;
      const note = document.querySelector('#note').value.trim();
      const response = await fetch('/api/decisions', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({id:current.id, decision, note})});
      if (!response.ok) { alert(await response.text()); return; }
      state = await response.json();
      current = undefined;
      render();
    }

    fetch('/api/state').then((response) => response.json()).then((value) => { state = value; render(); });
  </script>
</body>
</html>`;
}

async function main(): Promise<void> {
  const reportArgument = argument('report');
  if (!reportArgument) throw new Error('Bitte --report=/pfad/verification-report.json setzen.');
  const reportPath = resolve(reportArgument);
  const reportDirectory = dirname(reportPath);
  const report = JSON.parse(await readFile(reportPath, 'utf8')) as VerificationReport;
  const decisionsPath = resolve(report.decisionsPath);
  const decisions = JSON.parse(await readFile(decisionsPath, 'utf8')) as DecisionsFile;
  const port = Number.parseInt(argument('port') ?? '4317', 10);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error('--port muss zwischen 1024 und 65535 liegen.');
  }

  const server = Bun.serve({
    port,
    async fetch(request) {
      const url = new URL(request.url);
      if (request.method === 'GET' && url.pathname === '/') {
        return new Response(html(), { headers: { 'content-type': 'text/html; charset=utf-8' } });
      }
      if (request.method === 'GET' && url.pathname === '/api/state') {
        return Response.json(report);
      }
      if (request.method === 'GET' && /^\/assets\/[a-f0-9]{64}\.jpg$/.test(url.pathname)) {
        return new Response(Bun.file(join(reportDirectory, url.pathname.slice(1))));
      }
      if (request.method === 'POST' && url.pathname === '/api/decisions') {
        const body = (await request.json()) as { id?: unknown; decision?: unknown; note?: unknown };
        if (typeof body.id !== 'string' || !isDecision(body.decision)) {
          return new Response('Ungültige Entscheidung.', { status: 400 });
        }
        const candidate = report.candidates.find((item) => item.id === body.id);
        if (!candidate) return new Response('Kandidat nicht gefunden.', { status: 404 });
        const storedDecision: StoredDecision = {
          decision: body.decision,
          decidedAt: new Date().toISOString(),
          ...(typeof body.note === 'string' && body.note.trim() ? { note: body.note.trim() } : {}),
        };
        decisions.decisions[body.id] = storedDecision;
        candidate.decision = storedDecision;
        report.summary.reviewed = report.candidates.filter((item) => item.decision).length;
        report.summary.unreviewed = report.summary.reviewCandidates - report.summary.reviewed;
        await Promise.all([
          writeJsonAtomic(decisionsPath, decisions),
          writeJsonAtomic(reportPath, report),
        ]);
        return Response.json(report);
      }
      if (request.method === 'DELETE' && url.pathname.startsWith('/api/decisions/')) {
        const id = url.pathname.slice('/api/decisions/'.length);
        const candidate = report.candidates.find((item) => item.id === id);
        if (!candidate) return new Response('Kandidat nicht gefunden.', { status: 404 });

        delete decisions.decisions[id];
        delete candidate.decision;
        report.summary.reviewed = report.candidates.filter((item) => item.decision).length;
        report.summary.unreviewed = report.summary.reviewCandidates - report.summary.reviewed;
        await Promise.all([
          writeJsonAtomic(decisionsPath, decisions),
          writeJsonAtomic(reportPath, report),
        ]);
        return Response.json(report);
      }
      return new Response('Nicht gefunden.', { status: 404 });
    },
  });

  console.log(`👤 Review-Server: ${server.url}`);
  console.log(`📄 Bericht: ${reportPath}`);
  console.log(`💾 Entscheidungen: ${decisionsPath}`);
}

main().catch((error: unknown) => {
  console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
