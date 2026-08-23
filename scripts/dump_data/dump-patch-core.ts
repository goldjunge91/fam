/** Reine Produkt-Diff- und Rekonstruktionslogik der Dump-Delta-Pipeline. */

export type PatchProductRecord = {
  code: string;
  product_name: string;
  brand: string | null;
  quantity: string | null;
  stores: string | null;
  nutriscore: string | null;
  categories_tags: string;
  off_last_modified_at: string | null;
  energy_kcal: number | null;
  fat: number | null;
  saturated_fat: number | null;
  carbohydrates: number | null;
  sugars: number | null;
  proteins: number | null;
  salt: number | null;
};

export type DumpPatch = {
  upserts: PatchProductRecord[];
  deletes: string[];
};

function toMap(products: readonly PatchProductRecord[]): Map<string, PatchProductRecord> {
  return new Map(products.map((p) => [p.code, p]));
}

function isEqual(a: PatchProductRecord, b: PatchProductRecord): boolean {
  return (Object.keys(a) as (keyof PatchProductRecord)[]).every((key) => a[key] === b[key]);
}

/** Liefert neue/geaenderte Produkte und entfernte Produktcodes. */
export function computePatch(
  oldProducts: readonly PatchProductRecord[],
  newProducts: readonly PatchProductRecord[],
): DumpPatch {
  const oldByCode = toMap(oldProducts);
  const upserts: PatchProductRecord[] = [];

  for (const product of newProducts) {
    const previous = oldByCode.get(product.code);
    if (!previous || !isEqual(previous, product)) {
      upserts.push(product);
    }
  }

  const newCodes = new Set(newProducts.map((p) => p.code));
  const deletes = oldProducts.filter((p) => !newCodes.has(p.code)).map((p) => p.code);

  return { upserts, deletes };
}

/** Rekonstruiert deterministisch; spaetere Patches gewinnen pro Produktcode. */
export function reconstructCanonical(
  baseline: readonly PatchProductRecord[],
  patches: readonly DumpPatch[],
): PatchProductRecord[] {
  const state = toMap(baseline);

  for (const patch of patches) {
    for (const product of patch.upserts) {
      state.set(product.code, product);
    }
    for (const code of patch.deletes) {
      state.delete(code);
    }
  }

  return [...state.values()];
}
