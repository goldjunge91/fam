import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import type { RecipeDetail } from '../../hooks/use-recipes';
import { CookingModeFinished } from './cooking-mode-finished';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
}));

jest.mock('@/components/theme/ThemeProvider', () => ({
  useTheme: () => ({ colors: { backgroundSoft: '#eee' } }),
}));

jest.mock('@/constants/ui', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable: NativePressable, Text: NativeText } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Press: ({
      children,
      onPress,
      accessibilityRole,
    }: {
      children: ReactNode;
      onPress: () => void;
      accessibilityRole?: 'button';
    }) => React.createElement(NativePressable, { accessibilityRole, onPress }, children),
    Txt: ({ children }: { children: ReactNode }) => React.createElement(NativeText, null, children),
  };
});

jest.mock('../recipe-rating-sheet', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable: NativePressable, Text: NativeText } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return {
    RecipeRatingSheet: ({ visible, onClose }: { visible: boolean; onClose: () => void }) =>
      visible
        ? React.createElement(
            NativePressable,
            {
              accessibilityRole: 'button',
              accessibilityLabel: 'Bewertung schließen',
              onPress: onClose,
            },
            React.createElement(NativeText, null, 'Bewertung'),
          )
        : null,
  };
});

jest.mock('./cooking-mode-finish-action', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable: NativePressable, Text: NativeText } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return {
    CookingModeFinishAction: ({ title, onPress }: { title: string; onPress: () => void }) =>
      React.createElement(
        NativePressable,
        { accessibilityRole: 'button', accessibilityLabel: title, onPress },
        React.createElement(NativeText, null, title),
      ),
  };
});

jest.mock('./cooking-mode-shell', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const {
    Pressable: NativePressable,
    Text: NativeText,
    View: NativeView,
  } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    CookingModeShell: ({
      children,
      title,
      backLabel,
      onBack,
    }: {
      children: ReactNode;
      title: string;
      backLabel: string;
      onBack?: () => void;
    }) =>
      React.createElement(
        NativeView,
        null,
        React.createElement(NativeText, null, title),
        onBack
          ? React.createElement(
              NativePressable,
              { accessibilityRole: 'button', accessibilityLabel: backLabel, onPress: onBack },
              React.createElement(NativeText, null, backLabel),
            )
          : null,
        children,
      ),
  };
});

const recipe: RecipeDetail['recipe'] = {
  id: 'recipe-1',
  household_id: 'household-1',
  title: 'Linsensuppe',
  instructions: null,
  cover_image_path: null,
  cook_time_minutes: null,
  difficulty: null,
  dish_types: [],
  dietary_tags: [],
  hashtags: [],
  default_servings: 2,
  created_by: null,
  created_at: null,
};

beforeEach(() => {
  (router.push as jest.Mock).mockClear();
  (router.back as jest.Mock).mockClear();
});

it('führt nach dem Kochen zu Wiegen, Tagebuch, Bewertung und Schließen', async () => {
  const user = userEvent.setup();
  const onBack = jest.fn();
  await render(<CookingModeFinished recipe={recipe} onBack={onBack} />);

  expect(screen.getByText('Guten Appetit!')).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Zubereitete Gruppen wiegen' }));
  expect(router.push).toHaveBeenCalledWith({
    pathname: '/recipe/log',
    params: { id: 'recipe-1', mode: 'weigh' },
  });
  await user.press(screen.getByRole('button', { name: 'Ins Tagebuch eintragen' }));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/recipe/log', params: { id: 'recipe-1' } });
  await user.press(screen.getByRole('button', { name: 'Rezept bewerten' }));
  expect(screen.getByText('Bewertung')).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Bewertung schließen' }));
  expect(screen.queryByText('Bewertung')).not.toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Zurück zum letzten Schritt' }));
  expect(onBack).toHaveBeenCalledTimes(1);
  await user.press(screen.getByText('Ohne Angaben schließen'));
  expect(router.back).toHaveBeenCalledTimes(1);
});

it('überspringt Bewertung und Zusatzaktionen bei Katalogrezepten', async () => {
  await render(<CookingModeFinished recipe={recipe} onBack={jest.fn()} isCatalog />);

  expect(
    screen.queryByRole('button', { name: 'Zubereitete Gruppen wiegen' }),
  ).not.toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Rezept bewerten' })).not.toBeOnTheScreen();
  expect(screen.queryByText('Bewertung')).not.toBeOnTheScreen();
  expect(screen.getByText('Ohne Angaben schließen')).toBeOnTheScreen();
});
