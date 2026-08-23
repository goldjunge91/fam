import { act, render, screen } from '@testing-library/react-native';
import { ListenerDemo } from './listener-demo';
import { onStatusChange, type StatusListener } from './listener-service';

jest.mock('./listener-service');

const mockOnStatusChange = onStatusChange as jest.MockedFunction<typeof onStatusChange>;

function getCapturedListener(): StatusListener {
  const [listener] = mockOnStatusChange.mock.calls[0];
  return listener;
}

test('REPRODUKTION: sync act() flusht das State-Update aus einem rohen Callback nicht zuverlaessig', async () => {
  await render(<ListenerDemo />);
  const emit = getCapturedListener();

  // Reproduziert den direkten Callback in synchronem act().
  act(() => {
    emit('ready');
  });

  expect(screen.getByText('ready')).toBeOnTheScreen();
});
