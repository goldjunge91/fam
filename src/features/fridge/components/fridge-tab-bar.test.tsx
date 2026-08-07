import { getIconForLocation } from './fridge-tab-bar';

describe('FridgeTabBar & getIconForLocation', () => {
  it('sollte passende Icons basierend auf Kind und Name zurückgeben', () => {
    expect(getIconForLocation('fridge', 'Kühlschrank')).toBe('🫙');
    expect(getIconForLocation('freezer', 'Tiefkühltruhe')).toBe('❄️');
    expect(getIconForLocation('pantry', 'Abstellkammer')).toBe('🥫');
    expect(getIconForLocation('custom', 'Gefrierfach')).toBe('❄️');
    expect(getIconForLocation('custom', 'Vorratsschrank')).toBe('🥫');
    expect(getIconForLocation('custom', 'Keller')).toBe('📦');
    expect(getIconForLocation(null, null)).toBe('📦');
  });
});
