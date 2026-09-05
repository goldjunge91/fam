import type React from 'react';

let PerformanceMonitor: React.ComponentType | null = null;

if (__DEV__) {
  // Wird im Production-Build von Metro / Minifier komplett entfernt (Dead Code Elimination)
  const { usePerformanceMonitorDevTools } = require('@rozenite/performance-monitor-plugin');

  PerformanceMonitor = function PerformanceMonitor() {
    usePerformanceMonitorDevTools();
    return null;
  };
}

export function PerformanceMonitorDevTools() {
  if (!__DEV__ || !PerformanceMonitor) {
    return null;
  }

  return <PerformanceMonitor />;
}
