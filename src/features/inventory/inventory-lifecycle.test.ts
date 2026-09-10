import {
  isNonNegativeIntegerThousandths,
  isPositiveIntegerThousandths,
  MAX_INVENTORY_QUANTITY_UNITS,
} from '@/lib/inventory-quantity';
import {
  ALL_CANONICAL_OPERATION_TYPES,
  assertValidInventoryOperation,
  CANONICAL_CONTRACT_VERSION,
  canUndoTransaction,
  computeInventoryOperationFootprint,
  inventoryUndoMode,
  inverseTransactionType,
  planOpenInventoryItem,
  undoTransactionNotes,
  validateInventoryOperation,
} from './inventory-lifecycle';

const ITEM = {
  id: 'sealed-lot',
  householdId: 'household-1',
  locationId: 'fridge',
  productId: 'mustard',
  name: 'Senf',
  quantity: 3,
  unit: 'glas',
  expiryDate: '2026-12-31',
  openedAt: null,
  vacuumSealed: false,
  expiryUserSet: false,
  packageSize: null,
  packageSizeUnit: null,
  addedBy: 'alice',
  category: 'Saucen',
  locationKind: 'fridge',
} as const;

const MERGE_SNAPSHOT = {
  household_id: 'household-1',
  product_id: 'prod-1',
  name: 'Senf',
  unit: 'g',
  package_size: 500,
  package_size_unit: 'g',
  location_id: 'fridge',
  expiry_date: '2026-12-31',
  opened_at: null,
  vacuum_sealed: false,
  expiry_user_set: false,
  added_by: 'alice',
  quantity_before: 500,
};

describe('planOpenInventoryItem', () => {
  it('öffnet ein einzelnes Gebinde in-place und berechnet das Verbrauchsdatum', () => {
    const plan = planOpenInventoryItem(
      { ...ITEM, quantity: 1 },
      1,
      new Date(2026, 7, 5, 14, 30),
      'opened-lot',
    );

    expect(plan.originalPatch).toEqual({
      openedAt: new Date(2026, 7, 5, 14, 30).toISOString(),
      expiryDate: '2026-08-08',
      expiryUserSet: false,
      vacuumSealed: false,
    });
    expect(plan.openedItem).toBeNull();
  });

  it('bewahrt beim Inplace-Öffnen den Vakuumzustand für ein korrektes Undo', () => {
    const plan = planOpenInventoryItem(
      { ...ITEM, quantity: 1, vacuumSealed: true },
      1,
      new Date('2026-08-05T14:30:00.000Z'),
      'opened-lot',
    );

    expect(plan.originalPatch.vacuumSealed).toBe(true);
  });

  it('teilt mehrere Gebinde in einen versiegelten und einen geöffneten Lot', () => {
    const plan = planOpenInventoryItem(ITEM, 1, new Date('2026-08-05T14:30:00.000Z'), 'opened-lot');

    expect(plan.originalPatch).toEqual({ quantity: 2 });
    expect(plan.openedItem).toMatchObject({
      id: 'opened-lot',
      quantity: 1,
      openedAt: '2026-08-05T14:30:00.000Z',
      expiryDate: '2026-08-08',
      expiryUserSet: false,
      vacuumSealed: false,
    });
  });

  it('berechnet den Rest eines Dezimal-Splits exakt in Tausendsteln', () => {
    const plan = planOpenInventoryItem(
      { ...ITEM, quantity: 1.1 },
      1,
      new Date('2026-08-05T14:30:00.000Z'),
      'opened-lot',
    );

    expect(plan.originalPatch).toEqual({ quantity: 0.1 });
  });

  it('bewahrt beim Split Lifecycle-Metadaten und initialisiert das neue Los', () => {
    const plan = planOpenInventoryItem(
      { ...ITEM, vacuumSealed: true, expiryUserSet: true },
      1,
      new Date('2026-08-05T14:30:00.000Z'),
      'opened-lot',
    );

    expect(plan.openedItem).toMatchObject({
      vacuumSealed: true,
      expiryUserSet: true,
    });
  });

  it('verweigert das erneute Öffnen eines bereits geöffneten Lots', () => {
    expect(() =>
      planOpenInventoryItem(
        { ...ITEM, quantity: 1, openedAt: '2026-08-05T14:30:00.000Z' },
        1,
        new Date('2026-08-05T15:00:00.000Z'),
        'opened-again',
      ),
    ).toThrow('bereits geöffnet');
  });

  it('erkennt eine Öffnung nach 24 Stunden als nicht mehr rückgängig machbar', () => {
    const createdAt = new Date('2026-08-05T14:30:00.000Z');
    expect(canUndoTransaction(createdAt, new Date('2026-08-06T14:29:59.999Z'))).toBe(true);
    expect(canUndoTransaction(createdAt, new Date('2026-08-06T14:30:00.001Z'))).toBe(false);
  });

  it('klassifiziert die exakte 24-Stunden-Grenze als Undo oder Manual correction', () => {
    const createdAt = '2026-08-05T14:30:00.000Z';

    expect(inventoryUndoMode(createdAt, new Date('2026-08-06T14:30:00.000Z'))).toBe('undo');
    expect(inventoryUndoMode(createdAt, new Date('2026-08-06T14:30:00.001Z'))).toBe(
      'manual-correction',
    );
    expect(() =>
      inventoryUndoMode('2026-08-06T14:30:00.001Z', new Date('2026-08-06T14:30:00.000Z')),
    ).toThrow('Zukunft');
  });

  it('verwendet typisierte, stabile Notizen für beide Gegenbuchungsarten', () => {
    expect(undoTransactionNotes('undo', 'out')).toBe('[Undone] Gegenbuchung');
    expect(undoTransactionNotes('manual-correction', 'waste')).toBe('[Manual correction]');
  });
});

describe('inverseTransactionType', () => {
  it.each([
    ['in', 'out'],
    ['out', 'in'],
    ['waste', 'in'],
  ] as const)('%s -> %s', (type, expected) => {
    expect(inverseTransactionType(type)).toBe(expected);
  });
});

describe('Canonical v1 Operations - validateInventoryOperation', () => {
  it('contains exactly the 9 canonical operation types in ALL_CANONICAL_OPERATION_TYPES', () => {
    expect(ALL_CANONICAL_OPERATION_TYPES).toHaveLength(9);
    expect(ALL_CANONICAL_OPERATION_TYPES).toEqual([
      'insert_inventory',
      'open_inventory',
      'consume_inventory',
      'waste_inventory',
      'move_inventory',
      'correct_quantity',
      'undo_inventory_operation',
      'reseal_inventory',
      'patch_inventory_metadata',
    ]);
  });

  it('validates insert_inventory with all required and optional fields', () => {
    const result = validateInventoryOperation({
      contract_version: CANONICAL_CONTRACT_VERSION,
      type: 'insert_inventory',
      operation_id: 'op-1',
      household_id: 'household-1',
      created_at: '2026-08-05T14:30:00.000Z',
      item_id: 'item-1',
      in_transaction_id: 'txn-in-1',
      product_id: 'prod-1',
      product_name: 'Bio-Milch',
      quantity: 1_000,
      unit: 'liter',
      location_id: 'fridge',
      expiry_date: '2026-12-31',
      opened_at: null,
    });

    expect(result.success).toBe(true);
    if (result.success && result.data.type === 'insert_inventory') {
      expect(result.data.item_id).toBe('item-1');
      expect(result.data.in_transaction_id).toBe('txn-in-1');
      expect(result.data.quantity).toBe(1_000);
      expect(result.data.product_name).toBe('Bio-Milch');
    }
  });

  it('validates open_inventory in-place and split', () => {
    const inPlace = validateInventoryOperation({
      contract_version: 1,
      type: 'open_inventory',
      operation_id: 'op-open-1',
      household_id: 'household-1',
      created_at: '2026-08-05T14:30:00.000Z',
      source_item_id: 'item-1',
      expected_quantity: 1_000,
      portion_quantity: 1_000,
      opened_at: '2026-08-05T14:30:00.000Z',
    });
    expect(inPlace.success).toBe(true);
    if (inPlace.success && inPlace.data.type === 'open_inventory') {
      expect(inPlace.data.opened_item_id).toBeUndefined();
    }

    const split = validateInventoryOperation({
      contract_version: 1,
      type: 'open_inventory',
      operation_id: 'op-open-2',
      household_id: 'household-1',
      created_at: '2026-08-05T14:30:00.000Z',
      source_item_id: 'item-1',
      expected_quantity: 1_500,
      portion_quantity: 500,
      opened_at: '2026-08-05T14:30:00.000Z',
      opened_item_id: 'item-opened-1',
    });
    expect(split.success).toBe(true);
    if (split.success && split.data.type === 'open_inventory') {
      expect(split.data.portion_quantity).toBe(500);
      expect(split.data.opened_item_id).toBe('item-opened-1');
    }
  });

  it('validates consume_inventory for all three modes: sealed_full, sealed_partial, opened', () => {
    const sealedFull = validateInventoryOperation({
      contract_version: 1,
      type: 'consume_inventory',
      operation_id: 'op-consume-1',
      household_id: 'household-1',
      created_at: '2026-08-05T14:30:00.000Z',
      out_transaction_id: 'txn-out-1',
      source_item_id: 'item-1',
      expected_quantity: 1_000,
      consumed_quantity: 1_000,
      consumed_at: '2026-08-05T14:30:00.000Z',
      mode: 'sealed_full',
    });
    expect(sealedFull.success).toBe(true);

    const sealedPartial = validateInventoryOperation({
      contract_version: 1,
      type: 'consume_inventory',
      operation_id: 'op-consume-2',
      household_id: 'household-1',
      created_at: '2026-08-05T14:30:00.000Z',
      out_transaction_id: 'txn-out-2',
      source_item_id: 'item-1',
      expected_quantity: 500,
      consumed_quantity: 200,
      consumed_at: '2026-08-05T14:30:00.000Z',
      mode: 'sealed_partial',
      opened_item_id: 'item-rem-1',
      portion_quantity: 500,
      opened_at: '2026-08-05T14:30:00.000Z',
      merge_snapshot: MERGE_SNAPSHOT,
    });
    expect(sealedPartial.success).toBe(true);

    const opened = validateInventoryOperation({
      contract_version: 1,
      type: 'consume_inventory',
      operation_id: 'op-consume-3',
      household_id: 'household-1',
      created_at: '2026-08-05T14:30:00.000Z',
      out_transaction_id: 'txn-out-3',
      source_item_id: 'item-rem-1',
      expected_quantity: 300,
      consumed_quantity: 200,
      consumed_at: '2026-08-05T14:30:00.000Z',
      mode: 'opened',
    });
    expect(opened.success).toBe(true);
  });

  it('rejects sealed_partial when consumed_quantity is not strictly less than portion_quantity', () => {
    const result = validateInventoryOperation({
      contract_version: 1,
      type: 'consume_inventory',
      operation_id: 'op-consume-invalid-partial',
      household_id: 'household-1',
      created_at: '2026-08-05T14:30:00.000Z',
      out_transaction_id: 'txn-out',
      source_item_id: 'item-1',
      expected_quantity: 500,
      consumed_quantity: 500,
      consumed_at: '2026-08-05T14:30:00.000Z',
      mode: 'sealed_partial',
      opened_item_id: 'item-rem',
      portion_quantity: 500,
      opened_at: '2026-08-05T14:30:00.000Z',
      merge_snapshot: MERGE_SNAPSHOT,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('strictly less than');
    }
  });

  it('validates waste_inventory with reasons', () => {
    const result = validateInventoryOperation({
      contract_version: 1,
      type: 'waste_inventory',
      operation_id: 'op-waste-1',
      household_id: 'household-1',
      created_at: '2026-08-05T14:30:00.000Z',
      waste_transaction_id: 'txn-waste-1',
      item_id: 'item-1',
      expected_quantity: 500,
      waste_quantity: 500,
      reason: 'spoiled',
    });
    expect(result.success).toBe(true);
  });

  it('validates move_inventory', () => {
    const result = validateInventoryOperation({
      contract_version: 1,
      type: 'move_inventory',
      operation_id: 'op-move-1',
      household_id: 'household-1',
      created_at: '2026-08-05T14:30:00.000Z',
      out_transaction_id: 'txn-move-out',
      in_transaction_id: 'txn-move-in',
      item_id: 'item-1',
      expected_quantity: 1_000,
      expected_location_id: 'fridge',
      to_location_id: 'pantry',
    });
    expect(result.success).toBe(true);
  });

  it('validates correct_quantity with new_quantity > 0 and new_quantity === 0', () => {
    const adjust = validateInventoryOperation({
      contract_version: 1,
      type: 'correct_quantity',
      operation_id: 'op-correct-1',
      household_id: 'household-1',
      created_at: '2026-08-05T14:30:00.000Z',
      transaction_id: 'txn-correct-1',
      item_id: 'item-1',
      new_quantity: 750,
      expected_quantity: 1_000,
    });
    expect(adjust.success).toBe(true);

    const tombstone = validateInventoryOperation({
      contract_version: 1,
      type: 'correct_quantity',
      operation_id: 'op-correct-2',
      household_id: 'household-1',
      created_at: '2026-08-05T14:30:00.000Z',
      transaction_id: 'txn-correct-2',
      item_id: 'item-1',
      new_quantity: 0,
      expected_quantity: 500,
    });
    expect(tombstone.success).toBe(true);
  });

  it('validates undo_inventory_operation in all three modes', () => {
    const reverseQuantity = validateInventoryOperation({
      contract_version: 1,
      type: 'undo_inventory_operation',
      operation_id: 'op-undo-1',
      household_id: 'household-1',
      created_at: '2026-08-05T15:00:00.000Z',
      mode: 'reverse_quantity',
      reversal_transaction_id: 'txn-reversal-1',
      reversal_of: 'txn-out-1',
      item_id: 'item-1',
    });
    expect(reverseQuantity.success).toBe(true);

    const reverseMove = validateInventoryOperation({
      contract_version: 1,
      type: 'undo_inventory_operation',
      operation_id: 'op-undo-2',
      household_id: 'household-1',
      created_at: '2026-08-05T15:00:00.000Z',
      mode: 'reverse_move',
      reversal_out_transaction_id: 'txn-reversal-out',
      reversal_in_transaction_id: 'txn-reversal-in',
      reversal_of: 'op-move-1',
      item_id: 'item-1',
    });
    expect(reverseMove.success).toBe(true);

    const mergeUndoOpen = validateInventoryOperation({
      contract_version: 1,
      type: 'undo_inventory_operation',
      operation_id: 'op-undo-3',
      household_id: 'household-1',
      created_at: '2026-08-05T15:00:00.000Z',
      mode: 'merge_undo_open',
      in_transaction_id: 'txn-merge-in',
      reversal_of: 'txn-out-2',
      source_item_id: 'item-1',
      opened_item_id: 'item-rem-1',
    });
    expect(mergeUndoOpen.success).toBe(true);
  });

  it('accepts optional notes on undo_inventory_operation, absent by default (contract.md Abschnitt 6)', () => {
    const withNotes = validateInventoryOperation({
      contract_version: 1,
      type: 'undo_inventory_operation',
      operation_id: 'op-undo-1',
      household_id: 'household-1',
      created_at: '2026-08-05T15:00:00.000Z',
      mode: 'reverse_quantity',
      reversal_transaction_id: 'txn-reversal-1',
      reversal_of: 'txn-out-1',
      item_id: 'item-1',
      notes: '[Undone] Gegenbuchung',
    });
    expect(withNotes.success).toBe(true);
    if (withNotes.success && withNotes.data.type === 'undo_inventory_operation') {
      expect(withNotes.data.notes).toBe('[Undone] Gegenbuchung');
    }

    const withNullNotes = validateInventoryOperation({
      contract_version: 1,
      type: 'undo_inventory_operation',
      operation_id: 'op-undo-1',
      household_id: 'household-1',
      created_at: '2026-08-05T15:00:00.000Z',
      mode: 'reverse_quantity',
      reversal_transaction_id: 'txn-reversal-1',
      reversal_of: 'txn-out-1',
      item_id: 'item-1',
      notes: null,
    });
    expect(withNullNotes.success).toBe(true);
    if (withNullNotes.success && withNullNotes.data.type === 'undo_inventory_operation') {
      expect(withNullNotes.data.notes).toBeNull();
    }

    const withoutNotes = validateInventoryOperation({
      contract_version: 1,
      type: 'undo_inventory_operation',
      operation_id: 'op-undo-1',
      household_id: 'household-1',
      created_at: '2026-08-05T15:00:00.000Z',
      mode: 'reverse_quantity',
      reversal_transaction_id: 'txn-reversal-1',
      reversal_of: 'txn-out-1',
      item_id: 'item-1',
    });
    expect(withoutNotes.success).toBe(true);
    if (withoutNotes.success && withoutNotes.data.type === 'undo_inventory_operation') {
      expect('notes' in withoutNotes.data).toBe(false);
    }

    const invalidNotes = validateInventoryOperation({
      contract_version: 1,
      type: 'undo_inventory_operation',
      operation_id: 'op-undo-1',
      household_id: 'household-1',
      created_at: '2026-08-05T15:00:00.000Z',
      mode: 'reverse_quantity',
      reversal_transaction_id: 'txn-reversal-1',
      reversal_of: 'txn-out-1',
      item_id: 'item-1',
      notes: 42,
    });
    expect(invalidNotes.success).toBe(false);
  });

  it('validates reseal_inventory', () => {
    const result = validateInventoryOperation({
      contract_version: 1,
      type: 'reseal_inventory',
      operation_id: 'op-reseal-1',
      household_id: 'household-1',
      created_at: '2026-08-05T14:30:00.000Z',
      item_id: 'item-1',
    });
    expect(result.success).toBe(true);
  });

  it('validates patch_inventory_metadata and distinguishes absent vs explicit null', () => {
    const withExplicitNull = validateInventoryOperation({
      contract_version: 1,
      type: 'patch_inventory_metadata',
      operation_id: 'op-patch-1',
      household_id: 'household-1',
      created_at: '2026-08-05T14:30:00.000Z',
      item_id: 'item-1',
      notes: null,
      expiry_date: null,
      expected_updated_at: '2026-08-05T14:30:00.000Z',
    });
    expect(withExplicitNull.success).toBe(true);
    if (withExplicitNull.success && withExplicitNull.data.type === 'patch_inventory_metadata') {
      expect('notes' in withExplicitNull.data).toBe(true);
      expect(withExplicitNull.data.notes).toBeNull();
      expect('expiry_date' in withExplicitNull.data).toBe(true);
      expect(withExplicitNull.data.expiry_date).toBeNull();
      expect('product_name' in withExplicitNull.data).toBe(false);
    }

    const withOmittedNotes = validateInventoryOperation({
      contract_version: 1,
      type: 'patch_inventory_metadata',
      operation_id: 'op-patch-2',
      household_id: 'household-1',
      created_at: '2026-08-05T14:30:00.000Z',
      item_id: 'item-1',
      product_name: 'Neuer Name',
      expected_updated_at: '2026-08-05T14:30:00.000Z',
    });
    expect(withOmittedNotes.success).toBe(true);
    if (withOmittedNotes.success && withOmittedNotes.data.type === 'patch_inventory_metadata') {
      expect('notes' in withOmittedNotes.data).toBe(false);
      expect('expiry_date' in withOmittedNotes.data).toBe(false);
      expect(withOmittedNotes.data.product_name).toBe('Neuer Name');
    }
  });

  describe('strict runtime rejection and error reporting', () => {
    it('rejects non-object or null input with PAYLOAD_VALIDATION_FAILED', () => {
      const nullResult = validateInventoryOperation(null);
      expect(nullResult.success).toBe(false);
      if (!nullResult.success) {
        expect(nullResult.error.code).toBe('PAYLOAD_VALIDATION_FAILED');
      }

      const stringResult = validateInventoryOperation('invalid');
      expect(stringResult.success).toBe(false);
      if (!stringResult.success) {
        expect(stringResult.error.code).toBe('PAYLOAD_VALIDATION_FAILED');
      }
    });

    it('rejects invalid contract_version', () => {
      const result = validateInventoryOperation({
        contract_version: 2,
        type: 'insert_inventory',
        operation_id: 'op-1',
        household_id: 'h-1',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('PAYLOAD_VALIDATION_FAILED');
        expect(result.error.message).toContain('contract_version');
      }
    });

    it('rejects unknown operation types', () => {
      const result = validateInventoryOperation({
        contract_version: 1,
        type: 'unknown_operation_type',
        operation_id: 'op-1',
        household_id: 'h-1',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('PAYLOAD_VALIDATION_FAILED');
        expect(result.error.message).toContain('Invalid or missing operation type');
      }
    });

    it('strictly rejects unknown or extraneous keys', () => {
      const result = validateInventoryOperation({
        contract_version: 1,
        type: 'insert_inventory',
        operation_id: 'op-1',
        household_id: 'household-1',
        created_at: '2026-08-05T14:30:00.000Z',
        item_id: 'item-1',
        in_transaction_id: 'txn-in-1',
        product_name: 'Milch',
        quantity: 1_000,
        unit: 'l',
        location_id: 'fridge',
        unknown_field: 'sneaky_data',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('PAYLOAD_VALIDATION_FAILED');
        expect(result.error.message).toContain("Unknown or forbidden property 'unknown_field'");
      }
    });

    it('rejects patch_inventory_metadata if forbidden fields like quantity are included', () => {
      const result = validateInventoryOperation({
        contract_version: 1,
        type: 'patch_inventory_metadata',
        operation_id: 'op-patch-forbidden',
        household_id: 'h-1',
        created_at: '2026-08-05T14:30:00.000Z',
        item_id: 'item-1',
        expected_updated_at: '2026-08-05T14:30:00.000Z',
        quantity: 500,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('PAYLOAD_VALIDATION_FAILED');
        expect(result.error.message).toContain("Unknown or forbidden property 'quantity'");
      }
    });

    it('rejects patch_inventory_metadata with empty patch', () => {
      const result = validateInventoryOperation({
        contract_version: 1,
        type: 'patch_inventory_metadata',
        operation_id: 'op-patch-empty',
        household_id: 'h-1',
        created_at: '2026-08-05T14:30:00.000Z',
        item_id: 'item-1',
        expected_updated_at: '2026-08-05T14:30:00.000Z',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('PAYLOAD_VALIDATION_FAILED');
        expect(result.error.message).toContain('Metadata patch must include at least one property');
      }
    });

    it('rejects non-integer quantities in thousandths', () => {
      const decimalQuantity = validateInventoryOperation({
        contract_version: 1,
        type: 'insert_inventory',
        operation_id: 'op-1',
        household_id: 'h-1',
        created_at: '2026-08-05T14:30:00.000Z',
        item_id: 'item-1',
        in_transaction_id: 'txn-in-1',
        product_name: 'Milch',
        quantity: 1.5,
        unit: 'l',
        location_id: 'fridge',
      });
      expect(decimalQuantity.success).toBe(false);
      if (!decimalQuantity.success) {
        expect(decimalQuantity.error.code).toBe('PAYLOAD_VALIDATION_FAILED');
      }
    });

    it('rejects negative or zero quantities on insert', () => {
      const zeroQty = validateInventoryOperation({
        contract_version: 1,
        type: 'insert_inventory',
        operation_id: 'op-1',
        household_id: 'h-1',
        created_at: '2026-08-05T14:30:00.000Z',
        item_id: 'item-1',
        in_transaction_id: 'txn-in-1',
        product_name: 'Milch',
        quantity: 0,
        unit: 'l',
        location_id: 'fridge',
      });
      expect(zeroQty.success).toBe(false);

      const negativeQty = validateInventoryOperation({
        contract_version: 1,
        type: 'insert_inventory',
        operation_id: 'op-1',
        household_id: 'h-1',
        created_at: '2026-08-05T14:30:00.000Z',
        item_id: 'item-1',
        in_transaction_id: 'txn-in-1',
        product_name: 'Milch',
        quantity: -500,
        unit: 'l',
        location_id: 'fridge',
      });
      expect(negativeQty.success).toBe(false);
    });

    it('rejects quantity exceeding maximum allowed units', () => {
      const excessiveQty = validateInventoryOperation({
        contract_version: 1,
        type: 'insert_inventory',
        operation_id: 'op-1',
        household_id: 'h-1',
        created_at: '2026-08-05T14:30:00.000Z',
        item_id: 'item-1',
        in_transaction_id: 'txn-in-1',
        product_name: 'Milch',
        quantity: MAX_INVENTORY_QUANTITY_UNITS + 1,
        unit: 'l',
        location_id: 'fridge',
      });
      expect(excessiveQty.success).toBe(false);
    });

    it('rejects correct_quantity when new_quantity equals expected_quantity', () => {
      const noChange = validateInventoryOperation({
        contract_version: 1,
        type: 'correct_quantity',
        operation_id: 'op-correct-1',
        household_id: 'h-1',
        created_at: '2026-08-05T14:30:00.000Z',
        transaction_id: 'txn-correct-1',
        item_id: 'item-1',
        new_quantity: 1_000,
        expected_quantity: 1_000,
      });
      expect(noChange.success).toBe(false);
      if (!noChange.success) {
        expect(noChange.error.message).toContain('must differ from');
      }
    });

    it('rejects consume_inventory with invalid mode', () => {
      const invalidMode = validateInventoryOperation({
        contract_version: 1,
        type: 'consume_inventory',
        operation_id: 'op-consume-invalid',
        household_id: 'h-1',
        created_at: '2026-08-05T14:30:00.000Z',
        out_transaction_id: 'txn-out',
        source_item_id: 'item-1',
        expected_quantity: 500,
        consumed_quantity: 100,
        consumed_at: '2026-08-05T14:30:00.000Z',
        mode: 'invalid_mode_name',
      });
      expect(invalidMode.success).toBe(false);
    });

    it('rejects undo_inventory_operation with invalid mode', () => {
      const invalidMode = validateInventoryOperation({
        contract_version: 1,
        type: 'undo_inventory_operation',
        operation_id: 'op-undo-invalid',
        household_id: 'h-1',
        created_at: '2026-08-05T14:30:00.000Z',
        mode: 'non_existent_mode',
        reversal_of: 'txn-out',
      });
      expect(invalidMode.success).toBe(false);
    });

    it('assertValidInventoryOperation throws error with code PAYLOAD_VALIDATION_FAILED', () => {
      expect(() =>
        assertValidInventoryOperation({
          contract_version: 1,
          type: 'insert_inventory',
          operation_id: 'op-1',
        }),
      ).toThrow();

      try {
        assertValidInventoryOperation({ contract_version: 2 });
      } catch (err) {
        expect((err as { code: string }).code).toBe('PAYLOAD_VALIDATION_FAILED');
      }
    });
  });
});

describe('Canonical v1 Operations - computeInventoryOperationFootprint', () => {
  it('computes footprint for insert_inventory (created lot and created in-transaction)', () => {
    const op = assertValidInventoryOperation({
      contract_version: 1,
      type: 'insert_inventory',
      operation_id: 'op-insert-1',
      household_id: 'h-1',
      created_at: '2026-08-05T14:30:00.000Z',
      item_id: 'lot-new',
      in_transaction_id: 'txn-in-1',
      product_name: 'Brot',
      quantity: 1_000,
      unit: 'stk',
      location_id: 'pantry',
    });

    const footprint = computeInventoryOperationFootprint(op);
    expect(footprint).toEqual({
      lots: {
        created: ['lot-new'],
        modified: [],
        restored: [],
        tombstoned: [],
      },
      transactions: {
        created: ['txn-in-1'],
        reversals: [],
      },
    });
  });

  it('computes footprint for open_inventory (in-place vs split)', () => {
    const inPlaceOp = assertValidInventoryOperation({
      contract_version: 1,
      type: 'open_inventory',
      operation_id: 'op-open-inplace',
      household_id: 'h-1',
      created_at: '2026-08-05T14:30:00.000Z',
      source_item_id: 'lot-sealed',
      expected_quantity: 1_000,
      portion_quantity: 1_000,
      opened_at: '2026-08-05T14:30:00.000Z',
    });
    expect(computeInventoryOperationFootprint(inPlaceOp)).toEqual({
      lots: {
        created: [],
        modified: ['lot-sealed'],
        restored: [],
        tombstoned: [],
      },
      transactions: {
        created: [],
        reversals: [],
      },
    });

    const splitOp = assertValidInventoryOperation({
      contract_version: 1,
      type: 'open_inventory',
      operation_id: 'op-open-split',
      household_id: 'h-1',
      created_at: '2026-08-05T14:30:00.000Z',
      source_item_id: 'lot-sealed',
      expected_quantity: 1_500,
      portion_quantity: 500,
      opened_at: '2026-08-05T14:30:00.000Z',
      opened_item_id: 'lot-opened-new',
    });
    expect(computeInventoryOperationFootprint(splitOp)).toEqual({
      lots: {
        created: ['lot-opened-new'],
        modified: ['lot-sealed'],
        restored: [],
        tombstoned: [],
      },
      transactions: {
        created: [],
        reversals: [],
      },
    });
  });

  it('computes footprint for consume_inventory (sealed_full tombstones, opened modifies, sealed_partial splits)', () => {
    const fullOp = assertValidInventoryOperation({
      contract_version: 1,
      type: 'consume_inventory',
      operation_id: 'op-consume-full',
      household_id: 'h-1',
      created_at: '2026-08-05T14:30:00.000Z',
      out_transaction_id: 'txn-out-full',
      source_item_id: 'lot-1',
      expected_quantity: 1_000,
      consumed_quantity: 1_000,
      consumed_at: '2026-08-05T14:30:00.000Z',
      mode: 'sealed_full',
    });
    expect(computeInventoryOperationFootprint(fullOp)).toEqual({
      lots: {
        created: [],
        modified: [],
        restored: [],
        tombstoned: ['lot-1'],
      },
      transactions: {
        created: ['txn-out-full'],
        reversals: [],
      },
    });

    const partialOp = assertValidInventoryOperation({
      contract_version: 1,
      type: 'consume_inventory',
      operation_id: 'op-consume-partial',
      household_id: 'h-1',
      created_at: '2026-08-05T14:30:00.000Z',
      out_transaction_id: 'txn-out-partial',
      source_item_id: 'lot-1',
      expected_quantity: 500,
      consumed_quantity: 200,
      consumed_at: '2026-08-05T14:30:00.000Z',
      mode: 'sealed_partial',
      opened_item_id: 'lot-remainder-1',
      portion_quantity: 500,
      opened_at: '2026-08-05T14:30:00.000Z',
      merge_snapshot: MERGE_SNAPSHOT,
    });
    expect(computeInventoryOperationFootprint(partialOp)).toEqual({
      lots: {
        created: ['lot-remainder-1'],
        modified: [],
        restored: [],
        tombstoned: ['lot-1'],
      },
      transactions: {
        created: ['txn-out-partial'],
        reversals: [],
      },
    });
  });

  it('computes footprint for waste_inventory', () => {
    const op = assertValidInventoryOperation({
      contract_version: 1,
      type: 'waste_inventory',
      operation_id: 'op-waste-1',
      household_id: 'h-1',
      created_at: '2026-08-05T14:30:00.000Z',
      waste_transaction_id: 'txn-waste-1',
      item_id: 'lot-wasted',
      expected_quantity: 500,
      waste_quantity: 500,
      reason: 'expired',
    });
    expect(computeInventoryOperationFootprint(op)).toEqual({
      lots: {
        created: [],
        modified: [],
        restored: [],
        tombstoned: ['lot-wasted'],
      },
      transactions: {
        created: ['txn-waste-1'],
        reversals: [],
      },
    });
  });

  it('computes footprint for move_inventory', () => {
    const op = assertValidInventoryOperation({
      contract_version: 1,
      type: 'move_inventory',
      operation_id: 'op-move-1',
      household_id: 'h-1',
      created_at: '2026-08-05T14:30:00.000Z',
      out_transaction_id: 'txn-move-out',
      in_transaction_id: 'txn-move-in',
      item_id: 'lot-moving',
      expected_quantity: 1_000,
      expected_location_id: 'fridge',
      to_location_id: 'cellar',
    });
    expect(computeInventoryOperationFootprint(op)).toEqual({
      lots: {
        created: [],
        modified: ['lot-moving'],
        restored: [],
        tombstoned: [],
      },
      transactions: {
        created: ['txn-move-out', 'txn-move-in'],
        reversals: [],
      },
    });
  });

  it('computes footprint for correct_quantity (positive adjustment vs zero tombstone)', () => {
    const adjustOp = assertValidInventoryOperation({
      contract_version: 1,
      type: 'correct_quantity',
      operation_id: 'op-correct-adj',
      household_id: 'h-1',
      created_at: '2026-08-05T14:30:00.000Z',
      transaction_id: 'txn-correct-adj',
      item_id: 'lot-adj',
      new_quantity: 800,
      expected_quantity: 1_000,
    });
    expect(computeInventoryOperationFootprint(adjustOp)).toEqual({
      lots: {
        created: [],
        modified: ['lot-adj'],
        restored: [],
        tombstoned: [],
      },
      transactions: {
        created: ['txn-correct-adj'],
        reversals: [],
      },
    });

    const tombstoneOp = assertValidInventoryOperation({
      contract_version: 1,
      type: 'correct_quantity',
      operation_id: 'op-correct-zero',
      household_id: 'h-1',
      created_at: '2026-08-05T14:30:00.000Z',
      transaction_id: 'txn-correct-zero',
      item_id: 'lot-zero',
      new_quantity: 0,
      expected_quantity: 500,
    });
    expect(computeInventoryOperationFootprint(tombstoneOp)).toEqual({
      lots: {
        created: [],
        modified: [],
        restored: [],
        tombstoned: ['lot-zero'],
      },
      transactions: {
        created: ['txn-correct-zero'],
        reversals: [],
      },
    });
  });

  it('computes footprint for undo_inventory_operation in all three modes', () => {
    const reverseQuantity = assertValidInventoryOperation({
      contract_version: 1,
      type: 'undo_inventory_operation',
      operation_id: 'op-undo-counter',
      household_id: 'h-1',
      created_at: '2026-08-05T15:00:00.000Z',
      mode: 'reverse_quantity',
      reversal_transaction_id: 'txn-reversal-1',
      reversal_of: 'txn-out-to-reverse',
      item_id: 'lot-1',
    });
    expect(computeInventoryOperationFootprint(reverseQuantity)).toEqual({
      lots: {
        created: [],
        modified: ['lot-1'],
        restored: [],
        tombstoned: [],
      },
      transactions: {
        created: ['txn-reversal-1'],
        reversals: ['txn-out-to-reverse'],
      },
    });

    const reverseMove = assertValidInventoryOperation({
      contract_version: 1,
      type: 'undo_inventory_operation',
      operation_id: 'op-undo-move',
      household_id: 'h-1',
      created_at: '2026-08-05T15:00:00.000Z',
      mode: 'reverse_move',
      reversal_out_transaction_id: 'txn-reversal-out',
      reversal_in_transaction_id: 'txn-reversal-in',
      reversal_of: 'op-move-1',
      item_id: 'lot-1',
    });
    expect(computeInventoryOperationFootprint(reverseMove)).toEqual({
      lots: {
        created: [],
        modified: ['lot-1'],
        restored: [],
        tombstoned: [],
      },
      transactions: {
        created: ['txn-reversal-out', 'txn-reversal-in'],
        reversals: ['op-move-1'],
      },
    });

    const mergeUndoOpen = assertValidInventoryOperation({
      contract_version: 1,
      type: 'undo_inventory_operation',
      operation_id: 'op-undo-merge',
      household_id: 'h-1',
      created_at: '2026-08-05T15:00:00.000Z',
      mode: 'merge_undo_open',
      in_transaction_id: 'txn-merge-in',
      reversal_of: 'txn-out-original',
      source_item_id: 'lot-sealed',
      opened_item_id: 'lot-opened',
    });
    expect(computeInventoryOperationFootprint(mergeUndoOpen)).toEqual({
      lots: {
        created: [],
        modified: [],
        restored: ['lot-sealed'],
        tombstoned: ['lot-opened'],
      },
      transactions: {
        created: ['txn-merge-in'],
        reversals: ['txn-out-original'],
      },
    });
  });

  it('computes footprint for reseal_inventory (modifies lot, zero transactions)', () => {
    const op = assertValidInventoryOperation({
      contract_version: 1,
      type: 'reseal_inventory',
      operation_id: 'op-reseal-1',
      household_id: 'h-1',
      created_at: '2026-08-05T14:30:00.000Z',
      item_id: 'lot-resealed',
    });
    expect(computeInventoryOperationFootprint(op)).toEqual({
      lots: {
        created: [],
        modified: ['lot-resealed'],
        restored: [],
        tombstoned: [],
      },
      transactions: {
        created: [],
        reversals: [],
      },
    });
  });

  it('computes footprint for patch_inventory_metadata (modifies lot, zero transactions)', () => {
    const op = assertValidInventoryOperation({
      contract_version: 1,
      type: 'patch_inventory_metadata',
      operation_id: 'op-patch-meta',
      household_id: 'h-1',
      created_at: '2026-08-05T14:30:00.000Z',
      item_id: 'lot-patched',
      product_name: 'Neuer Titel',
      expected_updated_at: '2026-08-05T14:30:00.000Z',
    });
    expect(computeInventoryOperationFootprint(op)).toEqual({
      lots: {
        created: [],
        modified: ['lot-patched'],
        restored: [],
        tombstoned: [],
      },
      transactions: {
        created: [],
        reversals: [],
      },
    });
  });
});

describe('Quantity helpers', () => {
  it('isPositiveIntegerThousandths validates positive integers within bounds', () => {
    expect(isPositiveIntegerThousandths(1_000)).toBe(true);
    expect(isPositiveIntegerThousandths(300_000)).toBe(true);
    expect(isPositiveIntegerThousandths(MAX_INVENTORY_QUANTITY_UNITS)).toBe(true);
    expect(isPositiveIntegerThousandths(0)).toBe(false);
    expect(isPositiveIntegerThousandths(-1)).toBe(false);
    expect(isPositiveIntegerThousandths(1.5)).toBe(false);
    expect(isPositiveIntegerThousandths(MAX_INVENTORY_QUANTITY_UNITS + 1)).toBe(false);
    expect(isPositiveIntegerThousandths('100')).toBe(false);
  });

  it('isNonNegativeIntegerThousandths allows zero but rejects negative or floats', () => {
    expect(isNonNegativeIntegerThousandths(0)).toBe(true);
    expect(isNonNegativeIntegerThousandths(1_000)).toBe(true);
    expect(isNonNegativeIntegerThousandths(-1)).toBe(false);
    expect(isNonNegativeIntegerThousandths(0.5)).toBe(false);
  });
});
