import { render, screen, userEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { BUTTON_DEPTH } from '@/components/theme/index';
import { FloatingActionButton } from './floating-action-button';

describe('FloatingActionButton', () => {
  beforeEach(() => {
    jest.mocked(useReducedMotion).mockReturnValue(false);
  });

  it('behält die feste runde Touch-Fläche für den globalen Speed-Dial-Trigger', async () => {
    const user = userEvent.setup();
    const onPress = jest.fn();
    await render(
      <FloatingActionButton label="Neu hinzufügen" onPress={onPress}>
        <Text>+</Text>
      </FloatingActionButton>,
    );

    const button = screen.getByRole('button');

    expect(button).toHaveStyle({
      width: 48,
      height: 48,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
    });

    expect(button.props.className).toBeUndefined();
    expect(typeof button.props.style).not.toBe('function');
    await user.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);

    expect(button.parent?.parent?.parent?.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ paddingBottom: BUTTON_DEPTH })]),
    );
  });

  it('reicht Disabled-Zustand und Layout-Override an den Contract weiter', async () => {
    const user = userEvent.setup();
    const onPress = jest.fn();
    await render(
      <FloatingActionButton
        label="Neu hinzufügen"
        onPress={onPress}
        disabled
        style={{ marginTop: 12 }}>
        <Text>+</Text>
      </FloatingActionButton>,
    );

    const button = screen.getByRole('button');
    expect(button.props.accessibilityState).toEqual({ disabled: true });
    await user.press(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(button.parent?.parent?.parent?.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ marginTop: 12 })]),
    );
  });

  it('invokes the action with reduced motion enabled', async () => {
    jest.mocked(useReducedMotion).mockReturnValue(true);
    const user = userEvent.setup();
    const onPress = jest.fn();

    await render(
      <FloatingActionButton label="Neu hinzufügen" onPress={onPress}>
        <Text>+</Text>
      </FloatingActionButton>,
    );
    await user.press(screen.getByRole('button', { name: 'Neu hinzufügen' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
