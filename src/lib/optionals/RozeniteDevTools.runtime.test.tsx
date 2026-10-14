import type {
  CreateSqliteAdapterOptions,
  SqliteAdapter,
  SqliteQueryParams,
  SqliteStatementInput,
  SqliteStatementType,
} from '@rozenite/sqlite-plugin';
import { act, render } from '@testing-library/react-native';
import { RozeniteDevTools } from './RozeniteDevTools';

type ControlSection = {
  id: string;
  items: {
    id: string;
    value?: string | boolean;
    onUpdate?: (enabled: boolean) => void;
    onPress?: () => void;
  }[];
};

const mockQueryClient = {};
const mockDeviceStorage = {};
const mockGetAllAsync = jest.fn();
const mockRunAsync = jest.fn();
const mockGetDatabase = jest.fn(async () => ({
  getAllAsync: (...args: unknown[]) => mockGetAllAsync(...args),
  runAsync: (...args: unknown[]) => mockRunAsync(...args),
}));
const mockUseNetworkActivity = jest.fn();
const mockUseTanStack = jest.fn();
const mockCreateStorageAdapter = jest.fn((options: unknown) => ({ options }));
const mockUseStorage = jest.fn();
const mockDecodeSqliteValue = jest.fn((value: SqliteQueryParams) => value);
const mockNormalizeSql = jest.fn((sql: string) => sql.trim());
const mockClassifySql = jest.fn(
  (sql: string): SqliteStatementType =>
    sql.toLowerCase().startsWith('select') ? 'select' : 'update',
);
const mockStatementReturnsRows = jest.fn((type: SqliteStatementType) => type === 'select');
const mockCreateSqliteAdapter = jest.fn(
  (_options: CreateSqliteAdapterOptions): SqliteAdapter => ({
    id: 'local-sqlite',
    name: 'Local SQLite',
    databases: [],
  }),
);
const mockUseSqlite = jest.fn();
const mockUseRHFPlugin = jest.fn();
const mockCreateSection = jest.fn((section: ControlSection) => section);
const mockUseControls = jest.fn();
const mockGetPerformanceSnapshot = jest.fn();
const mockIsPerformanceEnabled = jest.fn(() => true);
const mockSetPerformanceEnabled = jest.fn();
const mockMarkPerformance = jest.fn();
const mockMetricPerformance = jest.fn();
const mockMeasurePerformance = jest.fn();
const mockClearPerformanceEntries = jest.fn();
const mockGetMeasureDuration = jest.fn((name: string) =>
  name === 'app.startup.total' ? 123.5 : null,
);

jest.mock('@/lib/data/query-client', () => ({
  get queryClient() {
    return mockQueryClient;
  },
}));
jest.mock('@/lib/db/local-client', () => ({ getDatabase: () => mockGetDatabase() }));
jest.mock('@/lib/storage/local-device-storage', () => ({
  getDeviceStorage: () => mockDeviceStorage,
}));
jest.mock('@/lib/observability/performance', () => ({
  clearPerformanceEntries: (...args: unknown[]) => mockClearPerformanceEntries(...args),
  getPerformanceMeasureDuration: (name: string) => mockGetMeasureDuration(name),
  getPerformanceMonitorSnapshot: () => mockGetPerformanceSnapshot(),
  isPerformanceInstrumentationEnabled: () => mockIsPerformanceEnabled(),
  markPerformance: (...args: unknown[]) => mockMarkPerformance(...args),
  measurePerformance: (...args: unknown[]) => mockMeasurePerformance(...args),
  metricPerformance: (...args: unknown[]) => mockMetricPerformance(...args),
  setPerformanceInstrumentationEnabled: (...args: unknown[]) => mockSetPerformanceEnabled(...args),
}));
jest.mock('@/lib/observability/debug-log', () => ({ debugWarn: jest.fn() }));
jest.mock('@rozenite/network-activity-plugin', () => ({
  useNetworkActivityDevTools: (...args: unknown[]) => mockUseNetworkActivity(...args),
}));
jest.mock('@rozenite/tanstack-query-plugin', () => ({
  useTanStackQueryDevTools: (...args: unknown[]) => mockUseTanStack(...args),
}));
jest.mock('@rozenite/storage-plugin', () => ({
  createMMKVStorageAdapter: (options: unknown) => mockCreateStorageAdapter(options),
  useRozeniteStoragePlugin: (...args: unknown[]) => mockUseStorage(...args),
}));
jest.mock('@rozenite/sqlite-plugin', () => ({
  createSqliteAdapter: (options: CreateSqliteAdapterOptions) => mockCreateSqliteAdapter(options),
  decodeSqliteBridgeValue: (value: SqliteQueryParams) => mockDecodeSqliteValue(value),
  normalizeSingleStatementSql: (sql: string) => mockNormalizeSql(sql),
  classifySqlStatement: (sql: string) => mockClassifySql(sql),
  statementReturnsRows: (type: SqliteStatementType) => mockStatementReturnsRows(type),
  useRozeniteSqlitePlugin: (...args: unknown[]) => mockUseSqlite(...args),
}));
jest.mock('@rozenite/rhf-plugin', () => ({
  useRozeniteRHFPlugin: (...args: unknown[]) => mockUseRHFPlugin(...args),
}));
jest.mock('@rozenite/controls-plugin', () => ({
  createSection: (section: ControlSection) => mockCreateSection(section),
  useRozeniteControlsPlugin: (...args: unknown[]) => mockUseControls(...args),
}));

beforeEach(() => {
  mockGetAllAsync.mockReset().mockResolvedValue([]);
  mockRunAsync.mockReset().mockResolvedValue({ changes: 2, lastInsertRowId: 17 });
  mockGetDatabase.mockClear();
  mockUseNetworkActivity.mockClear();
  mockUseTanStack.mockClear();
  mockCreateStorageAdapter.mockClear();
  mockUseStorage.mockClear();
  mockDecodeSqliteValue.mockClear();
  mockNormalizeSql.mockClear();
  mockClassifySql.mockClear();
  mockStatementReturnsRows.mockClear();
  mockCreateSqliteAdapter.mockClear();
  mockUseSqlite.mockClear();
  mockUseRHFPlugin.mockClear();
  mockCreateSection.mockClear();
  mockUseControls.mockClear();
  mockGetPerformanceSnapshot
    .mockReset()
    .mockReturnValueOnce({
      available: true,
      enabled: false,
      latestEntry: null,
      totalEntries: 3,
      markCount: 1,
      measureCount: 1,
      metricCount: 1,
      nativeMarkCount: 0,
    })
    .mockReturnValueOnce({
      available: false,
      enabled: true,
      latestEntry: 'app.start',
      totalEntries: 1,
      markCount: 1,
      measureCount: 0,
      metricCount: 0,
      nativeMarkCount: 0,
    });
  mockIsPerformanceEnabled.mockReturnValue(true);
  mockSetPerformanceEnabled.mockClear();
  mockMarkPerformance.mockClear();
  mockMetricPerformance.mockClear();
  mockMeasurePerformance.mockClear();
  mockClearPerformanceEntries.mockClear();
  mockGetMeasureDuration.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test('loads development panels, executes their controls, and serializes SQLite results', async () => {
  jest.useFakeTimers();
  const previousWorkerId = process.env.JEST_WORKER_ID;
  delete process.env.JEST_WORKER_ID;

  try {
    const screen = await render(<RozeniteDevTools />);
    expect(mockCreateStorageAdapter).toHaveBeenCalledWith(
      expect.objectContaining({
        adapterId: 'fam-device-storage',
        adapterName: 'fam Gerätespeicher',
        storages: { device: mockDeviceStorage },
        blacklist: { device: expect.any(RegExp) },
      }),
    );
    const blacklist = mockCreateStorageAdapter.mock.calls[0]?.[0] as {
      blacklist: { device: RegExp };
    };
    expect(blacklist.blacklist.device.test('refresh_token')).toBe(true);
    expect(blacklist.blacklist.device.test('displayName')).toBe(false);
    expect(mockCreateSqliteAdapter).toHaveBeenCalledTimes(1);
    expect(mockUseTanStack).toHaveBeenCalledWith(mockQueryClient);

    const firstControls = mockUseControls.mock.calls[0]?.[0] as { sections: ControlSection[] };
    const performanceSection = firstControls.sections[0];
    expect(performanceSection.items.find((item) => item.id === 'performance-status')?.value).toBe(
      'Pausiert',
    );
    expect(firstControls.sections[1].items[0]?.value).toBe('124 ms');
    expect(firstControls.sections[1].items[1]?.value).toBe('—');

    act(() => {
      performanceSection.items
        .find((item) => item.id === 'performance-instrumentation-enabled')
        ?.onUpdate?.(false);
      performanceSection.items
        .find((item) => item.id === 'performance-mark-checkpoint')
        ?.onPress?.();
      performanceSection.items
        .find((item) => item.id === 'performance-measure-startup')
        ?.onPress?.();
      performanceSection.items.find((item) => item.id === 'performance-clear-entries')?.onPress?.();
    });
    expect(mockSetPerformanceEnabled).toHaveBeenCalledWith(false);
    expect(mockMarkPerformance).toHaveBeenCalledTimes(2);
    expect(mockMetricPerformance).toHaveBeenCalledWith('controls.performance.checkpoint-count', 1, {
      source: 'rozenite-controls',
    });
    expect(mockMeasurePerformance).toHaveBeenCalledWith(
      'controls.performance.startup-to-ready',
      'app.start',
      'app.startup.ready',
      { source: 'rozenite-controls', phase: 'startup' },
    );
    expect(mockClearPerformanceEntries).toHaveBeenCalledTimes(1);

    expect(mockCreateStorageAdapter).toHaveBeenCalledTimes(1);

    const sqliteOptions = mockCreateSqliteAdapter.mock.calls[0]?.[0];
    if (
      !sqliteOptions ||
      !('database' in sqliteOptions) ||
      typeof sqliteOptions.database === 'function'
    ) {
      throw new Error('Expected a single-database adapter configuration.');
    }
    const executeStatements = sqliteOptions.database.executeStatements;
    const rows = [
      {
        nullable: null,
        text: 'tea',
        count: 2,
        enabled: true,
        bytes: new Uint8Array([1, 2]),
        list: [false, { nested: 'value' }],
        nested: { score: 7 },
        missing: undefined,
      },
    ];
    mockGetAllAsync.mockResolvedValueOnce(rows).mockResolvedValueOnce([]);
    const statements: SqliteStatementInput[] = [
      { sql: 'select * from pantry', params: [null, 3, 'three', true] },
      { sql: 'update pantry set checked = 1' },
      { sql: 'update pantry set checked = ?', params: ['done'] },
      { sql: 'select * from empty' },
    ];
    const results = await executeStatements(statements);

    expect(results[0]).toEqual(
      expect.objectContaining({
        rows: [
          expect.objectContaining({
            bytes: [1, 2],
            list: [false, { nested: 'value' }],
            nested: { score: 7 },
            missing: 'undefined',
          }),
        ],
        columns: Object.keys(rows[0]),
        metadata: expect.objectContaining({ statementType: 'select', rowCount: 1 }),
      }),
    );
    expect(results[1]).toEqual(
      expect.objectContaining({
        rows: [],
        columns: [],
        metadata: expect.objectContaining({ changes: 2, lastInsertRowId: 17 }),
      }),
    );
    expect(results[3]?.columns).toEqual([]);
    expect(mockGetAllAsync).toHaveBeenNthCalledWith(1, 'select * from pantry', [
      null,
      3,
      'three',
      1,
    ]);
    expect(mockRunAsync).toHaveBeenNthCalledWith(1, 'update pantry set checked = 1');
    expect(mockRunAsync).toHaveBeenNthCalledWith(2, 'update pantry set checked = ?', ['done']);

    await expect(
      executeStatements([{ sql: 'select * from pantry where name = ?', params: { name: 'Tea' } }]),
    ).rejects.toThrow('positionsbasierte Parameter');
    await expect(
      executeStatements([{ sql: 'select * from pantry where name = ?', params: [{}] }]),
    ).rejects.toThrow('nur Text-, Zahlen- und Nullwerte');

    await screen.unmount();
  } finally {
    if (previousWorkerId === undefined) {
      delete process.env.JEST_WORKER_ID;
    } else {
      process.env.JEST_WORKER_ID = previousWorkerId;
    }
  }
});
