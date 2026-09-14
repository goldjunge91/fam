type MockPerformanceEntry = {
  entryType: string;
  name: string;
  startTime: number;
  duration?: number;
};

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
});
