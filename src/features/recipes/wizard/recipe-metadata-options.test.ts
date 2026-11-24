import { i18n } from '@/i18n';
import {
  DIETARY_TAG_VALUES,
  DIFFICULTY_VALUES,
  DISH_TYPE_VALUES,
  getDietaryTagOptions,
  getDifficultyOptions,
  getDishTypeOptions,
} from './recipe-metadata-options';

describe('recipe metadata options', () => {
  it('keeps stable values while resolving labels for both supported locales', () => {
    const german = i18n.getFixedT('de');
    const english = i18n.getFixedT('en');

    expect(getDifficultyOptions(german).map((option) => option.value)).toEqual(DIFFICULTY_VALUES);
    expect(getDishTypeOptions(german).map((option) => option.value)).toEqual(DISH_TYPE_VALUES);
    expect(getDietaryTagOptions(german).map((option) => option.value)).toEqual(DIETARY_TAG_VALUES);

    expect(getDifficultyOptions(german).map((option) => option.label)).toEqual([
      'Einfach',
      'Mittel',
      'Schwer',
    ]);
    expect(getDifficultyOptions(english).map((option) => option.label)).toEqual([
      'Easy',
      'Medium',
      'Hard',
    ]);
  });
});
