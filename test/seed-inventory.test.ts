import { validateInventoryOperation } from '@/features/inventory/inventory-lifecycle';

import {
  buildInventoryOperations,
  isLocalSupabaseUrl,
  RANDOM_FOODS,
} from '../scripts/seed-inventory';

describe('seed-inventory', () => {
  it('builds twenty valid insert operations for one pantry location', () => {
    const operations = buildInventoryOperations({
      userId: '2d38b587-2834-4559-a240-48a765754bd0',
      householdId: '936aa05b-bde3-45f2-b1f9-227bfe0c7bd5',
      locationId: '7c871fc0-2976-466d-befb-fd858bf04336',
      createdAt: '2026-09-10T05:00:00.000Z',
      foods: RANDOM_FOODS,
    });

    expect(operations).toHaveLength(20);
    expect(new Set(operations.map((operation) => operation.operation_id)).size).toBe(20);
    expect(operations.every((operation) => operation.type === 'insert_inventory')).toBe(true);
    expect(
      operations.every(
        (operation) => operation.location_id === '7c871fc0-2976-466d-befb-fd858bf04336',
      ),
    ).toBe(true);
    expect(operations.every((operation) => validateInventoryOperation(operation).success)).toBe(true);
  });

  it('accepts only local Supabase URLs', () => {
    expect(isLocalSupabaseUrl('http://127.0.0.1:54321')).toBe(true);
    expect(isLocalSupabaseUrl('http://localhost:54321')).toBe(true);
    expect(isLocalSupabaseUrl('https://ivvebtqasotqpikuydov.supabase.co')).toBe(false);
  });
});
