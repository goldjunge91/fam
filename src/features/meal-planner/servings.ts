/** Personen werden per App-Einstellung in kanonisch gespeicherte Portionen umgerechnet. */

export const DEFAULT_PORTIONS_PER_PERSON = 1.25;

/** Rechnet positive Personenzahlen auf zwei Nachkommastellen in Portionen um. */
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

/** Loest die Formulareingabe konsistent in die drei DB-Spalten auf. */
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
