import { render, screen, userEvent } from '@testing-library/react-native';

import { PressableCallbackProbe } from './pressable-callback-probe';

describe('PressableCallbackProbe', () => {
  it('renders an accessible probe button and registers taps', async () => {
    const user = userEvent.setup();
    await render(<PressableCallbackProbe />);

    const button = screen.getByRole('button', { name: 'Pressed-State testen' });
    expect(button).toBeOnTheScreen();

    await user.press(button);

    expect(screen.getByText('Erkannte Tipps: 1')).toBeOnTheScreen();
  });
});
