import { useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { Redirect } from 'expo-router';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Screen } from '@/components/layout/screen';
import { ContentCard } from '@/components/ui/content-card';
import { Button, Divider, Press, Row, Txt, type TxtTone } from '@/constants/ui';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { BarcodeScannerModal } from '@/features/inventory/barcode-scanner-modal';
import { useProductBarcodeLookup } from '@/features/product-search/hooks/use-product-barcode-lookup';
import type { CatalogProduct } from '@/features/product-search/types';
import { useDevToolsAccess } from '@/hooks/use-dev-tools-access';
import { useSyncStatus } from '@/hooks/use-sync-status';
import { trackAnalyticsEvent } from '@/lib/analytics';
import { metaOf } from '@/lib/db/entities';
import { getDatabase } from '@/lib/db/local-client';
import { deleteOutboxEntries, loadOutboxHistory, type OutboxHistoryEntry } from '@/lib/db/outbox';
import type { Entity, SqlDatabase } from '@/lib/db/types';
import { fromInventoryQuantityUnits } from '@/lib/inventory-quantity';
import { debugError } from '@/lib/observability/debug-log';
import { sendTestNotification } from '@/lib/platform/notifications';
import {
  getActiveSyncEngineIntervalCount,
  getLastRealtimeStatus,
  getLastSyncInfo,
  getRealtimeDiagnostics,
  getRealtimeLatencySamples,
  getRealtimeLatencySampleVersion,
  syncRunHasErrors,
  triggerHouseholdSync,
} from '@/lib/sync/sync-runner';

type OutboxRow = {
  id: number;
  entity: string;
  entity_id: string;
  op: string;
  payload: string;
  created_at: number;
  attempts: number;
  last_error: string | null;
};

type LocationRow = {
  id: string;
  name: string;
  kind: string;
  household_id: string;
};

type ItemRow = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  location_id: string | null;
  household_id: string;
};

const styles = StyleSheet.create((theme) => ({
  debugRow: { paddingVertical: theme.space.xs },
  debugItem: { paddingVertical: theme.space.sm, gap: theme.space.xs },
  debugAction: { minHeight: 44, justifyContent: 'center' },
  actionStack: { marginTop: theme.space.lg, gap: theme.space.sm },
  copyActions: { marginTop: theme.space.xs },
  flex: { flex: 1 },
  payload: { marginTop: theme.space.xs, fontFamily: 'monospace' },
}));

type DebugRowProps = {
  label: string;
  tone?: TxtTone;
  children: ReactNode;
};

function DebugRow({ label, tone, children }: DebugRowProps) {
  return (
    <Row justify="space-between" gap={0} style={styles.debugRow}>
      <Txt variant="caption">{label}</Txt>
      <Txt variant="caption" weight="700" tone={tone}>
        {children}
      </Txt>
    </Row>
  );
}

function DebugItem({ children }: { children: ReactNode }) {
  return (
    <>
      <View style={styles.debugItem}>{children}</View>
      <Divider />
    </>
  );
}

/**
 * Spalte mit dem Anzeigenamen je Entity. Entitaeten ohne Namensspalte
 * bleiben absichtlich draussen — dort zeigt die Historie weiter die ID.
 */
const ENTITY_NAME_COLUMNS: Partial<Record<Entity, string>> = {
  storage_locations: 'name',
  stores: 'name',
  purchase_receipt_items: 'name',
  fridge_items: 'name',
  shopping_list_items: 'name',
  products: 'name',
  households: 'name',
  recipes: 'title',
  recipe_components: 'name',
  recipe_steps: 'text',
  meal_plans: 'name',
  meal_plan_entries: 'custom_title',
  medication_logs: 'medication_name',
};

const MAX_NAME_LENGTH = 60;

function truncateName(name: string): string {
  return name.length > MAX_NAME_LENGTH ? `${name.slice(0, MAX_NAME_LENGTH - 1)}…` : name;
}

/** Name aus dem Mutations-Payload, falls die Spiegeltabelle nichts liefert. */
function payloadName(payload: string): string | null {
  try {
    const parsed: unknown = JSON.parse(payload);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    const candidate = record.name ?? record.title ?? record.custom_title ?? record.medication_name;
    return typeof candidate === 'string' && candidate.trim().length > 0 ? candidate.trim() : null;
  } catch {
    return null;
  }
}

/** Loest die Anzeigenamen der Outbox-Historie aus den lokalen Spiegeltabellen auf. */
async function loadEntityNames(
  db: SqlDatabase,
  entries: readonly OutboxHistoryEntry[],
): Promise<Map<string, string>> {
  const idsByEntity = new Map<Entity, Set<string>>();
  for (const entry of entries) {
    if (!ENTITY_NAME_COLUMNS[entry.entity]) continue;
    const ids = idsByEntity.get(entry.entity) ?? new Set<string>();
    ids.add(entry.entity_id);
    idsByEntity.set(entry.entity, ids);
  }

  const names = new Map<string, string>();
  for (const [entity, ids] of idsByEntity) {
    const column = ENTITY_NAME_COLUMNS[entity];
    const idList = [...ids];
    const placeholders = idList.map(() => '?').join(', ');
    const rows = await db.getAllAsync<{ id: string; name: string | null }>(
      `select id, ${column} as name from ${metaOf(entity).table} where id in (${placeholders})`,
      idList,
    );
    for (const row of rows) {
      if (row.name && row.name.trim().length > 0) {
        names.set(`${entity}:${row.id}`, row.name.trim());
      }
    }
  }
  return names;
}

/** Anzeigename des Historien-Eintrags; UUID bleibt nur der Fallback. */
function historyName(row: OutboxHistoryEntry, entityNames: Map<string, string>): string {
  const resolved = entityNames.get(`${row.entity}:${row.entity_id}`) ?? payloadName(row.payload);
  return resolved ? truncateName(resolved) : `ID: ${row.entity_id}`;
}

export function SyncDebugScreen() {
  const hasAccess = useDevToolsAccess();
  const queryClient = useQueryClient();
  const { activeHousehold } = useActiveHousehold();
  const currentHousehold = activeHousehold;
  const syncStatus = useSyncStatus(getDatabase);

  const [loading, setLoading] = useState(false);
  const [showScannerTest, setShowScannerTest] = useState(false);
  const [outboxRows, setOutboxRows] = useState<OutboxRow[]>([]);
  const [outboxHistoryRows, setOutboxHistoryRows] = useState<OutboxHistoryEntry[]>([]);
  const [entityNames, setEntityNames] = useState<Map<string, string>>(new Map());
  const [locationRows, setLocationRows] = useState<LocationRow[]>([]);
  const [itemRows, setItemRows] = useState<ItemRow[]>([]);
  // Polling aktualisiert den aus Modulzustand gelesenen Realtime-Status.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => forceTick((t) => t + 1), 2000);
    return () => clearInterval(interval);
  }, []);
  const lastSyncInfo = getLastSyncInfo();
  const realtimeStatus = getLastRealtimeStatus();
  const activeIntervalCount = getActiveSyncEngineIntervalCount();
  const realtimeDiagnostics = getRealtimeDiagnostics();
  const latencySamples = getRealtimeLatencySamples();
  const latencySampleVersion = getRealtimeLatencySampleVersion();
  // Nur bei neuen Latenz-Samples neu berechnen, nicht bei jedem Polling-Tick.
  // biome-ignore lint/correctness/useExhaustiveDependencies: latencySamples-Referenz aendert sich nie (in-place mutiert), latencySampleVersion ist das eigentliche Signal
  const averageLatencyMs = useMemo(() => {
    const numericSamples = latencySamples
      .map((s) => s.latencyMs)
      .filter((v): v is number => v !== null);
    if (numericSamples.length === 0) return null;
    return Math.round(numericSamples.reduce((sum, v, _i, arr) => sum + v / arr.length, 0));
  }, [latencySampleVersion]);

  async function handleTestNotification() {
    const result = await sendTestNotification();
    Alert.alert(result.success ? 'Erfolg' : 'Hinweis', result.message);
  }

  function handleProductScanned(product: CatalogProduct) {
    Alert.alert(
      'Produkt erkannt! 📷',
      `Name: ${product.name}\nMarke: ${product.brand ?? '—'}\nBarcode: ${product.barcode}\nMenge: ${product.quantity} ${product.unit}`,
    );
  }

  const barcodeLookup = useProductBarcodeLookup({ onFound: handleProductScanned });

  function closeScanner() {
    setShowScannerTest(false);
    barcodeLookup.reset();
  }

  const loadDebugData = useCallback(async () => {
    try {
      const db = await getDatabase();
      const outbox = await db.getAllAsync<OutboxRow>(
        'select * from outbox order by id desc limit 20',
      );
      const outboxHistory = await loadOutboxHistory(db, 20);
      const names = await loadEntityNames(db, outboxHistory);
      const locs = await db.getAllAsync<LocationRow>(
        'select id, name, kind, household_id from storage_locations limit 20',
      );
      const items = await db.getAllAsync<ItemRow>(
        'select id, name, quantity, unit, location_id, household_id from fridge_items limit 20',
      );

      setOutboxRows(outbox);
      setOutboxHistoryRows(outboxHistory);
      setEntityNames(names);
      setLocationRows(locs);
      setItemRows(
        items.map((item) => ({
          ...item,
          quantity: fromInventoryQuantityUnits(item.quantity),
        })),
      );
    } catch (err) {
      debugError('Fehler beim Laden der Debug-Daten:', err);
    }
  }, []);

  useEffect(() => {
    loadDebugData();
  }, [loadDebugData]);

  async function handleSyncNow() {
    if (!currentHousehold || loading) return;
    setLoading(true);
    trackAnalyticsEvent('sync.manual.started', { source: 'sync_debug' });
    try {
      const result = await triggerHouseholdSync([currentHousehold.id], true, queryClient);
      trackAnalyticsEvent(
        syncRunHasErrors(result) ? 'sync.manual.failed' : 'sync.manual.completed',
        { source: 'sync_debug' },
      );
      queryClient.invalidateQueries();
      await loadDebugData();
    } finally {
      setLoading(false);
    }
  }

  async function handleClearOutbox() {
    Alert.alert(
      'Outbox leeren?',
      'Dies löscht ungesendete lokale Änderungen aus der Warteschlange.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Leeren',
          style: 'destructive',
          onPress: async () => {
            const db = await getDatabase();
            const rows = await db.getAllAsync<{ id: number }>('select id from outbox');
            await deleteOutboxEntries(
              db,
              rows.map((row) => row.id),
            );
            queryClient.invalidateQueries();
            await loadDebugData();
          },
        },
      ],
    );
  }

  const [copiedRowId, setCopiedRowId] = useState<number | null>(null);

  async function handleCopyOutbox(row: OutboxRow) {
    const textToCopy = row.last_error
      ? `Outbox #${row.id} ${row.op.toUpperCase()} ${row.entity}\nID: ${row.entity_id} | Versuche: ${row.attempts}\nFehler: ${row.last_error}\nPayload: ${row.payload}`
      : `Outbox #${row.id} ${row.op.toUpperCase()} ${row.entity}\nID: ${row.entity_id} | Versuche: ${row.attempts}\nPayload: ${row.payload}`;
    await Clipboard.setStringAsync(textToCopy);
    setCopiedRowId(row.id);
    setTimeout(() => setCopiedRowId(null), 2000);
  }

  function handleDeleteOutboxEntry(row: OutboxRow) {
    Alert.alert(
      `Eintrag #${row.id} löschen?`,
      'Diese einzelne fehlgeschlagene Änderung wird verworfen und nicht mehr synchronisiert.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            const db = await getDatabase();
            await deleteOutboxEntries(db, [row.id]);
            queryClient.invalidateQueries();
            await loadDebugData();
          },
        },
      ],
    );
  }

  const formattedLastSync = lastSyncInfo?.timestamp
    ? new Date(lastSyncInfo.timestamp).toLocaleTimeString('de-DE')
    : 'Noch nicht synchronisiert';

  if (!hasAccess) {
    return <Redirect href="/settings" />;
  }

  return (
    <Screen
      title="Sync-Diagnose"
      back={{ label: 'Synchronisation', href: '/settings/sync' }}
      backStyle="icon">
      <ContentCard title="Letzter Synchronisations-Lauf">
        <DebugRow label="Uhrzeit:">{formattedLastSync}</DebugRow>
        {lastSyncInfo && (
          <>
            <DebugRow label="Hochgeladen (Pushed):">{lastSyncInfo.pushedCount} Einträge</DebugRow>
            <DebugRow label="Empfangen (Pulled):">{lastSyncInfo.pulledCount} Zeilen</DebugRow>
          </>
        )}
        <DebugRow label="Aktueller Sync-Status:">{syncStatus.kind.toUpperCase()}</DebugRow>
        <DebugRow
          label="Realtime-Verbindung:"
          tone={realtimeStatus === 'SUBSCRIBED' ? 'success' : 'danger'}>
          {realtimeStatus ?? 'nie verbunden'}
        </DebugRow>
        <DebugRow
          label="Aktive Poll-Intervalle:"
          tone={activeIntervalCount > 1 ? 'danger' : 'success'}>
          {activeIntervalCount}
          {activeIntervalCount > 1 ? ' — sollte 1 sein!' : ''}
        </DebugRow>
        <DebugRow label="Realtime Status-Wechsel gesamt:">
          {realtimeDiagnostics.statusChangeCount}
        </DebugRow>
        <DebugRow
          label="Realtime Reconnects gesamt:"
          tone={realtimeDiagnostics.reconnectCount > 0 ? 'danger' : 'success'}>
          {realtimeDiagnostics.reconnectCount}
        </DebugRow>
        <View style={styles.actionStack}>
          <Button
            title="Jetzt synchronisieren & prüfen"
            onPress={handleSyncNow}
            loading={loading}
          />
        </View>
      </ContentCard>

      {/* Realtime-Latenzmessungen & Samples */}
      <ContentCard title={`Realtime-Latenz (letzte ${latencySamples.length} Zeilen)`}>
        {latencySamples.length === 0 ? (
          <Txt variant="caption" tone="secondary">
            Noch keine ueber Realtime empfangene Zeile in dieser Sitzung. Auf einem zweiten Geraet
            etwas aendern, um Messwerte zu sammeln.
          </Txt>
        ) : (
          <>
            <DebugRow
              label="Letzte Latenz:"
              tone={
                (latencySamples[latencySamples.length - 1].latencyMs ?? 0) > 2000
                  ? 'danger'
                  : 'success'
              }>
              {latencySamples[latencySamples.length - 1].latencyMs ?? '—'} ms
            </DebugRow>
            <DebugRow label="Durchschnitt:">
              {averageLatencyMs === null ? '—' : `${averageLatencyMs} ms`}
            </DebugRow>
            {latencySamples
              .slice()
              .reverse()
              .map((sample, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: Ringpuffer ohne stabile Id, Reihenfolge aendert sich nicht rueckwirkend
                <DebugItem key={i}>
                  <Txt variant="caption" tone="secondary">
                    {new Date(sample.timestamp).toLocaleTimeString('de-DE')} —{' '}
                    {sample.op.toUpperCase()} {sample.entity}: {sample.latencyMs ?? '—'} ms
                  </Txt>
                </DebugItem>
              ))}
          </>
        )}
      </ContentCard>

      {/* Live-Tests für Push-Mitteilungen und Barcode-Scanner */}
      <ContentCard title="Live-Test (Hardware & Push)">
        <Txt variant="caption" tone="secondary">
          Test-Aktionen für lokale Mitteilungen und die Kamera-Barcode-Erkennung.
        </Txt>

        <View style={styles.actionStack}>
          <Button title="🔔 Test-Benachrichtigung senden" onPress={handleTestNotification} />
          <Button
            title="📷 Barcode-Scanner testen"
            variant="secondary"
            onPress={() => setShowScannerTest(true)}
          />
        </View>
      </ContentCard>

      {/* Aktiver Haushalt in der lokalen SQLite-DB */}
      <ContentCard title="Aktueller Haushalt in DB">
        <DebugRow label="Haushalts-Name:">
          {currentHousehold?.name ?? 'Kein Haushalt geladen'}
        </DebugRow>
        <DebugRow label="Haushalts-ID:" tone="secondary">
          {currentHousehold?.id ?? '—'}
        </DebugRow>
      </ContentCard>

      {/* Lokale Outbox-Warteschlange mit Mutations-Payloads und Fehlern */}
      <ContentCard title={`Lokale Outbox (${outboxRows.length} Einträge)`}>
        {outboxRows.length === 0 ? (
          <Txt variant="caption" tone="secondary">
            Outbox ist leer. Alle lokalen Änderungen sind synchronisiert!
          </Txt>
        ) : (
          outboxRows.map((row) => (
            <DebugItem key={row.id}>
              <Txt variant="caption" weight="700">
                #{row.id} {row.op.toUpperCase()} {row.entity}
              </Txt>
              <Txt variant="caption" tone="secondary">
                ID: {row.entity_id} | Versuche: {row.attempts}
              </Txt>
              {row.last_error && (
                <Press
                  onPress={() => void handleCopyOutbox(row)}
                  accessibilityRole="button"
                  accessibilityLabel="Fehler kopieren"
                  style={styles.debugAction}>
                  <Txt variant="caption" tone="danger">
                    Fehler: {row.last_error}
                  </Txt>
                </Press>
              )}
              {/* Payload bleibt als kompakte, monospace Debug-Information lesbar. */}
              <Press
                onPress={() => void handleCopyOutbox(row)}
                accessibilityRole="button"
                accessibilityLabel="Payload kopieren"
                style={styles.debugAction}>
                <Txt variant="caption" style={styles.payload}>
                  Payload: {row.payload}
                </Txt>
              </Press>
              <Row style={styles.copyActions}>
                <View style={styles.flex}>
                  <Button
                    title={copiedRowId === row.id ? '✓ Kopiert' : '📋 Kopieren'}
                    variant="secondary"
                    onPress={() => handleCopyOutbox(row)}
                  />
                </View>
                <View style={styles.flex}>
                  <Button
                    title="Eintrag löschen"
                    variant="secondary"
                    onPress={() => handleDeleteOutboxEntry(row)}
                  />
                </View>
              </Row>
            </DebugItem>
          ))
        )}

        {outboxRows.length > 0 && (
          <View style={styles.actionStack}>
            <Button title="Outbox leeren (Notfall)" variant="danger" onPress={handleClearOutbox} />
          </View>
        )}
      </ContentCard>

      <ContentCard title={`Outbox-Historie (${outboxHistoryRows.length} Einträge)`}>
        {outboxHistoryRows.length === 0 ? (
          <Txt variant="caption" tone="secondary">
            Noch keine lokale Outbox-Aktion aufgezeichnet.
          </Txt>
        ) : (
          outboxHistoryRows.map((row) => {
            const statusLabel = {
              queued: 'offen',
              failed: 'fehlgeschlagen',
              pushed: 'synchronisiert',
              discarded: 'verworfen',
            }[row.status];
            const statusTone: TxtTone =
              row.status === 'pushed'
                ? 'success'
                : row.status === 'failed'
                  ? 'danger'
                  : row.status === 'discarded'
                    ? 'warning'
                    : 'secondary';

            return (
              <DebugItem key={row.id}>
                <Row justify="space-between" gap={0}>
                  <Txt variant="caption" weight="700">
                    #{row.outbox_id} {row.op.toUpperCase()} {row.entity}
                  </Txt>
                  <Txt variant="caption" weight="700" tone={statusTone}>
                    {statusLabel}
                  </Txt>
                </Row>
                <Txt variant="caption" tone="secondary">
                  {new Date(row.created_at).toLocaleString('de-DE')} ·{' '}
                  {historyName(row, entityNames)}
                </Txt>
                <Txt variant="caption" tone="secondary">
                  Versuche: {row.attempts}
                  {row.completed_at
                    ? ` · Abschluss: ${new Date(row.completed_at).toLocaleString('de-DE')}`
                    : ''}
                </Txt>
                {row.last_error ? (
                  <Txt variant="caption" tone="danger">
                    Fehler: {row.last_error}
                  </Txt>
                ) : null}
              </DebugItem>
            );
          })
        )}
      </ContentCard>

      {/* Lokale Lagerorte aus SQLite */}
      <ContentCard title={`Lokale Lagerorte (${locationRows.length} Orte)`}>
        {locationRows.length === 0 ? (
          <Txt variant="caption" tone="secondary">
            Keine Lagerorte lokal in SQLite gefunden.
          </Txt>
        ) : (
          locationRows.map((loc) => (
            <DebugItem key={loc.id}>
              <Txt variant="caption" weight="700">
                {loc.name}
              </Txt>
              <Txt variant="caption" tone="secondary">
                Typ: {loc.kind} | ID: {loc.id}
              </Txt>
            </DebugItem>
          ))
        )}
      </ContentCard>

      {/* Lokale Lebensmittel aus SQLite */}
      <ContentCard title={`Lokale Lebensmittel (${itemRows.length} Artikel)`}>
        {itemRows.length === 0 ? (
          <Txt variant="caption" tone="secondary">
            Keine Artikel lokal in SQLite gefunden.
          </Txt>
        ) : (
          itemRows.map((item) => (
            <DebugItem key={item.id}>
              <Txt variant="caption" weight="700">
                {item.name} ({item.quantity} {item.unit})
              </Txt>
              <Txt variant="caption" tone="secondary">
                Lagerort-ID: {item.location_id ?? 'Keiner'} | Artikel-ID: {item.id}
              </Txt>
            </DebugItem>
          ))
        )}
      </ContentCard>

      {/* Barcode-Scanner Testmodal */}
      <BarcodeScannerModal
        visible={showScannerTest}
        onClose={closeScanner}
        onBarcodeDetected={barcodeLookup.lookup}
        looking={barcodeLookup.looking}
        errorMessage={barcodeLookup.errorMessage}
      />
    </Screen>
  );
}
