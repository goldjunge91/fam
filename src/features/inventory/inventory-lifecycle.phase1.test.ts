import {
  ALL_CANONICAL_OPERATION_TYPES,
  computeInventoryOperationFootprint,
  type InventoryPlanningState,
  planInventoryOperation,
  validateInventoryOperation,
} from './inventory-lifecycle';

const IDS = {
  operation: '11111111-1111-4111-8111-111111111111',
  household: '22222222-2222-4222-8222-222222222222',
  source: '33333333-3333-4333-8333-333333333333',
  opened: '44444444-4444-4444-8444-444444444444',
  transaction: '55555555-5555-4555-8555-555555555555',
  actor: '66666666-6666-4666-8666-666666666666',
  location: '77777777-7777-4777-8777-777777777777',
} as const;
const CREATED_AT = '2026-09-10T10:00:00.000Z';

function validInsert() {
  return {
    contract_version: 1 as const,
    type: 'insert_inventory' as const,
    operation_id: IDS.operation,
    household_id: IDS.household,
    created_at: CREATED_AT,
    item_id: IDS.source,
    in_transaction_id: IDS.transaction,
    quantity: 500,
    product_id: null,
    name: 'Käse',
    unit: 'g',
    package_size: 500,
    package_size_unit: 'g',
    location_id: IDS.location,
    expiry_date: null,
    opened_at: null,
    vacuum_sealed: false,
    expiry_user_set: false,
  };
}

describe('inventory lifecycle phase 1', () => {
  it('exposes only the five canonical operation types', () => {
    expect(ALL_CANONICAL_OPERATION_TYPES).toEqual([
      'insert_inventory',
      'consume_inventory',
      'waste_inventory',
      'move_inventory',
      'correct_quantity',
    ]);
  });

  it.each([
    'open_inventory',
    'undo_inventory_operation',
    'reseal_inventory',
    'patch_inventory_metadata',
  ])('rejects phase-2 operation %s', (type) => {
    expect(validateInventoryOperation({ ...validInsert(), type }).success).toBe(false);
  });

  it('plans sealed_partial as a source tombstone, opened remainder, and one OUT ledger row', () => {
    const base: Record<string, unknown> = { ...validInsert() };
    delete base.item_id;
    delete base.in_transaction_id;
    delete base.quantity;
    delete base.name;
    delete base.package_size;
    delete base.package_size_unit;
    delete base.expiry_date;
    delete base.opened_at;
    delete base.vacuum_sealed;
    delete base.expiry_user_set;
    const operation = {
      ...base,
      type: 'consume_inventory' as const,
      out_transaction_id: IDS.transaction,
      source_item_id: IDS.source,
      expected_quantity: 500,
      consumed_quantity: 200,
      product_id: null,
      mode: 'sealed_partial' as const,
      opened_item_id: IDS.opened,
      portion_quantity: 500,
      remainder_quantity: 300,
      opened_at: CREATED_AT,
      expiry_date: null,
      vacuum_sealed: false,
      expiry_user_set: false,
      merge_snapshot: {
        household_id: IDS.household,
        product_id: null,
        name: 'Käse',
        unit: 'g',
        package_size: 500,
        package_size_unit: 'g',
        location_id: IDS.location,
        expiry_date: null,
        opened_at: null,
        vacuum_sealed: false,
        expiry_user_set: false,
        added_by: IDS.actor,
        quantity_before: 500,
      },
    };
    const parsed = validateInventoryOperation(operation);
    if (!parsed.success) throw parsed.error;

    const state: InventoryPlanningState = {
      lots: [
        {
          id: IDS.source,
          household_id: IDS.household,
          product_id: null,
          name: 'Käse',
          unit: 'g',
          package_size: 500,
          package_size_unit: 'g',
          location_id: IDS.location,
          expiry_date: null,
          opened_at: null,
          vacuum_sealed: false,
          expiry_user_set: false,
          added_by: IDS.actor,
          quantity: 500,
          created_at: CREATED_AT,
          updated_at: CREATED_AT,
          deleted_at: null,
        },
      ],
      transactions: [],
      authenticated_actor_id: IDS.actor,
      now: CREATED_AT,
    };
    const plan = planInventoryOperation(parsed.data, state);
    expect(plan.kind).toBe('planned');
    if (plan.kind !== 'planned') return;

    expect(plan.ledger_writes).toHaveLength(1);
    expect(plan.ledger_writes[0]?.transaction).toMatchObject({
      id: IDS.transaction,
      type: 'out',
      quantity: 200,
      fridge_item_id: IDS.opened,
    });
    expect(
      computeInventoryOperationFootprint(parsed.data, plan.lot_writes, plan.ledger_writes),
    ).toEqual({
      lots: {
        read: [IDS.source],
        created: [IDS.opened],
        updated: [IDS.source],
        restored: [],
        tombstoned: [IDS.source],
      },
      ledger: { read: [], created: [IDS.transaction], reversed: [] },
    });
  });
});
