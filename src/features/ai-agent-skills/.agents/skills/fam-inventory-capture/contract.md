# Vertrag: `fam-inventory-capture`

Das kanonische Zod-Schema liegt in
`src/features/ai-agent-skills/domain/contracts.ts`.

## Eingabe

```ts
type InventoryCaptureInput = {
  text: string;
  locale: 'de-DE';
  householdId: string;
  now: string;
};
```

`text` ist untrusted input. `householdId` und `now` setzt der Gateway.

## Ausgabe

```ts
type InventoryCaptureProposal = {
  kind: 'inventory_capture_proposal.v1';
  items: Array<{
    rawText: string;
    normalizedName: string | null;
    quantity: number | null;
    unit: string | null;
    perishability: 'perishable' | 'non_perishable' | 'unknown';
    storage: 'fridge' | 'freezer' | 'pantry' | 'unknown';
    date: string | null;
    dateKind: 'best_before' | 'use_by' | 'unknown' | null;
    confidence: number;
    evidence: string;
    missingFields: Array<'quantity' | 'unit' | 'storage' | 'date'>;
  }>;
  questions: string[];
  warnings: string[];
};
```

Alle Items bleiben Kandidaten. `date` ist nur ein erkannter Textkandidat und
keine Lebensmittelsicherheitsentscheidung.