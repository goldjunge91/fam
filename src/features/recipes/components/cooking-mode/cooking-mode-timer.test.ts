import type { RecipeStep } from '../../data/use-recipes';
import { getCookingTimerDurationSeconds } from './cooking-mode-timer';

const step: RecipeStep = {
  id: 'step-1',
  recipe_id: 'recipe-1',
  position: 0,
  text: 'Wasser 1 Minute kochen',
  image_path: null,
  timer_minutes: null,
  ingredientIds: [],
};

describe('getCookingTimerDurationSeconds', () => {
  it('verwendet die Zeitangabe aus dem Schritttext als Fallback', () => {
    expect(getCookingTimerDurationSeconds(step)).toBe(60);
  });

  it('bevorzugt die explizite Dauer vor der Zeitangabe im Schritttext', () => {
    expect(getCookingTimerDurationSeconds({ ...step, timer_minutes: 2 })).toBe(120);
  });
});
