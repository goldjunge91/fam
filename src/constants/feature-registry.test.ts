import { getSpeedDialOptions } from './feature-registry';

describe('feature registry SpeedDial configuration', () => {
  it('transports semantic theme keys instead of UI color values', () => {
    expect(getSpeedDialOptions().map((option) => option.backgroundToken)).toEqual([
      'speedDialPantry',
      'speedDialShopping',
      'speedDialCalories',
      'speedDialRecipes',
    ]);
  });
});
