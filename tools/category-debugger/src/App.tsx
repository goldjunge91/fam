import { useEffect, useMemo, useRef, useState } from 'react';
import initSqlJs, { type Database } from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
// Echte App-Logik, keine Kopie — importiert direkt aus dem Hauptprojekt, damit
// dieses Tool nie von guessCategory() abweichen kann.
import { guessCategory, SHOPPING_CATEGORIES } from '../../../src/features/shopping-list/domain-logik/shopping-categories';

type ProductRow = {
  code: string | null;
  product_name: string;
  brand: string | null;
  quantity: string | null;
  stores: string | null;
  nutriscore: string | null;
  energy_kcal: number | null;
  fat: number | null;
  saturated_fat: number | null;
  carbohydrates: number | null;
  sugars: number | null;
  proteins: number | null;
  salt: number | null;
};

type DbStatus = { kind: 'loading' } | { kind: 'ready'; count: number } | { kind: 'error'; message: string };

// --- Lokale Nachbildung der privaten Matching-Details aus shopping-categories.ts
// (SUBSTRING_MIN_LENGTH/containsWholeWord sind dort nicht exportiert). Der
// Gewinner wird nach jeder Analyse gegen das echte guessCategory() geprüft —
// weicht er ab, zeigt die UI eine Warnung statt eine falsche Erklärung.

const SUBSTRING_MIN_LENGTH = 4;
const WORD_CHAR = /[a-z0-9äöüß]/i;

function isWordChar(ch: string | undefined): boolean {
  return ch !== undefined && WORD_CHAR.test(ch);
}

function containsWholeWord(haystack: string, keyword: string): boolean {
  let fromIndex = 0;
  while (true) {
    const index = haystack.indexOf(keyword, fromIndex);
    if (index === -1) return false;
    if (!isWordChar(haystack[index - 1]) && !isWordChar(haystack[index + keyword.length])) {
      return true;
    }
    fromIndex = index + 1;
  }
}

const MATCHERS = SHOPPING_CATEGORIES.map((c) => ({
  ...c,
  longKeywords: c.keywords.filter((k) => k.length >= SUBSTRING_MIN_LENGTH),
  shortKeywords: c.keywords.filter((k) => k.length < SUBSTRING_MIN_LENGTH),
}));

type TraceRow = {
  category: (typeof SHOPPING_CATEGORIES)[number];
  keyword: string | null;
  type: 'substring' | 'wholeword' | null;
  reached: boolean;
};

function analyze(name: string) {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return null;

  const rows: TraceRow[] = [];
  let winnerIndex = -1;

  MATCHERS.forEach((m, i) => {
    const substringKw = m.longKeywords.find((k) => normalized.includes(k));
    const wholeKw = !substringKw && m.shortKeywords.find((k) => containsWholeWord(normalized, k));
    const keyword = substringKw || wholeKw || null;
    const type: TraceRow['type'] = substringKw ? 'substring' : wholeKw ? 'wholeword' : null;
    rows.push({ category: m, keyword, type, reached: winnerIndex === -1 });
    if (keyword && winnerIndex === -1) winnerIndex = i;
  });

  const winner = winnerIndex === -1 ? null : rows[winnerIndex];
  const shadowed = rows.filter((r, i) => i > winnerIndex && r.keyword);
  const realAnswer = guessCategory(name);
  const mismatch = (winner?.category.label ?? null) !== realAnswer;

  return { name, normalized, rows, winner, winnerIndex, shadowed, realAnswer, mismatch };
}

function highlight(name: string, keyword: string | null | undefined, type: string | null | undefined) {
  if (!keyword) return escapeHtml(name);
  const idx = name.toLowerCase().indexOf(keyword.toLowerCase());
  if (idx === -1) return escapeHtml(name);
  const before = name.slice(0, idx);
  const match = name.slice(idx, idx + keyword.length);
  const after = name.slice(idx + keyword.length);
  const cls = type === 'wholeword' ? 'safe' : '';
  return `${escapeHtml(before)}<mark class="${cls}">${escapeHtml(match)}</mark>${escapeHtml(after)}`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function fmt(n: number | null, digits = 1): string {
  return n == null ? '—' : n.toFixed(digits);
}

export function App() {
  const [status, setStatus] = useState<DbStatus>({ kind: 'loading' });
  const dbRef = useRef<Database | null>(null);

  const [query, setQuery] = useState('Schwein');
  const [results, setResults] = useState<ProductRow[]>([]);
  const [selected, setSelected] = useState<ProductRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [SQL, dbRes] = await Promise.all([
          initSqlJs({ locateFile: () => sqlWasmUrl }),
          fetch('/off-dump.db'),
        ]);
        if (!dbRes.ok) {
          throw new Error(
            `/off-dump.db nicht gefunden (${dbRes.status}). Erst "bun run download-dump" ausführen.`,
          );
        }
        const buffer = new Uint8Array(await dbRes.arrayBuffer());
        if (cancelled) return;
        const db = new SQL.Database(buffer);
        dbRef.current = db;
        const countRes = db.exec('select count(*) from products');
        const count = Number(countRes[0]?.values[0]?.[0] ?? 0);
        setStatus({ kind: 'ready', count });
      } catch (err) {
        if (!cancelled) {
          setStatus({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
        }
      }
    })();
    return () => {
      cancelled = true;
      dbRef.current?.close();
    };
  }, []);

  useEffect(() => {
    const db = dbRef.current;
    if (!db || status.kind !== 'ready') return;

    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }

    // Barcode-Suche (rein numerisch) trifft exakt auf `code`, sonst
    // Substring-Suche im Produktnamen — deckt sich mit `searchOffDump()` /
    // `fetchProductByBarcodeFromDump()` in src/lib/off-dump/off-dump.ts.
    const isBarcode = /^\d{6,}$/.test(trimmed);
    const sql = isBarcode
      ? 'select * from products where code = :q limit 50'
      : 'select * from products where lower(product_name) like :q order by product_name limit 50';
    const param = isBarcode ? trimmed : `%${trimmed.toLowerCase()}%`;

    const stmt = db.prepare(sql);
    stmt.bind({ ':q': param });
    const rows: ProductRow[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as unknown as ProductRow);
    }
    stmt.free();

    setResults(rows);
    setSelected((prev) => (prev && rows.some((r) => r.code === prev.code) ? prev : (rows[0] ?? null)));
  }, [query, status]);

  const analysis = useMemo(() => (selected ? analyze(selected.product_name) : null), [selected]);

  return (
    <div className="shell">
      <header className="top">
        <div className="eyebrow">shopping-list · guessCategory() gegen den echten Dump</div>
        <h1>Kategorie-Radar</h1>
        <p className="lede">
          Durchsucht die tatsächlich heruntergeladene <code>off-dump.db</code> (derselbe Release wie{' '}
          <code>ensureOffDumpDownloaded()</code> in der App) und zeigt zu jedem echten Treffer alle
          Felder aus dem Dump sowie den vollen Ablauf von <code>guessCategory()</code>.
        </p>
        <div className="status-line">
          {status.kind === 'loading' && (
            <>
              <span className="status-dot loading" /> Lade Dump…
            </>
          )}
          {status.kind === 'ready' && (
            <>
              <span className="status-dot ok" /> {status.count.toLocaleString('de-DE')} Produkte geladen
            </>
          )}
          {status.kind === 'error' && (
            <>
              <span className="status-dot err" /> {status.message}
            </>
          )}
        </div>
      </header>

      <div className="search-row">
        <div>
          <label className="field-label" htmlFor="q">
            Suche (Name oder EAN)
          </label>
          <input
            id="q"
            className="text-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="z. B. Schwein oder 4000417025005"
            spellCheck={false}
          />
        </div>
      </div>

      <div className="workspace">
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">Treffer im Dump</span>
            <span className="panel-count">{results.length}</span>
          </div>
          <div className="hit-list">
            {results.length === 0 ? (
              <div className="empty">Keine Treffer.</div>
            ) : (
              results.map((row) => (
                <button
                  key={row.code ?? row.product_name}
                  type="button"
                  className={`hit-row${selected?.code === row.code ? ' active' : ''}`}
                  onClick={() => setSelected(row)}>
                  <span className="hit-name">{row.product_name}</span>
                  <span className="hit-meta">
                    {row.brand || 'ohne Marke'} · EAN {row.code || '—'}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">Artikeldetails & Kategorie-Ablauf</span>
          </div>

          {!selected || !analysis ? (
            <div className="detail-empty">Links einen Artikel auswählen.</div>
          ) : (
            <>
              <div className="article-head">
                <div
                  className="article-name"
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: escapeHtml() laeuft ueber jeden Teil davor
                  dangerouslySetInnerHTML={{
                    __html: highlight(selected.product_name, analysis.winner?.keyword, analysis.winner?.type),
                  }}
                />
                <div className="result-chip-row">
                  <span
                    className="cat-pill"
                    style={{
                      background: `${analysis.winner ? analysis.winner.category.color : '#a89fa4'}22`,
                      color: analysis.winner ? analysis.winner.category.color : 'var(--ink-muted)',
                    }}>
                    <span
                      className="cat-dot"
                      style={{ background: analysis.winner ? analysis.winner.category.color : '#a89fa4' }}
                    />
                    {analysis.realAnswer ?? 'Sonstiges'}
                  </span>
                  <span className={`match-badge ${analysis.winner ? analysis.winner.type : 'none'}`}>
                    {analysis.winner
                      ? analysis.winner.type === 'substring'
                        ? 'Substring-Treffer'
                        : 'Ganzwort-Treffer'
                      : 'kein Treffer'}
                  </span>
                </div>
              </div>

              {analysis.mismatch && (
                <div className="mismatch-note">
                  ⚠ Trace-Nachbildung weicht vom echten guessCategory() ab (
                  {selected.product_name} → real: {analysis.realAnswer ?? 'Sonstiges'}) — die
                  Matching-Logik in shopping-categories.ts hat sich vermutlich geändert, dieses Tool
                  muss nachgezogen werden.
                </div>
              )}

              <div className="data-grid">
                <div className="data-cell">
                  <div className="k">EAN</div>
                  <div className="v">{selected.code || '—'}</div>
                </div>
                <div className="data-cell">
                  <div className="k">Marke</div>
                  <div className="v">{selected.brand || '—'}</div>
                </div>
                <div className="data-cell">
                  <div className="k">Menge</div>
                  <div className="v">{selected.quantity || '—'}</div>
                </div>
                <div className="data-cell">
                  <div className="k">Nutri-Score</div>
                  <div className="v">{selected.nutriscore?.toUpperCase() || '—'}</div>
                </div>
                <div className="data-cell">
                  <div className="k">kcal / 100g</div>
                  <div className="v">{fmt(selected.energy_kcal, 0)}</div>
                </div>
                <div className="data-cell">
                  <div className="k">Fett / 100g</div>
                  <div className="v">{fmt(selected.fat)} g</div>
                </div>
                <div className="data-cell">
                  <div className="k">– davon gesättigt</div>
                  <div className="v">{fmt(selected.saturated_fat)} g</div>
                </div>
                <div className="data-cell">
                  <div className="k">Kohlenhydrate</div>
                  <div className="v">{fmt(selected.carbohydrates)} g</div>
                </div>
                <div className="data-cell">
                  <div className="k">– davon Zucker</div>
                  <div className="v">{fmt(selected.sugars)} g</div>
                </div>
                <div className="data-cell">
                  <div className="k">Eiweiß</div>
                  <div className="v">{fmt(selected.proteins)} g</div>
                </div>
                <div className="data-cell">
                  <div className="k">Salz</div>
                  <div className="v">{fmt(selected.salt)} g</div>
                </div>
                <div className="data-cell">
                  <div className="k">Läden</div>
                  <div className="v">{selected.stores || '—'}</div>
                </div>
              </div>

              <div className="trace-list">
                {analysis.rows.map((row, i) => {
                  const isWinner = analysis.winnerIndex === i;
                  const cls = ['trace-row'];
                  if (isWinner) cls.push('hit', row.type === 'wholeword' ? 'safe' : '');
                  else if (row.reached) cls.push('checked');
                  else cls.push('unreached');

                  const status = isWinner
                    ? row.type === 'substring'
                      ? '✓ Treffer (Substring)'
                      : '✓ Treffer (Ganzwort)'
                    : row.reached
                      ? 'kein Treffer'
                      : 'nicht erreicht';

                  return (
                    <div key={row.category.id} className={cls.join(' ').trim()}>
                      <span className="trace-idx">{i + 1}</span>
                      <span className="trace-dot" style={{ background: row.category.color }} />
                      <span className="trace-cat">
                        {row.category.label}
                        {isWinner && <span className="trace-detail">via „{row.keyword}"</span>}
                      </span>
                      <span className="trace-status">{status}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      <footer className="note">
        Datenquelle: <code>public/off-dump.db</code>, per <code>bun run download-dump</code> vom neuesten
        GitHub-Release ({/* siehe scripts/download-dump.ts */}
        <code>goldjunge91/fam</code>) geladen — derselbe Release, den <code>off-dump.ts</code> in der App
        anhängt. Kategorie-Logik importiert direkt aus{' '}
        <code>src/features/shopping-list/domain-logik/shopping-categories.ts</code>, keine Kopie.
      </footer>
    </div>
  );
}
