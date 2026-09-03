import { render, screen, waitFor } from '@testing-library/react-native';
import * as SplashScreen from 'expo-splash-screen';

import { AnimatedSplashOverlay } from './animated-icon';

let mockSessionLoading = true;
let mockScheduleOnRNCalls = 0;

function mockScheduleOnRN(callback: (...args: never[]) => void, ...args: never[]) {
  mockScheduleOnRNCalls += 1;
  callback(...args);
}

jest.mock('expo-splash-screen', () => ({
  hide: jest.fn(),
  hideAsync: jest.fn(),
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ isLoading: mockSessionLoading }),
}));

jest.mock('react-native-reanimated', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');

  const AnimatedView = ({ children, ...props }: React.ComponentProps<typeof View>) =>
    React.createElement(View, props, children);

  class Keyframe {
    duration() {
      return this;
    }

    withCallback() {
      return this;
    }
  }

  return {
    __esModule: true,
    default: { View: AnimatedView },
    cancelAnimation: jest.fn(),
    Easing: {
      cubic: {},
      elastic: () => ({}),
      inOut: () => ({}),
      out: () => ({}),
    },
    Keyframe,
    interpolateColor: () => '#F8F4EF',
    useAnimatedStyle: (callback: () => object) => callback(),
    useSharedValue: (value: number) => {
      const ref = React.useRef({ value });
      return ref.current;
    },
    withRepeat: (animation: unknown) => animation,
    withSequence: (...animations: unknown[]) => animations.at(-1),
    withTiming: (value: number, _config: unknown, callback?: (finished: boolean) => void) => {
      callback?.(true);
      return value;
    },
  };
});

jest.mock('react-native-worklets', () => ({
  scheduleOnRN: mockScheduleOnRN,
}));

describe('AnimatedSplashOverlay', () => {
  beforeEach(() => {
    mockSessionLoading = true;
    mockScheduleOnRNCalls = 0;
    jest.clearAllMocks();
  });

  it('versteckt den nativen Splash sofort und bleibt während des Ladens sichtbar', async () => {
    await render(<AnimatedSplashOverlay />);

    expect(SplashScreen.hide).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('progressbar')).toBeOnTheScreen();
  });

  it('hält die auffällige Animation sichtbar, bevor es ausblendet', async () => {
    const view = await render(<AnimatedSplashOverlay />);

    mockSessionLoading = false;
    await view.rerender(<AnimatedSplashOverlay />);

    expect(screen.getByRole('progressbar')).toBeOnTheScreen();

    await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeOnTheScreen(), {
      timeout: 3000,
    });
    expect(mockScheduleOnRNCalls).toBe(0);
  });
});
