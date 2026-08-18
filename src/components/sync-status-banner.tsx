import { createContext, type ReactNode, useContext } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useSyncStatus } from '@/hooks/use-sync-status';
import { getDatabase } from '@/lib/db/client';
import { retryFailedOutboxEntries } from '@/lib/db/outbox-retry';
import type { SqlDatabase } from '@/lib/db/types';

/**
 * Ob das Banner gerade sichtbar ist und die obere Safe Area selbst schon
 * konsumiert (Statusleiste eingefaerbt). Screens lesen das, um ihre eigene
 * `top`-Safe-Area nicht ein zweites Mal draufzuschlagen — sonst haetten sie
 * bei Offline-/Sync-/Fehlerzustand einen doppelt so hohen Abstand nach oben.
 * Default `false`, damit Konsumenten ausserhalb von `AppShell` (Tests,
 * (auth)/(onboarding) ohne Banner) unveraendert bleiben.
 */
const BannerVisibleContext = createContext(false);

export function useSyncBannerVisible(): boolean {
  return useContext(BannerVisibleContext);
}

/** Umschliesst `SyncStatusBanner` und den Screen-Stack in `AppShell`. */
export function SyncBannerVisibilityProvider({
  getDb = getDatabase,
  children,
}: {
  getDb?: () => Promise<SqlDatabase>;
  children: ReactNode;
}) {
  const status = useSyncStatus(getDb);
  return (
    <BannerVisibleContext.Provider value={status.kind !== 'hidden'}>
      {children}
    </BannerVisibleContext.Provider>
  );
}

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

  if (status.kind === 'hidden') return null;

  const isFailed = status.kind === 'failed';
  const bgClass = isFailed ? 'bg-danger' : 'bg-warning';

  const label =
    status.kind === 'offline'
      ? status.pendingCount > 0
        ? `Offline, ${status.pendingCount} Änderungen ausstehend`
        : 'Offline'
      : status.kind === 'syncing'
        ? `Synchronisiere … ${status.pendingCount} ausstehend`
        : `${status.failedCount} Änderungen konnten nicht synchronisiert werden. Erneut versuchen.`;

  const content = (
    <ThemedText type="smallBold" className="text-white text-center">
      {label}
    </ThemedText>
  );

  return (
    <SafeAreaView edges={['top']} className={`w-full ${bgClass}`}>
      {isFailed ? (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Fehlgeschlagene Änderungen erneut versuchen"
          className="px-three py-two">
          {content}
        </Pressable>
      ) : (
        <View className="px-three py-two">{content}</View>
      )}
    </SafeAreaView>
  );
}
