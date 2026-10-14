test('does not load the optional monitor in a production build', () => {
  const initialDevMode = __DEV__;
  Object.defineProperty(globalThis, '__DEV__', { configurable: true, value: false });

  try {
    const { PerformanceMonitorDevTools } =
      require('./PerformanceMonitorDevTools') as typeof import('./PerformanceMonitorDevTools');

    expect(PerformanceMonitorDevTools()).toBeNull();
  } finally {
    Object.defineProperty(globalThis, '__DEV__', {
      configurable: true,
      value: initialDevMode,
    });
  }
});
