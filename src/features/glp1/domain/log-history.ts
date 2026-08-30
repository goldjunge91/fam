export type Glp1HistoryItem<MedicationLog, SymptomLog> =
  | { kind: 'injection'; timestamp: string; log: MedicationLog }
  | { kind: 'symptom'; timestamp: string; log: SymptomLog };

function timestampValue(timestamp: string): number {
  const value = Date.parse(timestamp);
  return Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
}

export function sortGlp1History<MedicationLog, SymptomLog>(
  items: readonly Glp1HistoryItem<MedicationLog, SymptomLog>[],
): Glp1HistoryItem<MedicationLog, SymptomLog>[] {
  return [...items].sort(
    (left, right) => timestampValue(right.timestamp) - timestampValue(left.timestamp),
  );
}
