export const medicationLogsRootQueryKey = ['glp1', 'medications'] as const;
export const symptomLogsRootQueryKey = ['glp1', 'symptoms'] as const;
export const correlationSeriesRootQueryKey = ['glp1', 'correlation'] as const;

export function medicationLogsScopeQueryKey(
  userId: string | undefined,
  childProfileId?: string | null,
) {
  return [...medicationLogsRootQueryKey, userId, childProfileId ?? null] as const;
}

export function symptomLogsScopeQueryKey(
  userId: string | undefined,
  childProfileId?: string | null,
) {
  return [...symptomLogsRootQueryKey, userId, childProfileId ?? null] as const;
}

export function correlationSeriesScopeQueryKey(
  userId: string | undefined,
  childProfileId?: string | null,
) {
  return [...correlationSeriesRootQueryKey, userId, childProfileId ?? null] as const;
}

export function correlationSeriesQueryKey(
  userId: string | undefined,
  childProfileId: string | null | undefined,
  endDate: string,
  dayStartTime: string,
) {
  return [
    ...correlationSeriesScopeQueryKey(userId, childProfileId),
    endDate,
    dayStartTime,
  ] as const;
}
