import { render, screen, userEvent } from '@testing-library/react-native';

import type { MealPlanEntry } from '../use-meal-plans';
import { WeekGrid } from './week-grid';

function makeEntry(overrides: Partial<MealPlanEntry>): MealPlanEntry {
  return {
    id: 'entry-1',
    meal_plan_id: 'plan-1',
    household_id: 'hh-1',
    recipe_id: 'r1',
    entry_date: '2026-08-17',
    meal_slot: 'dinner',
    servings_mode: 'portions',
    portions: 4,
    people_count: null,
    recipe_title: 'Spaghetti Bolognese',
    ...overrides,
  };
}

describe('WeekGrid', () => {
  it('zeigt die vier Mahlzeiten-Slots als Spaltenkoepfe', async () => {
    await render(
      <WeekGrid
        weekStart="2026-08-17"
        entries={[]}
        recipes={[]}
        onDropRecipe={jest.fn()}
        onTapEntry={jest.fn()}
      />,
    );

    expect(screen.getByText('Frühstück')).toBeOnTheScreen();
    expect(screen.getByText('Mittag')).toBeOnTheScreen();
    expect(screen.getByText('Abend')).toBeOnTheScreen();
    expect(screen.getByText('Snack')).toBeOnTheScreen();
  });

  it('zeigt einen leeren Platzhalter fuer eine Zelle ohne Eintrag', async () => {
    await render(
      <WeekGrid
        weekStart="2026-08-17"
        entries={[]}
        recipes={[]}
        onDropRecipe={jest.fn()}
        onTapEntry={jest.fn()}
      />,
    );

    expect(screen.getAllByText('+').length).toBe(28); // 7 Tage x 4 Slots
  });

  it('zeigt einen zugeordneten Wochenplan-Eintrag mit Rezepttitel und Portionen', async () => {
    const entry = makeEntry({});
    await render(
      <WeekGrid
        weekStart="2026-08-17"
        entries={[entry]}
        recipes={[]}
        onDropRecipe={jest.fn()}
        onTapEntry={jest.fn()}
      />,
    );

    expect(screen.getByText('Spaghetti Bolognese')).toBeOnTheScreen();
    expect(screen.getByText('4×')).toBeOnTheScreen();
  });

  it('ruft onTapEntry auf, wenn ein zugeordneter Eintrag angetippt wird', async () => {
    const user = userEvent.setup();
    const entry = makeEntry({});
    const onTapEntry = jest.fn();

    await render(
      <WeekGrid
        weekStart="2026-08-17"
        entries={[entry]}
        recipes={[]}
        onDropRecipe={jest.fn()}
        onTapEntry={onTapEntry}
      />,
    );

    await user.press(screen.getByRole('button', { name: 'Spaghetti Bolognese, 4 Portionen' }));

    expect(onTapEntry).toHaveBeenCalledWith(entry);
  });
});
