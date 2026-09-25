import { STORE_COLOR_PALETTE, STORE_PRESETS } from './store-presets';

describe('Store-Farbwerte', () => {
  it('behält die festgelegten Preset- und Auswahlfarben', () => {
    expect(STORE_PRESETS).toEqual([
      { name: 'REWE', color: '#B5623F' },
      { name: 'Aldi', color: '#5C7396' },
      { name: 'Lidl', color: '#C6A24A' },
      { name: 'Edeka', color: '#748C5B' },
      { name: 'Globus', color: '#4F8580' },
      { name: 'Marktkauf', color: '#A6483D' },
      { name: 'Netto', color: '#8B6B4A' },
      { name: 'Kaufland', color: '#A6483D' },
      { name: 'dm', color: '#8B6F72' },
    ]);
    expect(STORE_COLOR_PALETTE).toEqual([
      '#B5623F',
      '#C08A4E',
      '#C6A24A',
      '#748C5B',
      '#4F8580',
      '#5C7396',
      '#8B6F72',
      '#A6483D',
      '#8B6B4A',
      '#7A7680',
    ]);
  });
});
