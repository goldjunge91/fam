import { createContext, type ReactNode, useContext } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { space } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';
import { useSyncStatus } from '@/hooks/use-sync-status';
import { getDatabase } from '@/lib/db/client';
import { retryFailedOutboxEntries } from '@/lib/db/outbox-retry';
import type { SqlDatabase } from '@/lib/db/types';
import type { SyncStatusView } from '@/lib/sync/sync-status';

const SyncStatusContext = createContext<SyncStatusView>({ kind: 'hidden' });

const styles = StyleSheet.create({
  banner: {
    width: '100%',
  },
  action: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  content: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
});

export function useSyncBannerVisible(): boolean {
  return useContext(SyncStatusContext).kind !== 'hidden';
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
  return <SyncStatusContext.Provider value={status}>{children}</SyncStatusContext.Provider>;
}

export type SyncStatusBannerProps = {
  onRetry?: () => Promise<void>;
};

async function defaultRetry(): Promise<void> {
  const db = await getDatabase();
  await retryFailedOutboxEntries(db);
}

export function SyncStatusBanner({ onRetry = defaultRetry }: SyncStatusBannerProps) {
  const status = useContext(SyncStatusContext);
  const { colors } = useTheme();

  if (status.kind === 'hidden') return null;

  const isFailed = status.kind === 'failed';
  const backgroundColor = isFailed ? colors.danger : colors.warning;

  const label =
    status.kind === 'offline'
      ? status.pendingCount > 0
        ? `Offline, ${status.pendingCount} Änderungen ausstehend`
        : 'Offline'
      : `${status.failedCount} Änderungen konnten nicht synchronisiert werden. Erneut versuchen.`;

  const content = (
    <Txt variant="body" tone="onAccent" weight="700" center>
      {label}
    </Txt>
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.banner, { backgroundColor }]}>
      {isFailed ? (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Fehlgeschlagene Änderungen erneut versuchen"
          style={styles.action}>
          {content}
        </Pressable>
      ) : (
        <View style={styles.content}>{content}</View>
      )}
    </SafeAreaView>
  );
}
