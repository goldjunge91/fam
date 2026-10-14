import { render, renderHook } from '@testing-library/react-native';
import type { Control } from 'react-hook-form';
import { RozeniteDevTools, useRozeniteRHFDevTools } from './RozeniteDevTools';

jest.mock('@/lib/data/query-client', () => ({ queryClient: {} }));
jest.mock('@/lib/db/local-client', () => ({ getDatabase: jest.fn() }));
jest.mock('@/lib/storage/local-device-storage', () => ({ getDeviceStorage: jest.fn() }));
jest.mock('@/lib/observability/performance', () => ({
  clearPerformanceEntries: jest.fn(),
  getPerformanceMeasureDuration: jest.fn(() => null),
  getPerformanceMonitorSnapshot: jest.fn(() => ({
    available: false,
    enabled: false,
    latestEntry: null,
    totalEntries: 0,
    markCount: 0,
    measureCount: 0,
    metricCount: 0,
    nativeMarkCount: 0,
  })),
  isPerformanceInstrumentationEnabled: jest.fn(() => false),
  markPerformance: jest.fn(),
  measurePerformance: jest.fn(),
  metricPerformance: jest.fn(),
  setPerformanceInstrumentationEnabled: jest.fn(),
}));
jest.mock('@/lib/observability/debug-log', () => ({ debugWarn: jest.fn() }));

test('uses harmless hooks when the native Rozenite bridge is unavailable in Jest', async () => {
  expect(process.env.JEST_WORKER_ID).toBeDefined();

  const screen = await render(<RozeniteDevTools />);
  const control = {} as Control<{ name: string }>;
  await renderHook(() => useRozeniteRHFDevTools({ control }));

  await screen.unmount();
});
