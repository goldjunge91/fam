import { act, render, screen, userEvent } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { useReducedMotion } from 'react-native-reanimated';
import { ReanimatedShowcase } from './showcase-reanimated';

jest.mock('react-native-reanimated', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    default: { View },
    interpolate: jest.fn((value: number, input: number[], output: number[]) =>
      value === input[0] ? output[0] : output[1],
    ),
    useAnimatedStyle: (factory: () => object) => factory(),
    useDerivedValue: (factory: () => number) => ({ value: factory() }),
    useReducedMotion: jest.fn(() => false),
    useSharedValue: (value: number) => ({ value }),
    withSequence: (...values: number[]) => values,
    withSpring: (value: number) => value,
    withTiming: (value: number) => value,
    __react: React,
  };
});

jest.mock('react-native-gesture-handler', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const gestures: {
    onUpdate?: (event: { translationX: number; translationY: number }) => void;
    onEnd?: () => void;
  }[] = [];
  return {
    Gesture: {
      Pan: () => {
        const gesture: (typeof gestures)[number] = {};
        gestures.push(gesture);
        return {
          onUpdate(callback: NonNullable<typeof gesture.onUpdate>) {
            gesture.onUpdate = callback;
            return this;
          },
          onEnd(callback: NonNullable<typeof gesture.onEnd>) {
            gesture.onEnd = callback;
            return this;
          },
        };
      },
    },
    GestureDetector: ({ children }: { children: ReactNode }) =>
      React.createElement(View, null, children),
    __gestures: gestures,
  };
});

jest.mock('react-native-worklets', () => ({
  scheduleOnRN: (callback: () => void) => callback(),
}));

jest.mock('@/components/ui/filter-chip-bar', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text, View } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return {
    FilterChipBar: ({
      options,
      onSelect,
    }: {
      options: { label: string; value: string }[];
      onSelect: (value: string) => void;
    }) =>
      React.createElement(
        View,
        null,
        ...options.map(({ label, value }) =>
          React.createElement(
            Pressable,
            {
              key: value,
              accessibilityRole: 'button',
              accessibilityLabel: label,
              onPress: () => onSelect(value),
            },
            React.createElement(Text, null, label),
          ),
        ),
      ),
  };
});

jest.mock('@/constants/ui', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text, View } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Button: ({ title, onPress }: { title: string; onPress: () => void }) =>
      React.createElement(
        Pressable,
        { accessibilityRole: 'button', accessibilityLabel: title, onPress },
        React.createElement(Text, null, title),
      ),
    Surface: ({ children }: { children: ReactNode }) => React.createElement(View, null, children),
    Txt: ({ children }: { children: ReactNode }) => React.createElement(Text, null, children),
  };
});

jest.mock('./showcase-shared', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text, View } = jest.requireActual<typeof import('react-native')>('react-native');
  const Section = ({ title, children }: { title?: string; children: ReactNode }) =>
    React.createElement(
      View,
      null,
      title ? React.createElement(Text, null, title) : null,
      children,
    );
  return {
    CodeSample: ({ children }: { children: ReactNode }) =>
      React.createElement(Text, null, children),
    ContractIntro: Section,
    ExamplePair: ({ correct, incorrect }: { correct: ReactNode; incorrect: ReactNode }) =>
      React.createElement(View, null, correct, incorrect),
    Subsection: Section,
  };
});

const gestureHarness = jest.requireMock('react-native-gesture-handler') as {
  __gestures: {
    onUpdate?: (event: { translationX: number; translationY: number }) => void;
    onEnd?: () => void;
  }[];
};

beforeEach(() => {
  jest.clearAllMocks();
  gestureHarness.__gestures.length = 0;
  jest.mocked(useReducedMotion).mockReturnValue(false);
});

it('covers all motion modes, drag callbacks, derived progress, and composed animation', async () => {
  const user = userEvent.setup();
  await render(<ReanimatedShowcase />);

  expect(screen.getByText('Reanimated und Worklets')).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Animation starten' }));
  await user.press(screen.getByRole('button', { name: 'Timing' }));
  await user.press(screen.getByRole('button', { name: 'Animation starten' }));
  await user.press(screen.getByRole('button', { name: 'Sequence' }));
  await user.press(screen.getByRole('button', { name: 'Animation starten' }));
  expect(screen.getByText('Ausgeführt: 3')).toBeOnTheScreen();
  expect(screen.getByText('Aktiver Modus: sequence')).toBeOnTheScreen();

  const gesture = gestureHarness.__gestures.at(-1);
  await act(async () => {
    gesture?.onUpdate?.({ translationX: 12, translationY: -8 });
    gesture?.onEnd?.();
  });
  expect(screen.getByText('UI-Thread → RN: Drop verarbeitet')).toBeOnTheScreen();

  for (const progress of [
    '33% synchronisiert',
    '66% synchronisiert',
    '100% synchronisiert',
    '0% synchronisiert',
  ]) {
    await user.press(screen.getByRole('button', { name: 'Fortschritt weiterführen' }));
    expect(screen.getByText(progress)).toBeOnTheScreen();
  }

  await user.press(screen.getByRole('button', { name: 'Kombination animieren' }));
  expect(screen.getByText('STATISCH + DYNAMISCH')).toBeOnTheScreen();
});

it('keeps motion at its resting value when reduced motion is enabled', async () => {
  jest.mocked(useReducedMotion).mockReturnValue(true);
  const user = userEvent.setup();
  await render(<ReanimatedShowcase />);

  await user.press(screen.getByRole('button', { name: 'Animation starten' }));

  expect(screen.getByText('Ausgeführt: 1')).toBeOnTheScreen();
  expect(
    screen.getByText('Reduced Motion ist aktiv: zeitbasierte Übergänge werden verkürzt.'),
  ).toBeOnTheScreen();
});
