import { DEFAULT_PORTIONS_PER_PERSON, peopleToPortions, resolveServings } from './servings';

describe('peopleToPortions', () => {
  it('rechnet mit dem Standardfaktor 1,25 Portionen/Person', () => {
    expect(peopleToPortions(4)).toBe(5);
  });

  it('rechnet mit einem konfigurierten Faktor', () => {
    expect(peopleToPortions(4, 1.5)).toBe(6);
  });

  it('rundet auf 2 Nachkommastellen', () => {
    expect(peopleToPortions(3, 1.25)).toBe(3.75);
  });

  it('wirft bei nicht-positiver Personenzahl', () => {
    expect(() => peopleToPortions(0)).toThrow();
    expect(() => peopleToPortions(-2)).toThrow();
  });

  it('wirft bei nicht-positivem Faktor', () => {
    expect(() => peopleToPortions(4, 0)).toThrow();
  });

  it('exportiert den dokumentierten Standardfaktor', () => {
    expect(DEFAULT_PORTIONS_PER_PERSON).toBe(1.25);
  });
});

describe('resolveServings', () => {
  it('Portionen-Modus: uebernimmt die Eingabe direkt, people_count bleibt null', () => {
    expect(resolveServings({ mode: 'portions', portions: 3 })).toEqual({
      servings_mode: 'portions',
      portions: 3,
      people_count: null,
    });
  });

  it('Personen-Modus: rechnet um und rundet people_count auf ganze Personen', () => {
    expect(resolveServings({ mode: 'people', peopleCount: 4 })).toEqual({
      servings_mode: 'people',
      portions: 5,
      people_count: 4,
    });
  });

  it('Personen-Modus: respektiert einen uebergebenen Faktor', () => {
    expect(resolveServings({ mode: 'people', peopleCount: 4, portionsPerPerson: 1 })).toEqual({
      servings_mode: 'people',
      portions: 4,
      people_count: 4,
    });
  });

  it('Portionen-Modus wirft bei 0 oder negativen Portionen', () => {
    expect(() => resolveServings({ mode: 'portions', portions: 0 })).toThrow();
    expect(() => resolveServings({ mode: 'portions', portions: -1 })).toThrow();
  });
});
