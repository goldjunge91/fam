import { act, render } from '@testing-library/react-native';
import {
  AnimatedIcon as AndroidAnimatedIcon,
  AnimatedSplashOverlay as AndroidSplashOverlay,
} from './animated-icon.android';
import {
  AnimatedIcon as WebAnimatedIcon,
  AnimatedSplashOverlay as WebSplashOverlay,
} from './animated-icon.web';

let mockSessionLoading = true;

jest.mock('expo-splash-screen', () => ({ hide: jest.fn(), hideAsync: jest.fn() }));
jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ isLoading: mockSessionLoading }),
}));

describe('platform animated icons', () => {
  beforeEach(() => {
    mockSessionLoading = true;
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the animated Android icon and keeps the native splash overlay empty', async () => {
    const { toJSON } = await render(<AndroidAnimatedIcon />);

    expect(toJSON()).not.toBeNull();
  });

  it('keeps the web splash overlay empty', async () => {
    const { toJSON } = await render(<WebSplashOverlay />);

    expect(toJSON()).toBeNull();
  });

  it('holds the Android splash while loading and hides it after the session is ready', async () => {
    const screen = await render(<AndroidSplashOverlay />);

    expect(screen.getByRole('progressbar')).toBeOnTheScreen();
    mockSessionLoading = false;
    await screen.rerender(<AndroidSplashOverlay />);
    await act(async () => {
      jest.advanceTimersByTime(2400);
    });

    expect(screen.queryByRole('progressbar')).not.toBeOnTheScreen();
  });

  it('renders the animated web icon', async () => {
    const { toJSON } = await render(<WebAnimatedIcon />);

    expect(toJSON()).not.toBeNull();
  });
});
