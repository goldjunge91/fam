import { act, render, screen } from '@testing-library/react-native';
import { ListenerDemo } from './listener-demo';
import { onStatusChange, type StatusListener } from './listener-service';

jest.mock('./listener-service');

const mockOnStatusChange = onStatusChange as jest.MockedFunction<typeof onStatusChange>;

function getCapturedListener(): StatusListener {
  const [listener] = mockOnStatusChange.mock.calls[0];
  return listener;
}

test('FIX: await act(async () => ...) flusht das State-Update zuverlaessig', async () => {
  await render(<ListenerDemo />);
  const emit = getCapturedListener();

  await act(async () => {
    emit('ready');
  });

  expect(screen.getByText('ready')).toBeOnTheScreen();
});
