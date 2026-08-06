import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useSyncStatus } from '@/hooks/use-sync-status';
import { useTheme } from '@/hooks/use-theme';
import { getDatabase } from '@/lib/db/client';
import { retryFailedOutboxEntries } from '@/lib/db/outbox-retry';
import type { SqlDatabase } from '@/lib/db/types';

export type SyncStatusBannerProps = {
  /**
   * Wird bei einem Tap auf den Fehlerzustand aufgerufen. Ohne Vorgabe macht
   * der Default nur die Eintraege wieder faellig (`retryFailedOutboxEntries`)
   * — er kann keinen echten Sync anstossen, weil dafuer eine household_id
   * noetig ist, die es vor Epic 4 nirgends im App-Code gibt. Wer die Engine
   * spaeter verdrahtet, uebergibt eine eigene Funktion, die zusaetzlich
   * `syncHousehold(...)` aufruft.
   */
  onRetry?: () => Promise<void>;
  /** Nur fuer Tests: injiziert eine andere `SqlDatabase`-Quelle als die echte `getDatabase()`. */
  getDb?: () => Promise<SqlDatabase>;
};

async function defaultRetry(): Promise<void> {
  const db = await getDatabase();
  await retryFailedOutboxEntries(db);
}

/**
 * Dezenter Hinweis auf Offline-/Sync-Status (#51).
 *
 * Rendert `null` im `hidden`-Zustand — nimmt dann keinen Platz ein. Das,
 * nicht Insets oder z-index, ist der Grund, warum diese Komponente als
 * normaler Flex-Sibling ueber `RootNavigator` in `_layout.tsx` sitzt, statt
 * absolut positioniert zu werden: sichtbar schiebt sie den Inhalt nach unten,
 * unsichtbar verdeckt sie nichts, weil sie schlicht nicht da ist.
 */
export function SyncStatusBanner({
  onRetry = defaultRetry,
  getDb = getDatabase,
}: SyncStatusBannerProps) {
  const status = useSyncStatus(getDb);
  const theme = useTheme();

  if (status.kind === 'hidden') return null;

  const isFailed = status.kind === 'failed';
  const background = isFailed ? theme.danger : theme.warning;

  const label =
    status.kind === 'offline'
      ? status.pendingCount > 0
        ? `Offline, ${status.pendingCount} Änderungen ausstehend`
        : 'Offline'
      : status.kind === 'syncing'
        ? `Synchronisiere … ${status.pendingCount} ausstehend`
        : `${status.failedCount} Änderungen konnten nicht synchronisiert werden. Erneut versuchen.`;

  const content = (
    <ThemedText type="smallBold" style={styles.text}>
      {label}
    </ThemedText>
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: background }]}>
      {isFailed ? (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Fehlgeschlagene Änderungen erneut versuchen"
          style={styles.row}>
          {content}
        </Pressable>
      ) : (
        <View style={styles.row}>{content}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  row: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  text: {
    color: '#ffffff',
    textAlign: 'center',
  },
});
