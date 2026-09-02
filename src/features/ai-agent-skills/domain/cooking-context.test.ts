import {
  buildPerishableInventoryContext,
  type InventoryContextLot,
} from '@/features/ai-agent-skills/domain/cooking-context';

const LOTS: InventoryContextLot[] = [
  {
    id: 'lot-later',
    householdId: 'household-1',
    productId: 'product-spinach',
    name: 'Spinat',
    quantity: 1,
    unit: 'package',
    expiryDate: '2026-09-08',
    useByDate: null,
    locationKind: 'fridge',
    perishability: 'perishable',
    deletedAt: null,
  },
  {
    id: 'lot-sooner',
    householdId: 'household-1',
    productId: 'product-feta',
    name: 'Feta',
    quantity: 0.5,
    unit: 'package',
    expiryDate: '2026-09-03',
    useByDate: null,
    locationKind: 'fridge',
    perishability: 'perishable',
    deletedAt: null,
  },
  {
    id: 'lot-pantry',
    householdId: 'household-1',
    productId: null,
    name: 'Reis',
    quantity: 1,
    unit: 'package',
    expiryDate: null,
    useByDate: null,
    locationKind: 'pantry',
    perishability: 'non_perishable',
    deletedAt: null,
  },
  {
    id: 'lot-unknown',
    householdId: 'household-1',
    productId: null,
    name: 'Unbekanntes Lebensmittel',
    quantity: 1,
    unit: 'piece',
    expiryDate: null,
    useByDate: null,
    locationKind: 'fridge',
    perishability: 'unknown',
    deletedAt: null,
  },
  {
    id: 'lot-other-household',
    householdId: 'household-2',
    productId: null,
    name: 'Fremder Bestand',
    quantity: 1,
    unit: 'piece',
    expiryDate: '2026-09-01',
    useByDate: null,
    locationKind: 'fridge',
    perishability: 'perishable',
    deletedAt: null,
  },
  {
    id: 'lot-deleted',
    householdId: 'household-1',
    productId: null,
    name: 'Gelöschter Bestand',
    quantity: 1,
    unit: 'piece',
    expiryDate: '2026-09-01',
    useByDate: null,
    locationKind: 'fridge',
    perishability: 'perishable',
    deletedAt: '2026-08-31T12:00:00.000Z',
  },
];

describe('buildPerishableInventoryContext', () => {
  it('sends only active perishable lots from the requested household in expiry order', () => {
    const context = buildPerishableInventoryContext(LOTS, {
      householdId: 'household-1',
      fetchedAt: '2026-09-01T10:00:00.000Z',
    });

    expect(context).toEqual({
      source: 'inventory',
      fetchedAt: '2026-09-01T10:00:00.000Z',
      lots: [
        {
          lotId: 'lot-sooner',
          productId: 'product-feta',
          normalizedName: 'Feta',
          quantity: 0.5,
          unit: 'package',
          bestBefore: '2026-09-03',
          useBy: null,
          storage: 'fridge',
        },
        {
          lotId: 'lot-later',
          productId: 'product-spinach',
          normalizedName: 'Spinat',
          quantity: 1,
          unit: 'package',
          bestBefore: '2026-09-08',
          useBy: null,
          storage: 'fridge',
        },
      ],
    });
  });

  it('keeps equal-date ordering stable without using model input', () => {
    const context = buildPerishableInventoryContext(
      [
        { ...LOTS[0], id: 'lot-z', expiryDate: null, name: 'Zucchini' },
        { ...LOTS[0], id: 'lot-a', expiryDate: null, name: 'Apfel' },
      ],
      { householdId: 'household-1', fetchedAt: '2026-09-01T10:00:00.000Z' },
    );

    expect(context.lots.map((lot) => lot.lotId)).toEqual(['lot-a', 'lot-z']);
  });
});
