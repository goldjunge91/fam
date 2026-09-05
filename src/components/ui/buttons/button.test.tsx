import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';

import { Button } from '@/constants/ui';
import { medium as hapticMedium } from '@/lib/haptics';

jest.mock('@/lib/haptics', () => ({
  medium: jest.fn(),
}));

const reducedMotionMock = Reanimated.useReducedMotion as jest.MockedFunction<
  typeof Reanimated.useReducedMotion
>;
const withSpringSpy = jest.spyOn(Reanimated, 'withSpring');
const withTimingSpy = jest.spyOn(Reanimated, 'withTiming');

const variants = ['primary', 'secondary', 'danger', 'link', 'ghost', 'accent'] as const;
const sizes = ['sm', 'md', 'lg'] as const;

describe('Produkt-Button', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    reducedMotionMock.mockReturnValue(false);
  });

  it.each(variants.flatMap((variant) => sizes.map((size) => ({ variant, size }))))(
    'hält für $variant/$size mindestens 44px Touchhöhe',
    async ({ variant, size }) => {
      await render(<Button title="Aktion" onPress={jest.fn()} variant={variant} size={size} />);

      expect(screen.getByRole('button', { name: 'Aktion' })).toHaveStyle({ minHeight: 44 });
    },
  );

  it('führt Callback und Haptik genau einmal aus', async () => {
    const onPress = jest.fn();
    await render(<Button title="Speichern" onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Speichern' }));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(hapticMedium).toHaveBeenCalledTimes(1);
  });

  it.each([
    { loading: true, disabled: false },
    { loading: false, disabled: true },
  ])('blockiert Aktivierung und Haptik bei $loading/$disabled', async ({ loading, disabled }) => {
    const onPress = jest.fn();
    await render(
      <Button title="Speichern" onPress={onPress} loading={loading} disabled={disabled} />,
    );

    const button = screen.getByRole('button', { name: 'Speichern' });
    await fireEvent.press(button);

    expect(onPress).not.toHaveBeenCalled();
    expect(hapticMedium).not.toHaveBeenCalled();
    expect(button.props.accessibilityState).toEqual({ disabled: true, busy: loading });
  });

  it('überspringt Animationen bei Reduced Motion', async () => {
    reducedMotionMock.mockReturnValue(true);
    await render(<Button title="Aktion" onPress={jest.fn()} />);

    const button = screen.getByRole('button', { name: 'Aktion' });
    await fireEvent(button, 'pressIn');
    await fireEvent(button, 'pressOut');

    expect(withTimingSpy).not.toHaveBeenCalled();
    expect(withSpringSpy).not.toHaveBeenCalled();
  });
});
