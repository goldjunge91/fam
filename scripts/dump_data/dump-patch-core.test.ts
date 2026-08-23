import { computePatch, type PatchProductRecord, reconstructCanonical } from './dump-patch-core';

function product(overrides: Partial<PatchProductRecord> & { code: string }): PatchProductRecord {
  return {
    code: overrides.code,
    product_name: overrides.product_name ?? 'Testprodukt',
    brand: overrides.brand ?? null,
    quantity: overrides.quantity ?? null,
    stores: overrides.stores ?? null,
    nutriscore: overrides.nutriscore ?? null,
    categories_tags: overrides.categories_tags ?? '[]',
    off_last_modified_at: overrides.off_last_modified_at ?? null,
    energy_kcal: overrides.energy_kcal ?? null,
    fat: overrides.fat ?? null,
    saturated_fat: overrides.saturated_fat ?? null,
    carbohydrates: overrides.carbohydrates ?? null,
    sugars: overrides.sugars ?? null,
    proteins: overrides.proteins ?? null,
    salt: overrides.salt ?? null,
  };
}

describe('computePatch', () => {
  it('erkennt ein neues Produkt als Upsert', () => {
    const patch = computePatch([], [product({ code: '1' })]);
    expect(patch.upserts).toEqual([product({ code: '1' })]);
    expect(patch.deletes).toEqual([]);
  });

  it('erkennt ein verändertes Produkt als Upsert', () => {
    const before = [product({ code: '1', product_name: 'Alt' })];
    const after = [product({ code: '1', product_name: 'Neu' })];
    const patch = computePatch(before, after);
    expect(patch.upserts).toEqual([product({ code: '1', product_name: 'Neu' })]);
    expect(patch.deletes).toEqual([]);
  });

  it('lässt ein unverändertes Produkt weder als Upsert noch als Delete auftauchen', () => {
    const before = [product({ code: '1' })];
    const after = [product({ code: '1' })];
    const patch = computePatch(before, after);
    expect(patch.upserts).toEqual([]);
    expect(patch.deletes).toEqual([]);
  });

  it('erkennt ein nicht mehr vorhandenes Produkt als Delete', () => {
    const before = [product({ code: '1' }), product({ code: '2' })];
    const after = [product({ code: '2' })];
    const patch = computePatch(before, after);
    expect(patch.upserts).toEqual([]);
    expect(patch.deletes).toEqual(['1']);
  });

  it('kombiniert Neu/Verändert/Unverändert/Gelöscht in einem Lauf', () => {
    const before = [
      product({ code: '1', product_name: 'Bleibt gleich' }),
      product({ code: '2', product_name: 'Wird geändert' }),
      product({ code: '3', product_name: 'Wird gelöscht' }),
    ];
    const after = [
      product({ code: '1', product_name: 'Bleibt gleich' }),
      product({ code: '2', product_name: 'Geändert' }),
      product({ code: '4', product_name: 'Ist neu' }),
    ];
    const patch = computePatch(before, after);
    expect(patch.upserts.map((p) => p.code).sort()).toEqual(['2', '4']);
    expect(patch.deletes).toEqual(['3']);
  });
});

describe('reconstructCanonical', () => {
  it('wendet eine leere Patchkette auf die Baseline unverändert an', () => {
    const baseline = [product({ code: '1' })];
    expect(reconstructCanonical(baseline, [])).toEqual(baseline);
  });

  it('wendet einen einzelnen Patch (Baseline N -> N+1) korrekt an', () => {
    const baseline = [product({ code: '1' }), product({ code: '2' })];
    const patch = computePatch(baseline, [product({ code: '1' }), product({ code: '3' })]);

    const result = reconstructCanonical(baseline, [patch]);
    expect(result.map((p) => p.code).sort()).toEqual(['1', '3']);
  });

  it('wendet eine vollständige Patchkette über mehrere Versionen in Reihenfolge an', () => {
    const v1 = [product({ code: '1' })];
    const v2 = [product({ code: '1' }), product({ code: '2' })];
    const v3 = [product({ code: '2', product_name: 'Geändert in v3' })];

    const patch1to2 = computePatch(v1, v2);
    const patch2to3 = computePatch(v2, v3);

    const result = reconstructCanonical(v1, [patch1to2, patch2to3]);
    expect(result).toEqual(v3);
  });

  it('spätere Patches überschreiben frühere Upserts für denselben Code', () => {
    const baseline = [product({ code: '1', product_name: 'v0' })];
    const patchA = { upserts: [product({ code: '1', product_name: 'v1' })], deletes: [] };
    const patchB = { upserts: [product({ code: '1', product_name: 'v2' })], deletes: [] };

    const result = reconstructCanonical(baseline, [patchA, patchB]);
    expect(result).toEqual([product({ code: '1', product_name: 'v2' })]);
  });

  it('ein Delete in einem späteren Patch entfernt ein zuvor upsertetes Produkt wieder', () => {
    const baseline: PatchProductRecord[] = [];
    const patchA = { upserts: [product({ code: '1' })], deletes: [] };
    const patchB = { upserts: [], deletes: ['1'] };

    const result = reconstructCanonical(baseline, [patchA, patchB]);
    expect(result).toEqual([]);
  });
});
