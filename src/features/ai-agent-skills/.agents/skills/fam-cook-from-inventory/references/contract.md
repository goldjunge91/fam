# Vertrag: `fam-cook-from-inventory`

Die kanonischen Zod-Schemas liegen in
`src/features/ai-agent-skills/domain/contracts.ts`.

## Eingabe

```ts
type CookFromInventoryInput = {
  householdId: string;
  servings: number | null;
  maxMinutes: number | null;
  dietaryPattern: string | null;
  allergies: string[];
};
```

Der Gateway setzt `householdId` und liest die Lots selbst. Der Skill erhält
keine vom Client gelieferte Zutatenliste.

## Kanonischer Kontext

```ts
type PerishableInventoryContext = {
  source: 'inventory';
  fetchedAt: string;
  lots: Array<{
    lotId: string;
    productId: string | null;
    normalizedName: string;
    quantity: number | null;
    unit: string | null;
    bestBefore: string | null;
    useBy: string | null;
    storage: 'fridge' | 'freezer' | 'pantry' | 'unknown';
  }>;
};
```

Nur aktive Lots des Haushalts mit expliziter Verderblichkeitsklassifikation
werden aufgenommen. `unknown` wird nicht stillschweigend zu
`perishable`. Private Trackingwerte sind ausgeschlossen.

## Ausgabe

```ts
type CookingSuggestion = {
  kind: 'cooking_suggestion.v1';
  recipeId: string;
  title: string;
  usedLots: string[];
  missingIngredients: string[];
  estimatedMinutes: number | null;
  servings: number | null;
  rationale: string;
  constraintChecks: {
    allergies: 'pass';
    dietaryPattern: 'pass' | 'unknown';
    time: 'pass' | 'unknown';
  };
};
```

`allergies: 'pass'` ist absichtlich nicht optional. Ein nicht belegbarer
Allergie-Check darf keinen Vorschlag passieren lassen.
