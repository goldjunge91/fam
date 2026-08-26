import { useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Screen } from '@/components/layout/screen';
import { ThemedText } from '@/components/theme/themed-text';
import { Button } from '@/components/ui/buttons';
import { Card } from '@/components/ui/card';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { BarcodeScannerModal } from '@/features/inventory/barcode-scanner-modal';
import { useSyncStatus } from '@/hooks/use-sync-status';
import { getDatabase } from '@/lib/db/client';
import { deleteOutboxEntries } from '@/lib/db/outbox';
import { sendTestNotification } from '@/lib/notifications';
import type { OpenFoodFactsProduct } from '@/lib/open-food-facts';
import {
  getActiveSyncEngineIntervalCount,
  getLastRealtimeStatus,
  getLastSyncInfo,
  getRealtimeDiagnostics,
  getRealtimeLatencySamples,
  getRealtimeLatencySampleVersion,
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

  function handleProductScanned(product: OpenFoodFactsProduct) {
    Alert.alert(
      'Produkt erkannt! 📷',
      `Name: ${product.name}\nMarke: ${product.brand ?? '—'}\nBarcode: ${product.barcode}\nMenge: ${product.quantity} ${product.unit}`,
    );
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
    try {
      await triggerHouseholdSync([currentHousehold.id], true);
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
          <ThemedText type="small">Uhrzeit:</ThemedText>
          <ThemedText type="smallBold">{formattedLastSync}</ThemedText>
        </View>
        {lastSyncInfo && (
          <>
            <View className="debug-row">
              <ThemedText type="small">Hochgeladen (Pushed):</ThemedText>
              <ThemedText type="smallBold">{lastSyncInfo.pushedCount} Einträge</ThemedText>
            </View>
            <View className="debug-row">
              <ThemedText type="small">Empfangen (Pulled):</ThemedText>
              <ThemedText type="smallBold">{lastSyncInfo.pulledCount} Zeilen</ThemedText>
            </View>
          </>
        )}
        <View className="debug-row">
          <ThemedText type="small">Aktueller Sync-Status:</ThemedText>
          <ThemedText type="smallBold">{syncStatus.kind.toUpperCase()}</ThemedText>
        </View>
        <View className="debug-row">
          <ThemedText type="small">Realtime-Verbindung:</ThemedText>
          <ThemedText
            type="smallBold"
            themeColor={realtimeStatus === 'SUBSCRIBED' ? 'success' : 'danger'}>
            {realtimeStatus ?? 'nie verbunden'}
          </ThemedText>
        </View>
        <View className="debug-row">
          <ThemedText type="small">Aktive Poll-Intervalle:</ThemedText>
          <ThemedText type="smallBold" themeColor={activeIntervalCount > 1 ? 'danger' : 'success'}>
            {activeIntervalCount}
            {activeIntervalCount > 1 ? ' — sollte 1 sein!' : ''}
          </ThemedText>
        </View>
        <View className="debug-row">
          <ThemedText type="small">Realtime Status-Wechsel gesamt:</ThemedText>
          <ThemedText type="smallBold">{realtimeDiagnostics.statusChangeCount}</ThemedText>
        </View>
        <View className="debug-row">
          <ThemedText type="small">Realtime Reconnects gesamt:</ThemedText>
          <ThemedText
            type="smallBold"
            themeColor={realtimeDiagnostics.reconnectCount > 0 ? 'danger' : 'success'}>
            {realtimeDiagnostics.reconnectCount}
          </ThemedText>
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
          <ThemedText type="small" themeColor="textSecondary">
            Noch keine ueber Realtime empfangene Zeile in dieser Sitzung. Auf einem zweiten Geraet
            etwas aendern, um Messwerte zu sammeln.
          </ThemedText>
        ) : (
          <>
            <View className="debug-row">
              <ThemedText type="small">Letzte Latenz:</ThemedText>
              <ThemedText
                type="smallBold"
                themeColor={
                  (latencySamples[latencySamples.length - 1].latencyMs ?? 0) > 2000
                    ? 'danger'
                    : 'success'
                }>
                {latencySamples[latencySamples.length - 1].latencyMs ?? '—'} ms
              </ThemedText>
            </View>
            <View className="debug-row">
              <ThemedText type="small">Durchschnitt:</ThemedText>
              <ThemedText type="smallBold">
                {averageLatencyMs === null ? '—' : `${averageLatencyMs} ms`}
              </ThemedText>
            </View>
            {latencySamples
              .slice()
              .reverse()
              .map((sample, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: Ringpuffer ohne stabile Id, Reihenfolge aendert sich nicht rueckwirkend
                <View key={i} className="debug-item">
                  <ThemedText type="small" themeColor="textSecondary">
                    {new Date(sample.timestamp).toLocaleTimeString('de-DE')} —{' '}
                    {sample.op.toUpperCase()} {sample.entity}: {sample.latencyMs ?? '—'} ms
                  </ThemedText>
                </View>
              ))}
          </>
        )}
      </Card>

      {/* Live-Tests für Push-Mitteilungen und Barcode-Scanner */}
      <Card title="Live-Test (Hardware & Push)">
        <ThemedText type="small" themeColor="textSecondary">
          Test-Aktionen für lokale Mitteilungen und die Kamera-Barcode-Erkennung.
        </ThemedText>

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
          <ThemedText type="small">Haushalts-Name:</ThemedText>
          <ThemedText type="smallBold">
            {currentHousehold?.name ?? 'Kein Haushalt geladen'}
          </ThemedText>
        </View>
        <View className="debug-row">
          <ThemedText type="small">Haushalts-ID:</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {currentHousehold?.id ?? '—'}
          </ThemedText>
        </View>
      </Card>

      {/* Lokale Outbox-Warteschlange mit Mutations-Payloads und Fehlern */}
      <Card title={`Lokale Outbox (${outboxRows.length} Einträge)`}>
        {outboxRows.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            Outbox ist leer. Alle lokalen Änderungen sind synchronisiert!
          </ThemedText>
        ) : (
          outboxRows.map((row) => (
            <View key={row.id} className="debug-item">
              <ThemedText type="smallBold">
                #{row.id} {row.op.toUpperCase()} {row.entity}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                ID: {row.entity_id} | Versuche: {row.attempts}
              </ThemedText>
              {row.last_error && (
                <Pressable
                  onPress={() => handleCopyOutbox(row)}
                  accessibilityLabel="Fehler kopieren">
                  <ThemedText type="small" themeColor="danger">
                    Fehler: {row.last_error}
                  </ThemedText>
                </Pressable>
              )}
              {/* type="code" (Fonts.mono, 12px) statt der frueheren
                  Sonderroute mit fest verdrahtetem 'Courier' — jetzt eine
                  echte ThemedText-Rolle. */}
              <Pressable
                onPress={() => handleCopyOutbox(row)}
                accessibilityLabel="Payload kopieren">
                <ThemedText type="code" className="mt-half">
                  Payload: {row.payload}
                </ThemedText>
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
          <ThemedText type="small" themeColor="textSecondary">
            Keine Lagerorte lokal in SQLite gefunden.
          </ThemedText>
        ) : (
          locationRows.map((loc) => (
            <View key={loc.id} className="debug-item">
              <ThemedText type="smallBold">{loc.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Typ: {loc.kind} | ID: {loc.id}
              </ThemedText>
            </View>
          ))
        )}
      </Card>

      {/* Lokale Lebensmittel aus SQLite */}
      <Card title={`Lokale Lebensmittel (${itemRows.length} Artikel)`}>
        {itemRows.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            Keine Artikel lokal in SQLite gefunden.
          </ThemedText>
        ) : (
          itemRows.map((item) => (
            <View key={item.id} className="debug-item">
              <ThemedText type="smallBold">
                {item.name} ({item.quantity} {item.unit})
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Lagerort-ID: {item.location_id ?? 'Keiner'} | Artikel-ID: {item.id}
              </ThemedText>
            </View>
          ))
        )}
      </Card>

      {/* Barcode-Scanner Testmodal */}
      <BarcodeScannerModal
        visible={showScannerTest}
        onClose={() => setShowScannerTest(false)}
        onProductFound={handleProductScanned}
      />
    </Screen>
  );
}
