import { z } from 'zod';

import {
  isNonNegativeInventoryQuantity,
  isPositiveInventoryQuantity,
  subtractInventoryQuantities,
} from '@/lib/inventory-quantity';

export const CANONICAL_CONTRACT_VERSION = 1 as const;
export const ALL_CANONICAL_OPERATION_TYPES = [
  'insert_inventory',
  'consume_inventory',
  'waste_inventory',
  'move_inventory',
  'correct_quantity',
] as const;

const UUID = z.uuid();
const TIME = z.iso.datetime({ offset: true });
const DAY = z.iso.date();
const quantity = z.number().refine(isNonNegativeInventoryQuantity);
const positiveQuantity = z.number().refine(isPositiveInventoryQuantity);
const text = z.string().refine((value) => value.trim().length > 0);
const name = text.max(200);
const nullable = <T extends z.ZodType>(schema: T) => schema.nullable();

const base = {
  contract_version: z.literal(CANONICAL_CONTRACT_VERSION),
  operation_id: UUID,
  household_id: UUID,
  created_at: TIME,
};
const operation = <T extends string, S extends z.ZodRawShape>(type: T, fields: S) =>
  z.strictObject({ ...base, type: z.literal(type), ...fields });

const packagePair = (value: { package_size: number | null; package_size_unit: string | null }) =>
  (value.package_size === null) === (value.package_size_unit === null);
const lotMetadata = {
  product_id: nullable(UUID),
  name,
  unit: text,
  package_size: nullable(positiveQuantity),
  package_size_unit: nullable(text),
  location_id: UUID,
  expiry_date: nullable(DAY),
  opened_at: nullable(TIME),
  vacuum_sealed: z.boolean(),
  expiry_user_set: z.boolean(),
};

const snapshotSchema = z
  .strictObject({
    household_id: UUID,
    ...lotMetadata,
    added_by: nullable(UUID),
    quantity_before: quantity,
  })
  .refine(packagePair, 'package size fields must be supplied together');
export type InventorySnapshotV1 = z.infer<typeof snapshotSchema>;

const insertSchema = operation('insert_inventory', {
  item_id: UUID,
  in_transaction_id: UUID,
  quantity: positiveQuantity,
  ...lotMetadata,
}).refine(packagePair, 'package size fields must be supplied together');

const recipe = {
  recipe_id: nullable(UUID).optional(),
  recipe_name: nullable(name).optional(),
  meal_plan_entry_id: nullable(UUID).optional(),
};
const consumeBase = {
  out_transaction_id: UUID,
  source_item_id: UUID,
  expected_quantity: positiveQuantity,
  consumed_quantity: positiveQuantity,
  product_id: nullable(UUID),
  unit: text,
  location_id: UUID,
  ...recipe,
};
const consumeSchema = z.union([
  operation('consume_inventory', { ...consumeBase, mode: z.literal('sealed_full') }),
  operation('consume_inventory', { ...consumeBase, mode: z.literal('opened') }),
  operation('consume_inventory', {
    ...consumeBase,
    mode: z.literal('sealed_partial'),
    opened_item_id: UUID,
    portion_quantity: positiveQuantity,
    remainder_quantity: quantity,
    opened_at: TIME,
    expiry_date: nullable(DAY),
    vacuum_sealed: z.boolean(),
    expiry_user_set: z.boolean(),
    merge_snapshot: snapshotSchema,
  }),
]);

const wasteSchema = operation('waste_inventory', {
  waste_transaction_id: UUID,
  item_id: UUID,
  expected_quantity: positiveQuantity,
  waste_quantity: positiveQuantity,
  reason: z.enum(['expired', 'spoiled', 'other']),
  product_id: nullable(UUID),
  unit: text,
  location_id: UUID,
});
const moveSchema = operation('move_inventory', {
  out_transaction_id: UUID,
  in_transaction_id: UUID,
  item_id: UUID,
  expected_quantity: positiveQuantity,
  expected_location_id: UUID,
  to_location_id: UUID,
  product_id: nullable(UUID),
  unit: text,
  location_id: UUID,
});

const correctSchema = operation('correct_quantity', {
  transaction_id: UUID,
  item_id: UUID,
  expected_quantity: positiveQuantity,
  new_quantity: quantity,
  product_id: nullable(UUID),
  unit: text,
  location_id: UUID,
});

export const inventoryOperationSchema = z
  .union([insertSchema, consumeSchema, wasteSchema, moveSchema, correctSchema])
  .superRefine((value, context) => {
    const fail = (message: string) => context.addIssue({ code: 'custom', message });

    if (value.type === 'insert_inventory') {
      if (value.item_id === value.in_transaction_id) fail('lot and ledger IDs must differ');
      return;
    }

    if (value.type === 'consume_inventory') {
      if (value.consumed_quantity > value.expected_quantity)
        fail('consume quantity exceeds expected quantity');
      if (value.mode !== 'sealed_partial') return;

      const snapshotMatches =
        value.merge_snapshot.household_id === value.household_id &&
        value.merge_snapshot.quantity_before === value.expected_quantity &&
        value.merge_snapshot.opened_at === null;
      const splitMatches =
        value.opened_item_id !== value.source_item_id &&
        value.consumed_quantity < value.portion_quantity &&
        value.portion_quantity <= value.expected_quantity &&
        value.remainder_quantity ===
          subtractInventoryQuantities(value.portion_quantity, value.consumed_quantity) &&
        value.remainder_quantity > 0 &&
        value.portion_quantity === value.merge_snapshot.package_size;
      if (!snapshotMatches || !splitMatches) fail('consume split is inconsistent');
      return;
    }

    if (value.type === 'waste_inventory') {
      if (value.waste_quantity > value.expected_quantity) fail('waste exceeds expected quantity');
      return;
    }

    if (value.type === 'move_inventory') {
      if (
        value.out_transaction_id === value.in_transaction_id ||
        value.expected_location_id === value.to_location_id ||
        value.location_id !== value.expected_location_id
      )
        fail('move IDs or locations are inconsistent');
      return;
    }

    if (value.new_quantity === value.expected_quantity)
      fail('quantity correction must change quantity');
  });

export type InventoryOperationV1 = z.infer<typeof inventoryOperationSchema>;
