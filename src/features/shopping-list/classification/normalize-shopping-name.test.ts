import { normalizeShoppingName } from './normalize-shopping-name';

describe('normalizeShoppingName (Issue 223 Bug-Verifizierung)', () => {
  it('zerreißt Lehnwörter wegen zu striktem Regex', () => {
    // 1. "Café": Das 'é' fällt weg, Rest wird abgebrochen
    // Tatsächlich: ['caf']
    expect(normalizeShoppingName('Café')).toEqual(['café']);

    // 2. "Pâtisserie": Das 'â' fällt weg, das Wort wird in der Mitte zerrissen
    // Tatsächlich: ['p', 'tisserie']
    expect(normalizeShoppingName('Pâtisserie')).toEqual(['pâtisserie']);

    // 3. "Crème fraîche": 'è' und 'î' fallen weg
    // Tatsächlich: ['cr', 'me', 'fra', 'che']
    expect(normalizeShoppingName('Crème fraîche')).toEqual(['crème', 'fraîche']);
  });
});
