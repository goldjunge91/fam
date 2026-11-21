import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ReactNode } from 'react';

import { getCards } from '@/features/dashboard/registry';
import './chef-koch-dashboard-card';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'dashboard.cards.chefKoch.title': 'Aus Vorrat kochen',
        'dashboard.cards.chefKoch.description': 'Passende Mahlzeiten aus eurem Bestand.',
        'dashboard.cards.chefKoch.accessibility': 'Chef-Koch aus dem Vorrat öffnen',
      })[key] ?? key,
  }),
}));
jest.mock('@/components/icons/fam-icon', () => ({
  FamIcon: () => null,
}));
jest.mock('@/features/dashboard/components/dashboard-card-shell', () => {
  const React = require('react') as typeof import('react');
  const { Pressable } = require('react-native') as typeof import('react-native');
  return {
    DashboardCardShell: ({
      children,
      onPress,
      accessibilityLabel,
    }: {
      children: ReactNode;
      onPress?: () => void;
      accessibilityLabel: string;
    }) =>
      React.createElement(
        Pressable,
        { accessibilityRole: 'button', accessibilityLabel, onPress },
        children,
      ),
  };
});

beforeEach(() => {
  (router.push as jest.Mock).mockClear();
});

test('registers an accessible dashboard entry that opens Chef-Koch', async () => {
  const card = getCards().find((candidate) => candidate.id === 'chefKoch');
  expect(card).toBeDefined();
  expect(card?.moduleKey).toBe('recipes');

  const user = userEvent.setup();
  if (card === undefined) throw new Error('chefKoch card was not registered');
  const Card = card.component;
  await render(<Card size="small" />);

  await user.press(screen.getByRole('button', { name: 'Chef-Koch aus dem Vorrat öffnen' }));
  expect(router.push).toHaveBeenCalledWith('/chef-koch');
  expect(screen.getByText('Aus Vorrat kochen')).toBeOnTheScreen();
});

test('shows the description twice in the large dashboard layout', async () => {
  const card = getCards().find((candidate) => candidate.id === 'chefKoch');
  if (card === undefined) throw new Error('chefKoch card was not registered');
  const Card = card.component;
  await render(<Card size="large" />);

  expect(screen.getAllByText('Passende Mahlzeiten aus eurem Bestand.')).toHaveLength(2);
});
