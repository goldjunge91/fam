import { createContext, type ReactNode, useContext } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/theme/themed-text';
import { useSyncStatus } from '@/hooks/use-sync-status';
import { getDatabase } from '@/lib/db/client';
import { retryFailedOutboxEntries } from '@/lib/db/outbox-retry';
import type { SqlDatabase } from '@/lib/db/types';

const BannerVisibleContext = createContext(false);

export function useSyncBannerVisible(): boolean {
  return useContext(BannerVisibleContext);
}

/** Umschliesst `SyncStatusBanner` und den Screen-Stack in `AppShell`. */
export function SyncBannerVisibilityProvider({
  getDb = getDatabase,
  enabled = true,
  children,
}: {
  getDb?: () => Promise<SqlDatabase>;
  enabled?: boolean;
  children: ReactNode;
}) {
  const status = useSyncStatus(getDb, enabled);
  return (
    <BannerVisibleContext.Provider value={status.kind !== 'hidden'}>
      {children}
    </BannerVisibleContext.Provider>
  );
}

export type SyncStatusBannerProps = {
  onRetry?: () => Promise<void>;
  /** Nur fuer Tests: injiziert eine andere `SqlDatabase`-Quelle als die echte `getDatabase()`. */
  getDb?: () => Promise<SqlDatabase>;
  /** Verhindert DB-Polling in Onboarding/Auth ohne autoritative Session. */
  enabled?: boolean;
};

async function defaultRetry(): Promise<void> {
  const db = await getDatabase();
  await retryFailedOutboxEntries(db);
}

export function SyncStatusBanner({
  onRetry = defaultRetry,
  getDb = getDatabase,
  enabled = true,
}: SyncStatusBannerProps) {
  const status = useSyncStatus(getDb, enabled);

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
