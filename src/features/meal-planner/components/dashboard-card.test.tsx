import { act, render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import type { CardSize, DashboardCardProps } from '@/features/dashboard/registry';
import { getCards } from '@/features/dashboard/registry';
import { i18n } from '@/i18n';
import './dashboard-card';

let mockMealEntries: {
  id: string;
  entry_date: string;
  meal_slot: 'breakfast' | 'lunch' | 'dinner';
  recipe_title: string;
  recipe_cover_image_path: string | null;
  portions: number;
}[] = [];

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHouseholdId: 'hh-1' }),
}));

jest.mock('@/features/meal-planner/use-meal-plans', () => ({
  useMealPlanEntriesInRange: () => ({ data: mockMealEntries }),
}));

jest.mock('@/features/recipes/data/household-recipe-images', () => ({
  useRecipeCoverUrl: () => ({ data: 'https://example.com/meal.jpg' }),
}));

jest.mock('@/features/recipes/components/recipe-preview-card', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    RecipeArtwork: ({ title }: { title: string }) => <Text>{title}</Text>,
  };
});

jest.mock('@/features/dashboard/components/dashboard-card-shell', () => {
  const { Pressable } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    DashboardCardShell: ({
      onPress,
      onLongPress,
      disabled,
      accessibilityRole,
      accessibilityLabel,
      children,
    }: {
      onPress?: () => void;
      onLongPress?: () => void;
      disabled?: boolean;
      accessibilityRole?: 'button';
      accessibilityLabel: string;
      children: ReactNode;
    }) => (
      <Pressable
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        disabled={disabled}
        onPress={onPress}
        onLongPress={onLongPress}>
        {children}
      </Pressable>
    ),
  };
});

const mealPlannerCard = getCards().find((card) => card.id === 'mealPlanner')?.component;

function renderCard(size: CardSize, props: Partial<DashboardCardProps> = {}) {
  if (!mealPlannerCard) throw new Error('Meal planner card was not registered');
  const Card = mealPlannerCard;
  return render(<Card size={size} {...props} />);
}

function localDateString(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

describe('MealPlanDashboardCard', () => {
  beforeEach(async () => {
    jest.mocked(router.push).mockClear();
    mockMealEntries = [];
    jest.useRealTimers();
    await i18n.changeLanguage('de');
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('zeigt die Wochenstreifen-Illustration in der kleinen leeren Karte und öffnet den Plan', async () => {
    const user = userEvent.setup();
    const onLongPress = jest.fn();
    await renderCard('small', { onLongPress });

    expect(screen.getByTestId('meal-plan-weekly-strip')).toBeOnTheScreen();
    const card = screen.getByRole('button', { name: /Essensplan/ });
    await user.longPress(card);
    expect(onLongPress).toHaveBeenCalledTimes(1);
    await user.press(card);

    expect(router.push).toHaveBeenCalledWith('/meal-planner');
  });

  it('zeigt das passende Tagesmotiv in der großen leeren Karte', async () => {
    jest.useFakeTimers({ now: new Date(2026, 0, 1, 12) });
    await renderCard('large');

    expect(screen.getByTestId('meal-plan-kitchen-note')).toBeOnTheScreen();
    expect(screen.getByTestId('meal-plan-kitchen-note-sheet')).toBeOnTheScreen();
  });

  it('zeigt die nächste Mahlzeit und rotiert bei mehreren anstehenden Gerichten', async () => {
    const today = new Date(2026, 9, 29, 10);
    const date = localDateString(today);
    mockMealEntries = [
      {
        id: 'meal-breakfast',
        entry_date: date,
        meal_slot: 'breakfast',
        recipe_title: 'Apfelpfannkuchen',
        recipe_cover_image_path: 'covers/apfelpfannkuchen.jpg',
        portions: 2,
      },
      {
        id: 'meal-lunch',
        entry_date: date,
        meal_slot: 'lunch',
        recipe_title: 'Linsensuppe',
        recipe_cover_image_path: null,
        portions: 4,
      },
    ];
    jest.useFakeTimers({ now: today });
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await renderCard('large');

    expect(screen.getAllByText('Apfelpfannkuchen')).toHaveLength(2);
    expect(screen.getByText('HEUTE GEPLANT')).toBeOnTheScreen();
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(screen.getAllByText('Linsensuppe')).toHaveLength(2);

    await user.press(screen.getByRole('button', { name: /Essensplan/ }));
    expect(router.push).toHaveBeenCalledWith('/meal-planner');
  });
});
