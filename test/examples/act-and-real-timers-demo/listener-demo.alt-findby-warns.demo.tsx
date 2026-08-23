import { render, screen } from '@testing-library/react-native';
import { ListenerDemo } from './listener-demo';
import { onStatusChange, type StatusListener } from './listener-service';

jest.mock('./listener-service');

const mockOnStatusChange = onStatusChange as jest.MockedFunction<typeof onStatusChange>;

function getCapturedListener(): StatusListener {
  const [listener] = mockOnStatusChange.mock.calls[0];
  return listener;
}

// findByText wartet ohne manuelles act().
test('ALTERNATIVE: findByText ohne jedes manuelle act()', async () => {
  await render(<ListenerDemo />);
  const emit = getCapturedListener();

  emit('ready');

  expect(await screen.findByText('ready')).toBeOnTheScreen();
});
