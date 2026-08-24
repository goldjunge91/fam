/**
 * Reine Diff-/Rekonstruktionslogik für die CI-Delta-Pipeline (#223 Paket 5,
 * Abschnitt 13 in `docs/issue#223_V2.md`). Getrennt von der eigentlichen
 * SQLite-/GitHub-Release-Orchestrierung (`build-canonical-update.ts`), damit
 * der Kern ohne Dateisystem/Netz testbar ist — dasselbe Muster wie
 * `evaluate-categories-core.ts`.
 */

/** Eine Zeile aus `products` (Dump Schema 3), unverändert für Vergleich/Speicherung. */
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
  /** Front-Produktfoto (Schema 3) — URL bei images.openfoodfacts.org, `null` ohne Bild. */
  image_url: string | null;
};

export type DumpPatch = {
  upserts: PatchProductRecord[];
  /** Codes gelöschter bzw. nicht mehr Deutschland zugeordneter Produkte. */
  deletes: string[];
};

function toMap(products: readonly PatchProductRecord[]): Map<string, PatchProductRecord> {
  return new Map(products.map((p) => [p.code, p]));
}

/** Deep-Equal über alle Felder — ein Produkt zaehlt nur als geaendert, wenn sich wirklich etwas unterscheidet. */
function isEqual(a: PatchProductRecord, b: PatchProductRecord): boolean {
  return (Object.keys(a) as (keyof PatchProductRecord)[]).every((key) => a[key] === b[key]);
}

/**
 * Vergleicht den alten und den neuen vollständigen Deutschland-Produktbestand
 * (Schritte 5–8 im Updateablauf, Abschnitt 13) und liefert Upserts (neu oder
 * verändert) sowie Deletes (nicht mehr vorhanden oder nicht mehr Deutschland
 * zugeordnet — beides zeigt sich hier gleich: der Code fehlt im neuen
 * Bestand). Unveränderte Produkte tauchen in keiner der beiden Listen auf.
 */
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

/**
 * Wendet eine Patchkette in Reihenfolge auf eine Baseline an (Abschnitt 13,
 * "deterministische Rekonstruktion aus Monats-Baseline + vollständiger
 * Patchkette"). Spätere Patches gewinnen bei überlappenden Codes — sowohl
 * bei einem erneuten Upsert als auch bei einem Delete nach einem Upsert.
 */
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
