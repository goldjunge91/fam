import { render } from '@testing-library/react-native';
import type { ComponentType, ReactNode } from 'react';

const mockAppProviders = jest.fn(({ children }: { children: ReactNode }) => children);
const mockInitializeAppRuntime = jest.fn();
const mockUseAppLifecycle = jest.fn();
const mockUseAppDeepLinks = jest.fn();
const mockRootNavigator = jest.fn(() => null);
const mockScreenshotDriver = jest.fn(() => null);
const mockPerformanceTools = jest.fn(() => null);
const mockRozeniteTools = jest.fn(() => null);

jest.doMock('expo-observe', () => ({
  ObserveRoot: { wrap: (component: unknown) => component },
}));

jest.doMock('@/components/ScreenshotDriver', () => ({
  ScreenshotDriver: mockScreenshotDriver,
}));

jest.doMock('@/features/app-shell/app-providers', () => ({ AppProviders: mockAppProviders }));
jest.doMock('@/features/app-shell/initialize-app-runtime', () => ({
  initializeAppRuntime: mockInitializeAppRuntime,
}));
jest.doMock('@/features/app-shell/use-app-lifecycle', () => ({
  useAppLifecycle: mockUseAppLifecycle,
}));
jest.doMock('@/features/navigation/root-navigator', () => ({ RootNavigator: mockRootNavigator }));
jest.doMock('@/features/navigation/use-app-deep-links', () => ({
  useAppDeepLinks: mockUseAppDeepLinks,
}));
jest.doMock('@/i18n', () => ({}));
jest.doMock('@/lib/observability/providers/sentry', () => ({
  Sentry: { wrap: (component: unknown) => component },
}));
jest.doMock('@/lib/optionals/PerformanceMonitorDevTools', () => ({
  PerformanceMonitorDevTools: mockPerformanceTools,
}));
jest.doMock('@/lib/optionals/RozeniteDevTools', () => ({ RozeniteDevTools: mockRozeniteTools }));

const RootLayout = require('../../app/_layout').default as ComponentType;

describe('root Expo layout', () => {
  const setDevelopmentMode = (enabled: boolean) => {
    Object.defineProperty(globalThis, '__DEV__', {
      configurable: true,
      value: enabled,
    });
  };

  it('initializes the runtime, hooks lifecycle behavior, and renders the navigator', async () => {
    setDevelopmentMode(false);
    await render(<RootLayout />);

    expect(mockInitializeAppRuntime).toHaveBeenCalledTimes(1);
    expect(mockUseAppLifecycle).toHaveBeenCalledTimes(1);
    expect(mockUseAppDeepLinks).toHaveBeenCalledTimes(1);
    expect(mockRootNavigator).toHaveBeenCalledTimes(1);
    expect(mockScreenshotDriver).not.toHaveBeenCalled();
  });

  it('adds development tools only in development mode', async () => {
    setDevelopmentMode(true);
    await render(<RootLayout />);

    expect(mockScreenshotDriver).toHaveBeenCalledTimes(1);
    expect(mockPerformanceTools).toHaveBeenCalledTimes(1);
    expect(mockRozeniteTools).toHaveBeenCalledTimes(1);
  });
});
