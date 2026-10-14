import { render, screen, userEvent } from '@testing-library/react-native';
import { View } from 'react-native';

import { dashboardCardSizes } from '@/components/theme/index';
import { i18n } from '@/i18n';
import { JiggleWrapper } from './jiggle-wrapper';

const mockImpactAsync = jest.fn();

jest.mock('@/components/theme/ThemeProvider', () => ({
  useTheme: () => ({ colors: require('@/components/theme/index').Colors.light }),
}));

jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light' },
  impactAsync: (...args: unknown[]) => mockImpactAsync(...args),
}));

const { JiggleWrapper: FallbackJiggleWrapper } = jest.requireActual(
  './jiggle-wrapper.tsx',
) as typeof import('./jiggle-wrapper');

describe('JiggleWrapper', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await i18n.changeLanguage('de');
  });

  it('does not add a second fixed height around a large card', async () => {
    await render(
      <JiggleWrapper isEditing={false} index={0} size="large" onToggleSize={() => {}}>
        <View testID="large-card" style={{ minHeight: dashboardCardSizes.large.height }} />
      </JiggleWrapper>,
    );

    expect(screen.getByTestId('large-card').parent).not.toHaveStyle({
      height: dashboardCardSizes.large.height,
    });
  });

  it('does not add a second fixed height around a small card', async () => {
    await render(
      <JiggleWrapper isEditing={false} index={0} size="small" onToggleSize={() => {}}>
        <View testID="small-card" style={{ minHeight: dashboardCardSizes.small.height }} />
      </JiggleWrapper>,
    );

    expect(screen.getByTestId('small-card').parent).not.toHaveStyle({
      height: dashboardCardSizes.small.height,
    });
  });

  it('runs the iOS editing actions', async () => {
    const user = userEvent.setup();
    const onDelete = jest.fn();
    const onToggleSize = jest.fn();

    await render(
      <JiggleWrapper
        isEditing
        index={3}
        size="small"
        onDelete={onDelete}
        onToggleSize={onToggleSize}>
        <View testID="ios-edit-card" />
      </JiggleWrapper>,
    );

    await user.press(screen.getByRole('button', { name: 'Karte entfernen' }));
    await user.press(screen.getByRole('button', { name: 'Kartengröße umschalten' }));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onToggleSize).toHaveBeenCalledTimes(1);
    expect(mockImpactAsync).toHaveBeenCalledTimes(2);
  });

  it('keeps the iOS edit animation paused without a delete action', async () => {
    const onToggleSize = jest.fn();

    await render(
      <JiggleWrapper isEditing paused index={0} size="large" onToggleSize={onToggleSize}>
        <View testID="ios-paused-card" />
      </JiggleWrapper>,
    );

    expect(screen.getByRole('button', { name: 'Kartengröße umschalten' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Karte entfernen' })).not.toBeOnTheScreen();
    expect(screen.getByTestId('ios-paused-card')).toBeOnTheScreen();
  });

  it('runs the fallback editing actions and haptics', async () => {
    const user = userEvent.setup();
    const onDelete = jest.fn();
    const onToggleSize = jest.fn();

    await render(
      <FallbackJiggleWrapper
        isEditing
        index={2}
        size="large"
        onDelete={onDelete}
        onToggleSize={onToggleSize}>
        <View testID="fallback-large-card" />
      </FallbackJiggleWrapper>,
    );

    await user.press(screen.getByRole('button', { name: 'Karte entfernen' }));
    await user.press(screen.getByRole('button', { name: 'Kartengröße umschalten' }));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onToggleSize).toHaveBeenCalledTimes(1);
    expect(mockImpactAsync).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('fallback-large-card')).toBeOnTheScreen();
  });

  it('keeps the fallback controls consistent while paused and outside edit mode', async () => {
    const onToggleSize = jest.fn();
    const rendered = await render(
      <FallbackJiggleWrapper isEditing paused index={1} size="small" onToggleSize={onToggleSize}>
        <View testID="fallback-small-card" />
      </FallbackJiggleWrapper>,
    );

    expect(screen.getByRole('button', { name: 'Kartengröße umschalten' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Karte entfernen' })).not.toBeOnTheScreen();

    await rendered.rerender(
      <FallbackJiggleWrapper isEditing={false} index={1} size="small" onToggleSize={onToggleSize}>
        <View testID="fallback-small-card" />
      </FallbackJiggleWrapper>,
    );

    expect(screen.queryByRole('button', { name: 'Kartengröße umschalten' })).not.toBeOnTheScreen();
    expect(screen.getByTestId('fallback-small-card').parent).toHaveStyle({
      minHeight: dashboardCardSizes.small.height,
    });
  });
});
