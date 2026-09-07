import {
  calculateOpenedExpiryDate,
  estimateOpenedExpiryDays,
  getVacuumExpiryDays,
} from './opened-expiry';

const OPENED_AT = new Date(2026, 7, 5, 14, 30);

describe('estimateOpenedExpiryDays', () => {
  it.each([
    ['Salz', 365],
    ['Zucker', 365],
    ['Honig', 365],
    ['Essig', 365],
    ['Bicarbonat', 365],
    ['Backpulver', 90],
    ['Backtriebmittel', 90],
    ['Gin', 365],
    ['Vanilleextrakt', 365],
    ['Tee', 365],
    ['Kräutertee', 365],
    ['Kaffee', 180],
    ['Öl', 180],
    ['Sojasauce', 90],
    ['Paniermehl', 90],
    ['Panko', 90],
  ])('wendet ortsunabhängige Regeln an: %s', (name, expected) => {
    expect(estimateOpenedExpiryDays({ name, locationKind: 'fridge' })).toBe(expected);
    expect(estimateOpenedExpiryDays({ name, locationKind: 'freezer' })).toBe(expected);
    expect(estimateOpenedExpiryDays({ name, locationKind: 'pantry' })).toBe(expected);
  });

  it.each([
    ['Brot', 90],
    ['Gebäck', 90],
    ['Biscuit', 90],
    ['Gemüse-Mix', 180],
    ['Obst-Mix', 180],
    ['Frische Pasta', 60],
    ['Pasta fresca', 60],
    ['Gnocchi', 60],
    ['Eis', 60],
    ['Lachsfilet', 60],
    ['Meeresfrüchte', 60],
    ['Geflügel', 90],
    ['Rinderbraten', 90],
    ['Hackfleisch', 90],
    ['Wurst', 60],
    ['Butter', 180],
    ['Sahne', 30],
    ['Käse', 30],
    ['Mozzarella', 30],
    ['Brühe', 60],
  ])('wendet die vollständige Tiefkühler-Matrix an: %s', (name, expected) => {
    expect(estimateOpenedExpiryDays({ name, locationKind: 'freezer' })).toBe(expected);
  });

  it.each([
    ['Pasta', 365],
    ['Reis', 365],
    ['Mehl', 180],
    ['Linsen', 365],
    ['Kekse', 60],
    ['Müsli', 60],
    ['Marmelade', 60],
    ['Schokolade', 60],
    ['Brot', 4],
    ['Tomatensauce', 5],
    ['Sahne', 3],
    ['Joghurt', 2],
    ['Milch', 1],
    ['Käse', 2],
    ['Kartoffeln', 30],
    ['Karotten', 14],
  ])('wendet die vollständige Speisekammer-Matrix an: %s', (name, expected) => {
    expect(estimateOpenedExpiryDays({ name, locationKind: 'pantry' })).toBe(expected);
  });

  it.each([
    ['Frische Milch', 3],
    ['H-Milch', 7],
    ['Joghurt', 7],
    ['Mozzarella', 3],
    ['Frischkäse', 7],
    ['Parmesan', 21],
    ['Ricotta', 7],
    ['Käse', 7],
    ['Butter', 30],
    ['Sahne', 7],
    ['Kochschinken', 3],
    ['Salami', 7],
    ['Fleisch', 2],
    ['Frischer Fisch', 1],
    ['Passata', 5],
    ['Nudelsalat', 3],
    ['Reis-Salat', 3],
    ['Pasta-Salat', 3],
    ['Getreide-Salat', 3],
    ['Couscous-Salat', 3],
    ['Salat', 4],
    ['Saft', 5],
    ['Bier', 3],
    ['Wein', 5],
    ['Dosenfisch', 3],
    ['Dosenfisch in Öl', 3],
    ['Fisch in Öl', 3],
    ['Beeren', 3],
    ['Avocado', 3],
    ['Banane', 3],
    ['Apfel', 5],
    ['Orange', 7],
    ['Grapefruit', 7],
    ['Zucchini', 5],
    ['Brokkoli', 4],
    ['Zwiebeln', 6],
    ['Karotten', 7],
    ['Kartoffeln', 4],
    ['Knoblauch', 14],
    ['Piadina', 3],
    ['Schnittbrot', 4],
  ])('wendet die vollständige Kühlschrank-Matrix an: %s', (name, expected) => {
    expect(estimateOpenedExpiryDays({ name, locationKind: 'fridge' })).toBe(expected);
  });

  it('verwendet bei unbekanntem Namen und unbekannter Kategorie je Lagerort einen deterministischen Fallback', () => {
    expect(
      estimateOpenedExpiryDays({
        name: 'Unbekannt',
        category: 'unbekannt',
        locationKind: 'freezer',
      }),
    ).toBe(60);
    expect(
      estimateOpenedExpiryDays({
        name: 'Unbekannt',
        category: 'unbekannt',
        locationKind: 'pantry',
      }),
    ).toBe(30);
    expect(
      estimateOpenedExpiryDays({
        name: 'Unbekannt',
        category: 'unbekannt',
        locationKind: 'fridge',
      }),
    ).toBe(3);
    expect(estimateOpenedExpiryDays({ name: '', locationKind: null })).toBe(30);
  });

  it.each([
    ['KÜHLSCHRANK', 3],
    ['frigo', 30],
    ['TIEFKÜHLER', 60],
    ['freezer', 60],
    ['dispensa', 30],
    ['Vorrat', 30],
    ['unbekannter Lagerort', 30],
  ])(
    'normalisiert dokumentierte und unbekannte Lagerorte deterministisch: %s',
    (locationKind, expected) => {
      expect(estimateOpenedExpiryDays({ name: 'Unbekannt', locationKind })).toBe(expected);
    },
  );

  it('verwendet Kategorie-Fallbacks nur nach einem Namenstreffer und bleibt dabei lagerortabhängig', () => {
    expect(
      estimateOpenedExpiryDays({ name: 'Unbekannt', category: 'fish', locationKind: 'freezer' }),
    ).toBe(60);
    expect(
      estimateOpenedExpiryDays({ name: 'Unbekannt', category: 'dairy', locationKind: 'fridge' }),
    ).toBe(7);
    expect(
      estimateOpenedExpiryDays({ name: 'Unbekannt', category: 'fruit', locationKind: 'fridge' }),
    ).toBe(5);
    expect(
      estimateOpenedExpiryDays({ name: 'Joghurt', category: 'meat', locationKind: 'fridge' }),
    ).toBe(7);
    expect(
      estimateOpenedExpiryDays({ name: 'Joghurt', category: 'oil', locationKind: 'fridge' }),
    ).toBe(7);
  });

  it('nimmt bei überlappenden Produktnamen den ersten dokumentierten Treffer', () => {
    expect(estimateOpenedExpiryDays({ name: 'Hackfleisch', locationKind: 'freezer' })).toBe(90);
    expect(estimateOpenedExpiryDays({ name: 'Frische Milch', locationKind: 'fridge' })).toBe(3);
    expect(estimateOpenedExpiryDays({ name: 'Frischkäse', locationKind: 'fridge' })).toBe(7);
  });
});

describe('getVacuumExpiryDays', () => {
  it('behält den geprüften Grundwert bei', () => {
    expect(getVacuumExpiryDays(5)).toBe(5);
    expect(getVacuumExpiryDays(90)).toBe(90);
  });

  it('behält auch große geprüfte Grundwerte bei', () => {
    expect(getVacuumExpiryDays(365)).toBe(365);
  });
});

describe('fachlich geprüfte Sicherheitsgrenzen', () => {
  it('verwendet konservative Werte statt der ungeprüften EverShelf-Platzhalter', () => {
    expect(estimateOpenedExpiryDays({ name: 'Honig', locationKind: 'pantry' })).toBe(365);
    expect(estimateOpenedExpiryDays({ name: 'Backpulver', locationKind: 'pantry' })).toBe(90);
    expect(estimateOpenedExpiryDays({ name: 'Hähnchen', locationKind: 'freezer' })).toBe(90);
    expect(estimateOpenedExpiryDays({ name: 'Lachsfilet', locationKind: 'freezer' })).toBe(60);
    expect(estimateOpenedExpiryDays({ name: 'Joghurt', locationKind: 'fridge' })).toBe(7);
    expect(estimateOpenedExpiryDays({ name: 'Unbekannt', locationKind: 'fridge' })).toBe(3);
  });

  it('wendet keine pauschale Vakuum-Verlängerung an', () => {
    expect(getVacuumExpiryDays(5)).toBe(5);
    expect(getVacuumExpiryDays(90)).toBe(90);
  });
});

describe('calculateOpenedExpiryDate', () => {
  it('berechnet das Datum aus Öffnungsdatum und Regelwert', () => {
    expect(
      calculateOpenedExpiryDate({ name: 'Joghurt', locationKind: 'fridge', openedAt: OPENED_AT }),
    ).toBe('2026-08-12');
  });

  it('verlässt sich bei Vakuumverpackung auf denselben geprüften Wert', () => {
    expect(
      calculateOpenedExpiryDate({
        name: 'Joghurt',
        locationKind: 'fridge',
        openedAt: OPENED_AT,
        vacuumSealed: true,
      }),
    ).toBe('2026-08-12');
  });

  it('behält ein manuell gesetztes früheres Datum als Sicherheitsgrenze', () => {
    expect(
      calculateOpenedExpiryDate({
        name: 'Joghurt',
        locationKind: 'fridge',
        openedAt: OPENED_AT,
        currentExpiryDate: '2026-08-07',
        expiryUserSet: true,
      }),
    ).toBe('2026-08-07');
  });

  it('schützt ein manuell gesetztes späteres Datum ebenfalls vor automatischer Ersetzung', () => {
    expect(
      calculateOpenedExpiryDate({
        name: 'Joghurt',
        locationKind: 'fridge',
        openedAt: OPENED_AT,
        currentExpiryDate: '2026-12-31',
        expiryUserSet: true,
      }),
    ).toBe('2026-12-31');
  });

  it('schützt das manuell gesetzte Datum auch bei einem späteren Öffnen-Pfad', () => {
    expect(
      calculateOpenedExpiryDate({
        name: 'Joghurt',
        locationKind: 'fridge',
        openedAt: new Date(2026, 7, 10, 9),
        currentExpiryDate: '2026-08-20',
        expiryUserSet: true,
      }),
    ).toBe('2026-08-20');
  });

  it('fällt bei einem ungültigen manuellen Datum auf die Berechnung zurück', () => {
    expect(
      calculateOpenedExpiryDate({
        name: 'Joghurt',
        locationKind: 'fridge',
        openedAt: OPENED_AT,
        currentExpiryDate: 'nicht-datum',
        expiryUserSet: true,
      }),
    ).toBe('2026-08-12');
  });

  it('verändert das übergebene Öffnungsdatum nicht', () => {
    const openedAt = new Date(OPENED_AT);

    calculateOpenedExpiryDate({ name: 'Joghurt', locationKind: 'fridge', openedAt });

    expect(openedAt.getTime()).toBe(OPENED_AT.getTime());
  });
});
