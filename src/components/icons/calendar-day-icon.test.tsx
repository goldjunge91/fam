import { act, render, screen } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { CalendarDayIcon } from './calendar-day-icon';

let mockDay = 15;
let mockStateListener: ((state: AppStateStatus) => void) | undefined;
const mockRemove = jest.fn();

describe('CalendarDayIcon', () => {
  beforeEach(() => {
    mockDay = 15;
    mockStateListener = undefined;
    mockRemove.mockClear();
    jest.useFakeTimers();
    jest.spyOn(Date.prototype, 'getDate').mockImplementation(() => mockDay);
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
      mockStateListener = listener;
      return { remove: mockRemove };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('updates on foreground and midnight sync, and releases its listener on unmount', async () => {
    const { unmount } = await render(<CalendarDayIcon size={48} />);
    expect(screen.getByLabelText('Essensplan, heute der 15.')).toBeOnTheScreen();

    mockDay = 16;
    await act(async () => {
      mockStateListener?.('background');
    });
    expect(screen.getByLabelText('Essensplan, heute der 15.')).toBeOnTheScreen();

    await act(async () => {
      mockStateListener?.('active');
    });
    expect(screen.getByLabelText('Essensplan, heute der 16.')).toBeOnTheScreen();

    mockDay = 0;
    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });
    expect(screen.getByLabelText('Essensplan, heute der 0.')).toBeOnTheScreen();

    await unmount();
    expect(mockRemove).toHaveBeenCalledTimes(1);
  });
});
