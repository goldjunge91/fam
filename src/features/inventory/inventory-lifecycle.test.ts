import {
  canUndoTransaction,
  inventoryUndoMode,
  inverseTransactionType,
  planOpenInventoryItem,
  planUndoOpenTransaction,
  splitTransactionNotes,
  undoTransactionNotes,
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

describe('planOpenInventoryItem', () => {
  it('öffnet ein einzelnes Gebinde in-place und protokolliert die vorherige MHD', () => {
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
    expect(plan.transaction).toMatchObject({
      fridgeItemId: 'sealed-lot',
      productId: 'mustard',
      type: 'open',
      quantity: 1,
      previousExpiryDate: '2026-12-31',
    });
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

  it('bewahrt beim Split Lifecycle-Metadaten und protokolliert die Ursprungs-ID', () => {
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
    expect(plan.transaction).toMatchObject({
      originItemId: 'sealed-lot',
      notes: '[Split] origin=sealed-lot',
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
    expect(undoTransactionNotes('undo', 'open')).toBe('[Undone] Öffnung rückgängig gemacht');
    expect(undoTransactionNotes('undo', 'out')).toBe('[Undone] Gegenbuchung');
    expect(undoTransactionNotes('manual-correction', 'waste')).toBe('[Manual correction]');
  });
});

describe('planUndoOpenTransaction', () => {
  it('stellt eine in-place Öffnung samt ursprünglichem MHD wieder her', () => {
    const plan = planUndoOpenTransaction(
      {
        id: 'transaction-1',
        householdId: 'household-1',
        fridgeItemId: 'sealed-lot',
        productId: 'mustard',
        locationId: 'fridge',
        type: 'open',
        quantity: 1,
        previousExpiryDate: '2026-12-31',
        createdAt: '2026-08-05T14:30:00.000Z',
      },
      {
        ...ITEM,
        openedAt: '2026-08-05T14:30:00.000Z',
        expiryDate: '2026-08-10',
        vacuumSealed: true,
        expiryUserSet: true,
      },
      null,
      new Date('2026-08-05T15:00:00.000Z'),
    );

    expect(plan.mode).toBe('restore-in-place');
    expect(plan.openedPatch).toEqual({
      openedAt: null,
      expiryDate: '2026-12-31',
      expiryUserSet: true,
      vacuumSealed: true,
    });
    expect(plan.deleteOpenedItem).toBe(false);
  });

  it('merged einen unveränderten Split-Lot zurück', () => {
    const sealed = { ...ITEM, quantity: 2 };
    const opened = {
      ...ITEM,
      id: 'opened-lot',
      quantity: 1,
      openedAt: '2026-08-05T14:30:00.000Z',
      expiryDate: '2026-08-10',
    };
    const plan = planUndoOpenTransaction(
      {
        id: 'transaction-1',
        householdId: 'household-1',
        fridgeItemId: 'opened-lot',
        productId: 'mustard',
        locationId: 'fridge',
        type: 'open',
        quantity: 1,
        previousExpiryDate: '2026-12-31',
        originItemId: 'sealed-lot',
        originQuantity: 3,
        notes: splitTransactionNotes('sealed-lot'),
        createdAt: '2026-08-05T14:30:00.000Z',
      },
      opened,
      sealed,
      new Date('2026-08-05T15:00:00.000Z'),
    );

    expect(plan.mode).toBe('merge-split');
    expect(plan.sealedPatch).toEqual({ quantity: 3 });
    expect(plan.deleteOpenedItem).toBe(true);
  });

  it('ignoriert serverseitige updated_at-Drift bei stabiler Split-Provenienz', () => {
    const sealed = {
      ...ITEM,
      quantity: 2,
      updatedAt: '2026-08-05T15:00:00.000Z',
    };
    const opened = {
      ...ITEM,
      id: 'opened-lot',
      quantity: 1,
      openedAt: '2026-08-05T14:30:00.000Z',
      expiryDate: '2026-08-10',
    };
    const plan = planUndoOpenTransaction(
      {
        id: 'transaction-1',
        householdId: 'household-1',
        fridgeItemId: 'opened-lot',
        productId: 'mustard',
        locationId: 'fridge',
        type: 'open',
        quantity: 1,
        previousExpiryDate: '2026-12-31',
        originItemId: 'sealed-lot',
        originQuantity: 3,
        notes: splitTransactionNotes('sealed-lot'),
        createdAt: '2026-08-05T14:30:00.000Z',
      },
      opened,
      sealed,
      new Date('2026-08-05T15:00:00.000Z'),
    );

    expect(plan.mode).toBe('merge-split');
  });

  it('verweigert das Merge eines attributgleichen Duplicate-Lots ohne Ursprungs-ID', () => {
    const duplicateSealed = { ...ITEM, id: 'sealed-lot-duplicate', quantity: 2 };
    const opened = {
      ...ITEM,
      id: 'opened-lot',
      quantity: 1,
      openedAt: '2026-08-05T14:30:00.000Z',
      expiryDate: '2026-08-10',
    };
    const plan = planUndoOpenTransaction(
      {
        householdId: 'household-1',
        fridgeItemId: 'opened-lot',
        productId: 'mustard',
        locationId: 'fridge',
        type: 'open',
        quantity: 1,
        previousExpiryDate: '2026-12-31',
        notes: '[Split]',
        originItemId: 'sealed-lot',
        createdAt: '2026-08-05T14:30:00.000Z',
      },
      opened,
      duplicateSealed,
      new Date('2026-08-05T15:00:00.000Z'),
    );

    expect(plan.mode).toBe('fallback');
    expect(plan.deleteOpenedItem).toBe(false);
    expect(plan.sealedPatch).toBeNull();
  });

  it('verwendet die stabile DB-Ursprungsreferenz für das Split-Merge', () => {
    const sealed = { ...ITEM, quantity: 2 };
    const opened = {
      ...ITEM,
      id: 'opened-lot',
      quantity: 1,
      openedAt: '2026-08-05T14:30:00.000Z',
      expiryDate: '2026-08-10',
    };
    const plan = planUndoOpenTransaction(
      {
        householdId: 'household-1',
        fridgeItemId: 'opened-lot',
        productId: 'mustard',
        locationId: 'fridge',
        type: 'open',
        quantity: 1,
        previousExpiryDate: '2026-12-31',
        originItemId: 'sealed-lot',
        originQuantity: 3,
        notes: splitTransactionNotes('wrong-sealed-lot'),
        createdAt: '2026-08-05T14:30:00.000Z',
      },
      opened,
      sealed,
      new Date('2026-08-05T15:00:00.000Z'),
    );

    expect(plan.mode).toBe('merge-split');
    expect(plan.sealedPatch).toEqual({ quantity: 3 });
  });

  it('verweigert den Legacy-Split-Undo ohne stabile Ursprungs-ID', () => {
    const sealed = { ...ITEM, quantity: 2 };
    const opened = {
      ...ITEM,
      id: 'opened-lot',
      quantity: 1,
      openedAt: '2026-08-05T14:30:00.000Z',
      expiryDate: '2026-08-10',
    };
    const plan = planUndoOpenTransaction(
      {
        householdId: 'household-1',
        fridgeItemId: 'opened-lot',
        productId: 'mustard',
        locationId: 'fridge',
        type: 'open',
        quantity: 1,
        previousExpiryDate: '2026-12-31',
        notes: '[Split]',
        createdAt: '2026-08-05T14:30:00.000Z',
      },
      opened,
      sealed,
      new Date('2026-08-05T15:00:00.000Z'),
    );

    expect(plan.mode).toBe('fallback');
  });

  it('fällt bei verändertem geöffnetem Lot auf einen sicheren Restore zurück', () => {
    const sealed = { ...ITEM, quantity: 2 };
    const opened = {
      ...ITEM,
      id: 'opened-lot',
      quantity: 0.5,
      openedAt: '2026-08-05T14:30:00.000Z',
      expiryDate: '2026-08-10',
    };
    const plan = planUndoOpenTransaction(
      {
        id: 'transaction-1',
        householdId: 'household-1',
        fridgeItemId: 'opened-lot',
        productId: 'mustard',
        locationId: 'fridge',
        type: 'open',
        quantity: 1,
        previousExpiryDate: '2026-12-31',
        createdAt: '2026-08-05T14:30:00.000Z',
      },
      opened,
      sealed,
      new Date('2026-08-05T15:00:00.000Z'),
    );

    expect(plan.mode).toBe('fallback');
    expect(plan.deleteOpenedItem).toBe(false);
    expect(plan.sealedPatch).toBeNull();
  });

  it('führt bei einer veränderten Ursprungszeile keinen Split-Merge durch', () => {
    const changedSealed = { ...ITEM, quantity: 2, name: 'Scharfer Senf' };
    const opened = {
      ...ITEM,
      id: 'opened-lot',
      quantity: 1,
      openedAt: '2026-08-05T14:30:00.000Z',
      expiryDate: '2026-08-10',
    };
    const plan = planUndoOpenTransaction(
      {
        householdId: 'household-1',
        fridgeItemId: 'opened-lot',
        productId: 'mustard',
        locationId: 'fridge',
        type: 'open',
        quantity: 1,
        previousExpiryDate: '2026-12-31',
        originItemId: 'sealed-lot',
        originQuantity: 3,
        notes: splitTransactionNotes('sealed-lot'),
        createdAt: '2026-08-05T14:30:00.000Z',
      },
      opened,
      changedSealed,
      new Date('2026-08-05T15:00:00.000Z'),
    );

    expect(plan.mode).toBe('fallback');
    expect(plan.sealedPatch).toBeNull();
    expect(plan.deleteOpenedItem).toBe(false);
  });

  it('führt bei einer konkurrierend geänderten Ursprungsmenge keinen Split-Merge durch', () => {
    const changedSealed = {
      ...ITEM,
      quantity: 7,
      updatedAt: '2026-08-05T16:00:00.000Z',
    };
    const opened = {
      ...ITEM,
      id: 'opened-lot',
      quantity: 1,
      openedAt: '2026-08-05T14:30:00.000Z',
      expiryDate: '2026-08-10',
    };
    const plan = planUndoOpenTransaction(
      {
        householdId: 'household-1',
        fridgeItemId: 'opened-lot',
        productId: 'mustard',
        locationId: 'fridge',
        type: 'open',
        quantity: 1,
        previousExpiryDate: '2026-12-31',
        originItemId: 'sealed-lot',
        originQuantity: 3,
        notes: splitTransactionNotes('sealed-lot'),
        createdAt: '2026-08-05T14:30:00.000Z',
      },
      opened,
      changedSealed,
      new Date('2026-08-05T16:05:00.000Z'),
    );

    expect(plan.mode).toBe('fallback');
    expect(plan.sealedPatch).toBeNull();
    expect(plan.deleteOpenedItem).toBe(false);
  });

  it('macht denselben Open-Vorgang nicht ein zweites Mal rückgängig', () => {
    expect(() =>
      planUndoOpenTransaction(
        {
          householdId: 'household-1',
          fridgeItemId: 'sealed-lot',
          productId: 'mustard',
          locationId: 'fridge',
          type: 'open',
          quantity: 1,
          previousExpiryDate: '2026-12-31',
          undone: true,
          createdAt: '2026-08-05T14:30:00.000Z',
        },
        {
          ...ITEM,
          quantity: 1,
          openedAt: '2026-08-05T14:30:00.000Z',
          expiryDate: '2026-08-10',
        },
        null,
        new Date('2026-08-05T15:00:00.000Z'),
      ),
    ).toThrow('bereits rückgängig');
  });

  it('behandelt eine bereits erzeugte Undo-Gegenbuchung als nicht erneut undo-bar', () => {
    expect(() =>
      planUndoOpenTransaction(
        {
          householdId: 'household-1',
          fridgeItemId: 'sealed-lot',
          productId: 'mustard',
          locationId: 'fridge',
          type: 'open',
          quantity: 1,
          previousExpiryDate: '2026-12-31',
          notes: '[Undone] Öffnung rückgängig gemacht',
          createdAt: '2026-08-05T14:30:00.000Z',
        },
        {
          ...ITEM,
          quantity: 1,
          openedAt: '2026-08-05T14:30:00.000Z',
          expiryDate: '2026-08-10',
        },
        null,
        new Date('2026-08-05T15:00:00.000Z'),
      ),
    ).toThrow('bereits rückgängig');
  });
});

describe('inverseTransactionType', () => {
  it.each([
    ['in', 'out'],
    ['out', 'in'],
    ['waste', 'in'],
    ['open', 'open'],
  ] as const)('%s -> %s', (type, expected) => {
    expect(inverseTransactionType(type)).toBe(expected);
  });
});
