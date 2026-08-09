import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { BarcodeScannerModal } from '@/features/inventory/barcode-scanner-modal';
import { useSyncStatus } from '@/hooks/use-sync-status';
import { useTheme } from '@/hooks/use-theme';
import { getDatabase } from '@/lib/db/client';
import { sendTestNotification } from '@/lib/notifications';
import type { OpenFoodFactsProduct } from '@/lib/open-food-facts';
import { getLastSyncInfo, triggerHouseholdSync } from '@/lib/sync/sync-runner';

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
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { activeHousehold } = useActiveHousehold();
  const currentHousehold = activeHousehold;
  const syncStatus = useSyncStatus(getDatabase);

  const [loading, setLoading] = useState(false);
  const [showScannerTest, setShowScannerTest] = useState(false);
  const [outboxRows, setOutboxRows] = useState<OutboxRow[]>([]);
  const [locationRows, setLocationRows] = useState<LocationRow[]>([]);
  const [itemRows, setItemRows] = useState<ItemRow[]>([]);
  const lastSyncInfo = getLastSyncInfo();

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

  const formattedLastSync = lastSyncInfo?.timestamp
    ? new Date(lastSyncInfo.timestamp).toLocaleTimeString('de-DE')
    : 'Noch nicht synchronisiert';

  return (
    <Screen title="Sync-Diagnose" back={{ label: 'Synchronisation', href: '/settings/sync' }}>
      <Card title="Letzter Synchronisations-Lauf">
        <View style={styles.zeile}>
          <ThemedText type="small">Uhrzeit:</ThemedText>
          <ThemedText type="smallBold">{formattedLastSync}</ThemedText>
        </View>
        {lastSyncInfo && (
          <>
            <View style={styles.zeile}>
              <ThemedText type="small">Hochgeladen (Pushed):</ThemedText>
              <ThemedText type="smallBold">{lastSyncInfo.pushedCount} Einträge</ThemedText>
            </View>
            <View style={styles.zeile}>
              <ThemedText type="small">Empfangen (Pulled):</ThemedText>
              <ThemedText type="smallBold">{lastSyncInfo.pulledCount} Zeilen</ThemedText>
            </View>
          </>
        )}
        <View style={styles.zeile}>
          <ThemedText type="small">Aktueller Sync-Status:</ThemedText>
          <ThemedText type="smallBold">{syncStatus.kind.toUpperCase()}</ThemedText>
        </View>
        <View style={styles.actionRow}>
          <Button
            label="Jetzt synchronisieren & prüfen"
            onPress={handleSyncNow}
            loading={loading}
          />
        </View>
      </Card>

      <Card title="Live-Test (Hardware & Push)">
        <ThemedText type="small" themeColor="textSecondary">
          Test-Aktionen für lokale Mitteilungen und die Kamera-Barcode-Erkennung.
        </ThemedText>

        <View style={styles.actionStack}>
          <Button label="🔔 Test-Benachrichtigung senden" onPress={handleTestNotification} />
          <Button
            label="📷 Barcode-Scanner testen"
            variant="secondary"
            onPress={() => setShowScannerTest(true)}
          />
        </View>
      </Card>

      <Card title="Aktueller Haushalt in DB">
        <View style={styles.zeile}>
          <ThemedText type="small">Haushalts-Name:</ThemedText>
          <ThemedText type="smallBold">
            {currentHousehold?.name ?? 'Kein Haushalt geladen'}
          </ThemedText>
        </View>
        <View style={styles.zeile}>
          <ThemedText type="small">Haushalts-ID:</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {currentHousehold?.id ?? '—'}
          </ThemedText>
        </View>
      </Card>

      <Card title={`Lokale Outbox (${outboxRows.length} Einträge)`}>
        {outboxRows.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            Outbox ist leer. Alle lokalen Änderungen sind synchronisiert!
          </ThemedText>
        ) : (
          outboxRows.map((row) => (
            <View key={row.id} style={[styles.boxItem, { borderBottomColor: theme.border }]}>
              <ThemedText type="smallBold">
                #{row.id} {row.op.toUpperCase()} {row.entity}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                ID: {row.entity_id} | Versuche: {row.attempts}
              </ThemedText>
              {row.last_error && (
                <ThemedText type="small" themeColor="danger">
                  Fehler: {row.last_error}
                </ThemedText>
              )}
              <ThemedText type="small" style={styles.payloadCode}>
                Payload: {row.payload}
              </ThemedText>
            </View>
          ))
        )}

        {outboxRows.length > 0 && (
          <View style={styles.actionRow}>
            <Button label="Outbox leeren (Notfall)" variant="danger" onPress={handleClearOutbox} />
          </View>
        )}
      </Card>

      <Card title={`Lokale Lagerorte (${locationRows.length} Orte)`}>
        {locationRows.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            Keine Lagerorte lokal in SQLite gefunden.
          </ThemedText>
        ) : (
          locationRows.map((loc) => (
            <View key={loc.id} style={[styles.boxItem, { borderBottomColor: theme.border }]}>
              <ThemedText type="smallBold">{loc.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Typ: {loc.kind} | ID: {loc.id}
              </ThemedText>
            </View>
          ))
        )}
      </Card>

      <Card title={`Lokale Lebensmittel (${itemRows.length} Artikel)`}>
        {itemRows.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            Keine Artikel lokal in SQLite gefunden.
          </ThemedText>
        ) : (
          itemRows.map((item) => (
            <View key={item.id} style={[styles.boxItem, { borderBottomColor: theme.border }]}>
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

      <BarcodeScannerModal
        visible={showScannerTest}
        onClose={() => setShowScannerTest(false)}
        onProductFound={handleProductScanned}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  zeile: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.one,
  },
  actionRow: {
    marginTop: Spacing.three,
  },
  actionStack: {
    marginTop: Spacing.three,
    gap: Spacing.two,
  },
  boxItem: {
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.one,
  },
  payloadCode: {
    fontFamily: 'Courier',
    fontSize: 11,
    marginTop: 2,
  },
});
