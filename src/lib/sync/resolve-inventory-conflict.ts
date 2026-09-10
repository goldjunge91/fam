import { addDiagnosticStep, reportWarning } from '@/lib/telemetry';

export type InventoryConflictCode = 'STALE_BASE' | 'INSUFFICIENT_QUANTITY' | 'ID_PAYLOAD_MISMATCH';

export type InventoryConflict = {
  operation_id: string;
  code: InventoryConflictCode;
};

const CONFLICT_CODES: readonly InventoryConflictCode[] = [
  'STALE_BASE',
  'INSUFFICIENT_QUANTITY',
  'ID_PAYLOAD_MISMATCH',
];

export function parseInventoryConflict(value: unknown): InventoryConflict | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as { operation_id?: unknown; code?: unknown; kind?: unknown };
  if (
    record.kind !== 'conflict' ||
    typeof record.operation_id !== 'string' ||
    typeof record.code !== 'string' ||
    !CONFLICT_CODES.includes(record.code as InventoryConflictCode)
  )
    return null;
  return { operation_id: record.operation_id, code: record.code as InventoryConflictCode };
}

export function notifyInventoryConflict(conflict: InventoryConflict): void {
  addDiagnosticStep('sync.inventory_conflict', {
    operation: 'sync.inventory.push',
    outcome: 'conflict',
    operation_id: conflict.operation_id,
    error_code: conflict.code,
  });
  reportWarning(`Inventory-Operation ${conflict.code}`, {
    operation: 'sync.inventory.push',
    outcome: 'conflict',
    operation_id: conflict.operation_id,
    error_code: conflict.code,
  });
}
