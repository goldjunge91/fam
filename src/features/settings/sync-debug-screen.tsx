import { useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Screen } from '@/components/layout/screen';
import { Button } from '@/components/ui/buttons';
import { Card } from '@/components/ui/card';
import { Txt } from '@/constants/ui';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { BarcodeScannerModal } from '@/features/inventory/barcode-scanner-modal';
import { useProductBarcodeLookup } from '@/features/product-search/hooks/use-product-barcode-lookup';
import type { CatalogProduct } from '@/features/product-search/types';
import { useSyncStatus } from '@/hooks/use-sync-status';
import { trackAnalyticsEvent } from '@/lib/analytics';
import { getDatabase } from '@/lib/db/client';
import { deleteOutboxEntries } from '@/lib/db/outbox';
import { sendTestNotification } from '@/lib/notifications';
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

export function SyncDebugScreen() {
  const queryClient = useQueryClient();
  const { activeHousehold } = useActiveHousehold();
  const currentHousehold = activeHousehold;
  const syncStatus = useSyncStatus(getDatabase);

  const [loading, setLoading] = useState(false);
  const [showScannerTest, setShowScannerTest] = useState(false);
  const [outboxRows, setOutboxRows] = useState<OutboxRow[]>([]);
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
      const locs = await db.getAllAsync<LocationRow>(
        'select id, name, kind, household_id from storage_locations limit 20',
      );
      const items = await db.getAllAsync<ItemRow>(
        'select id, name, quantity, unit, location_id, household_id from fridge_items limit 20',
      );

      setOutboxRows(outbox);
      setLocationRows(locs);
      setItemRows(items);
    } catch (err) {
      console.error('Fehler beim Laden der Debug-Daten:', err);
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
      const result = await triggerHouseholdSync([currentHousehold.id], true);
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
            await db.runAsync('delete from outbox');
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

  return (
    <Screen
      title="Sync-Diagnose"
      back={{ label: 'Synchronisation', href: '/settings/sync' }}
      backStyle="icon">
      <Card title="Letzter Synchronisations-Lauf">
        <View className="debug-row">
          <Txt variant="caption">Uhrzeit:</Txt>
          <Txt variant="caption" weight="700">{formattedLastSync}</Txt>
        </View>
        {lastSyncInfo && (
          <>
            <View className="debug-row">
              <Txt variant="caption">Hochgeladen (Pushed):</Txt>
              <Txt variant="caption" weight="700">{lastSyncInfo.pushedCount} Einträge</Txt>
            </View>
            <View className="debug-row">
              <Txt variant="caption">Empfangen (Pulled):</Txt>
              <Txt variant="caption" weight="700">{lastSyncInfo.pulledCount} Zeilen</Txt>
            </View>
          </>
        )}
        <View className="debug-row">
          <Txt variant="caption">Aktueller Sync-Status:</Txt>
          <Txt variant="caption" weight="700">{syncStatus.kind.toUpperCase()}</Txt>
        </View>
        <View className="debug-row">
          <Txt variant="caption">Realtime-Verbindung:</Txt>
          <Txt variant="caption" weight="700" tone={realtimeStatus === 'SUBSCRIBED' ? 'success' : 'danger'}>
            {realtimeStatus ?? 'nie verbunden'}
          </Txt>
        </View>
        <View className="debug-row">
          <Txt variant="caption">Aktive Poll-Intervalle:</Txt>
          <Txt variant="caption" weight="700" tone={activeIntervalCount > 1 ? 'danger' : 'success'}>
            {activeIntervalCount}
            {activeIntervalCount > 1 ? ' — sollte 1 sein!' : ''}
          </Txt>
        </View>
        <View className="debug-row">
          <Txt variant="caption">Realtime Status-Wechsel gesamt:</Txt>
          <Txt variant="caption" weight="700">{realtimeDiagnostics.statusChangeCount}</Txt>
        </View>
        <View className="debug-row">
          <Txt variant="caption">Realtime Reconnects gesamt:</Txt>
          <Txt variant="caption" weight="700" tone={realtimeDiagnostics.reconnectCount > 0 ? 'danger' : 'success'}>
            {realtimeDiagnostics.reconnectCount}
          </Txt>
        </View>
        <View className="mt-three">
          <Button
            label="Jetzt synchronisieren & prüfen"
            onPress={handleSyncNow}
            loading={loading}
          />
        </View>
      </Card>

      {/* Realtime-Latenzmessungen & Samples */}
      <Card title={`Realtime-Latenz (letzte ${latencySamples.length} Zeilen)`}>
        {latencySamples.length === 0 ? (
          <Txt variant="caption" tone="secondary">
            Noch keine ueber Realtime empfangene Zeile in dieser Sitzung. Auf einem zweiten Geraet
            etwas aendern, um Messwerte zu sammeln.
          </Txt>
        ) : (
          <>
            <View className="debug-row">
              <Txt variant="caption">Letzte Latenz:</Txt>
              <Txt
                variant="caption"
                weight="700"
                tone={
                  (latencySamples[latencySamples.length - 1].latencyMs ?? 0) > 2000
                    ? 'danger'
                    : 'success'
                }>
                {latencySamples[latencySamples.length - 1].latencyMs ?? '—'} ms
              </Txt>
            </View>
            <View className="debug-row">
              <Txt variant="caption">Durchschnitt:</Txt>
              <Txt variant="caption" weight="700">
                {averageLatencyMs === null ? '—' : `${averageLatencyMs} ms`}
              </Txt>
            </View>
            {latencySamples
              .slice()
              .reverse()
              .map((sample, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: Ringpuffer ohne stabile Id, Reihenfolge aendert sich nicht rueckwirkend
                <View key={i} className="debug-item">
                  <Txt variant="caption" tone="secondary">
                    {new Date(sample.timestamp).toLocaleTimeString('de-DE')} —{' '}
                    {sample.op.toUpperCase()} {sample.entity}: {sample.latencyMs ?? '—'} ms
                  </Txt>
                </View>
              ))}
          </>
        )}
      </Card>

      {/* Live-Tests für Push-Mitteilungen und Barcode-Scanner */}
      <Card title="Live-Test (Hardware & Push)">
        <Txt variant="caption" tone="secondary">
          Test-Aktionen für lokale Mitteilungen und die Kamera-Barcode-Erkennung.
        </Txt>

        <View className="action-stack">
          <Button label="🔔 Test-Benachrichtigung senden" onPress={handleTestNotification} />
          <Button
            label="📷 Barcode-Scanner testen"
            variant="secondary"
            onPress={() => setShowScannerTest(true)}
          />
        </View>
      </Card>

      {/* Aktiver Haushalt in der lokalen SQLite-DB */}
      <Card title="Aktueller Haushalt in DB">
        <View className="debug-row">
          <Txt variant="caption">Haushalts-Name:</Txt>
          <Txt variant="caption" weight="700">
            {currentHousehold?.name ?? 'Kein Haushalt geladen'}
          </Txt>
        </View>
        <View className="debug-row">
          <Txt variant="caption">Haushalts-ID:</Txt>
          <Txt variant="caption" tone="secondary">
            {currentHousehold?.id ?? '—'}
          </Txt>
        </View>
      </Card>

      {/* Lokale Outbox-Warteschlange mit Mutations-Payloads und Fehlern */}
      <Card title={`Lokale Outbox (${outboxRows.length} Einträge)`}>
        {outboxRows.length === 0 ? (
          <Txt variant="caption" tone="secondary">
            Outbox ist leer. Alle lokalen Änderungen sind synchronisiert!
          </Txt>
        ) : (
          outboxRows.map((row) => (
            <View key={row.id} className="debug-item">
              <Txt variant="caption" weight="700">
                #{row.id} {row.op.toUpperCase()} {row.entity}
              </Txt>
              <Txt variant="caption" tone="secondary">
                ID: {row.entity_id} | Versuche: {row.attempts}
              </Txt>
              {row.last_error && (
                <Pressable
                  onPress={() => handleCopyOutbox(row)}
                  accessibilityLabel="Fehler kopieren">
                  <Txt variant="caption" tone="danger">
                    Fehler: {row.last_error}
                  </Txt>
                </Pressable>
              )}
              {/* Payload bleibt als kompakte, monospace Debug-Information lesbar. */}
              <Pressable
                onPress={() => handleCopyOutbox(row)}
                accessibilityLabel="Payload kopieren">
                <Txt
                  variant="caption"
                  className="mt-half"
                  style={{ fontFamily: 'monospace', fontSize: 12, lineHeight: 16 }}>
                  Payload: {row.payload}
                </Txt>
              </Pressable>
              <View className="flex-row gap-two mt-one">
                <View className="flex-1">
                  <Button
                    label={copiedRowId === row.id ? '✓ Kopiert' : '📋 Kopieren'}
                    variant="secondary"
                    onPress={() => handleCopyOutbox(row)}
                  />
                </View>
                <View className="flex-1">
                  <Button
                    label="Eintrag löschen"
                    variant="secondary"
                    onPress={() => handleDeleteOutboxEntry(row)}
                  />
                </View>
              </View>
            </View>
          ))
        )}

        {outboxRows.length > 0 && (
          <View className="mt-three">
            <Button label="Outbox leeren (Notfall)" variant="danger" onPress={handleClearOutbox} />
          </View>
        )}
      </Card>

      {/* Lokale Lagerorte aus SQLite */}
      <Card title={`Lokale Lagerorte (${locationRows.length} Orte)`}>
        {locationRows.length === 0 ? (
          <Txt variant="caption" tone="secondary">
            Keine Lagerorte lokal in SQLite gefunden.
          </Txt>
        ) : (
          locationRows.map((loc) => (
            <View key={loc.id} className="debug-item">
              <Txt variant="caption" weight="700">{loc.name}</Txt>
              <Txt variant="caption" tone="secondary">
                Typ: {loc.kind} | ID: {loc.id}
              </Txt>
            </View>
          ))
        )}
      </Card>

      {/* Lokale Lebensmittel aus SQLite */}
      <Card title={`Lokale Lebensmittel (${itemRows.length} Artikel)`}>
        {itemRows.length === 0 ? (
          <Txt variant="caption" tone="secondary">
            Keine Artikel lokal in SQLite gefunden.
          </Txt>
        ) : (
          itemRows.map((item) => (
            <View key={item.id} className="debug-item">
              <Txt variant="caption" weight="700">
                {item.name} ({item.quantity} {item.unit})
              </Txt>
              <Txt variant="caption" tone="secondary">
                Lagerort-ID: {item.location_id ?? 'Keiner'} | Artikel-ID: {item.id}
              </Txt>
            </View>
          ))
        )}
      </Card>

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
