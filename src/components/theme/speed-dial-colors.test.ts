import { colorsDark, colorsLight, SPEED_DIAL_COLOR_KEYS, type SpeedDialColorKey } from './index';

describe('SpeedDial theme tokens', () => {
  it('defines one semantic surface key for every SpeedDial action', () => {
    expect(SPEED_DIAL_COLOR_KEYS).toEqual([
      'speedDialPantry',
      'speedDialShopping',
      'speedDialRecipes',
      'speedDialCalories',
    ] satisfies readonly SpeedDialColorKey[]);
  });

  it('provides every SpeedDial surface in both palettes', () => {
    for (const key of SPEED_DIAL_COLOR_KEYS) {
      expect(colorsLight[key]).toMatch(/^#[0-9a-f]{6}$/iu);
      expect(colorsDark[key]).toMatch(/^#[0-9a-f]{6}$/iu);
    }
  });
});
