/**
 * Reine Funktionen fuer die Portionen-/Personen-Eingabe (#130). Kein I/O —
 * analog zu `../recipes/nutrition.ts`.
 *
 * Entscheidung (docs/plans/phase-2-4-brainstorm.md, Abschnitt #15,
 * 2026-08-12): Personen-Modus rechnet ueber einen Umrechnungsfaktor
 * (Standard 1,25 Portionen/Person) in Portionen um. Der Faktor ist eine
 * App-Einstellung (siehe settings.ts in diesem Feature), keine DB-Spalte —
 * `meal_plan_entries.portions` speichert immer den bereits umgerechneten,
 * kanonischen Wert.
 */

export const DEFAULT_PORTIONS_PER_PERSON = 1.25;

/**
 * Personenzahl -> Portionenzahl, gerundet auf 2 Nachkommastellen (wie
 * `meal_plan_entries.portions numeric(6,2)` in 14_meal_plans.sql). Wirft bei
 * nicht-positiven Eingaben, statt eine unbrauchbare Zeile stillschweigend
 * durchzureichen — ein Formular kann das vor dem Speichern selbst abfangen.
 */
export function peopleToPortions(
  peopleCount: number,
  portionsPerPerson: number = DEFAULT_PORTIONS_PER_PERSON,
): number {
  if (!Number.isFinite(peopleCount) || peopleCount <= 0) {
    throw new Error('peopleCount muss positiv sein');
  }
  if (!Number.isFinite(portionsPerPerson) || portionsPerPerson <= 0) {
    throw new Error('portionsPerPerson muss positiv sein');
  }
  return Math.round(peopleCount * portionsPerPerson * 100) / 100;
}

export type ServingsMode = 'portions' | 'people';

export type ServingsInput =
  | { mode: 'portions'; portions: number }
  | { mode: 'people'; peopleCount: number; portionsPerPerson?: number };

export type ResolvedServings = {
  servings_mode: ServingsMode;
  portions: number;
  people_count: number | null;
};

/**
 * Loest eine Formular-Eingabe in die Spaltenwerte auf, die
 * `meal_plan_entries` erwartet (#128-Schema: `servings_mode`/`portions`/
 * `people_count`, mit der Konsistenz-Check-Constraint
 * `meal_plan_entries_people_count_matches_mode`).
 */
export function resolveServings(input: ServingsInput): ResolvedServings {
  if (input.mode === 'portions') {
    if (!Number.isFinite(input.portions) || input.portions <= 0) {
      throw new Error('portions muss positiv sein');
    }
    return { servings_mode: 'portions', portions: input.portions, people_count: null };
  }

  const portions = peopleToPortions(input.peopleCount, input.portionsPerPerson);
  return {
    servings_mode: 'people',
    portions,
    people_count: Math.round(input.peopleCount),
  };
}
