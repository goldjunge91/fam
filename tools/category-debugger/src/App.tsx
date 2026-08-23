import { useEffect, useMemo, useRef, useState } from 'react';
import initSqlJs, { type Database } from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
// Echte App-Logik, keine Kopie — importiert direkt aus dem Hauptprojekt, damit
// dieses Tool nie vom echten Classifier abweichen kann.
import { explainCategory } from '../../../src/features/shopping-list/classification/shopping-category-classifier';
import type { CategoryTrace } from '../../../src/features/shopping-list/classification/types';
import { SHOPPING_CATEGORIES } from '../../../src/features/shopping-list/domain-logik/shopping-categories';

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
  /**
   * Erst ab Dump Schema 2 (#223 Paket 4) — gegen einen alten Schema-1-Dump
   * fehlt die Spalte in `getAsObject()` einfach (undefined), kein Crash.
   */
  categories_tags?: string | null;
  off_last_modified_at?: string | null;
};

type DbStatus = { kind: 'loading' } | { kind: 'ready'; count: number } | { kind: 'error'; message: string };

/**
 * Trivialer, eigenständiger JSON-Array-Parser statt Import von
 * `parseCategoryTagsJson` aus `src/lib/open-food-facts.ts` — dessen Modul
 * zieht `src/lib/env.ts` (`process.env.EXPO_PUBLIC_*`) mit, was in diesem
 * reinen Vite/Browser-Tool ohne Expo-Build-Zeit-Ersetzung nicht sauber
 * auflöst. Anders als bei `explainCategory()`/`classifyCategory()` (echte,
 * pflegebedürftige Domänenlogik, siehe Kommentar oben) lohnt sich für dieses
 * Fünfzeiler-Utility keine Kopplung an den App-Import-Graphen.
 */
function parseCategoryTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((tag): tag is string => typeof tag === 'string') : [];
  } catch {
    return [];
  }
}

function categoryDisplay(categoryId: string | null) {
  if (!categoryId) return { label: 'Sonstiges', color: '#a89fa4' };
  const category = SHOPPING_CATEGORIES.find((c) => c.id === categoryId);
  return category ? { label: category.label, color: category.color } : { label: categoryId, color: '#a89fa4' };
}

function highlight(name: string, value: string | undefined) {
  if (!value) return escapeHtml(name);
  const idx = name.toLowerCase().indexOf(value.toLowerCase());
  if (idx === -1) return escapeHtml(name);
  const before = name.slice(0, idx);
  const match = name.slice(idx, idx + value.length);
  const after = name.slice(idx + value.length);
  return `${escapeHtml(before)}<mark>${escapeHtml(match)}</mark>${escapeHtml(after)}`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function fmt(n: number | null, digits = 1): string {
  return n == null ? '—' : n.toFixed(digits);
}

/** Vollständiger Trace-Ablauf, gemeinsam für Dump-Treffer und Freitext-Tester genutzt. */
function TraceView({ trace }: { trace: CategoryTrace }) {
  const winnerDisplay = categoryDisplay(trace.winner.categoryId);
  const winnerValue = trace.winner.evidence?.value;

  return (
    <>
      <div className="result-chip-row">
        <span className="cat-pill" style={{ background: `${winnerDisplay.color}22`, color: winnerDisplay.color }}>
          <span className="cat-dot" style={{ background: winnerDisplay.color }} />
          {winnerDisplay.label}
        </span>
        <span className={`match-badge ${trace.winner.source ?? 'none'}`}>
          {trace.winner.source === 'off_taxonomy'
            ? 'OFF-Taxonomie'
            : trace.winner.source === 'name_fallback'
              ? 'Namens-Fallback'
              : 'kein Signal'}
        </span>
      </div>

      {trace.conflictReason && <div className="mismatch-note">⚠ {trace.conflictReason}</div>}

      <div className="data-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        <div className="data-cell">
          <div className="k">Classifier-Version</div>
          <div className="v">{trace.classifierVersion}</div>
        </div>
        <div className="data-cell">
          <div className="k">Eingabequelle</div>
          <div className="v">{trace.input.source ?? '—'}</div>
        </div>
        <div className="data-cell">
          <div className="k">Normalisierter Name</div>
          <div className="v">{trace.input.normalizedName ?? '—'}</div>
        </div>
        <div className="data-cell">
          <div className="k">OFF-Tags</div>
          <div className="v">{trace.input.categoryTags.length > 0 ? trace.input.categoryTags.join(', ') : '—'}</div>
        </div>
      </div>

      <div className="trace-list">
        {trace.candidates.length === 0 && trace.rejectedCandidates.length === 0 ? (
          <div className="trace-row unreached">
            <span className="trace-cat">Kein Kandidat gefunden — ehrliches „Sonstiges".</span>
          </div>
        ) : (
          trace.candidates.map((candidate, i) => {
            const isWinner = candidate.categoryId === trace.winner.categoryId && candidate.value === winnerValue;
            const rejected = trace.rejectedCandidates.find(
              (r) => r.categoryId === candidate.categoryId && r.value === candidate.value && r.kind === candidate.kind,
            );
            const display = categoryDisplay(candidate.categoryId);
            return (
              <div key={`${candidate.kind}-${candidate.value}-${i}`} className={`trace-row ${isWinner ? 'hit safe' : 'checked'}`}>
                <span className="trace-idx">{candidate.weight}</span>
                <span className="trace-dot" style={{ background: display.color }} />
                <span className="trace-cat">
                  {display.label}
                  <span className="trace-detail">
                    via {candidate.kind === 'off_tag' ? 'OFF-Tag' : 'Namensregel'} „{candidate.value}"
                  </span>
                </span>
                <span className="trace-status">
                  {isWinner ? '✓ Gewinner' : rejected ? `verworfen (${rejected.reason})` : ''}
                </span>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

export function App() {
  const [status, setStatus] = useState<DbStatus>({ kind: 'loading' });
  const dbRef = useRef<Database | null>(null);

  const [query, setQuery] = useState('Schwein');
  const [results, setResults] = useState<ProductRow[]>([]);
  const [selected, setSelected] = useState<ProductRow | null>(null);

  const [freeText, setFreeText] = useState('2 Schnitzel vom Schwein Spar Fein Küche');
  const [freeTextTags, setFreeTextTags] = useState('');

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

  // Ab Dump Schema 2 (#223 Paket 4) liefert `categories_tags` echte OFF-Tags;
  // gegen einen alten Schema-1-Dump ist die Spalte einfach nicht da
  // (parseCategoryTags(undefined) === []) — der Trace läuft dann wie
  // bisher nur über den Namens-Fallback.
  const dumpTrace = useMemo(
    () =>
      selected
        ? explainCategory({
            name: selected.product_name,
            categoryTags: parseCategoryTags(selected.categories_tags),
            source: 'dump',
          })
        : null,
    [selected],
  );

  const freeTextTrace = useMemo(() => {
    const tags = freeTextTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    return explainCategory({ name: freeText, categoryTags: tags, source: 'free_text' });
  }, [freeText, freeTextTags]);

  return (
    <div className="shell">
      <header className="top">
        <div className="eyebrow">shopping-list · classifyCategory()/explainCategory() gegen den echten Dump</div>
        <h1>Kategorie-Radar</h1>
        <p className="lede">
          Durchsucht die tatsächlich heruntergeladene <code>off-dump.db</code> (derselbe Release wie{' '}
          <code>ensureOffDumpDownloaded()</code> in der App) und zeigt zu jedem echten Treffer den vollen
          Entscheidungs-Trace von <code>explainCategory()</code>.
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

      <section className="panel">
        <div className="panel-head">
          <span className="panel-title">Freitext- & Barcode-Tester</span>
        </div>
        <div className="search-row">
          <div>
            <label className="field-label" htmlFor="free-text">
              Artikelname
            </label>
            <input
              id="free-text"
              className="text-input"
              type="text"
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder="z. B. Apfelsaft"
              spellCheck={false}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="free-text-tags">
              OFF-Tags (kommagetrennt, optional)
            </label>
            <input
              id="free-text-tags"
              className="text-input"
              type="text"
              value={freeTextTags}
              onChange={(e) => setFreeTextTags(e.target.value)}
              placeholder="en:porks, en:meats"
              spellCheck={false}
            />
          </div>
        </div>
        <div
          className="article-name"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: escapeHtml() laeuft ueber jeden Teil davor
          dangerouslySetInnerHTML={{ __html: highlight(freeText, freeTextTrace.winner.evidence?.value) }}
        />
        <TraceView trace={freeTextTrace} />
      </section>

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
          <div className="search-row" style={{ marginTop: 12 }}>
            <div>
              <label className="field-label" htmlFor="q">
                Suche im Dump (Name oder EAN)
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
        </div>

        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">Artikeldetails & Kategorie-Trace</span>
          </div>

          {!selected || !dumpTrace ? (
            <div className="detail-empty">Links einen Artikel auswählen.</div>
          ) : (
            <>
              <div className="article-head">
                <div
                  className="article-name"
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: escapeHtml() laeuft ueber jeden Teil davor
                  dangerouslySetInnerHTML={{
                    __html: highlight(selected.product_name, dumpTrace.winner.evidence?.value),
                  }}
                />
                <TraceView trace={dumpTrace} />
              </div>

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
                <div className="data-cell">
                  <div className="k">OFF-Kategorie-Tags</div>
                  <div className="v">
                    {parseCategoryTags(selected.categories_tags).join(', ') || '—'}
                  </div>
                </div>
                <div className="data-cell">
                  <div className="k">OFF zuletzt geändert</div>
                  <div className="v">{selected.off_last_modified_at || '—'}</div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <footer className="note">
        Datenquelle: <code>public/off-dump.db</code>, per <code>bun run download-dump</code> vom neuesten
        GitHub-Release (<code>goldjunge91/fam</code>) geladen — derselbe Release, den <code>off-dump.ts</code>{' '}
        in der App anhängt. Ab Dump Schema 2 (#223 Paket 4) läuft der Dump-Trace über echte
        OFF-Kategorie-Tags; gegen einen älteren Schema-1-Dump fehlt die Spalte einfach (kein Crash), der
        Trace fällt dann automatisch auf den Namens-Fallback zurück. Kategorie-Logik importiert direkt aus
        <code>src/features/shopping-list/classification/shopping-category-classifier.ts</code>, keine Kopie.
      </footer>
    </div>
  );
}
