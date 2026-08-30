import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { z } from 'zod';
import {
  type CreateMedicationLogInput,
  type CreateSymptomLogInput,
  medicationLogMutationSchema,
  symptomLogMutationSchema,
  type UpdateMedicationLogInput,
  type UpdateSymptomLogInput,
  updateMedicationLogMutationSchema,
  updateSymptomLogMutationSchema,
} from '@/features/glp1/domain/mutation-schemas';
import {
  medicationLogsScopeQueryKey,
  symptomLogsScopeQueryKey,
} from '@/features/glp1/domain/query-keys';
import { invalidateCorrelationSeries } from '@/features/glp1/hooks/invalidate-correlation';
import {
  getLogicalDateForTimestamp,
  getTimeRangeForLogicalDate,
} from '@/features/tracking/domain/day-boundary';
import type { Database } from '@/lib/database.types';
import { getDatabase } from '@/lib/db/client';
import { enqueueMutation } from '@/lib/db/outbox';
import type { SqlDatabase } from '@/lib/db/types';
import { applyLocalMirrorWrite } from '@/lib/sync/mirror-write';

export type MedicationLogRow = Database['public']['Tables']['medication_logs']['Row'];
export type SymptomLogRow = Database['public']['Tables']['symptom_logs']['Row'];

type LocalMedicationLogRow = Omit<MedicationLogRow, 'deleted_at' | 'updated_at'> & {
  deleted_at: number | null;
  updated_at: number;
};

type LocalSymptomLogRow = Omit<SymptomLogRow, 'deleted_at' | 'side_effects' | 'updated_at'> & {
  deleted_at: number | null;
  side_effects: string;
  updated_at: number;
};

const sideEffectsSchema = z.array(z.string());

function medicationLogFromLocal(row: LocalMedicationLogRow): MedicationLogRow {
  return {
    ...row,
    deleted_at: row.deleted_at === null ? null : new Date(row.deleted_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
  };
}

function symptomLogFromLocal(row: LocalSymptomLogRow): SymptomLogRow {
  let parsedSideEffects: unknown;
  try {
    parsedSideEffects = JSON.parse(row.side_effects);
  } catch {
    parsedSideEffects = [];
  }

  const sideEffects = sideEffectsSchema.safeParse(parsedSideEffects);
  return {
    ...row,
    deleted_at: row.deleted_at === null ? null : new Date(row.deleted_at).toISOString(),
    side_effects: sideEffects.success ? sideEffects.data : [],
    updated_at: new Date(row.updated_at).toISOString(),
  };
}

export function medicationLogsQueryKey(
  userId: string | undefined,
  childProfileId: string | null | undefined,
  logicalDate: string,
  dayStartTime: string,
) {
  return [
    ...medicationLogsScopeQueryKey(userId, childProfileId),
    'logical-day',
    logicalDate,
    dayStartTime,
  ] as const;
}

export function symptomLogsQueryKey(
  userId: string | undefined,
  childProfileId: string | null | undefined,
  logicalDate: string,
  dayStartTime: string,
) {
  return [
    ...symptomLogsScopeQueryKey(userId, childProfileId),
    'logical-day',
    logicalDate,
    dayStartTime,
  ] as const;
}

export function latestMedicationLogQueryKey(
  userId: string | undefined,
  childProfileId?: string | null,
  medicationName?: string,
) {
  return [
    ...medicationLogsScopeQueryKey(userId, childProfileId),
    'latest',
    medicationName?.trim().toLocaleLowerCase('de-DE') ?? null,
  ] as const;
}

export function recentMedicationLogsQueryKey(
  userId: string | undefined,
  childProfileId: string | null | undefined,
  limit: number,
) {
  return [...medicationLogsScopeQueryKey(userId, childProfileId), 'recent', limit] as const;
}

type LogicalDayLogQueryInput = {
  userId: string;
  childProfileId?: string | null;
  logicalDate: string;
  dayStartTime: string;
};

export async function fetchMedicationLogsForLogicalDay({
  userId,
  childProfileId,
  logicalDate,
  dayStartTime,
}: LogicalDayLogQueryInput): Promise<MedicationLogRow[]> {
  const { start, nextStart } = getTimeRangeForLogicalDate(logicalDate, dayStartTime);
  const db = await getDatabase();
  const rows = await db.getAllAsync<LocalMedicationLogRow>(
    `select id, user_id, child_profile_id, medication_name, dose, unit, injection_site,
            administered_at, notes, created_at, updated_at, deleted_at
     from medication_logs
     where user_id = ? and child_profile_id is ? and deleted_at is null
       and administered_at >= ? and administered_at < ?
     order by administered_at desc`,
    [userId, childProfileId ?? null, start.toISOString(), nextStart.toISOString()],
  );
  return rows.map(medicationLogFromLocal);
}

export function useMedicationLogs(
  userId: string | undefined,
  childProfileId?: string | null,
  logicalDate?: string,
  dayStartTime = '00:00',
) {
  const selectedLogicalDate = logicalDate ?? getLogicalDateForTimestamp(new Date(), dayStartTime);
  return useQuery({
    queryKey: medicationLogsQueryKey(userId, childProfileId, selectedLogicalDate, dayStartTime),
    queryFn: () =>
      fetchMedicationLogsForLogicalDay({
        userId: userId as string,
        childProfileId,
        logicalDate: selectedLogicalDate,
        dayStartTime,
      }),
    enabled: !!userId,
    networkMode: 'always',
  });
}

export function useLatestMedicationLog(
  userId: string | undefined,
  childProfileId?: string | null,
  medicationName?: string,
) {
  return useQuery({
    queryKey: latestMedicationLogQueryKey(userId, childProfileId, medicationName),
    queryFn: () =>
      fetchLatestMedicationLog({ userId: userId as string, childProfileId, medicationName }),
    enabled: !!userId,
    networkMode: 'always',
  });
}

function boundedRecentLimit(limit: number): number {
  if (!Number.isFinite(limit)) return 10;
  return Math.min(100, Math.max(1, Math.trunc(limit)));
}

export async function fetchRecentMedicationLogs({
  userId,
  childProfileId,
  medicationName,
  limit = 10,
}: {
  userId: string;
  childProfileId?: string | null;
  medicationName?: string;
  limit?: number;
}): Promise<MedicationLogRow[]> {
  const db = await getDatabase();
  const boundedLimit = boundedRecentLimit(limit);
  const medicationFilter = medicationName ? ' and medication_name = ? collate nocase' : '';
  const params = [userId, childProfileId ?? null];
  if (medicationName) params.push(medicationName.trim());
  const rows = await db.getAllAsync<LocalMedicationLogRow>(
    `select id, user_id, child_profile_id, medication_name, dose, unit, injection_site,
            administered_at, notes, created_at, updated_at, deleted_at
     from medication_logs
     where user_id = ? and child_profile_id is ? and deleted_at is null${medicationFilter}
     order by administered_at desc
     limit ?`,
    [...params, boundedLimit],
  );
  return rows.map(medicationLogFromLocal);
}

export function useRecentMedicationLogs(
  userId: string | undefined,
  childProfileId?: string | null,
  limit = 10,
) {
  const boundedLimit = boundedRecentLimit(limit);
  return useQuery({
    queryKey: recentMedicationLogsQueryKey(userId, childProfileId, boundedLimit),
    queryFn: () =>
      fetchRecentMedicationLogs({
        userId: userId as string,
        childProfileId,
        limit: boundedLimit,
      }),
    enabled: !!userId,
    networkMode: 'always',
  });
}

export async function fetchLatestMedicationLog({
  userId,
  childProfileId,
  medicationName,
}: {
  userId: string;
  childProfileId?: string | null;
  medicationName?: string;
}): Promise<MedicationLogRow | null> {
  const [latest] = await fetchRecentMedicationLogs({
    userId,
    childProfileId,
    medicationName,
    limit: 1,
  });
  return latest ?? null;
}

export type { CreateMedicationLogInput, CreateSymptomLogInput };

export function useAddMedicationLogMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateMedicationLogInput) => {
      const validated = medicationLogMutationSchema.parse(input);
      const db = await getDatabase();
      const id = Crypto.randomUUID();
      const nowMs = Date.now();
      const now = new Date(nowMs).toISOString();
      const row: MedicationLogRow = {
        id,
        user_id: validated.userId,
        child_profile_id: validated.childProfileId ?? null,
        medication_name: validated.medicationName,
        dose: validated.dose ?? null,
        unit: validated.unit,
        injection_site: validated.injectionSite ?? null,
        administered_at: validated.administeredAt ?? now,
        notes: validated.notes,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };

      await enqueueMutation(db, {
        entity: 'medication_logs',
        entityId: id,
        op: 'insert',
        payload: row,
        applyLocally: (txn) => applyLocalMirrorWrite(txn, 'medication_logs', 'insert', row, nowMs),
      });
      return row;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: medicationLogsScopeQueryKey(variables.userId, variables.childProfileId),
      });
      invalidateCorrelationSeries(queryClient, variables.userId, variables.childProfileId);
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
    networkMode: 'always',
  });
}

async function findScopedMedicationLog(
  db: SqlDatabase,
  id: string,
  userId: string,
  childProfileId: string | null | undefined,
): Promise<LocalMedicationLogRow> {
  const row = await db.getFirstAsync<LocalMedicationLogRow>(
    `select id, user_id, child_profile_id, medication_name, dose, unit, injection_site,
            administered_at, notes, created_at, updated_at, deleted_at
     from medication_logs
     where id = ? and user_id = ? and child_profile_id is ?
     limit 1`,
    [id, userId, childProfileId ?? null],
  );
  if (!row) throw new Error('Injektion wurde in diesem Profil nicht gefunden.');
  return row;
}

export function useUpdateMedicationLogMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateMedicationLogInput) => {
      const validated = updateMedicationLogMutationSchema.parse(input);
      const db = await getDatabase();
      const existing = await findScopedMedicationLog(
        db,
        validated.id,
        validated.userId,
        validated.childProfileId,
      );
      const nowMs = Date.now();
      const now = new Date(nowMs).toISOString();
      const changed = {
        id: validated.id,
        medication_name: validated.medicationName,
        dose: validated.dose ?? null,
        unit: validated.unit,
        injection_site: validated.injectionSite ?? null,
        administered_at: validated.administeredAt ?? existing.administered_at,
        notes: validated.notes,
      };

      await enqueueMutation(db, {
        entity: 'medication_logs',
        entityId: validated.id,
        op: 'update',
        payload: changed,
        applyLocally: (txn) =>
          applyLocalMirrorWrite(txn, 'medication_logs', 'update', changed, nowMs),
      });

      return {
        ...medicationLogFromLocal(existing),
        ...changed,
        updated_at: now,
      };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: medicationLogsScopeQueryKey(variables.userId, variables.childProfileId),
      });
      invalidateCorrelationSeries(queryClient, variables.userId, variables.childProfileId);
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
    networkMode: 'always',
  });
}

export function useDeleteMedicationLogMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      userId,
      childProfileId,
    }: {
      id: string;
      userId: string;
      childProfileId?: string | null;
    }) => {
      const db = await getDatabase();
      await findScopedMedicationLog(db, id, userId, childProfileId);
      const nowMs = Date.now();
      await enqueueMutation(db, {
        entity: 'medication_logs',
        entityId: id,
        op: 'delete',
        payload: { id },
        applyLocally: (txn) =>
          applyLocalMirrorWrite(txn, 'medication_logs', 'delete', { id }, nowMs),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: medicationLogsScopeQueryKey(variables.userId, variables.childProfileId),
      });
      invalidateCorrelationSeries(queryClient, variables.userId, variables.childProfileId);
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
    networkMode: 'always',
  });
}

export function useRestoreMedicationLogMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      userId,
      childProfileId,
    }: {
      id: string;
      userId: string;
      childProfileId?: string | null;
    }) => {
      const db = await getDatabase();
      await findScopedMedicationLog(db, id, userId, childProfileId);
      const nowMs = Date.now();
      await enqueueMutation(db, {
        entity: 'medication_logs',
        entityId: id,
        op: 'restore',
        payload: { id },
        applyLocally: (txn) =>
          applyLocalMirrorWrite(txn, 'medication_logs', 'restore', { id }, nowMs),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: medicationLogsScopeQueryKey(variables.userId, variables.childProfileId),
      });
      invalidateCorrelationSeries(queryClient, variables.userId, variables.childProfileId);
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
    networkMode: 'always',
  });
}

export async function fetchSymptomLogsForLogicalDay({
  userId,
  childProfileId,
  logicalDate,
  dayStartTime,
}: LogicalDayLogQueryInput): Promise<SymptomLogRow[]> {
  const { start, nextStart } = getTimeRangeForLogicalDate(logicalDate, dayStartTime);
  const db = await getDatabase();
  const rows = await db.getAllAsync<LocalSymptomLogRow>(
    `select id, user_id, child_profile_id, logged_at, appetite_level, satiety_level,
            nausea_level, side_effects, notes, created_at, updated_at, deleted_at
     from symptom_logs
     where user_id = ? and child_profile_id is ? and deleted_at is null
       and logged_at >= ? and logged_at < ?
     order by logged_at desc`,
    [userId, childProfileId ?? null, start.toISOString(), nextStart.toISOString()],
  );
  return rows.map(symptomLogFromLocal);
}

export function useSymptomLogs(
  userId: string | undefined,
  childProfileId?: string | null,
  logicalDate?: string,
  dayStartTime = '00:00',
) {
  const selectedLogicalDate = logicalDate ?? getLogicalDateForTimestamp(new Date(), dayStartTime);
  return useQuery({
    queryKey: symptomLogsQueryKey(userId, childProfileId, selectedLogicalDate, dayStartTime),
    queryFn: () =>
      fetchSymptomLogsForLogicalDay({
        userId: userId as string,
        childProfileId,
        logicalDate: selectedLogicalDate,
        dayStartTime,
      }),
    enabled: !!userId,
    networkMode: 'always',
  });
}

export function useAddSymptomLogMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateSymptomLogInput) => {
      const validated = symptomLogMutationSchema.parse(input);
      const db = await getDatabase();
      const id = Crypto.randomUUID();
      const nowMs = Date.now();
      const now = new Date(nowMs).toISOString();
      const row: SymptomLogRow = {
        id,
        user_id: validated.userId,
        child_profile_id: validated.childProfileId ?? null,
        logged_at: validated.loggedAt ?? now,
        appetite_level: validated.appetiteLevel ?? null,
        satiety_level: validated.satietyLevel ?? null,
        nausea_level: validated.nauseaLevel ?? null,
        side_effects: validated.sideEffects,
        notes: validated.notes,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      const localRow = { ...row, side_effects: JSON.stringify(row.side_effects) };

      await enqueueMutation(db, {
        entity: 'symptom_logs',
        entityId: id,
        op: 'insert',
        payload: row,
        applyLocally: (txn) =>
          applyLocalMirrorWrite(txn, 'symptom_logs', 'insert', localRow, nowMs),
      });
      return row;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: symptomLogsScopeQueryKey(variables.userId, variables.childProfileId),
      });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
    networkMode: 'always',
  });
}

async function findScopedSymptomLog(
  db: SqlDatabase,
  id: string,
  userId: string,
  childProfileId: string | null | undefined,
): Promise<LocalSymptomLogRow> {
  const row = await db.getFirstAsync<LocalSymptomLogRow>(
    `select id, user_id, child_profile_id, logged_at, appetite_level, satiety_level,
            nausea_level, side_effects, notes, created_at, updated_at, deleted_at
     from symptom_logs
     where id = ? and user_id = ? and child_profile_id is ?
     limit 1`,
    [id, userId, childProfileId ?? null],
  );
  if (!row) throw new Error('Symptom-Eintrag wurde in diesem Profil nicht gefunden.');
  return row;
}

export function useUpdateSymptomLogMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateSymptomLogInput) => {
      const validated = updateSymptomLogMutationSchema.parse(input);
      const db = await getDatabase();
      const existing = await findScopedSymptomLog(
        db,
        validated.id,
        validated.userId,
        validated.childProfileId,
      );
      const nowMs = Date.now();
      const now = new Date(nowMs).toISOString();
      const changed = {
        id: validated.id,
        logged_at: validated.loggedAt ?? existing.logged_at,
        appetite_level: validated.appetiteLevel ?? null,
        satiety_level: validated.satietyLevel ?? null,
        nausea_level: validated.nauseaLevel ?? null,
        side_effects: validated.sideEffects,
        notes: validated.notes,
      };
      const localChanged = {
        ...changed,
        side_effects: JSON.stringify(changed.side_effects),
      };

      await enqueueMutation(db, {
        entity: 'symptom_logs',
        entityId: validated.id,
        op: 'update',
        payload: changed,
        applyLocally: (txn) =>
          applyLocalMirrorWrite(txn, 'symptom_logs', 'update', localChanged, nowMs),
      });

      return {
        ...symptomLogFromLocal(existing),
        ...changed,
        updated_at: now,
      };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: symptomLogsScopeQueryKey(variables.userId, variables.childProfileId),
      });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
    networkMode: 'always',
  });
}

type SymptomLogMutationScope = {
  id: string;
  userId: string;
  childProfileId?: string | null;
};

export function useDeleteSymptomLogMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, userId, childProfileId }: SymptomLogMutationScope) => {
      const db = await getDatabase();
      await findScopedSymptomLog(db, id, userId, childProfileId);
      const nowMs = Date.now();
      await enqueueMutation(db, {
        entity: 'symptom_logs',
        entityId: id,
        op: 'delete',
        payload: { id },
        applyLocally: (txn) => applyLocalMirrorWrite(txn, 'symptom_logs', 'delete', { id }, nowMs),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: symptomLogsScopeQueryKey(variables.userId, variables.childProfileId),
      });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
    networkMode: 'always',
  });
}

export function useRestoreSymptomLogMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, userId, childProfileId }: SymptomLogMutationScope) => {
      const db = await getDatabase();
      await findScopedSymptomLog(db, id, userId, childProfileId);
      const nowMs = Date.now();
      await enqueueMutation(db, {
        entity: 'symptom_logs',
        entityId: id,
        op: 'restore',
        payload: { id },
        applyLocally: (txn) => applyLocalMirrorWrite(txn, 'symptom_logs', 'restore', { id }, nowMs),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: symptomLogsScopeQueryKey(variables.userId, variables.childProfileId),
      });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
    networkMode: 'always',
  });
}
