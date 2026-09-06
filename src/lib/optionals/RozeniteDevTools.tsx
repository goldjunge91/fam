import { useEffect, useMemo, useState } from 'react';
import type { Control, FieldValues, UseFormReset } from 'react-hook-form';

import { getDatabase } from '@/lib/db/client';
import type { SqlParam } from '@/lib/db/types';
import {
  clearPerformanceEntries,
  getPerformanceMeasureDuration,
  getPerformanceMonitorSnapshot,
  isPerformanceInstrumentationEnabled,
  markPerformance,
  measurePerformance,
  metricPerformance,
  setPerformanceInstrumentationEnabled,
} from '@/lib/performance';
import { queryClient } from '@/lib/query-client';
import { getDeviceStorage } from '@/lib/storage/device-storage';

type RozeniteModules = {
  network: typeof import('@rozenite/network-activity-plugin');
  sqlite: typeof import('@rozenite/sqlite-plugin');
  storage: typeof import('@rozenite/storage-plugin');
  tanstack: typeof import('@rozenite/tanstack-query-plugin');
  rhf: typeof import('@rozenite/rhf-plugin');
  controls: typeof import('@rozenite/controls-plugin');
};

type SqliteStatementInput = import('@rozenite/sqlite-plugin').SqliteStatementInput;
type SqliteQueryResult = import('@rozenite/sqlite-plugin').SqliteQueryResult;
type SqliteQueryParams = import('@rozenite/sqlite-plugin').SqliteQueryParams;
type SqliteStatementType = import('@rozenite/sqlite-plugin').SqliteStatementType;

type RozeniteRuntime = {
  modules: RozeniteModules;
  storageAdapters: ReturnType<RozeniteModules['storage']['createMMKVStorageAdapter']>[];
  sqliteAdapters: ReturnType<RozeniteModules['sqlite']['createSqliteAdapter']>[];
};

type BridgeValue =
  | string
  | number
  | boolean
  | null
  | BridgeValue[]
  | { [key: string]: BridgeValue };

let runtime: RozeniteRuntime | null | undefined;

function loadRozeniteRuntime(): RozeniteRuntime | null {
  if (runtime !== undefined) return runtime;
  if (!__DEV__) {
    runtime = null;
    return runtime;
  }

  try {
    const modules: RozeniteModules = {
      network: require('@rozenite/network-activity-plugin'),
      sqlite: require('@rozenite/sqlite-plugin'),
      storage: require('@rozenite/storage-plugin'),
      tanstack: require('@rozenite/tanstack-query-plugin'),
      rhf: require('@rozenite/rhf-plugin'),
      controls: require('@rozenite/controls-plugin'),
    };

    runtime = {
      modules,
      storageAdapters: [
        modules.storage.createMMKVStorageAdapter({
          adapterId: 'fam-device-storage',
          adapterName: 'fam Gerätespeicher',
          storages: { device: getDeviceStorage() },
          blacklist: {
            device: /(?:secret|token|password|encryption|session|credential|temp|debug|internal)/i,
          },
        }),
      ],
      sqliteAdapters: [
        modules.sqlite.createSqliteAdapter({
          adapterId: 'fam-local-sqlite',
          adapterName: 'fam lokale SQLite-Datenbank',
          database: {
            name: 'Aktiver Account (verschlüsselt)',
            executeStatements: (statements) => executeSqliteStatements(modules.sqlite, statements),
          },
        }),
      ],
    };
  } catch (error) {
    console.warn('[rozenite] DevTools konnten nicht geladen werden:', error);
    runtime = null;
  }

  return runtime;
}

function toSqliteParams(
  sqlite: RozeniteModules['sqlite'],
  params: SqliteQueryParams | undefined,
): readonly SqlParam[] | undefined {
  if (params === undefined) return undefined;

  const decoded = sqlite.decodeSqliteBridgeValue(params);
  if (!Array.isArray(decoded)) {
    throw new Error('Der fam SQLite-Adapter unterstützt nur positionsbasierte Parameter.');
  }

  return decoded.map((value): SqlParam => {
    if (value === null || typeof value === 'string' || typeof value === 'number') {
      return value;
    }
    if (typeof value === 'boolean') return value ? 1 : 0;
    throw new Error('Der fam SQLite-Adapter unterstützt nur Text-, Zahlen- und Nullwerte.');
  });
}

function toBridgeValue(value: unknown): BridgeValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (value instanceof Uint8Array) return Array.from(value);
  if (Array.isArray(value)) return value.map(toBridgeValue);
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, toBridgeValue(nestedValue)]),
    );
  }
  return String(value);
}

function toBridgeRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((row) =>
    Object.fromEntries(Object.entries(row).map(([key, value]) => [key, toBridgeValue(value)])),
  );
}

function statementReturnsRows(
  sqlite: RozeniteModules['sqlite'],
  statementType: SqliteStatementType,
): boolean {
  return sqlite.statementReturnsRows(statementType);
}

async function executeSqliteStatements(
  sqlite: RozeniteModules['sqlite'],
  statements: SqliteStatementInput[],
): Promise<SqliteQueryResult[]> {
  const database = await getDatabase();
  const results: SqliteQueryResult[] = [];

  for (const statement of statements) {
    const sql = sqlite.normalizeSingleStatementSql(statement.sql);
    const statementType = sqlite.classifySqlStatement(sql);
    const params = toSqliteParams(sqlite, statement.params);
    const startedAt = Date.now();

    if (statementReturnsRows(sqlite, statementType)) {
      const rows =
        params === undefined
          ? await database.getAllAsync<Record<string, unknown>>(sql)
          : await database.getAllAsync<Record<string, unknown>>(sql, params);
      const normalizedRows = toBridgeRows(rows);

      results.push({
        rows: normalizedRows,
        columns: Object.keys(normalizedRows[0] ?? {}),
        metadata: {
          statementType,
          rowCount: normalizedRows.length,
          changes: null,
          lastInsertRowId: null,
          durationMs: Date.now() - startedAt,
        },
      });
      continue;
    }

    const result =
      params === undefined ? await database.runAsync(sql) : await database.runAsync(sql, params);

    results.push({
      rows: [],
      columns: [],
      metadata: {
        statementType,
        rowCount: 0,
        changes: result.changes,
        lastInsertRowId: result.lastInsertRowId,
        durationMs: Date.now() - startedAt,
      },
    });
  }

  return results;
}

export type RozeniteRHFDevToolsOptions<
  TInput extends FieldValues,
  TOutput extends FieldValues = TInput,
> = {
  control: Control<TInput, unknown, TOutput>;
  id?: string;
  reset?: UseFormReset<TInput>;
};

/** Registers a React Hook Form with Rozenite in development builds. */
export function useRozeniteRHFDevTools<
  TInput extends FieldValues,
  TOutput extends FieldValues = TInput,
>(options: RozeniteRHFDevToolsOptions<TInput, TOutput>): void {
  const currentRuntime = loadRozeniteRuntime();
  const useRHFPlugin = currentRuntime?.modules.rhf.useRozeniteRHFPlugin ?? noopRHFPlugin;
  useRHFPlugin({
    ...options,
    control: options.control as unknown as Control<TInput>,
  });
}

const noopNetworkActivityHook: RozeniteModules['network']['useNetworkActivityDevTools'] = () =>
  null;
const noopTanStackHook: RozeniteModules['tanstack']['useTanStackQueryDevTools'] = () => undefined;
const noopStorageHook: RozeniteModules['storage']['useRozeniteStoragePlugin'] = () => null;
const noopSqliteHook: RozeniteModules['sqlite']['useRozeniteSqlitePlugin'] = () => null;
const noopRHFPlugin: RozeniteModules['rhf']['useRozeniteRHFPlugin'] = () => undefined;
const noopControlsHook: RozeniteModules['controls']['useRozeniteControlsPlugin'] = () => null;

function formatDuration(durationMs: number | null): string {
  return durationMs === null ? '—' : `${Math.round(durationMs)} ms`;
}

/** Mounts the global Rozenite panels once inside the app's provider tree. */
export function RozeniteDevTools() {
  const currentRuntime = loadRozeniteRuntime();
  const useNetworkActivityHook =
    currentRuntime?.modules.network.useNetworkActivityDevTools ?? noopNetworkActivityHook;
  const useTanStackHook =
    currentRuntime?.modules.tanstack.useTanStackQueryDevTools ?? noopTanStackHook;
  const useStorageHook =
    currentRuntime?.modules.storage.useRozeniteStoragePlugin ?? noopStorageHook;
  const useSqliteHook = currentRuntime?.modules.sqlite.useRozeniteSqlitePlugin ?? noopSqliteHook;
  const useControlsHook =
    currentRuntime?.modules.controls.useRozeniteControlsPlugin ?? noopControlsHook;

  const [, setControlsRefreshToken] = useState(0);
  const [performanceEnabled, setPerformanceEnabled] = useState(isPerformanceInstrumentationEnabled);
  const performanceSnapshot = getPerformanceMonitorSnapshot();

  useEffect(() => {
    const refreshTimer = setInterval(() => {
      setControlsRefreshToken((token) => token + 1);
    }, 1000);

    return () => clearInterval(refreshTimer);
  }, []);

  const performanceSections = useMemo(() => {
    const createSection = currentRuntime?.modules.controls.createSection;
    if (!createSection) return [];

    return [
      createSection({
        id: 'performance-monitor',
        title: 'Performance Monitor',
        description:
          'Dev-only Instrumentierung für Startup, Laufzeiten, Marks, Measures und Metrics. Die Einträge erscheinen parallel im Performance-Monitor-Panel.',
        items: [
          {
            id: 'performance-status',
            type: 'text',
            title: 'Status',
            value: performanceSnapshot.available
              ? performanceSnapshot.enabled
                ? 'Aktiv'
                : 'Pausiert'
              : 'Nicht verfügbar',
            description: 'react-native-performance und Rozenite Performance Monitor.',
          },
          {
            id: 'performance-entry-count',
            type: 'text',
            title: 'Alle Einträge',
            value: String(performanceSnapshot.totalEntries),
            description: 'Marks, Measures, Metrics und native Startup-Marks zusammen.',
          },
          {
            id: 'performance-mark-count',
            type: 'text',
            title: 'Marks',
            value: String(performanceSnapshot.markCount),
            description: 'Benannte Zeitpunkte wie app.start oder app.root.mounted.',
          },
          {
            id: 'performance-measure-count',
            type: 'text',
            title: 'Measures',
            value: String(performanceSnapshot.measureCount),
            description: 'Zeitspannen zwischen zwei Marks.',
          },
          {
            id: 'performance-metric-count',
            type: 'text',
            title: 'Metrics',
            value: String(performanceSnapshot.metricCount),
            description: 'Numerische oder textuelle Messwerte mit optionalen Details.',
          },
          {
            id: 'performance-native-mark-count',
            type: 'text',
            title: 'Native Startup-Marks',
            value: String(performanceSnapshot.nativeMarkCount),
            description: 'Native Initialisierung, JS-Bundle und erster React-Mount.',
          },
          {
            id: 'performance-latest-entry',
            type: 'text',
            title: 'Letzter Eintrag',
            value: performanceSnapshot.latestEntry ?? '—',
          },
          {
            id: 'performance-instrumentation-enabled',
            type: 'toggle',
            title: 'Instrumentierung aktiv',
            value: performanceEnabled,
            description: 'Schaltet eigene Marks, Measures und Metrics im Dev-Build an oder aus.',
            onUpdate: (enabled: boolean) => {
              setPerformanceInstrumentationEnabled(enabled);
              setPerformanceEnabled(enabled);
            },
          },
          {
            id: 'performance-mark-checkpoint',
            type: 'button',
            title: 'Checkpoint markieren',
            actionLabel: 'Markieren',
            description: 'Erzeugt einen sichtbaren Mark und eine zugehörige Kontroll-Metric.',
            onPress: () => {
              markPerformance('controls.performance.checkpoint', {
                source: 'rozenite-controls',
              });
              metricPerformance('controls.performance.checkpoint-count', 1, {
                source: 'rozenite-controls',
              });
            },
          },
          {
            id: 'performance-measure-startup',
            type: 'button',
            title: 'Startup erneut messen',
            actionLabel: 'Messen',
            description:
              'Misst app.runtime.initialization.start bis app.startup.ready, sofern beide Marks vorhanden sind.',
            onPress: () => {
              markPerformance('controls.performance.measure-requested', {
                source: 'rozenite-controls',
              });
              measurePerformance(
                'controls.performance.startup-to-ready',
                'app.start',
                'app.startup.ready',
                { source: 'rozenite-controls', phase: 'startup' },
              );
            },
          },
          {
            id: 'performance-clear-entries',
            type: 'button',
            title: 'Einträge löschen',
            actionLabel: 'Löschen',
            description:
              'Entfernt lokale Dev-Entries. Ein neuer App-Start erzeugt die automatischen Startup-Daten erneut.',
            onPress: clearPerformanceEntries,
          },
        ],
      }),
      createSection({
        id: 'performance-startup-phases',
        title: 'Startup-Phasen',
        description: 'Wichtige App-spezifische Measures aus dem aktuellen Dev-Run.',
        items: [
          {
            id: 'measure-app-startup-total',
            type: 'text',
            title: 'App-Startup gesamt',
            value: formatDuration(getPerformanceMeasureDuration('app.startup.total')),
          },
          {
            id: 'measure-runtime-initialization',
            type: 'text',
            title: 'Runtime-Initialisierung',
            value: formatDuration(getPerformanceMeasureDuration('app.runtime.initialization')),
          },
          {
            id: 'measure-startup-to-root',
            type: 'text',
            title: 'Runtime bis Root-Mount',
            value: formatDuration(getPerformanceMeasureDuration('app.startup.to-root')),
          },
          {
            id: 'measure-auth-session-restore',
            type: 'text',
            title: 'Auth Session Restore',
            value: formatDuration(getPerformanceMeasureDuration('auth.session.restore')),
          },
          {
            id: 'measure-database-open',
            type: 'text',
            title: 'Lokale Datenbank öffnen',
            value: formatDuration(getPerformanceMeasureDuration('db.open')),
          },
          {
            id: 'measure-sync-run',
            type: 'text',
            title: 'Letzter Sync-Lauf',
            value: formatDuration(getPerformanceMeasureDuration('sync.run')),
          },
        ],
      }),
    ];
  }, [
    currentRuntime,
    performanceEnabled,
    performanceSnapshot.available,
    performanceSnapshot.enabled,
    performanceSnapshot.latestEntry,
    performanceSnapshot.markCount,
    performanceSnapshot.measureCount,
    performanceSnapshot.metricCount,
    performanceSnapshot.nativeMarkCount,
    performanceSnapshot.totalEntries,
  ]);

  useNetworkActivityHook();
  useTanStackHook(queryClient);
  useStorageHook({
    storages: currentRuntime?.storageAdapters ?? [],
  });
  useSqliteHook({
    adapters: currentRuntime?.sqliteAdapters ?? [],
  });
  useControlsHook({ sections: performanceSections });

  return null;
}
