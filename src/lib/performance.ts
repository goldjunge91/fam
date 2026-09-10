type PerformanceDetail = Readonly<Record<string, string | number | boolean | null>>;
type PerformanceApi = typeof import('react-native-performance').default;

export type PerformanceMonitorSnapshot = {
  available: boolean;
  enabled: boolean;
  totalEntries: number;
  markCount: number;
  measureCount: number;
  metricCount: number;
  nativeMarkCount: number;
  latestEntry: string | null;
};

let performanceApi: PerformanceApi | null | undefined;
let performanceInstrumentationEnabled = true;

function getPerformanceApi(): PerformanceApi | null {
  if (performanceApi !== undefined) return performanceApi;
  if (!__DEV__) {
    performanceApi = null;
    return performanceApi;
  }

  try {
    performanceApi = (
      require('react-native-performance') as typeof import('react-native-performance')
    ).default;
  } catch (error) {
    console.warn('[performance] react-native-performance ist nicht verfügbar:', error);
    performanceApi = null;
  }

  return performanceApi;
}

export function isPerformanceInstrumentationEnabled(): boolean {
  return __DEV__ && performanceInstrumentationEnabled;
}

export function setPerformanceInstrumentationEnabled(enabled: boolean): void {
  if (__DEV__) {
    performanceInstrumentationEnabled = enabled;
  }
}

export function markPerformance(name: string, detail?: PerformanceDetail): void {
  if (!isPerformanceInstrumentationEnabled()) return;
  try {
    getPerformanceApi()?.mark(name, detail ? { detail } : undefined);
  } catch (error) {
    if (__DEV__) console.warn(`[performance] Mark "${name}" fehlgeschlagen:`, error);
  }
}

export function measurePerformance(
  name: string,
  startMark: string,
  endMark?: string,
  detail?: PerformanceDetail,
): void {
  if (!isPerformanceInstrumentationEnabled()) return;
  try {
    getPerformanceApi()?.measure(
      name,
      detail ? { start: startMark, end: endMark, detail } : { start: startMark, end: endMark },
    );
  } catch (error) {
    if (__DEV__) console.warn(`[performance] Measure "${name}" fehlgeschlagen:`, error);
  }
}

export function metricPerformance(
  name: string,
  value: number | string,
  detail?: PerformanceDetail,
): void {
  if (!isPerformanceInstrumentationEnabled()) return;
  try {
    const api = getPerformanceApi();
    if (!api) return;
    if (detail && value !== '') {
      api.metric(name, { value, detail, startTime: api.now() });
    } else {
      api.metric(name, value);
    }
  } catch (error) {
    if (__DEV__) console.warn(`[performance] Metric "${name}" fehlgeschlagen:`, error);
  }
}

export function startPerformanceSpan(
  name: string,
  detail: PerformanceDetail = {},
): (outcome?: 'completed' | 'failed', resultDetail?: PerformanceDetail) => void {
  if (!isPerformanceInstrumentationEnabled()) return () => {};

  const startMark = `${name}.start`;
  const endMark = `${name}.end`;
  const startedAt = Date.now();
  let finished = false;

  markPerformance(startMark, detail);

  return (outcome = 'completed', resultDetail = {}) => {
    if (finished) return;
    finished = true;

    const combinedDetail = { ...detail, ...resultDetail, outcome };
    markPerformance(endMark, combinedDetail);
    measurePerformance(name, startMark, endMark, combinedDetail);
    metricPerformance(`${name}.duration-ms`, Math.max(0, Date.now() - startedAt), combinedDetail);
  };
}

export function getPerformanceMonitorSnapshot(): PerformanceMonitorSnapshot {
  const api = getPerformanceApi();
  if (!api) {
    return {
      available: false,
      enabled: false,
      totalEntries: 0,
      markCount: 0,
      measureCount: 0,
      metricCount: 0,
      nativeMarkCount: 0,
      latestEntry: null,
    };
  }

  const entries = api.getEntries();
  const latestEntry = entries[entries.length - 1];

  return {
    available: true,
    enabled: isPerformanceInstrumentationEnabled(),
    totalEntries: entries.length,
    markCount: api.getEntriesByType('mark').length,
    measureCount: api.getEntriesByType('measure').length,
    metricCount: api.getEntriesByType('metric').length,
    nativeMarkCount: api.getEntriesByType('react-native-mark').length,
    latestEntry: latestEntry ? `${latestEntry.entryType}: ${latestEntry.name}` : null,
  };
}

export function getPerformanceMeasureDuration(name: string): number | null {
  const api = getPerformanceApi();
  if (!api) return null;

  const entries = api.getEntriesByName(name, 'measure');
  const latestEntry = entries[entries.length - 1];
  return latestEntry?.duration ?? null;
}

export function clearPerformanceEntries(): void {
  const api = getPerformanceApi();
  api?.clearMarks();
  api?.clearMeasures();
  api?.clearMetrics();
  api?.clearResourceTimings();
}
