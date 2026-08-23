import { useMemo, useState } from 'react';
import type { Database } from 'sql.js';
import {
  classifyCategory,
  explainCategory,
} from '../../../src/features/shopping-list/classification/shopping-category-classifier';
import type { CategoryTrace } from '../../../src/features/shopping-list/classification/types';
import {
  type ShoppingCategory,
  SHOPPING_CATEGORIES,
} from '../../../src/features/shopping-list/domain-logik/shopping-categories';

export type ProductRow = {
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
  categories_tags?: string | null;
  off_last_modified_at?: string | null;
};

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

type Props = {
  db: Database | null;
  onSelectForRadar?: (product: ProductRow) => void;
};

const PAGE_SIZES = [25, 50, 100, 200];

export function DumpBrowserView({ db, onSelectForRadar }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [nutriFilter, setNutriFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [activeModalProduct, setActiveModalProduct] = useState<ProductRow | null>(null);

  // Kategorien mit Sortierung
  const sortedCategories = useMemo(
    () => [...SHOPPING_CATEGORIES].sort((a, b) => a.sortOrder - b.sortOrder),
    [],
  );

  // Query-Filter zusammenbauen
  const { totalCount, rows } = useMemo(() => {
    if (!db) return { totalCount: 0, rows: [] };

    try {
      db.create_function('classify_category', (name: string, tagsJson: string) => {
        if (!name) return 'OTHER';
        const tags = parseCategoryTags(tagsJson);
        return classifyCategory({ name, categoryTags: tags }).categoryId ?? 'OTHER';
      });
    } catch {}

    const conditions: string[] = [];
    const params: Record<string, string | number> = {};

    const trimmed = searchTerm.trim();
    if (trimmed) {
      const isBarcode = /^\d{6,}$/.test(trimmed);
      if (isBarcode) {
        conditions.push('code = :searchExact');
        params[':searchExact'] = trimmed;
      } else {
        conditions.push('(lower(product_name) like :searchLike or lower(brand) like :searchLike)');
        params[':searchLike'] = `%${trimmed.toLowerCase()}%`;
      }
    }

    if (nutriFilter !== 'ALL') {
      if (nutriFilter === 'UNKNOWN') {
        conditions.push('(nutriscore is null or nutriscore = "" or nutriscore = "unknown")');
      } else {
        conditions.push('lower(nutriscore) = :nutri');
        params[':nutri'] = nutriFilter.toLowerCase();
      }
    }

    if (selectedCategory !== 'ALL') {
      conditions.push('classify_category(product_name, categories_tags) = :cat');
      params[':cat'] = selectedCategory;
    }

    const whereClause = conditions.length > 0 ? `where ${conditions.join(' and ')}` : '';

    // Zähle Gesamtanzahl
    let count = 0;
    try {
      const countStmt = db.prepare(`select count(*) from products ${whereClause}`);
      countStmt.bind(params);
      if (countStmt.step()) {
        count = Number(countStmt.get()[0] ?? 0);
      }
      countStmt.free();
    } catch (err) {
      console.error('Count query error:', err);
    }

    // Lade paginierte Zeilen
    const offset = (page - 1) * pageSize;
    params[':limit'] = pageSize;
    params[':offset'] = offset;

    const dataRows: ProductRow[] = [];
    try {
      const dataStmt = db.prepare(
        `select * from products ${whereClause} order by product_name limit :limit offset :offset`,
      );
      dataStmt.bind(params);
      while (dataStmt.step()) {
        dataRows.push(dataStmt.getAsObject() as unknown as ProductRow);
      }
      dataStmt.free();
    } catch (err) {
      console.error('Data query error:', err);
    }

    return { totalCount: count, rows: dataRows };
  }, [db, searchTerm, nutriFilter, page, pageSize, selectedCategory]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Trace für das Modal
  const modalTrace: CategoryTrace | null = useMemo(() => {
    if (!activeModalProduct) return null;
    return explainCategory({
      name: activeModalProduct.product_name,
      categoryTags: parseCategoryTags(activeModalProduct.categories_tags),
      source: 'dump',
    });
  }, [activeModalProduct]);

  return (
    <div className="dump-browser">
      <div className="browser-toolbar panel">
        <div className="browser-search-row">
          <div className="search-input-col">
            <label className="field-label" htmlFor="browser-search">
              Produktsuche (Name, Marke oder EAN-Barcode)
            </label>
            <input
              id="browser-search"
              className="text-input"
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              placeholder="z. B. Brombeeren, Edeka, 4311501682357..."
              spellCheck={false}
            />
          </div>

          <div className="filter-col">
            <label className="field-label" htmlFor="category-select">
              Kategorie-Filter
            </label>
            <select
              id="category-select"
              className="select-input"
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setPage(1);
              }}>
              <option value="ALL">Alle Kategorien anzeigen</option>
              <option value="OTHER">Nur Sonstiges (Unkategorisiert)</option>
              {sortedCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.sortOrder}. {c.label} ({c.id})
                </option>
              ))}
            </select>
          </div>

          <div className="filter-col-small">
            <label className="field-label" htmlFor="nutri-select">
              Nutri-Score
            </label>
            <select
              id="nutri-select"
              className="select-input"
              value={nutriFilter}
              onChange={(e) => {
                setNutriFilter(e.target.value);
                setPage(1);
              }}>
              <option value="ALL">Alle</option>
              <option value="A">Nutri-Score A</option>
              <option value="B">Nutri-Score B</option>
              <option value="C">Nutri-Score C</option>
              <option value="D">Nutri-Score D</option>
              <option value="E">Nutri-Score E</option>
              <option value="UNKNOWN">Unbekannt</option>
            </select>
          </div>
        </div>

        {/* Paginierungs-Leiste */}
        <div className="pagination-bar">
          <div className="pagination-info">
            Gefunden: <strong>{totalCount.toLocaleString('de-DE')}</strong> Produkte · Seite{' '}
            <strong>{page}</strong> von <strong>{totalPages}</strong>
          </div>

          <div className="pagination-controls">
            <button
              type="button"
              className="page-btn"
              disabled={page <= 1}
              onClick={() => setPage(1)}>
              ««
            </button>
            <button
              type="button"
              className="page-btn"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}>
              « Zurück
            </button>
            <span className="page-current">{page}</span>
            <button
              type="button"
              className="page-btn"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              Weiter »
            </button>
            <button
              type="button"
              className="page-btn"
              disabled={page >= totalPages}
              onClick={() => setPage(totalPages)}>
              »»
            </button>

            <select
              className="select-input-sm"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}>
              {PAGE_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s} / Seite
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Produkt-Tabelle */}
      <div className="table-container panel">
        {rows.length === 0 ? (
          <div className="empty" style={{ padding: '3rem', textAlign: 'center' }}>
            Keine Produkte für diese Suchkriterien im Dump gefunden.
          </div>
        ) : (
          <table className="dump-table">
            <thead>
              <tr>
                <th style={{ width: '130px' }}>EAN / Barcode</th>
                <th>Produktname & Marke</th>
                <th style={{ width: '190px' }}>Berechnete Kategorie</th>
                <th style={{ width: '80px', textAlign: 'center' }}>Nutri</th>
                <th style={{ width: '90px' }}>Menge</th>
                <th style={{ width: '220px' }}>OFF-Tags</th>
                <th style={{ width: '100px', textAlign: 'right' }}>Aktion</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((product) => {
                const tags = parseCategoryTags(product.categories_tags);
                const trace = explainCategory({
                  name: product.product_name,
                  categoryTags: tags,
                  source: 'dump',
                });
                const display = categoryDisplay(trace.winner.categoryId);

                return (
                  <tr key={product.code ?? product.product_name}>
                    <td className="mono" style={{ fontSize: '0.85rem' }}>
                      {product.code || '—'}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{product.product_name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>
                        {product.brand || 'Keine Marke angegeben'}
                        {product.stores ? ` · ${product.stores}` : ''}
                      </div>
                    </td>
                    <td>
                      <span
                        className="cat-pill"
                        style={{
                          background: `${display.color}22`,
                          color: display.color,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}>
                        <span className="cat-dot" style={{ background: display.color }} />
                        {display.label}
                      </span>
                      <div style={{ fontSize: '0.72rem', color: 'var(--ink-faint)', marginTop: '2px' }}>
                        via {trace.winner.source === 'off_taxonomy' ? 'OFF-Tag' : trace.winner.source === 'name_fallback' ? 'Name' : 'keins'}
                        {trace.winner.evidence?.value ? ` (${trace.winner.evidence.value})` : ''}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {product.nutriscore ? (
                        <span className={`nutri-badge nutri-${product.nutriscore.toLowerCase()}`}>
                          {product.nutriscore.toUpperCase()}
                        </span>
                      ) : (
                        <span style={{ color: '#aaa', fontSize: '0.8rem' }}>—</span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--ink-muted)' }}>
                      {product.quantity || '—'}
                    </td>
                    <td>
                      {tags.length > 0 ? (
                        <div className="tag-chips">
                          {tags.slice(0, 3).map((t) => (
                            <span key={t} className="tag-chip" title={t}>
                              {t.replace(/^en:/, '')}
                            </span>
                          ))}
                          {tags.length > 3 && (
                            <span className="tag-chip more">+{tags.length - 3}</span>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: '#aaa', fontSize: '0.8rem' }}>keine</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="action-btn"
                        onClick={() => setActiveModalProduct(product)}>
                        Trace 🔍
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Trace Modal / Dialog */}
      {activeModalProduct && modalTrace && (
        <div className="modal-backdrop" onClick={() => setActiveModalProduct(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Entscheidungs-Trace für Produkt</h3>
              <button
                type="button"
                className="close-btn"
                onClick={() => setActiveModalProduct(null)}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '1.1rem' }}>
                  {activeModalProduct.product_name}
                </h4>
                <div style={{ fontSize: '0.85rem', color: 'var(--ink-muted)' }}>
                  Marke: {activeModalProduct.brand || '—'} · EAN: {activeModalProduct.code || '—'} · Menge: {activeModalProduct.quantity || '—'}
                </div>
              </div>

              {/* Detail-Trace */}
              <div className="panel" style={{ background: 'var(--surface)' }}>
                <div className="result-chip-row">
                  <span
                    className="cat-pill"
                    style={{
                      background: `${categoryDisplay(modalTrace.winner.categoryId).color}22`,
                      color: categoryDisplay(modalTrace.winner.categoryId).color,
                    }}>
                    <span
                      className="cat-dot"
                      style={{ background: categoryDisplay(modalTrace.winner.categoryId).color }}
                    />
                    {categoryDisplay(modalTrace.winner.categoryId).label}
                  </span>
                  <span className={`match-badge ${modalTrace.winner.source ?? 'none'}`}>
                    {modalTrace.winner.source === 'off_taxonomy'
                      ? 'OFF-Taxonomie'
                      : modalTrace.winner.source === 'name_fallback'
                        ? 'Namens-Fallback'
                        : 'kein Signal'}
                  </span>
                </div>

                <div className="trace-list" style={{ marginTop: '12px' }}>
                  {modalTrace.candidates.map((cand, i) => {
                    const isWinner =
                      cand.categoryId === modalTrace.winner.categoryId &&
                      cand.value === modalTrace.winner.evidence?.value;
                    const disp = categoryDisplay(cand.categoryId);
                    return (
                      <div
                        key={i}
                        className={`trace-row ${isWinner ? 'hit safe' : 'checked'}`}>
                        <span className="trace-idx">{cand.weight}</span>
                        <span className="trace-dot" style={{ background: disp.color }} />
                        <span className="trace-cat">
                          {disp.label}
                          <span className="trace-detail">
                            via {cand.kind === 'off_tag' ? 'OFF-Tag' : 'Namensregel'} „{cand.value}“
                          </span>
                        </span>
                        <span className="trace-status">
                          {isWinner ? '✓ Gewinner' : 'verworfen'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Nährwerte */}
              <div className="data-grid" style={{ marginTop: '16px' }}>
                <div className="data-cell">
                  <div className="k">Nutri-Score</div>
                  <div className="v">{activeModalProduct.nutriscore?.toUpperCase() || '—'}</div>
                </div>
                <div className="data-cell">
                  <div className="k">kcal / 100g</div>
                  <div className="v">{activeModalProduct.energy_kcal ?? '—'}</div>
                </div>
                <div className="data-cell">
                  <div className="k">Fett / 100g</div>
                  <div className="v">{activeModalProduct.fat ?? '—'} g</div>
                </div>
                <div className="data-cell">
                  <div className="k">Kohlenhydrate</div>
                  <div className="v">{activeModalProduct.carbohydrates ?? '—'} g</div>
                </div>
                <div className="data-cell">
                  <div className="k">Eiweiß</div>
                  <div className="v">{activeModalProduct.proteins ?? '—'} g</div>
                </div>
                <div className="data-cell">
                  <div className="k">OFF-Tags</div>
                  <div className="v">
                    {parseCategoryTags(activeModalProduct.categories_tags).join(', ') || '—'}
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-foot">
              {onSelectForRadar && (
                <button
                  type="button"
                  className="action-btn-primary"
                  onClick={() => {
                    onSelectForRadar(activeModalProduct);
                    setActiveModalProduct(null);
                  }}>
                  Im Radar bearbeiten ↗
                </button>
              )}
              <button
                type="button"
                className="page-btn"
                onClick={() => setActiveModalProduct(null)}>
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
