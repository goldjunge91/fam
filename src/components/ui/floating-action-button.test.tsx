import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { BUTTON_DEPTH } from '@/components/theme/index';
import { FloatingActionButton } from './floating-action-button';

describe('FloatingActionButton', () => {
  it('behält die feste runde Touch-Fläche für den globalen Speed-Dial-Trigger', async () => {
    await render(
      <FloatingActionButton label="Neu hinzufügen" onPress={jest.fn()}>
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

    expect(button.parent?.parent?.parent?.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ paddingBottom: BUTTON_DEPTH })]),
    );
  });

  it('reicht Disabled-Zustand und Layout-Override an den Contract weiter', async () => {
    await render(
      <FloatingActionButton
        label="Neu hinzufügen"
        onPress={jest.fn()}
        disabled
        style={{ marginTop: 12 }}>
        <Text>+</Text>
      </FloatingActionButton>,
    );

    const button = screen.getByRole('button');
    expect(button.props.accessibilityState).toEqual({ disabled: true });
    expect(button.parent?.parent?.parent?.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ marginTop: 12 })]),
    );
  });
});
