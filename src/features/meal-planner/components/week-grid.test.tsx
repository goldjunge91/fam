import { render, screen, userEvent } from '@testing-library/react-native';

import type { MealPlanEntry } from '../use-meal-plans';
import { weekDates } from '../week';
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

const WEEK = weekDates('2026-08-17');

describe('WeekGrid', () => {
  it('zeigt die drei Mahlzeiten-Slots als Spaltenkoepfe, ohne Snack', async () => {
    await render(
      <WeekGrid
        dates={WEEK}
        entries={[]}
        recipes={[]}
        onDropRecipe={jest.fn()}
        onTapEntry={jest.fn()}
        onTapEmptyCell={jest.fn()}
      />,
    );

    expect(screen.getByText('Frühstück')).toBeOnTheScreen();
    expect(screen.getByText('Mittag')).toBeOnTheScreen();
    expect(screen.getByText('Abend')).toBeOnTheScreen();
    expect(screen.queryByText('Snack')).not.toBeOnTheScreen();
  });

  it('zeigt einen leeren, tippbaren Platzhalter fuer eine Zelle ohne Eintrag', async () => {
    await render(
      <WeekGrid
        dates={WEEK}
        entries={[]}
        recipes={[]}
        onDropRecipe={jest.fn()}
        onTapEntry={jest.fn()}
        onTapEmptyCell={jest.fn()}
      />,
    );

    expect(screen.getAllByText('+').length).toBe(21); // 7 Tage x 3 Slots
  });

  it('zeigt nur so viele Tagesreihen wie `dates` lang ist (Tages-/3-Tage-Ansicht)', async () => {
    await render(
      <WeekGrid
        dates={['2026-08-17', '2026-08-18', '2026-08-19']}
        entries={[]}
        recipes={[]}
        onDropRecipe={jest.fn()}
        onTapEntry={jest.fn()}
        onTapEmptyCell={jest.fn()}
      />,
    );

    expect(screen.getAllByText('+').length).toBe(9); // 3 Tage x 3 Slots
  });

  it('zeigt einen zugeordneten Wochenplan-Eintrag mit Rezepttitel und Portionen', async () => {
    const entry = makeEntry({});
    await render(
      <WeekGrid
        dates={WEEK}
        entries={[entry]}
        recipes={[]}
        onDropRecipe={jest.fn()}
        onTapEntry={jest.fn()}
        onTapEmptyCell={jest.fn()}
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
        dates={WEEK}
        entries={[entry]}
        recipes={[]}
        onDropRecipe={jest.fn()}
        onTapEntry={onTapEntry}
        onTapEmptyCell={jest.fn()}
      />,
    );

    await user.press(screen.getByRole('button', { name: 'Spaghetti Bolognese, 4 Portionen' }));

    expect(onTapEntry).toHaveBeenCalledWith(entry);
  });

  it('ruft onTapEmptyCell mit Datum und Slot auf, wenn eine leere Zelle angetippt wird (#129-Nachtrag)', async () => {
    const user = userEvent.setup();
    const onTapEmptyCell = jest.fn();

    await render(
      <WeekGrid
        dates={WEEK}
        entries={[]}
        recipes={[]}
        onDropRecipe={jest.fn()}
        onTapEntry={jest.fn()}
        onTapEmptyCell={onTapEmptyCell}
      />,
    );

    await user.press(
      screen.getByRole('button', { name: 'Frühstück am Montag, Gericht hinzufügen' }),
    );

    expect(onTapEmptyCell).toHaveBeenCalledWith('2026-08-17', 'breakfast');
  });
});
