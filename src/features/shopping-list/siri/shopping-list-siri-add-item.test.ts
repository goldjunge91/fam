import { parseSiriShoppingItemName } from './shopping-list-siri-add-item';

describe('parseSiriShoppingItemName', () => {
  it('trimmt einen einzelnen Deep-Link-Parameter', () => {
    expect(parseSiriShoppingItemName('  Milch  ')).toBe('Milch');
  });

  it('verwendet beim mehrfachen Query-Parameter nur den ersten Wert', () => {
    expect(parseSiriShoppingItemName(['Brot', 'Milch'])).toBe('Brot');
  });

  it('verwirft leere oder fehlende Werte', () => {
    expect(parseSiriShoppingItemName('   ')).toBeNull();
    expect(parseSiriShoppingItemName(undefined)).toBeNull();
  });
});
