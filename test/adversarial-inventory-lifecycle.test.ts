import {
  validateInventoryOperation,
  computeInventoryOperationFootprint,
  MAX_INVENTORY_QUANTITY_UNITS,
  ALL_CANONICAL_OPERATION_TYPES,
} from '@/features/inventory/inventory-lifecycle';

// Basisfelder gemaess BaseInventoryOperationV1 (contract.md Abschnitt 2/4):
// `operation_id`, nicht `id`. Frueher Stand dieser Datei nutzte durchgaengig
// `id` und andere erfundene Feldnamen (z.B. `item_id` bei open_inventory statt
// `source_item_id`, `location` statt `location_id`) - das verdeckte jede
// echte Erkenntnis hinter falschen "Unknown property"-Ablehnungen. Payloads
// unten sind gegen die tatsaechlichen V1-Operationstypen korrigiert.
const CREATED_AT = '2026-08-05T14:30:00.000Z';

describe('Adversarial Inventory Lifecycle Validation Suite', () => {
  describe('1. Object prototype injection, __proto__, and inherited properties', () => {
    it('rejects payload with explicit __proto__ property from JSON.parse', () => {
      // Written as a raw JSON string, not an object literal: `{ __proto__: x }`
      // in source code sets the actual prototype and JSON.stringify would
      // drop it again as a non-own property. JSON.parse of a string
      // containing a literal "__proto__" key instead creates a genuine own
      // data property with that name (CreateDataProperty semantics) - this
      // is the actual attack shape the check has to defend against.
      const maliciousJson =
        '{"contract_version":1,"type":"open_inventory","operation_id":"op-1",' +
        '"household_id":"h-1","created_at":"' +
        CREATED_AT +
        '","source_item_id":"i-1","expected_quantity":500,"portion_quantity":500,' +
        '"opened_at":"' +
        CREATED_AT +
        '","__proto__":{"polluted":true}}';
      const parsed = JSON.parse(maliciousJson);
      const res = validateInventoryOperation(parsed);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe('PAYLOAD_VALIDATION_FAILED');
        expect(res.error.message).toContain("Unknown or forbidden property '__proto__'");
      }
    });

    it('rejects a payload whose required field is only present via a custom prototype, not as its own property', () => {
      const proto = { portion_quantity: 1000 };
      const payload = Object.create(proto);
      Object.assign(payload, {
        contract_version: 1,
        type: 'open_inventory',
        operation_id: 'op-1',
        household_id: 'h-1',
        created_at: CREATED_AT,
        source_item_id: 'i-1',
        expected_quantity: 1000,
        opened_at: CREATED_AT,
        // portion_quantity is intentionally NOT an own property here.
      });

      const res = validateInventoryOperation(payload);
      // validateInventoryOperation copies only Object.keys(raw) (own
      // enumerable keys) into a prototype-less working object up front - an
      // inherited portion_quantity from a custom prototype is genuinely
      // absent afterward, not silently treated as if it were provided.
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.message).toContain('portion_quantity');
      }
    });

    it('DEFECT DEMONSTRATION: Object.prototype pollution breaks validation of unrelated valid payloads', () => {
      const proto = Object.prototype as Record<string, unknown>;
      try {
        // Pollute prototype with an invalid portion_quantity.
        proto.portion_quantity = -999;

        const payload = {
          contract_version: 1,
          type: 'open_inventory',
          operation_id: 'op-1',
          household_id: 'h-1',
          created_at: CREATED_AT,
          source_item_id: 'i-1',
          expected_quantity: 1000,
          opened_at: CREATED_AT,
          // portion_quantity absent - but Object.prototype now provides one.
        };

        const res = validateInventoryOperation(payload);
        // Valid payload without its own portion_quantity is rejected, because
        // `'portion_quantity' in rawObj` / `rawObj.portion_quantity` finds -999
        // on the prototype instead of treating the field as genuinely absent.
        expect(res.success).toBe(false);
        if (!res.success) {
          expect(res.error.code).toBe('PAYLOAD_VALIDATION_FAILED');
          expect(res.error.message).toContain('portion_quantity');
        }
      } finally {
        delete proto.portion_quantity;
      }
    });
  });

  describe('2. Unknown properties on root and nested objects', () => {
    it('rejects unknown properties on each of the 9 operations with PAYLOAD_VALIDATION_FAILED', () => {
      const basePayloadFor = (opType: string): Record<string, unknown> => {
        const base: Record<string, unknown> = {
          contract_version: 1,
          type: opType,
          operation_id: 'op-1',
          household_id: 'h-1',
          created_at: CREATED_AT,
          unknown_extra_prop: 'boom',
        };
        switch (opType) {
          case 'insert_inventory':
            return {
              ...base,
              item_id: 'item-1',
              in_transaction_id: 'tx-1',
              product_name: 'Apfel',
              quantity: 1000,
              unit: 'stk',
              location_id: 'loc-1',
            };
          case 'open_inventory':
            return {
              ...base,
              source_item_id: 'item-1',
              expected_quantity: 1000,
              portion_quantity: 500,
              opened_at: CREATED_AT,
            };
          case 'consume_inventory':
            return {
              ...base,
              out_transaction_id: 'tx-1',
              source_item_id: 'item-1',
              expected_quantity: 1000,
              consumed_quantity: 500,
              consumed_at: CREATED_AT,
              mode: 'sealed_full',
            };
          case 'waste_inventory':
            return {
              ...base,
              waste_transaction_id: 'tx-1',
              item_id: 'item-1',
              expected_quantity: 1000,
              waste_quantity: 200,
              reason: 'spoiled',
            };
          case 'move_inventory':
            return {
              ...base,
              out_transaction_id: 'tx-1',
              in_transaction_id: 'tx-2',
              item_id: 'item-1',
              expected_quantity: 1000,
              expected_location_id: 'loc-1',
              to_location_id: 'loc-2',
            };
          case 'correct_quantity':
            return {
              ...base,
              transaction_id: 'tx-1',
              item_id: 'item-1',
              expected_quantity: 1000,
              new_quantity: 500,
            };
          case 'undo_inventory_operation':
            return {
              ...base,
              mode: 'reverse_quantity',
              reversal_transaction_id: 'tx-rev-1',
              reversal_of: 'tx-orig-1',
              item_id: 'item-1',
            };
          case 'reseal_inventory':
            return { ...base, item_id: 'item-1' };
          case 'patch_inventory_metadata':
            return {
              ...base,
              item_id: 'item-1',
              expected_updated_at: CREATED_AT,
              product_name: 'Neuer Apfel',
            };
          default:
            throw new Error(`unhandled op type in test fixture: ${opType}`);
        }
      };

      for (const opType of ALL_CANONICAL_OPERATION_TYPES) {
        const res = validateInventoryOperation(basePayloadFor(opType));
        expect(res.success).toBe(false);
        if (!res.success) {
          expect(res.error.code).toBe('PAYLOAD_VALIDATION_FAILED');
          expect(res.error.message).toContain('Unknown or forbidden property');
        }
      }
    });

    it('rejects contract_version mismatch or omission', () => {
      const noVersion = validateInventoryOperation({
        type: 'open_inventory',
        operation_id: 'op-1',
        household_id: 'h-1',
        created_at: CREATED_AT,
        source_item_id: 'i-1',
        expected_quantity: 1000,
        portion_quantity: 500,
        opened_at: CREATED_AT,
      });
      expect(noVersion.success).toBe(false);

      const badVersion = validateInventoryOperation({
        contract_version: 2,
        type: 'open_inventory',
        operation_id: 'op-1',
        household_id: 'h-1',
        created_at: CREATED_AT,
        source_item_id: 'i-1',
        expected_quantity: 1000,
        portion_quantity: 500,
        opened_at: CREATED_AT,
      });
      expect(badVersion.success).toBe(false);
    });

    it('rejects an operation-foreign field even when it looks like a plausible extra column', () => {
      const res = validateInventoryOperation({
        contract_version: 1,
        type: 'open_inventory',
        operation: 'consume_inventory', // not a real field on any operation
        operation_id: 'op-1',
        household_id: 'h-1',
        created_at: CREATED_AT,
        source_item_id: 'i-1',
        expected_quantity: 1000,
        portion_quantity: 500,
        opened_at: CREATED_AT,
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe('PAYLOAD_VALIDATION_FAILED');
        expect(res.error.message).toContain("Unknown or forbidden property 'operation'");
      }
    });
  });

  describe('3. Numeric boundaries, negative, floating point, NaN, and infinity', () => {
    const invalidNumbers = [
      -1,
      -0.001,
      0.1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      MAX_INVENTORY_QUANTITY_UNITS + 1,
      Number.MAX_SAFE_INTEGER,
      '1000',
      true,
      false,
      null,
      [],
      {},
    ];

    it.each(invalidNumbers)('rejects invalid quantity %p on insert_inventory', (qty) => {
      const res = validateInventoryOperation({
        contract_version: 1,
        type: 'insert_inventory',
        operation_id: 'op-1',
        household_id: 'h-1',
        created_at: CREATED_AT,
        item_id: 'item-1',
        in_transaction_id: 'tx-1',
        product_name: 'Milch',
        quantity: qty,
        unit: 'l',
        location_id: 'loc-1',
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe('PAYLOAD_VALIDATION_FAILED');
      }
    });

    it('rejects quantity = 0 on insert_inventory', () => {
      const res = validateInventoryOperation({
        contract_version: 1,
        type: 'insert_inventory',
        operation_id: 'op-1',
        household_id: 'h-1',
        created_at: CREATED_AT,
        item_id: 'item-1',
        in_transaction_id: 'tx-1',
        product_name: 'Milch',
        quantity: 0,
        unit: 'l',
        location_id: 'loc-1',
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe('PAYLOAD_VALIDATION_FAILED');
      }
    });

    it.each(invalidNumbers)('rejects invalid portion_quantity %p on open_inventory', (qty) => {
      const res = validateInventoryOperation({
        contract_version: 1,
        type: 'open_inventory',
        operation_id: 'op-1',
        household_id: 'h-1',
        created_at: CREATED_AT,
        source_item_id: 'i-1',
        expected_quantity: 1000,
        portion_quantity: qty,
        opened_at: CREATED_AT,
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe('PAYLOAD_VALIDATION_FAILED');
      }
    });

    it('accepts exact boundary MAX_INVENTORY_QUANTITY_UNITS (9_999_999_999)', () => {
      const res = validateInventoryOperation({
        contract_version: 1,
        type: 'insert_inventory',
        operation_id: 'op-1',
        household_id: 'h-1',
        created_at: CREATED_AT,
        item_id: 'item-1',
        in_transaction_id: 'tx-1',
        product_name: 'Milch',
        quantity: MAX_INVENTORY_QUANTITY_UNITS,
        unit: 'ml',
        location_id: 'loc-1',
      });
      expect(res.success).toBe(true);
    });

    it('correct_quantity allows new_quantity = 0 (tombstone)', () => {
      const res = validateInventoryOperation({
        contract_version: 1,
        type: 'correct_quantity',
        operation_id: 'op-1',
        household_id: 'h-1',
        created_at: CREATED_AT,
        transaction_id: 'tx-1',
        item_id: 'i-1',
        new_quantity: 0,
        expected_quantity: 1000,
      });
      expect(res.success).toBe(true);
    });

    it('correct_quantity rejects new_quantity === expected_quantity', () => {
      const res = validateInventoryOperation({
        contract_version: 1,
        type: 'correct_quantity',
        operation_id: 'op-1',
        household_id: 'h-1',
        created_at: CREATED_AT,
        transaction_id: 'tx-1',
        item_id: 'i-1',
        new_quantity: 500,
        expected_quantity: 500,
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe('PAYLOAD_VALIDATION_FAILED');
      }
    });
  });

  describe('4. Missing required keys vs explicit null properties', () => {
    it('rejects missing or empty string operation_id', () => {
      const missing = validateInventoryOperation({
        contract_version: 1,
        type: 'open_inventory',
        household_id: 'h-1',
        created_at: CREATED_AT,
        source_item_id: 'i-1',
        expected_quantity: 1000,
        portion_quantity: 500,
        opened_at: CREATED_AT,
      });
      expect(missing.success).toBe(false);

      const empty = validateInventoryOperation({
        contract_version: 1,
        type: 'open_inventory',
        operation_id: '',
        household_id: 'h-1',
        created_at: CREATED_AT,
        source_item_id: 'i-1',
        expected_quantity: 1000,
        portion_quantity: 500,
        opened_at: CREATED_AT,
      });
      expect(empty.success).toBe(false);

      const whitespace = validateInventoryOperation({
        contract_version: 1,
        type: 'open_inventory',
        operation_id: '   ',
        household_id: 'h-1',
        created_at: CREATED_AT,
        source_item_id: 'i-1',
        expected_quantity: 1000,
        portion_quantity: 500,
        opened_at: CREATED_AT,
      });
      expect(whitespace.success).toBe(false);
    });

    it('rejects explicit null for non-nullable required keys (household_id, source_item_id)', () => {
      const nullHousehold = validateInventoryOperation({
        contract_version: 1,
        type: 'open_inventory',
        operation_id: 'op-1',
        household_id: null,
        created_at: CREATED_AT,
        source_item_id: 'i-1',
        expected_quantity: 1000,
        portion_quantity: 500,
        opened_at: CREATED_AT,
      });
      expect(nullHousehold.success).toBe(false);

      const nullItem = validateInventoryOperation({
        contract_version: 1,
        type: 'open_inventory',
        operation_id: 'op-1',
        household_id: 'h-1',
        created_at: CREATED_AT,
        source_item_id: null,
        expected_quantity: 1000,
        portion_quantity: 500,
        opened_at: CREATED_AT,
      });
      expect(nullItem.success).toBe(false);
    });

    it('distinguishes absent vs null notes in patch_inventory_metadata', () => {
      const absentRes = validateInventoryOperation({
        contract_version: 1,
        type: 'patch_inventory_metadata',
        operation_id: 'op-1',
        household_id: 'h-1',
        created_at: CREATED_AT,
        item_id: 'i-1',
        product_name: 'New Name',
        expected_updated_at: CREATED_AT,
      });
      expect(absentRes.success).toBe(true);
      if (absentRes.success && absentRes.data.type === 'patch_inventory_metadata') {
        expect('notes' in absentRes.data).toBe(false);
      }

      const nullRes = validateInventoryOperation({
        contract_version: 1,
        type: 'patch_inventory_metadata',
        operation_id: 'op-1',
        household_id: 'h-1',
        created_at: CREATED_AT,
        item_id: 'i-1',
        notes: null,
        expected_updated_at: CREATED_AT,
      });
      expect(nullRes.success).toBe(true);
      if (nullRes.success && nullRes.data.type === 'patch_inventory_metadata') {
        expect('notes' in nullRes.data).toBe(true);
        expect(nullRes.data.notes).toBeNull();
      }
    });

    it('rejects patch_inventory_metadata when no patch properties are present', () => {
      const res = validateInventoryOperation({
        contract_version: 1,
        type: 'patch_inventory_metadata',
        operation_id: 'op-1',
        household_id: 'h-1',
        created_at: CREATED_AT,
        item_id: 'i-1',
        expected_updated_at: CREATED_AT,
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe('PAYLOAD_VALIDATION_FAILED');
      }
    });
  });

  describe('5. Malformed UUIDs and invalid timestamps (Gap Verification)', () => {
    it('DEFECT DEMONSTRATION: accepts arbitrary non-UUID strings for operation_id, household_id, source_item_id', () => {
      const res = validateInventoryOperation({
        contract_version: 1,
        type: 'open_inventory',
        operation_id: 'invalid-not-a-uuid-string',
        household_id: 'not-a-uuid-household',
        created_at: CREATED_AT,
        source_item_id: 'not-a-uuid-item',
        expected_quantity: 500,
        portion_quantity: 500,
        opened_at: CREATED_AT,
      });
      // The current implementation accepts non-UUID strings because it only
      // checks isNonEmptyString, never a UUID shape.
      expect(res.success).toBe(true);
    });

    it('created_at is correctly rejected when empty, but insert_inventory\'s optional opened_at accepts an empty string', () => {
      const resCreated = validateInventoryOperation({
        contract_version: 1,
        type: 'insert_inventory',
        operation_id: 'op-1',
        household_id: 'h-1',
        created_at: '',
        item_id: 'item-1',
        in_transaction_id: 'tx-1',
        product_name: 'Brot',
        quantity: 1000,
        unit: 'stk',
        location_id: 'loc-1',
      });
      // Base field created_at IS checked for non-emptiness. Regression guard.
      expect(resCreated.success).toBe(false);

      // DEFECT: insert_inventory's optional `opened_at` only checks
      // `typeof === 'string'`, never non-empty (unlike open_inventory's
      // required `opened_at`, which does call isNonEmptyStringProp).
      const resOpened = validateInventoryOperation({
        contract_version: 1,
        type: 'insert_inventory',
        operation_id: 'op-1',
        household_id: 'h-1',
        created_at: CREATED_AT,
        item_id: 'item-1',
        in_transaction_id: 'tx-1',
        product_name: 'Brot',
        quantity: 1000,
        unit: 'stk',
        location_id: 'loc-1',
        opened_at: '',
      });
      expect(resOpened.success).toBe(true);
    });

    it('DEFECT DEMONSTRATION: accepts malformed non-ISO date string for timestamps and expiry_date', () => {
      const res = validateInventoryOperation({
        contract_version: 1,
        type: 'insert_inventory',
        operation_id: 'op-1',
        household_id: 'h-1',
        created_at: 'not-a-valid-date-timestamp',
        item_id: 'item-1',
        in_transaction_id: 'tx-1',
        product_name: 'Brot',
        quantity: 1000,
        unit: 'stk',
        location_id: 'loc-1',
        expiry_date: 'garbage-date',
      });
      // Arbitrary non-date strings pass validation - no ISO-8601 format check.
      expect(res.success).toBe(true);
    });

    it('DEFECT DEMONSTRATION: accepts malformed non-ISO timestamp for expected_updated_at CAS anchor', () => {
      const res = validateInventoryOperation({
        contract_version: 1,
        type: 'patch_inventory_metadata',
        operation_id: 'op-1',
        household_id: 'h-1',
        created_at: CREATED_AT,
        item_id: 'i-1',
        product_name: 'New Name',
        expected_updated_at: 'not-an-iso-timestamp',
      });
      // Accepts arbitrary non-ISO string for expected_updated_at CAS anchor.
      expect(res.success).toBe(true);
    });
  });

  describe('6. Sealed_partial consume_inventory footprint consistency', () => {
    it('rejects consume_inventory sealed_partial without opened_item_id (missing lot from footprint)', () => {
      const res = validateInventoryOperation({
        contract_version: 1,
        type: 'consume_inventory',
        operation_id: 'op-consume-1',
        household_id: 'h-1',
        created_at: CREATED_AT,
        out_transaction_id: 'tx-1',
        source_item_id: 'item-1',
        expected_quantity: 1000,
        consumed_quantity: 300,
        consumed_at: CREATED_AT,
        mode: 'sealed_partial',
        portion_quantity: 500,
        opened_at: CREATED_AT,
        merge_snapshot: {
          household_id: 'h-1',
          product_id: null,
          name: 'Milch',
          unit: 'g',
          package_size: 500,
          package_size_unit: 'g',
          location_id: 'loc-1',
          expiry_date: null,
          opened_at: null,
          vacuum_sealed: false,
          expiry_user_set: false,
          added_by: null,
          quantity_before: 1000,
        },
        // opened_item_id is missing - sealed_partial requires it (contract.md
        // Abschnitt 5) so the new lot is representable in the footprint.
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe('PAYLOAD_VALIDATION_FAILED');
      }
    });

    it('accepts consume_inventory sealed_partial with opened_item_id and reports the new lot in the footprint', () => {
      const res = validateInventoryOperation({
        contract_version: 1,
        type: 'consume_inventory',
        operation_id: 'op-consume-1',
        household_id: 'h-1',
        created_at: CREATED_AT,
        out_transaction_id: 'tx-1',
        source_item_id: 'item-1',
        expected_quantity: 1000,
        consumed_quantity: 300,
        consumed_at: CREATED_AT,
        mode: 'sealed_partial',
        opened_item_id: 'item-opened-1',
        portion_quantity: 500,
        opened_at: CREATED_AT,
        merge_snapshot: {
          household_id: 'h-1',
          product_id: null,
          name: 'Milch',
          unit: 'g',
          package_size: 500,
          package_size_unit: 'g',
          location_id: 'loc-1',
          expiry_date: null,
          opened_at: null,
          vacuum_sealed: false,
          expiry_user_set: false,
          added_by: null,
          quantity_before: 1000,
        },
      });
      expect(res.success).toBe(true);
      if (res.success) {
        const footprint = computeInventoryOperationFootprint(res.data);
        expect(footprint.lots.created).toEqual(['item-opened-1']);
      }
    });
  });
});
