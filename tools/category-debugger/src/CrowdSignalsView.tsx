import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchCrowdSignals, importCrowdSignals, saveCrowdSignalReview } from './evaluation/api';
import type {
  CrowdSignal,
  CrowdSignalImportFile,
  CrowdSignalReviewDecision,
} from './evaluation/types';
import {
  PLACEMENT_ZONE_DEFINITIONS,
  PRODUCT_FAMILY_GROUPS,
  PRODUCT_FORM_DEFINITIONS,
  resolvePlacementZone,
  type PlacementZoneId,
  type ProductFamilyId,
  type ProductFormId,
} from './evaluation/taxonomy';

type SignalQueue = 'unreviewed' | 'conflicts' | 'missing_store' | 'reviewed' | 'training';

const QUEUES: { id: SignalQueue; label: string }[] = [
  { id: 'unreviewed', label: 'Ungeprüft' },
  { id: 'conflicts', label: 'Konflikte' },
  { id: 'missing_store', label: 'Ohne Markt' },
  { id: 'reviewed', label: 'Geprüft' },
  { id: 'training', label: 'Trainingsfreigabe' },
];

function matchesQueue(signal: CrowdSignal, queue: SignalQueue): boolean {
  switch (queue) {
    case 'unreviewed':
      return signal.latestReview === null;
    case 'conflicts':
      return signal.latestReview?.decision === 'rejected' || signal.latestReview?.decision === 'insufficient_context';
    case 'missing_store':
      return signal.storeKey === null;
    case 'reviewed':
      return signal.latestReview !== null;
    case 'training':
      return signal.latestReview?.trainingApproved === true;
  }
}

function ProductImage({ barcode }: { barcode: string | null }) {
  const [missing, setMissing] = useState(false);
  if (!barcode || missing) return <div className="evaluation-product-image missing">Kein Frontbild lokal</div>;
  return (
    <div className="evaluation-product-image">
      <img src={`/api/images/${encodeURIComponent(barcode)}/front`} alt="Produktvorderseite" onError={() => setMissing(true)} />
    </div>
  );
}

export function CrowdSignalsView() {
  const [signals, setSignals] = useState<CrowdSignal[]>([]);
  const [queue, setQueue] = useState<SignalQueue>('unreviewed');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [decision, setDecision] = useState<CrowdSignalReviewDecision>('confirmed');
  const [family, setFamily] = useState<ProductFamilyId | ''>('');
  const [form, setForm] = useState<ProductFormId | ''>('');
  const [zone, setZone] = useState<PlacementZoneId | ''>('');
  const [trainingApproved, setTrainingApproved] = useState(false);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true);
    void fetchCrowdSignals()
      .then(setSignals)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason)))
      .finally(() => setLoading(false));
  }, []);

  const queueCounts = useMemo(() => Object.fromEntries(
    QUEUES.map((entry) => [entry.id, signals.filter((signal) => matchesQueue(signal, entry.id)).length]),
  ) as Record<SignalQueue, number>, [signals]);
  const visibleSignals = useMemo(() => signals.filter((signal) => matchesQueue(signal, queue)), [queue, signals]);
  const activeSignal = visibleSignals.find((signal) => signal.id === selectedId) ?? visibleSignals[0] ?? null;

  useEffect(() => {
    if (!activeSignal) return;
    const review = activeSignal.latestReview;
    setSelectedId(activeSignal.id);
    setDecision(review?.decision ?? 'confirmed');
    setFamily(review?.productFamilyId ?? '');
    setForm(review?.productFormId ?? '');
    setZone(review?.placementZoneId ?? '');
    setTrainingApproved(review?.trainingApproved ?? false);
    setNote(review?.note ?? '');
  }, [activeSignal?.id]);

  useEffect(() => {
    if (decision !== 'confirmed') {
      setFamily('');
      setForm('');
      setZone('');
      setTrainingApproved(false);
    }
  }, [decision]);

  const handleImport = async (file: File | undefined) => {
    if (!file) return;
    setTransferring(true);
    setError(null);
    try {
      const raw: unknown = JSON.parse(await file.text());
      const result = await importCrowdSignals(raw as CrowdSignalImportFile);
      setSignals(result.signals);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setTransferring(false);
      if (importRef.current) importRef.current.value = '';
    }
  };

  const handleReview = async () => {
    if (!activeSignal || saving) return;
    setSaving(true);
    setError(null);
    try {
      const confirmed = decision === 'confirmed';
      const review = await saveCrowdSignalReview({
        signalId: activeSignal.id,
        decision,
        productFamilyId: confirmed && family ? family : null,
        productFormId: confirmed && form ? form : null,
        placementZoneId: confirmed && zone ? zone : null,
        trainingApproved: confirmed && trainingApproved,
        note: note.trim() || null,
      });
      setSignals((current) => current.map((signal) => signal.id === activeSignal.id
        ? { ...signal, latestReview: review }
        : signal));
      setSelectedId(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="evaluation-review-layout evaluation-crowd-layout">
      <aside className="evaluation-queues">
        <div className="evaluation-section-title">Signal-Queues</div>
        {QUEUES.map((entry) => (
          <button type="button" className={queue === entry.id ? 'active' : ''} key={entry.id} onClick={() => { setQueue(entry.id); setSelectedId(null); }}>
            <span>{entry.label}</span>
            <strong>{queueCounts[entry.id].toLocaleString('de-DE')}</strong>
          </button>
        ))}
        <div className="evaluation-immutable-note">
          <strong>Append-only</strong>
          <span>Rohsignale und Reviews werden niemals überschrieben oder gelöscht.</span>
        </div>
        <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={(event) => void handleImport(event.target.files?.[0])} />
        <button type="button" disabled={transferring} onClick={() => importRef.current?.click()}>
          {transferring ? 'Import läuft' : 'Rohsignale importieren'}
        </button>
      </aside>

      <main className="evaluation-review-main">
        {error && <div className="evaluation-error" role="alert">{error}</div>}
        {loading ? (
          <div className="evaluation-empty"><strong>Rohsignale werden geladen.</strong></div>
        ) : !activeSignal ? (
          <div className="evaluation-empty"><strong>Keine Signale in dieser Queue.</strong><span>Die Alpha-App wird später versionierte JSON-Ereignisse liefern.</span></div>
        ) : (
          <>
            <div className="evaluation-progress-line"><span>Rohsignal #{activeSignal.id}</span><span>{visibleSignals.length} in Queue</span></div>
            <div className="evaluation-product-header">
              <ProductImage key={activeSignal.id} barcode={activeSignal.barcode} />
              <div>
                <h2>{activeSignal.productName}</h2>
                <div className="evaluation-product-meta">{activeSignal.barcode ?? 'Kein Barcode'} · {activeSignal.storeKey ?? 'Kein Markt'} · {activeSignal.source}</div>
                <div className="evaluation-tags">{activeSignal.fromZoneId ?? 'Keine Ausgangszone'} → {activeSignal.toZoneId}</div>
              </div>
            </div>

            <label className="evaluation-note-label" htmlFor="crowd-decision">Review-Entscheidung</label>
            <select id="crowd-decision" value={decision} onChange={(event) => setDecision(event.target.value as CrowdSignalReviewDecision)}>
              <option value="confirmed">Signal fachlich bestätigt</option>
              <option value="rejected">Signal abgelehnt</option>
              <option value="duplicate">Duplikat</option>
              <option value="insufficient_context">Zu wenig Kontext</option>
            </select>

            {decision === 'confirmed' && (
              <div className="evaluation-taxonomy-form">
                <label htmlFor="crowd-family">1 · Was ist es?</label>
                <select id="crowd-family" value={family} onChange={(event) => {
                  const nextFamily = event.target.value as ProductFamilyId | '';
                  setFamily(nextFamily);
                  if (nextFamily && form) setZone(resolvePlacementZone(nextFamily, form));
                }}>
                  <option value="">Produktfamilie wählen</option>
                  {PRODUCT_FAMILY_GROUPS.map((group) => (
                    <optgroup label={group.label} key={group.label}>
                      {group.families.map(([id, label]) => <option value={id} key={id}>{label}</option>)}
                    </optgroup>
                  ))}
                </select>
                <label htmlFor="crowd-form">2 · In welcher Form?</label>
                <select id="crowd-form" value={form} onChange={(event) => {
                  const nextForm = event.target.value as ProductFormId | '';
                  setForm(nextForm);
                  if (family && nextForm) setZone(resolvePlacementZone(family, nextForm));
                }}>
                  <option value="">Produktform wählen</option>
                  {PRODUCT_FORM_DEFINITIONS.map((entry) => <option value={entry.id} key={entry.id}>{entry.label}</option>)}
                </select>
                <label htmlFor="crowd-zone">3 · Platzierung prüfen</label>
                <select id="crowd-zone" value={zone} onChange={(event) => setZone(event.target.value as PlacementZoneId | '')}>
                  <option value="">Standardzone wählen</option>
                  {PLACEMENT_ZONE_DEFINITIONS.map((entry) => <option value={entry.id} key={entry.id}>{entry.label}</option>)}
                </select>
                <label className="evaluation-training-approval">
                  <input type="checkbox" checked={trainingApproved} onChange={(event) => setTrainingApproved(event.target.checked)} />
                  <span><strong>Explizit fürs Training freigeben</strong><small>Standardmäßig gesperrt, auch nach fachlicher Bestätigung.</small></span>
                </label>
              </div>
            )}

            <label className="evaluation-note-label" htmlFor="crowd-note">Review-Notiz, optional</label>
            <textarea id="crowd-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Begründung oder fehlender Kontext" />
            <button type="button" className="evaluation-next" disabled={saving || (decision === 'confirmed' && (!family || !form || !zone))} onClick={() => void handleReview()}>
              {saving ? 'Review wird gespeichert' : 'Review append-only speichern'}
            </button>
          </>
        )}
      </main>

      <aside className="evaluation-blind-trace evaluation-raw-signal">
        <div className="evaluation-section-title">Unverändertes Rohsignal</div>
        {activeSignal ? (
          <>
            <dl>
              <dt>Event</dt><dd>{activeSignal.eventId}</dd>
              <dt>Zeit</dt><dd>{new Date(activeSignal.occurredAt).toLocaleString('de-DE')}</dd>
              <dt>Classifier</dt><dd>{activeSignal.classifierVersion}</dd>
              <dt>Hash</dt><dd><code>{activeSignal.payloadSha256}</code></dd>
              <dt>Status</dt><dd>{activeSignal.latestReview?.trainingApproved ? 'Trainingsfreigegeben' : activeSignal.latestReview ? 'Geprüft, Training gesperrt' : 'Ungeprüft'}</dd>
            </dl>
            <pre>{JSON.stringify(activeSignal.rawPayload, null, 2)}</pre>
          </>
        ) : <p>Kein Signal ausgewählt.</p>}
      </aside>
    </div>
  );
}
