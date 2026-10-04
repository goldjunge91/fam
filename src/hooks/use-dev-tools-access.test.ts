import { renderHook } from '@testing-library/react-native';
import { useDevToolsAccess } from './use-dev-tools-access';

const mockUseFeatureFlag = jest.fn();

jest.mock('@/lib/observability/providers/posthog', () => ({
  useFeatureFlag: (flag: string, defaultValue: boolean) => mockUseFeatureFlag(flag, defaultValue),
}));

jest.mock('@/lib/config/env', () => ({
  env: {
    get devTools() {
      return mockEnvDevTools;
    },
  },
}));

let mockEnvDevTools = false;

describe('useDevToolsAccess', () => {
  const originalDev = (globalThis as unknown as { __DEV__: boolean }).__DEV__;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEnvDevTools = false;
    mockUseFeatureFlag.mockReturnValue(false);
  });

  afterAll(() => {
    (globalThis as unknown as { __DEV__: boolean }).__DEV__ = originalDev;
  });

  describe('in development (__DEV__ = true)', () => {
    beforeEach(() => {
      (globalThis as unknown as { __DEV__: boolean }).__DEV__ = true;
    });

    it('returns true when env.devTools is true', async () => {
      mockEnvDevTools = true;
      mockUseFeatureFlag.mockReturnValue(false);

      const { result } = await renderHook(() => useDevToolsAccess());
      expect(result.current).toBe(true);
      expect(mockUseFeatureFlag).toHaveBeenCalledWith('dev-tools', false);
    });

    it('returns true when PostHog dev-tools flag is true', async () => {
      mockEnvDevTools = false;
      mockUseFeatureFlag.mockReturnValue(true);

      const { result } = await renderHook(() => useDevToolsAccess());
      expect(result.current).toBe(true);
    });

    it('returns false when both env.devTools and PostHog flag are false', async () => {
      mockEnvDevTools = false;
      mockUseFeatureFlag.mockReturnValue(false);

      const { result } = await renderHook(() => useDevToolsAccess());
      expect(result.current).toBe(false);
    });
  });

  describe('in preview and production (__DEV__ = false)', () => {
    beforeEach(() => {
      (globalThis as unknown as { __DEV__: boolean }).__DEV__ = false;
    });

    it('returns true when PostHog dev-tools flag is true', async () => {
      mockEnvDevTools = false;
      mockUseFeatureFlag.mockReturnValue(true);

      const { result } = await renderHook(() => useDevToolsAccess());
      expect(result.current).toBe(true);
    });

    it('returns false when PostHog dev-tools flag is false even if env.devTools is true', async () => {
      mockEnvDevTools = true;
      mockUseFeatureFlag.mockReturnValue(false);

      const { result } = await renderHook(() => useDevToolsAccess());
      expect(result.current).toBe(false);
    });

    it('returns false when PostHog flag is default (false)', async () => {
      mockEnvDevTools = false;
      mockUseFeatureFlag.mockReturnValue(false);

      const { result } = await renderHook(() => useDevToolsAccess());
      expect(result.current).toBe(false);
    });
  });
});
