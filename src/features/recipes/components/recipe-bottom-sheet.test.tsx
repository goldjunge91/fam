import { render, screen, userEvent } from '@testing-library/react-native';
import { Text } from 'react-native';

import { MIN_TOUCH_SIZE } from '@/constants/ui';
import { RecipeBottomSheet } from './recipe-bottom-sheet';

describe('RecipeBottomSheet', () => {
  it('rendert keinen Inhalt, wenn das Sheet verborgen ist', async () => {
    await render(
      <RecipeBottomSheet visible={false} onClose={jest.fn()} title="Zutaten">
        <Text>Inhalt</Text>
      </RecipeBottomSheet>,
    );

    expect(screen.queryByText('Inhalt')).not.toBeOnTheScreen();
  });

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

  it('rendert in der nativen Modal-Huelle mit Tastaturausgleich', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalExpoOs = process.env.EXPO_OS;
    process.env.NODE_ENV = 'production';
    process.env.EXPO_OS = 'ios';

    try {
      await render(
        <RecipeBottomSheet visible avoidKeyboard onClose={jest.fn()} title="Zutaten">
          <Text>Inhalt mit Tastaturausgleich</Text>
        </RecipeBottomSheet>,
      );

      expect(screen.getByText('Inhalt mit Tastaturausgleich')).toBeOnTheScreen();
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      process.env.EXPO_OS = originalExpoOs;
    }
  });

  it('rendert die Tastaturhülle ohne iOS-Verhalten auf Android', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalExpoOs = process.env.EXPO_OS;
    process.env.NODE_ENV = 'production';
    process.env.EXPO_OS = 'android';

    try {
      await render(
        <RecipeBottomSheet visible avoidKeyboard onClose={jest.fn()} title="Zutaten">
          <Text>Android Inhalt</Text>
        </RecipeBottomSheet>,
      );

      expect(screen.getByText('Android Inhalt')).toBeOnTheScreen();
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      process.env.EXPO_OS = originalExpoOs;
    }
  });
});
