import { render, screen, userEvent } from '@testing-library/react-native';
import { Text } from 'react-native';

import { MIN_TOUCH_SIZE } from '@/constants/ui';
import { RecipeBottomSheet } from './recipe-bottom-sheet';

describe('RecipeBottomSheet', () => {
  it('ruft onClose beim Tap auf den Schliessen-Knopf auf', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    await render(
      <RecipeBottomSheet visible onClose={onClose} title="Zutaten">
        <Text>Inhalt</Text>
      </RecipeBottomSheet>,
    );

    await user.press(screen.getByRole('button', { name: 'Schließen' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // fam-7ndw: der sichtbare 32er-Kreis sitzt in einem 44er-Container. Die
  // Mindestflaeche wird am antippbaren Pressable geprueft, nicht am Wrapper.
  it('haelt den Schliessen-Knopf auf mindestens 44 Punkten Touchflaeche', async () => {
    await render(
      <RecipeBottomSheet visible onClose={jest.fn()} title="Zutaten">
        <Text>Inhalt</Text>
      </RecipeBottomSheet>,
    );

    const closeButton = screen.getByRole('button', { name: 'Schließen' });

    expect(closeButton).toHaveStyle({ width: MIN_TOUCH_SIZE, height: MIN_TOUCH_SIZE });
    expect(MIN_TOUCH_SIZE).toBeGreaterThanOrEqual(44);
  });
});
