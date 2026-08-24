import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Database } from 'sql.js';
import { CLASSIFIER_VERSION } from '../../../src/features/shopping-list/classification/classifier-version';
import { explainCategory } from '../../../src/features/shopping-list/classification/shopping-category-classifier';
import type { CategoryTrace } from '../../../src/features/shopping-list/classification/types';
import { SHOPPING_CATEGORIES } from '../../../src/features/shopping-list/domain-logik/shopping-categories';
import type { ProductRow } from './DumpBrowserView';
import { CrowdSignalsView } from './CrowdSignalsView';
import {
  createBaselineRun,
  createEvaluationRun,
  exportEvaluationLabels,
  fetchEvaluationHealth,
  fetchBaselines,
  fetchEvaluationLabels,
  fetchEvaluationRun,
  fetchEvaluationRuns,
  fetchRuleProposals,
  fetchSilverLabels,
  generateSilverLabels,
  importEvaluationLabels,
  reviewSilverLabel,
  saveEvaluationLabel,
} from './evaluation/api';
import { buildConfusionMatrix, compareEvaluationRuns, computeEvaluationMetrics } from './evaluation/metrics';
import { parseCategoryTags } from './evaluation/product';
import { legacyCategoryForTaxonomy } from './evaluation/legacy-category-adapter';
import {
  PLACEMENT_ZONE_DEFINITIONS,
  PRODUCT_FAMILY_GROUPS,
  PRODUCT_FORM_DEFINITIONS,
  TAXONOMY_VERSION,
  placementZoneLabel,
  productFamilyLabel,
  productFormLabel,
  resolvePlacementZone,
  type PlacementZoneId,
  type ProductFamilyId,
  type ProductFormId,
} from './evaluation/taxonomy';
import type {
  BaselineDefinition,
  BaselineId,
  CanonicalCategoryId,
  EvaluationClass,
  EvaluationLabel,
  EvaluationProduct,
  EvaluationPrediction,
  EvaluationQueue,
  EvaluationRun,
  EvaluationRunDetail,
  EvaluationSilverLabel,
  EvaluationSplit,
  RuleProposal,
  SaveEvaluationLabel,
} from './evaluation/types';

type CandidateRow = ProductRow & {
  product_key: string;
  snapshot_hash: string;
  dataset_split: EvaluationSplit;
  combined_category: CanonicalCategoryId | null;
  combined_source: 'off_taxonomy' | 'name_fallback' | null;
  off_category: CanonicalCategoryId | null;
  name_category: CanonicalCategoryId | null;
  conflict_reason: string | null;
};

type QueueCounts = Record<EvaluationQueue, number>;
type ApiState = 'loading' | 'ready' | 'error';

const QUEUES: { id: EvaluationQueue; label: string; description: string }[] = [
  { id: 'disagreement', label: 'OFF vs. Name', description: 'Beide Signale liefern verschiedene Kategorien.' },
  { id: 'tie', label: 'Gleichstände', description: 'Der Classifier enthält sich wegen gleich starker Kandidaten.' },
  { id: 'no_signal', label: 'Kein Signal', description: 'Weder OFF noch Name liefern eine Kategorie.' },
  { id: 'stratified', label: 'Zufallsstichprobe', description: 'Deterministische Stichprobe über klassifizierte Produkte.' },
  { id: 'version_changes', label: 'Versionsänderungen', description: 'Labels, deren Vorhersage zwischen zwei Runs wechselte.' },
];

function categoryDisplay(categoryId: string | null): { label: string; color: string } {
  if (!categoryId || categoryId === 'other') return { label: 'Sonstiges', color: '#91878d' };
  const category = SHOPPING_CATEGORIES.find((candidate) => candidate.id === categoryId);
  return category ? { label: category.label, color: category.color } : { label: categoryId, color: '#91878d' };
}

function formatPercent(value: number | null): string {
  return value === null ? '—' : `${(value * 100).toFixed(1)} %`;
}

function ProductFrontImage({ barcode }: { barcode: string | null }) {
  const [missing, setMissing] = useState(false);
  if (!barcode || missing) return <div className="evaluation-product-image missing">Kein Frontbild lokal</div>;
  return (
    <div className="evaluation-product-image">
      <img src={`/api/images/${encodeURIComponent(barcode)}/front`} alt="Produktvorderseite" onError={() => setMissing(true)} />
    </div>
  );
}

function evaluationSource(source: CategoryTrace['winner']['source']): EvaluationPrediction['predictionSource'] {
  return source === 'off_taxonomy' || source === 'name_fallback' ? source : null;
}

function currentPredictions(labels: readonly EvaluationLabel[]): EvaluationPrediction[] {
  return labels.map((label) => {
    const trace = explainCategory({ name: label.name, categoryTags: label.categoryTags, source: 'dump' });
    return {
      labelId: label.id,
      predictedCategoryId: trace.winner.categoryId as CanonicalCategoryId | null,
      predictionSource: evaluationSource(trace.winner.source),
      conflictReason: trace.conflictReason,
      trace,
    };
  });
}

function queueCondition(queue: EvaluationQueue): string {
  switch (queue) {
    case 'disagreement':
      return 'c.is_disagreement = 1';
    case 'tie':
      return 'c.is_tie = 1';
    case 'no_signal':
      return 'c.is_no_signal = 1';
    case 'stratified':
      return 'c.combined_category is not null';
    case 'version_changes':
      return '0 = 1';
  }
}

function loadQueueCounts(db: Database): Omit<QueueCounts, 'version_changes'> {
  const result = db.exec(`
    select
      sum(is_disagreement) as disagreement,
      sum(is_tie) as tie,
      sum(is_no_signal) as no_signal,
      sum(case when combined_category is not null then 1 else 0 end) as stratified
    from category_evaluation_candidates
  `);
  const values = result[0]?.values[0] ?? [0, 0, 0, 0];
  return {
    disagreement: Number(values[0] ?? 0),
    tie: Number(values[1] ?? 0),
    no_signal: Number(values[2] ?? 0),
    stratified: Number(values[3] ?? 0),
  };
}

function queryCandidates(
  db: Database,
  queue: EvaluationQueue,
  labeledKeys: ReadonlySet<string>,
  changedProductKeys: readonly string[],
): CandidateRow[] {
  const rows: CandidateRow[] = [];
  const pageSize = 500;
  for (let offset = 0; offset < 5000 && rows.length < 100; offset += pageSize) {
    const changedPlaceholders = changedProductKeys.map((_, index) => `:changed${index}`).join(', ');
    const condition = queue === 'version_changes'
      ? changedProductKeys.length > 0 ? `c.product_key in (${changedPlaceholders})` : '0 = 1'
      : queueCondition(queue);
    const candidateSource = queue === 'stratified'
      ? `(select *, row_number() over (
           partition by combined_category
           order by sample_hash, product_rowid
         ) as stratum_rank
         from category_evaluation_candidates
         where combined_category is not null) c`
      : 'category_evaluation_candidates c';
    const order = queue === 'stratified'
      ? 'c.stratum_rank, c.combined_category, c.product_rowid'
      : 'c.sample_hash, c.product_rowid';
    const statement = db.prepare(`
      select p.*, c.product_key, c.snapshot_hash, c.dataset_split,
             c.combined_category, c.combined_source, c.off_category, c.name_category,
             c.conflict_reason
      from ${candidateSource}
      join products p on p.rowid = c.product_rowid
      where ${condition}
      order by ${order}
      limit :limit offset :offset
    `);
    const params: Record<string, string | number> = { ':limit': pageSize, ':offset': offset };
    changedProductKeys.forEach((key, index) => { params[`:changed${index}`] = key; });
    statement.bind(params);
    let read = 0;
    while (statement.step()) {
      read++;
      const row = statement.getAsObject() as unknown as CandidateRow;
      if (!labeledKeys.has(row.product_key)) rows.push(row);
      if (rows.length >= 100) break;
    }
    statement.free();
    if (read < pageSize) break;
  }
  return rows;
}

function TraceAfterReview({ trace }: { trace: CategoryTrace }) {
  const winner = categoryDisplay(trace.winner.categoryId);
  return (
    <div className="evaluation-trace" aria-live="polite">
      <div className="evaluation-trace-result">
        <span className="evaluation-category-dot" style={{ background: winner.color }} />
        <strong>{winner.label}</strong>
        <span>{trace.winner.source ?? 'kein Signal'}</span>
      </div>
      {trace.conflictReason && <div className="evaluation-conflict">{trace.conflictReason}</div>}
      <div className="evaluation-trace-list">
        {trace.candidates.length === 0 ? (
          <div className="evaluation-trace-line">Keine Kandidaten gefunden.</div>
        ) : trace.candidates.map((candidate, index) => {
          const display = categoryDisplay(candidate.categoryId);
          const winnerMatch = candidate.categoryId === trace.winner.categoryId
            && candidate.value === trace.winner.evidence?.value;
          return (
            <div className="evaluation-trace-line" key={`${candidate.kind}-${candidate.value}-${index}`}>
              <span>{candidate.weight}</span>
              <span className="evaluation-category-dot" style={{ background: display.color }} />
              <span>{display.label} · {candidate.value}</span>
              <strong>{winnerMatch ? 'Gewinner' : 'verworfen'}</strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type Props = { db: Database | null; dumpCount: number };

export function EvaluationView({ db, dumpCount }: Props) {
  const [mode, setMode] = useState<'review' | 'crowd' | 'silver' | 'analysis'>('review');
  const [apiState, setApiState] = useState<ApiState>('loading');
  const [apiError, setApiError] = useState<string | null>(null);
  const [reviewerName, setReviewerName] = useState('');
  const [labels, setLabels] = useState<EvaluationLabel[]>([]);
  const [runs, setRuns] = useState<EvaluationRun[]>([]);
  const [queue, setQueue] = useState<EvaluationQueue>('disagreement');
  const [queueCounts, setQueueCounts] = useState<QueueCounts>({ disagreement: 0, tie: 0, no_signal: 0, stratified: 0, version_changes: 0 });
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [note, setNote] = useState('');
  const [productFamily, setProductFamily] = useState<ProductFamilyId | ''>('');
  const [productForm, setProductForm] = useState<ProductFormId | ''>('');
  const [placementZone, setPlacementZone] = useState<PlacementZoneId | ''>('');
  const [saving, setSaving] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [analysisSplit, setAnalysisSplit] = useState<'all' | EvaluationSplit>('calibration');
  const [creatingRun, setCreatingRun] = useState(false);
  const [baselineRunId, setBaselineRunId] = useState<number | null>(null);
  const [candidateRunId, setCandidateRunId] = useState<number | null>(null);
  const [baselineRun, setBaselineRun] = useState<EvaluationRunDetail | null>(null);
  const [candidateRun, setCandidateRun] = useState<EvaluationRunDetail | null>(null);
  const [silverLabels, setSilverLabels] = useState<EvaluationSilverLabel[]>([]);
  const [llmConfigured, setLlmConfigured] = useState(false);
  const [llmModel, setLlmModel] = useState('');
  const [generatingSilver, setGeneratingSilver] = useState(false);
  const [baselines, setBaselines] = useState<BaselineDefinition[]>([]);
  const [selectedBaseline, setSelectedBaseline] = useState<BaselineId>('linear_ngram');
  const [runningBaseline, setRunningBaseline] = useState(false);
  const [ruleProposals, setRuleProposals] = useState<RuleProposal[]>([]);
  const [loadingRuleProposals, setLoadingRuleProposals] = useState(false);
  const [transferringLabels, setTransferringLabels] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const labeledKeys = useMemo(() => new Set(labels.flatMap((label) => (
    label.expectedProductFamilyId && label.expectedProductFormId && label.expectedPlacementZoneId
      ? [label.productKey]
      : []
  ))), [labels]);
  const labeledKeysRef = useRef<ReadonlySet<string>>(labeledKeys);
  labeledKeysRef.current = labeledKeys;
  const labelById = useMemo(() => new Map(labels.map((label) => [label.id, label])), [labels]);
  const runComparison = useMemo(
    () => baselineRun && candidateRun
      ? compareEvaluationRuns(labels, baselineRun.predictions, candidateRun.predictions)
      : null,
    [baselineRun, candidateRun, labels],
  );
  const changedProductKeys = useMemo(
    () => runComparison?.changedLabelIds.flatMap((id) => {
      const label = labelById.get(id);
      return label ? [label.productKey] : [];
    }) ?? [],
    [labelById, runComparison],
  );
  const changedProductKeysSignature = changedProductKeys.join('\u0000');
  const changedProductKeysRef = useRef<readonly string[]>(changedProductKeys);
  changedProductKeysRef.current = changedProductKeys;

  const refreshRemote = useCallback(async () => {
    setApiState('loading');
    setApiError(null);
    try {
      const [health, nextLabels, nextRuns, nextSilverLabels, nextBaselines] = await Promise.all([
        fetchEvaluationHealth(),
        fetchEvaluationLabels(),
        fetchEvaluationRuns(),
        fetchSilverLabels(),
        fetchBaselines(),
      ]);
      setReviewerName(health.reviewer.displayName);
      setLabels(nextLabels);
      setRuns(nextRuns);
      setSilverLabels(nextSilverLabels);
      setLlmConfigured(health.llmConfigured);
      setLlmModel(health.llmModel);
      setBaselines(nextBaselines);
      setCandidateRunId((current) => current ?? nextRuns[0]?.id ?? null);
      setBaselineRunId((current) => current ?? nextRuns[1]?.id ?? null);
      setApiState('ready');
    } catch (error) {
      setApiError(error instanceof Error ? error.message : String(error));
      setApiState('error');
    }
  }, []);

  useEffect(() => { void refreshRemote(); }, [refreshRemote]);

  useEffect(() => {
    if (!db) return;
    try {
      const table = db.exec("select 1 from sqlite_master where type = 'table' and name = 'category_evaluation_candidates'");
      if (!table[0]?.values.length) throw new Error('Evaluation-Index fehlt. Führe bun run prepare-dump aus.');
      const base = loadQueueCounts(db);
      setQueueCounts({ ...base, version_changes: changedProductKeys.length });
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : String(error));
    }
  }, [changedProductKeys.length, db]);

  const loadCandidates = useCallback(() => {
    if (!db || apiState !== 'ready') return;
    try {
      setCandidates(queryCandidates(db, queue, labeledKeysRef.current, changedProductKeysRef.current));
      setRevealed(false);
      setNote('');
      setProductFamily('');
      setProductForm('');
      setPlacementZone('');
      setReviewError(null);
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : String(error));
    }
  }, [apiState, changedProductKeysSignature, db, queue]);

  useEffect(() => { loadCandidates(); }, [loadCandidates]);

  useEffect(() => {
    if (mode !== 'analysis' || apiState !== 'ready') return;
    setLoadingRuleProposals(true);
    void fetchRuleProposals()
      .then(setRuleProposals)
      .catch((error: unknown) => setApiError(error instanceof Error ? error.message : String(error)))
      .finally(() => setLoadingRuleProposals(false));
  }, [apiState, labels.length, mode]);

  useEffect(() => {
    if (!baselineRunId) { setBaselineRun(null); return; }
    void fetchEvaluationRun(baselineRunId).then(setBaselineRun).catch((error: unknown) => setApiError(error instanceof Error ? error.message : String(error)));
  }, [baselineRunId]);

  useEffect(() => {
    if (!candidateRunId) { setCandidateRun(null); return; }
    void fetchEvaluationRun(candidateRunId).then(setCandidateRun).catch((error: unknown) => setApiError(error instanceof Error ? error.message : String(error)));
  }, [candidateRunId]);

  const activeProduct = candidates[0] ?? null;
  const activeTags = useMemo(() => parseCategoryTags(activeProduct?.categories_tags), [activeProduct]);
  const activeTrace = useMemo(
    () => activeProduct
      ? explainCategory({ name: activeProduct.product_name, categoryTags: activeTags, source: 'dump' })
      : null,
    [activeProduct, activeTags],
  );

  useEffect(() => {
    if (productFamily && productForm) setPlacementZone(resolvePlacementZone(productFamily, productForm));
  }, [productFamily, productForm]);

  const submitLabel = useCallback(async (status: SaveEvaluationLabel['status']) => {
    if (!activeProduct || !activeTrace || saving) return;
    const isLabeled = status === 'labeled';
    if (isLabeled && (!productFamily || !productForm || !placementZone)) return;
    setSaving(true);
    setReviewError(null);
    try {
      const saved = await saveEvaluationLabel({
        productKey: activeProduct.product_key,
        snapshotHash: activeProduct.snapshot_hash,
        barcode: /^[0-9]{6,32}$/.test(activeProduct.code ?? '') ? activeProduct.code : null,
        name: activeProduct.product_name,
        brand: activeProduct.brand,
        quantity: activeProduct.quantity,
        categoryTags: activeTags,
        split: activeProduct.dataset_split,
        expectedCategoryId: isLabeled && productFamily && productForm
          ? legacyCategoryForTaxonomy(productFamily, productForm)
          : null,
        status,
        note: note.trim() || null,
        classifierVersionAtLabel: CLASSIFIER_VERSION,
        originalPredictionCategoryId: activeTrace.winner.categoryId as CanonicalCategoryId | null,
        originalPredictionSource: evaluationSource(activeTrace.winner.source),
        expectedProductFamilyId: isLabeled && productFamily ? productFamily : null,
        expectedProductFormId: isLabeled && productForm ? productForm : null,
        expectedPlacementZoneId: isLabeled && placementZone ? placementZone : null,
        taxonomyVersionAtLabel: isLabeled ? TAXONOMY_VERSION : null,
      });
      setLabels((current) => [saved, ...current.filter((label) => label.id !== saved.id)]);
      setRevealed(true);
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }, [activeProduct, activeTags, activeTrace, note, placementZone, productFamily, productForm, saving]);

  const nextProduct = useCallback(() => {
    const remaining = activeProduct
      ? candidates.slice(1).filter((candidate) => !labeledKeys.has(candidate.product_key))
      : [];
    setCandidates(remaining);
    setRevealed(false);
    setNote('');
    setProductFamily('');
    setProductForm('');
    setPlacementZone('');
    if (remaining.length === 0) loadCandidates();
  }, [activeProduct, candidates, labeledKeys, loadCandidates]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (mode !== 'review' || target?.matches('input, textarea, select, button')) return;
      if (revealed && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        nextProduct();
        return;
      }
      if (revealed) return;
      if (event.key.toLowerCase() === 'm') {
        event.preventDefault(); void submitLabel('ambiguous');
      } else if (event.key.toLowerCase() === 'x') {
        event.preventDefault(); void submitLabel('invalid');
      } else if (event.key === ' ') {
        event.preventDefault(); nextProduct();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode, nextProduct, revealed, submitLabel]);

  const filteredLabels = useMemo(
    () => analysisSplit === 'all' ? labels : labels.filter((label) => label.split === analysisSplit),
    [analysisSplit, labels],
  );
  const livePredictions = useMemo(() => currentPredictions(filteredLabels), [filteredLabels]);
  const metrics = useMemo(() => computeEvaluationMetrics(filteredLabels, livePredictions), [filteredLabels, livePredictions]);
  const confusionMatrix = useMemo(() => buildConfusionMatrix(metrics), [metrics]);
  const livePredictionByLabel = useMemo(() => new Map(livePredictions.map((prediction) => [prediction.labelId, prediction])), [livePredictions]);

  const handleCreateRun = async () => {
    setCreatingRun(true);
    setApiError(null);
    try {
      const run = await createEvaluationRun();
      setRuns((current) => [run, ...current]);
      setBaselineRunId(candidateRunId);
      setCandidateRunId(run.id);
      setCandidateRun(run);
      if (candidateRun) setBaselineRun(candidateRun);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : String(error));
    } finally {
      setCreatingRun(false);
    }
  };

  const handleExport = async () => {
    setTransferringLabels(true);
    setApiError(null);
    try {
      const exported = await exportEvaluationLabels();
      const blob = new Blob([`${JSON.stringify(exported, null, 2)}\n`], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `category-evaluation-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : String(error));
    } finally {
      setTransferringLabels(false);
    }
  };

  const handleImport = async (file: File | undefined) => {
    if (!file) return;
    setTransferringLabels(true);
    setApiError(null);
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const result = await importEvaluationLabels(parsed as Parameters<typeof importEvaluationLabels>[0]);
      setLabels(result.labels);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : String(error));
    } finally {
      setTransferringLabels(false);
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  const handleGenerateSilver = async () => {
    const products: EvaluationProduct[] = candidates.slice(0, 10).map((candidate) => ({
      productKey: candidate.product_key,
      snapshotHash: candidate.snapshot_hash,
      barcode: /^[0-9]{6,32}$/.test(candidate.code ?? '') ? candidate.code : null,
      name: candidate.product_name,
      brand: candidate.brand,
      quantity: candidate.quantity,
      categoryTags: parseCategoryTags(candidate.categories_tags),
      split: candidate.dataset_split,
    }));
    if (products.length === 0) return;
    setGeneratingSilver(true);
    setApiError(null);
    try {
      const generated = await generateSilverLabels(products);
      const generatedIds = new Set(generated.map((label) => label.id));
      setSilverLabels((current) => [...generated, ...current.filter((label) => !generatedIds.has(label.id))]);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : String(error));
    } finally {
      setGeneratingSilver(false);
    }
  };

  const handleReviewSilver = async (id: number, reviewStatus: 'accepted' | 'rejected') => {
    setApiError(null);
    try {
      const updated = await reviewSilverLabel(id, reviewStatus);
      setSilverLabels((current) => current.map((label) => label.id === updated.id ? updated : label));
    } catch (error) {
      setApiError(error instanceof Error ? error.message : String(error));
    }
  };

  const handleBaselineRun = async () => {
    setRunningBaseline(true);
    setApiError(null);
    try {
      const run = await createBaselineRun(selectedBaseline);
      setRuns((current) => [run, ...current]);
      setBaselineRunId(candidateRunId);
      setCandidateRunId(run.id);
      setCandidateRun(run);
      if (candidateRun) setBaselineRun(candidateRun);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : String(error));
    } finally {
      setRunningBaseline(false);
    }
  };

  return (
    <div className="evaluation-shell">
      <div className="evaluation-mode-nav">
        <button type="button" className={mode === 'review' ? 'active' : ''} onClick={() => setMode('review')}>Blind Review</button>
        <button type="button" className={mode === 'crowd' ? 'active' : ''} onClick={() => setMode('crowd')}>Rohsignale</button>
        <button type="button" className={mode === 'silver' ? 'active' : ''} onClick={() => setMode('silver')}>LLM Silver</button>
        <button type="button" className={mode === 'analysis' ? 'active' : ''} onClick={() => setMode('analysis')}>Analyse</button>
        <span className={`evaluation-api-state ${apiState}`}>{apiState === 'ready' ? `${reviewerName} · Supabase verbunden` : apiState === 'loading' ? 'Backend wird verbunden' : 'Backend nicht erreichbar'}</span>
      </div>

      {(apiError || reviewError) && <div className="evaluation-error" role="alert">{apiError ?? reviewError}</div>}

      {mode === 'review' ? (
        <div className="evaluation-review-layout">
          <aside className="evaluation-queues">
            <div className="evaluation-section-title">Review-Queues</div>
            {QUEUES.map((entry) => (
              <button
                type="button"
                className={queue === entry.id ? 'active' : ''}
                key={entry.id}
                title={entry.description}
                onClick={() => { setQueue(entry.id); setRevealed(false); }}>
                <span>{entry.label}</span>
                <strong>{queueCounts[entry.id].toLocaleString('de-DE')}</strong>
              </button>
            ))}
            <div className="evaluation-review-summary">
              <span>Neue Gold-Taxonomie</span><strong>{labels.filter((label) => label.expectedProductFamilyId !== null).length.toLocaleString('de-DE')}</strong>
              <span>Legacy-Labels</span><strong>{labels.filter((label) => label.expectedProductFamilyId === null).length.toLocaleString('de-DE')}</strong>
              <span>Calibration</span><strong>{labels.filter((label) => label.split === 'calibration').length.toLocaleString('de-DE')}</strong>
              <span>Holdout</span><strong>{labels.filter((label) => label.split === 'holdout').length.toLocaleString('de-DE')}</strong>
            </div>
          </aside>

          <main className="evaluation-review-main">
            {!activeProduct || !activeTrace ? (
              <div className="evaluation-empty">
                <strong>Keine unbewerteten Produkte in dieser Queue.</strong>
                <span>Queue wechseln oder einen Versionsvergleich erzeugen.</span>
              </div>
            ) : (
              <>
                <div className="evaluation-progress-line">
                  <span>{QUEUES.find((entry) => entry.id === queue)?.label}</span>
                  <span>{candidates.length} vorgeladen</span>
                </div>
                <div className="evaluation-product-header">
                  <ProductFrontImage key={activeProduct.product_key} barcode={activeProduct.code} />
                  <div>
                    <h2>{activeProduct.product_name}</h2>
                    <div className="evaluation-product-meta">{activeProduct.brand || 'Keine Marke'} · {activeProduct.quantity || 'Keine Menge'} · EAN {activeProduct.code || '—'}</div>
                    <div className="evaluation-tags">{activeTags.length > 0 ? activeTags.join(' · ') : 'Keine OFF-Tags'}</div>
                  </div>
                </div>

                {!revealed ? (
                  <>
                    <div className="evaluation-question">Produkt fachlich einordnen</div>
                    <div className="evaluation-taxonomy-form">
                      <label htmlFor="evaluation-family">1 · Was ist es?</label>
                      <select id="evaluation-family" value={productFamily} onChange={(event) => setProductFamily(event.target.value as ProductFamilyId | '')}>
                        <option value="">Produktfamilie wählen</option>
                        {PRODUCT_FAMILY_GROUPS.map((group) => (
                          <optgroup label={group.label} key={group.label}>
                            {group.families.map(([id, label]) => <option value={id} key={id}>{label}</option>)}
                          </optgroup>
                        ))}
                      </select>
                      <label htmlFor="evaluation-form">2 · In welcher Form?</label>
                      <select id="evaluation-form" value={productForm} onChange={(event) => setProductForm(event.target.value as ProductFormId | '')}>
                        <option value="">Produktform wählen</option>
                        {PRODUCT_FORM_DEFINITIONS.map((entry) => <option value={entry.id} key={entry.id}>{entry.label}</option>)}
                      </select>
                      <label htmlFor="evaluation-zone">3 · Standardzone prüfen</label>
                      <select id="evaluation-zone" value={placementZone} onChange={(event) => setPlacementZone(event.target.value as PlacementZoneId | '')}>
                        <option value="">Standardzone wählen</option>
                        {PLACEMENT_ZONE_DEFINITIONS.map((entry) => <option value={entry.id} key={entry.id}>{entry.label}</option>)}
                      </select>
                    </div>
                    <label className="evaluation-note-label" htmlFor="evaluation-note">Notiz, optional</label>
                    <textarea id="evaluation-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Warum ist dieser Fall wichtig?" />
                    <div className="evaluation-secondary-actions">
                      <button type="button" className="evaluation-save-gold" disabled={saving || !productFamily || !productForm || !placementZone} onClick={() => void submitLabel('labeled')}>Gold-Label speichern</button>
                      <button type="button" disabled={saving} onClick={() => void submitLabel('ambiguous')}>Mehrdeutig <kbd>M</kbd></button>
                      <button type="button" disabled={saving} onClick={() => void submitLabel('invalid')}>Ungültig <kbd>X</kbd></button>
                      <button type="button" disabled={saving} onClick={nextProduct}>Überspringen <kbd>Leertaste</kbd></button>
                    </div>
                  </>
                ) : (
                  <div className="evaluation-reveal">
                    <div className="evaluation-human-result">
                      {productFamily && productForm && placementZone
                        ? `${productFamilyLabel(productFamily)} · ${productFormLabel(productForm)} · ${placementZoneLabel(placementZone)}`
                        : 'Menschliche Bewertung gespeichert'}
                    </div>
                    <TraceAfterReview trace={activeTrace} />
                    <button type="button" className="evaluation-next" onClick={nextProduct}>Nächstes Produkt <kbd>Enter</kbd></button>
                  </div>
                )}
              </>
            )}
          </main>

          <aside className="evaluation-blind-trace">
            <div className="evaluation-section-title">Classifier-Trace</div>
            {revealed && activeTrace ? <TraceAfterReview trace={activeTrace} /> : <p>Der Trace wird erst nach dem menschlichen Label sichtbar.</p>}
          </aside>
        </div>
      ) : mode === 'crowd' ? (
        <CrowdSignalsView />
      ) : mode === 'silver' ? (
        <div className="evaluation-silver">
          <div className="evaluation-silver-toolbar">
            <div>
              <div className="evaluation-section-title">LLM-Trainingslabels</div>
              <p>Silver-Labels trainieren Modelle, werden aber niemals als Gold-Holdout gewertet.</p>
            </div>
            <button type="button" disabled={!llmConfigured || generatingSilver || candidates.length === 0} onClick={() => void handleGenerateSilver()}>
              {generatingSilver ? 'LLM verarbeitet bis zu 10 Produkte' : 'Bis zu 10 Produkte labeln (API-Kosten)'}
            </button>
          </div>
          <div className="evaluation-silver-summary">
            <span>Modell</span><strong>{llmModel || 'nicht konfiguriert'}</strong>
            <span>Ausstehend</span><strong>{silverLabels.filter((label) => label.reviewStatus === 'pending').length}</strong>
            <span>Akzeptiert</span><strong>{silverLabels.filter((label) => label.reviewStatus === 'accepted').length}</strong>
            <span>Abgelehnt</span><strong>{silverLabels.filter((label) => label.reviewStatus === 'rejected').length}</strong>
          </div>
          {!llmConfigured && <div className="evaluation-error">OPENAI_API_KEY fehlt im lokalen API-Prozess. Es wurde keine Modellanfrage ausgeführt.</div>}
          <div className="evaluation-silver-list">
            {silverLabels.length === 0 ? (
              <div className="evaluation-empty"><strong>Noch keine Silver-Labels.</strong><span>Wähle links im Blind Review eine Queue und starte anschließend einen kleinen LLM-Lauf.</span></div>
            ) : silverLabels.map((label) => (
              <article key={label.id} className={`evaluation-silver-row ${label.reviewStatus}`}>
                <ProductFrontImage barcode={label.barcode} />
                <div className="evaluation-silver-content">
                  <div className="evaluation-silver-head">
                    <div><strong>{label.name}</strong><span>{label.brand || 'Keine Marke'} · {label.barcode || label.productKey}</span></div>
                    <span>{label.reviewStatus}</span>
                  </div>
                  <div className="evaluation-silver-proposal">
                    <strong>{label.annotationStatus === 'labeled' ? categoryDisplay(label.proposedCategoryId).label : label.annotationStatus}</strong>
                    {label.alternativeCategoryId && <span>Alternative: {categoryDisplay(label.alternativeCategoryId).label}</span>}
                  </div>
                  <p>{label.rationale || 'Keine Begründung.'}</p>
                  <div className="evaluation-tags">{label.evidence.length > 0 ? label.evidence.join(' · ') : 'Keine Evidenz angegeben'} · {label.modelName} · {label.promptVersion}</div>
                  {label.reviewStatus === 'pending' && (
                    <div className="evaluation-secondary-actions">
                      <button type="button" disabled={label.annotationStatus !== 'labeled'} onClick={() => void handleReviewSilver(label.id, 'accepted')}>Als Silver akzeptieren</button>
                      <button type="button" onClick={() => void handleReviewSilver(label.id, 'rejected')}>Ablehnen</button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <div className="evaluation-analysis">
          <div className="evaluation-analysis-toolbar">
            <div>
              <label htmlFor="analysis-split">Datensatz</label>
              <select id="analysis-split" value={analysisSplit} onChange={(event) => setAnalysisSplit(event.target.value as typeof analysisSplit)}>
                <option value="calibration">Calibration</option>
                <option value="holdout">Holdout, nur final prüfen</option>
                <option value="all">Alle Labels</option>
              </select>
            </div>
            <div className="evaluation-analysis-actions">
              <input ref={importInputRef} type="file" accept="application/json,.json" hidden onChange={(event) => void handleImport(event.target.files?.[0])} />
              <button type="button" disabled={transferringLabels} onClick={() => importInputRef.current?.click()}>JSON importieren</button>
              <button type="button" disabled={transferringLabels || labels.length === 0} onClick={() => void handleExport()}>JSON exportieren</button>
              <button type="button" disabled={creatingRun || apiState !== 'ready'} onClick={() => void handleCreateRun()}>{creatingRun ? 'Run wird gespeichert' : 'Aktuellen Run speichern'}</button>
            </div>
          </div>

          <div className="evaluation-metrics-strip">
            <div><strong>{metrics.labeledCount}</strong><span>gelabelt</span></div>
            <div><strong>{formatPercent(metrics.accuracy)}</strong><span>Accuracy</span></div>
            <div><strong>{formatPercent(metrics.coverage)}</strong><span>Abdeckung</span></div>
            <div><strong>{formatPercent(metrics.macroF1)}</strong><span>Macro-F1</span></div>
          </div>

          <div className="evaluation-analysis-grid">
            <section>
              <div className="evaluation-section-title">Kategorien</div>
              <div className="evaluation-table-wrap">
                <table className="evaluation-table">
                  <thead><tr><th>Kategorie</th><th>Support</th><th>Precision</th><th>Recall</th><th>F1</th></tr></thead>
                  <tbody>{metrics.categoryMetrics.filter((metric) => metric.support > 0 || metric.falsePositive > 0).map((metric) => (
                    <tr key={metric.categoryId}>
                      <td>{categoryDisplay(metric.categoryId).label}</td><td>{metric.support}</td><td>{formatPercent(metric.precision)}</td><td>{formatPercent(metric.recall)}</td><td>{formatPercent(metric.f1)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </section>

            <aside>
              <div className="evaluation-section-title">Häufigste Verwechslungen</div>
              <div className="evaluation-confusions">
                {metrics.confusion.filter((entry) => entry.expected !== entry.predicted).slice(0, 10).map((entry) => (
                  <div key={`${entry.expected}-${entry.predicted}`}><span>{categoryDisplay(entry.expected).label} → {categoryDisplay(entry.predicted).label}</span><strong>{entry.count}</strong></div>
                ))}
                {metrics.confusion.every((entry) => entry.expected === entry.predicted) && <p>Noch keine Fehlklassifikationen im gewählten Split.</p>}
              </div>
              <div className="evaluation-section-title evaluation-version-title">Versionsvergleich</div>
              <div className="evaluation-run-selectors">
                <label>Baseline<select value={baselineRunId ?? ''} onChange={(event) => setBaselineRunId(event.target.value ? Number(event.target.value) : null)}><option value="">Keine</option>{runs.map((run) => <option value={run.id} key={run.id}>v{run.classifierVersion} · {new Date(run.createdAt).toLocaleString('de-DE')}</option>)}</select></label>
                <label>Candidate<select value={candidateRunId ?? ''} onChange={(event) => setCandidateRunId(event.target.value ? Number(event.target.value) : null)}><option value="">Keine</option>{runs.map((run) => <option value={run.id} key={run.id}>v{run.classifierVersion} · {new Date(run.createdAt).toLocaleString('de-DE')}</option>)}</select></label>
              </div>
              {runComparison ? (
                <div className="evaluation-comparison">
                  <div><span>verbessert</span><strong>{runComparison.improved}</strong></div>
                  <div><span>verschlechtert</span><strong>{runComparison.regressed}</strong></div>
                  <div><span>neu klassifiziert</span><strong>{runComparison.newlyClassified}</strong></div>
                  <div><span>neu Sonstiges</span><strong>{runComparison.newlyUnclassified}</strong></div>
                </div>
              ) : <p className="evaluation-muted">Zwei gespeicherte Runs auswählen.</p>}

              <div className="evaluation-section-title evaluation-version-title">Modell-Baselines</div>
              <div className="evaluation-baseline-controls">
                <select value={selectedBaseline} onChange={(event) => setSelectedBaseline(event.target.value as BaselineId)}>
                  {baselines.map((baseline) => <option key={baseline.id} value={baseline.id} disabled={!baseline.available}>{baseline.label}{baseline.available ? '' : ' · nicht bereit'}</option>)}
                </select>
                {(() => {
                  const selected = baselines.find((baseline) => baseline.id === selectedBaseline);
                  if (!selected) return null;
                  return <p>{selected.description}{selected.unavailableReason ? ` ${selected.unavailableReason}` : ''}{selected.externalNetwork ? ' Dieser Lauf kann Netzwerkzugriffe oder Modelldownloads auslösen.' : ''}</p>;
                })()}
                <button
                  type="button"
                  disabled={runningBaseline || !baselines.find((baseline) => baseline.id === selectedBaseline)?.available}
                  onClick={() => void handleBaselineRun()}>
                  {runningBaseline ? 'Baseline läuft' : 'Baseline starten'}
                </button>
              </div>
            </aside>
          </div>

          <section>
            <div className="evaluation-section-title">Automatische Regelvorschläge</div>
            <p className="evaluation-analysis-note">Nur aus Calibration-Gold gelernt. Holdout wird ausschließlich als getrennte Validierung angezeigt. Kein Vorschlag verändert den produktiven Klassifikator automatisch.</p>
            <div className="evaluation-table-wrap">
              <table className="evaluation-table evaluation-rule-table">
                <thead><tr><th>Signal</th><th>Ziel</th><th>Calibration</th><th>Lift</th><th>Aktuelle Fehler</th><th>Holdout</th><th>Beispiele</th></tr></thead>
                <tbody>
                  {ruleProposals.map((proposal) => (
                    <tr key={`${proposal.signalType}:${proposal.signal}:${proposal.categoryId}`}>
                      <td><strong>{proposal.signal}</strong><span>{proposal.signalType}</span></td>
                      <td>{categoryDisplay(proposal.categoryId).label}</td>
                      <td>{proposal.calibrationMatches} · {formatPercent(proposal.calibrationPrecision)}</td>
                      <td>{proposal.calibrationLift.toFixed(1)}×</td>
                      <td>{proposal.currentClassifierErrors}</td>
                      <td>{proposal.holdoutMatches === 0 ? 'keine Treffer' : `${proposal.holdoutMatches} · ${formatPercent(proposal.holdoutPrecision)}`}</td>
                      <td title={proposal.examples.join(' · ')}>{proposal.examples.join(' · ')}</td>
                    </tr>
                  ))}
                  {!loadingRuleProposals && ruleProposals.length === 0 && <tr><td colSpan={7}>Noch zu wenig wiederkehrende Gold-Signale. Pro Signal sind mindestens drei Calibration-Treffer nötig.</td></tr>}
                  {loadingRuleProposals && <tr><td colSpan={7}>Regelvorschläge werden berechnet.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <div className="evaluation-section-title">Vollständige Confusion Matrix</div>
            <p className="evaluation-analysis-note">Zeilen sind menschliche Gold-Labels, Spalten die aktuelle Vorhersage.</p>
            <div className="evaluation-confusion-matrix-wrap">
              <table className="evaluation-confusion-matrix">
                <thead>
                  <tr>
                    <th>Gold ↓ / Modell →</th>
                    {confusionMatrix.map((row) => <th key={row.expected} title={categoryDisplay(row.expected).label}>{categoryDisplay(row.expected).label}</th>)}
                    <th>Σ</th>
                  </tr>
                </thead>
                <tbody>
                  {confusionMatrix.map((row) => (
                    <tr key={row.expected}>
                      <th>{categoryDisplay(row.expected).label}</th>
                      {confusionMatrix.map((column) => {
                        const value = row.counts[column.expected as EvaluationClass];
                        const className = row.expected === column.expected && value > 0 ? 'diagonal' : value > 0 ? 'error' : '';
                        return <td key={column.expected} className={className}>{value || ''}</td>;
                      })}
                      <td className="total">{row.total || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="evaluation-reviewed-products">
            <div className="evaluation-section-title">Bewertete Produkte</div>
            <div className="evaluation-table-wrap">
              <table className="evaluation-table">
                <thead><tr><th>Produkt</th><th>Split</th><th>Mensch</th><th>Classifier</th><th>Quelle</th><th>Ergebnis</th></tr></thead>
                <tbody>{filteredLabels.slice(0, 200).map((label) => {
                  const prediction = livePredictionByLabel.get(label.id);
                  const correct = label.status === 'labeled' && prediction?.predictedCategoryId === label.expectedCategoryId;
                  return (
                    <tr key={label.id}>
                      <td><strong>{label.name}</strong><span>{label.barcode || label.productKey}</span></td>
                      <td>{label.split}</td>
                      <td>{label.status === 'labeled' ? categoryDisplay(label.expectedCategoryId).label : label.status}</td>
                      <td>{prediction ? categoryDisplay(prediction.predictedCategoryId).label : '—'}</td>
                      <td>{prediction?.predictionSource ?? 'keine'}</td>
                      <td className={correct ? 'evaluation-correct' : 'evaluation-wrong'}>{label.status !== 'labeled' ? 'nicht gewertet' : correct ? 'korrekt' : 'falsch'}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          </section>
          <div className="evaluation-analysis-note">Dump: {dumpCount.toLocaleString('de-DE')} Produkte · Ambiguous: {metrics.ambiguousCount} · Invalid: {metrics.invalidCount} · Overclassified: {metrics.overclassifiedCount} · Missed: {metrics.missedCount}</div>
        </div>
      )}
    </div>
  );
}
