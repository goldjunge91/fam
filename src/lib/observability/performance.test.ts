type MockPerformanceEntry = {
  entryType: string;
  name: string;
  startTime: number;
  duration?: number;
};

import { debugWarn } from '@/lib/observability/debug-log';

jest.mock('@/lib/observability/debug-log', () => ({ debugWarn: jest.fn() }));

const mockPerformance = {
  now: jest.fn(() => 100),
  mark: jest.fn(),
  measure: jest.fn(),
  metric: jest.fn(),
  getEntries: jest.fn<MockPerformanceEntry[], []>(() => []),
  getEntriesByName: jest.fn<MockPerformanceEntry[], [string, string?]>(() => []),
  getEntriesByType: jest.fn<MockPerformanceEntry[], [string]>(() => []),
  clearMarks: jest.fn(),
  clearMeasures: jest.fn(),
  clearMetrics: jest.fn(),
  clearResourceTimings: jest.fn(),
};

jest.mock('react-native-performance', () => ({
  __esModule: true,
  default: mockPerformance,
}));

describe('performance instrumentation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { setPerformanceInstrumentationEnabled } = require('./performance');
    setPerformanceInstrumentationEnabled(true);
  });

  it('emits a mark, measure, and duration metric for a completed span', () => {
    const { startPerformanceSpan } = require('./performance');
    mockPerformance.getEntriesByName.mockImplementation((name: string, type?: string) =>
      type === 'mark' && ['startup.phase.start', 'startup.phase.end'].includes(name)
        ? [{ entryType: 'mark', name, startTime: 100 }]
        : [],
    );

    const finish = startPerformanceSpan('startup.phase', { phase: 'startup' });
    finish('completed', { initialized: true });

    expect(mockPerformance.mark).toHaveBeenNthCalledWith(1, 'startup.phase.start', {
      detail: { phase: 'startup' },
    });
    expect(mockPerformance.mark).toHaveBeenNthCalledWith(2, 'startup.phase.end', {
      detail: { phase: 'startup', initialized: true, outcome: 'completed' },
    });
    expect(mockPerformance.measure).toHaveBeenCalledWith('startup.phase', {
      start: 'startup.phase.start',
      end: 'startup.phase.end',
      detail: { phase: 'startup', initialized: true, outcome: 'completed' },
    });
    expect(mockPerformance.metric).toHaveBeenCalledWith(
      'startup.phase.duration-ms',
      expect.objectContaining({
        detail: { phase: 'startup', initialized: true, outcome: 'completed' },
        value: expect.any(Number),
      }),
    );
  });

  it('skips a measure when one of its marks was cleared', () => {
    const { measurePerformance } = require('./performance');

    mockPerformance.getEntriesByName.mockReturnValue([]);

    measurePerformance('app.startup.total', 'app.start', 'app.startup.ready');

    expect(mockPerformance.measure).not.toHaveBeenCalled();
  });

  it('exposes entry counts and can clear the captured session', () => {
    const entries = [
      { entryType: 'mark', name: 'app.start', startTime: 10 },
      { entryType: 'measure', name: 'app.startup.total', startTime: 10, duration: 20 },
      { entryType: 'metric', name: 'app.startup.completed', startTime: 30, duration: 0 },
      { entryType: 'react-native-mark', name: 'nativeLaunchEnd', startTime: 40 },
    ];
    mockPerformance.getEntries.mockReturnValue(entries);
    mockPerformance.getEntriesByType.mockImplementation((type: string) =>
      entries.filter((entry) => entry.entryType === type),
    );

    const { clearPerformanceEntries, getPerformanceMonitorSnapshot } = require('./performance');

    expect(getPerformanceMonitorSnapshot()).toEqual({
      available: true,
      enabled: true,
      totalEntries: 4,
      markCount: 1,
      measureCount: 1,
      metricCount: 1,
      nativeMarkCount: 1,
      latestEntry: 'react-native-mark: nativeLaunchEnd',
    });

    clearPerformanceEntries();

    expect(mockPerformance.clearMarks).toHaveBeenCalledTimes(1);
    expect(mockPerformance.clearMeasures).toHaveBeenCalledTimes(1);
    expect(mockPerformance.clearMetrics).toHaveBeenCalledTimes(1);
    expect(mockPerformance.clearResourceTimings).toHaveBeenCalledTimes(1);
  });

  it('handles optional marks, measures, metrics, and empty snapshots', () => {
    const {
      getPerformanceMeasureDuration,
      getPerformanceMonitorSnapshot,
      markPerformance,
      measurePerformance,
      metricPerformance,
    } = require('./performance');
    mockPerformance.getEntries.mockReturnValue([]);
    mockPerformance.getEntriesByType.mockReturnValue([]);
    mockPerformance.getEntriesByName.mockImplementation((name: string, type?: string) =>
      type === 'mark' && name === 'startup.start'
        ? [{ entryType: 'mark', name, startTime: 100 }]
        : [],
    );

    markPerformance('plain.mark');
    measurePerformance('startup.measure', 'startup.start');
    metricPerformance('empty.value', '', { source: 'test' });
    metricPerformance('plain.value', 12);

    expect(mockPerformance.mark).toHaveBeenCalledWith('plain.mark', undefined);
    expect(mockPerformance.measure).toHaveBeenCalledWith('startup.measure', {
      start: 'startup.start',
      end: undefined,
    });
    expect(mockPerformance.metric).toHaveBeenNthCalledWith(1, 'empty.value', '');
    expect(mockPerformance.metric).toHaveBeenNthCalledWith(2, 'plain.value', 12);
    expect(getPerformanceMonitorSnapshot()).toEqual({
      available: true,
      enabled: true,
      totalEntries: 0,
      markCount: 0,
      measureCount: 0,
      metricCount: 0,
      nativeMarkCount: 0,
      latestEntry: null,
    });
    expect(getPerformanceMeasureDuration('missing.measure')).toBeNull();
  });

  it('does no instrumentation while disabled and finishes a span only once', () => {
    const {
      isPerformanceInstrumentationEnabled,
      setPerformanceInstrumentationEnabled,
      startPerformanceSpan,
    } = require('./performance');
    setPerformanceInstrumentationEnabled(false);
    expect(isPerformanceInstrumentationEnabled()).toBe(false);

    const disabledFinish = startPerformanceSpan('disabled.span');
    disabledFinish();
    expect(mockPerformance.mark).not.toHaveBeenCalled();

    setPerformanceInstrumentationEnabled(true);
    mockPerformance.getEntriesByName.mockReturnValue([
      { entryType: 'mark', name: 'default.span.start', startTime: 100 },
      { entryType: 'mark', name: 'default.span.end', startTime: 120 },
    ]);
    const finish = startPerformanceSpan('default.span');
    finish();
    finish('failed', { reason: 'duplicate finish' });

    expect(mockPerformance.mark).toHaveBeenCalledTimes(2);
    expect(mockPerformance.mark).toHaveBeenNthCalledWith(2, 'default.span.end', {
      detail: { outcome: 'completed' },
    });
    expect(mockPerformance.measure).toHaveBeenCalledTimes(1);
    expect(mockPerformance.metric).toHaveBeenCalledTimes(1);
  });

  it('logs and suppresses errors raised by the performance API', () => {
    const { markPerformance, measurePerformance, metricPerformance } = require('./performance');
    mockPerformance.getEntriesByName.mockReturnValue([
      { entryType: 'mark', name: 'start', startTime: 0 },
      { entryType: 'mark', name: 'end', startTime: 1 },
    ]);
    mockPerformance.mark.mockImplementationOnce(() => {
      throw new Error('mark failed');
    });
    mockPerformance.measure.mockImplementationOnce(() => {
      throw new Error('measure failed');
    });
    mockPerformance.metric.mockImplementationOnce(() => {
      throw new Error('metric failed');
    });

    expect(() => markPerformance('broken.mark')).not.toThrow();
    expect(() => measurePerformance('broken.measure', 'start', 'end')).not.toThrow();
    expect(() => metricPerformance('broken.metric', 1)).not.toThrow();
    expect(debugWarn).toHaveBeenCalledTimes(3);
  });
});
