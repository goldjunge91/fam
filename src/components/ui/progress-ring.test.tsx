import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { ProgressRing } from './progress-ring';

describe('ProgressRing', () => {
  beforeEach(() => {
    jest.mocked(useReducedMotion).mockReturnValue(false);
  });

  it('renders a labeled value with the empty progress ring when its target is zero', async () => {
    await render(
      <ProgressRing value={45} target={0} label="" displayMode="value" animated={false} />,
    );

    expect(screen.getByRole('progressbar')).toHaveProp('accessibilityLabel', '45 von 0');
    expect(screen.getByText('45')).toBeOnTheScreen();
    expect(screen.getByText('kcal')).toBeOnTheScreen();
  });

  it('renders remaining progress with warning copy after exceeding a custom target', async () => {
    await render(
      <ProgressRing
        value={120}
        target={100}
        preset="compact"
        size={120}
        strokeWidth={8}
        label="Kalorien"
        displayMode="remaining"
        animated={false}
        trackColor="#eee"
      />,
    );

    expect(screen.getByRole('progressbar')).toHaveProp(
      'accessibilityLabel',
      'Kalorien: 120 von 100 kcal, 20 kcal darüber',
    );
    expect(screen.getByText('20')).toBeOnTheScreen();
    expect(screen.getByText('kcal darüber')).toBeOnTheScreen();
  });

  it('renders bounded percentage and count modes', async () => {
    await render(<ProgressRing value={150} target={100} displayMode="percent" animated={false} />);
    expect(screen.getByText('100%')).toBeOnTheScreen();

    await render(<ProgressRing value={7} target={10} displayMode="count" animated={false} />);
    expect(screen.getByText('7')).toBeOnTheScreen();
  });

  it('uses the default value mode and skips timing when reduced motion is enabled', async () => {
    const { rerender } = await render(<ProgressRing value={50} target={100} label="Ziel" />);

    expect(screen.getByText('50')).toBeOnTheScreen();
    expect(screen.getByText('von 100 kcal')).toBeOnTheScreen();
    expect(screen.getByText('50 übrig')).toBeOnTheScreen();

    jest.mocked(useReducedMotion).mockReturnValue(true);
    await rerender(<ProgressRing value={60} target={100} label="Ziel" />);

    expect(screen.getByText('40 übrig')).toBeOnTheScreen();
  });

  it('formats a labeled ring without a positive target', async () => {
    await render(
      <ProgressRing
        value={25}
        target={0}
        label="Wasser"
        displayMode="remaining"
        animated={false}
      />,
    );

    expect(screen.getByRole('progressbar')).toHaveProp('accessibilityLabel', 'Wasser: 25 kcal');
    expect(screen.getByText('25')).toBeOnTheScreen();
  });

  it('allows caller content to replace the center display', async () => {
    await render(
      <ProgressRing value={3} target={0} displayMode="none" animated={false}>
        <Text>Custom Inhalt</Text>
      </ProgressRing>,
    );

    expect(screen.getByText('Custom Inhalt')).toBeOnTheScreen();
  });
});
