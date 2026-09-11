import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { FloatingActionButton } from './floating-action-button';

describe('FloatingActionButton', () => {
  it('behält die feste runde Touch-Fläche für den globalen Speed-Dial-Trigger', async () => {
    await render(
      <FloatingActionButton label="Neu hinzufügen" onPress={jest.fn()}>
        <Text>+</Text>
      </FloatingActionButton>,
    );

    expect(screen.getByRole('button')).toHaveStyle({
      width: 72,
      height: 72,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
    });
  });
});
