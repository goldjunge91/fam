import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { createElement, type ReactNode } from 'react';

import { SyncSettingsScreen } from '@/features/settings/sync-settings-screen';

let mockSyncStatus: {
  kind: 'hidden' | 'offline' | 'failed';
  pendingCount?: number;
  failedCount?: number;
};
let mockActiveHousehold: { id: string } | null;
const mockGetDatabase = jest.fn();
const mockTrackAnalyticsEvent = jest.fn();
const mockTriggerHouseholdSync = jest.fn();
const mockSyncRunHasErrors = jest.fn();
const mockRouterPush = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { error?: string }) =>
      options?.error ? `${key}:${options.error}` : key,
  }),
}));

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockRouterPush(...args) },
}));

jest.mock('@/components/layout/screen', () => {
  const { Text: NativeText, View: NativeView } = require('react-native');
  return {
    Screen: ({ children, title }: { children: React.ReactNode; title: string }) => (
      <NativeView>
        <NativeText>{title}</NativeText>
        {children}
      </NativeView>
    ),
  };
});

jest.mock('@/components/ui/content-card', () => {
  const { View: NativeView } = require('react-native');
  return {
    ContentCard: ({ children }: { children: React.ReactNode }) => (
      <NativeView>{children}</NativeView>
    ),
  };
});

jest.mock('@/constants/ui', () => {
  const { Pressable: NativePressable, Text: NativeText } = require('react-native');
  return {
    Button: ({
      title,
      onPress,
      loading,
      disabled,
    }: {
      title: string;
      onPress?: () => void;
      loading?: boolean;
      disabled?: boolean;
    }) => (
      <NativePressable
        accessibilityRole="button"
        accessibilityLabel={title}
        disabled={disabled}
        onPress={onPress}>
        <NativeText>{loading ? 'loading' : title}</NativeText>
      </NativePressable>
    ),
    Txt: ({ children }: { children: React.ReactNode }) => <NativeText>{children}</NativeText>,
  };
});

jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHousehold: mockActiveHousehold }),
}));
jest.mock('@/hooks/use-sync-status', () => ({ useSyncStatus: () => mockSyncStatus }));
jest.mock('@/lib/analytics', () => ({
  trackAnalyticsEvent: (...args: unknown[]) => mockTrackAnalyticsEvent(...args),
}));
jest.mock('@/lib/db/local-client', () => ({ getDatabase: () => mockGetDatabase() }));
jest.mock('@/lib/sync/sync-runner', () => ({
  syncRunHasErrors: (result: unknown) => mockSyncRunHasErrors(result),
  triggerHouseholdSync: (...args: unknown[]) => mockTriggerHouseholdSync(...args),
}));

let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

async function renderSyncSettings() {
  return render(<SyncSettingsScreen />, { wrapper });
}

beforeEach(() => {
  mockSyncStatus = { kind: 'hidden' };
  mockActiveHousehold = { id: 'household-1' };
  mockGetDatabase.mockReset().mockResolvedValue({
    getFirstAsync: jest.fn().mockResolvedValue(null),
  });
  mockTrackAnalyticsEvent.mockReset();
  mockTriggerHouseholdSync.mockReset().mockResolvedValue({ runId: 'run-1' });
  mockSyncRunHasErrors.mockReset().mockReturnValue(false);
  mockRouterPush.mockReset();
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY },
    },
  });
});

afterEach(() => queryClient.clear());

test('disables manual sync without a household and opens diagnostics separately', async () => {
  mockActiveHousehold = null;
  await renderSyncSettings();

  const syncButton = screen.getByRole('button', { name: 'settings.sync.syncNowButton' });
  expect(syncButton).toBeDisabled();
  fireEvent.press(syncButton);
  expect(mockTriggerHouseholdSync).not.toHaveBeenCalled();

  await act(async () => {
    fireEvent.press(screen.getByRole('button', { name: 'settings.sync.diagnosticsButton' }));
  });
  expect(mockRouterPush).toHaveBeenCalledWith('/settings/sync-debug');
});

test('runs a manual sync and records its completion', async () => {
  await renderSyncSettings();

  await act(async () => {
    fireEvent.press(screen.getByRole('button', { name: 'settings.sync.syncNowButton' }));
    await Promise.resolve();
  });

  expect(mockTriggerHouseholdSync).toHaveBeenCalledWith(['household-1'], true, queryClient);
  expect(mockTrackAnalyticsEvent).toHaveBeenNthCalledWith(1, 'sync.manual.started', {
    source: 'sync_settings',
  });
  expect(mockTrackAnalyticsEvent).toHaveBeenNthCalledWith(2, 'sync.manual.completed', {
    source: 'sync_settings',
  });
});

test('records failed sync results and uses the retry label after a failure', async () => {
  mockSyncStatus = { kind: 'failed', failedCount: 2 };
  mockSyncRunHasErrors.mockReturnValue(true);
  await renderSyncSettings();

  expect(screen.getByRole('button', { name: 'settings.sync.retryButton' })).toBeOnTheScreen();
  await act(async () => {
    fireEvent.press(screen.getByRole('button', { name: 'settings.sync.retryButton' }));
    await Promise.resolve();
  });

  expect(mockTrackAnalyticsEvent).toHaveBeenNthCalledWith(2, 'sync.manual.failed', {
    source: 'sync_settings',
  });
});

test('loads the latest local error for a failed sync', async () => {
  mockSyncStatus = { kind: 'failed', failedCount: 1 };
  mockGetDatabase.mockResolvedValue({
    getFirstAsync: jest.fn().mockResolvedValue({ last_error: 'permission denied' }),
  });
  await renderSyncSettings();

  await waitFor(() =>
    expect(screen.getByText('settings.sync.errorPrefix:permission denied')).toBeOnTheScreen(),
  );
});

test('does not display an error when the outbox has no error detail', async () => {
  mockSyncStatus = { kind: 'failed', failedCount: 1 };
  mockGetDatabase.mockResolvedValue({
    getFirstAsync: jest.fn().mockResolvedValue({ last_error: null }),
  });
  await renderSyncSettings();

  await waitFor(() => expect(mockGetDatabase).toHaveBeenCalled());
  expect(screen.queryByText(/^settings\.sync\.errorPrefix/)).not.toBeOnTheScreen();
});
