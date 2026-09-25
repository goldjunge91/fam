import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import type { AccessibilityRole, StyleProp, ViewStyle } from 'react-native';
import { Pressable } from 'react-native';

import { borderWidth, colorsLight, dashboardCardSizes, withAlpha } from '@/components/theme';

import { DashboardCardShell } from './dashboard-card-shell';

type MockGlassCardProps = {
  children: ReactNode;
  glassStyle: StyleProp<ViewStyle>;
  outerStyle?: StyleProp<ViewStyle>;
  tinted?: boolean;
  shadow?: 'card' | 'prominent' | 'floatingControl';
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
};

jest.mock('@/components/ui/glass-card', () => {
  const React = require('react');
  const { Pressable: NativePressable } = require('react-native');

  return {
    GlassCard: ({
      children,
      glassStyle,
      outerStyle,
      tinted,
      shadow,
      onPress,
      onLongPress,
      disabled,
      accessibilityRole,
      accessibilityLabel,
    }: MockGlassCardProps) =>
      React.createElement(
        NativePressable,
        {
          testID: 'dashboard-card-shell',
          accessibilityHint: shadow,
          style: [
            outerStyle,
            glassStyle,
            tinted
              ? {
                  backgroundColor: require('@/components/theme').withAlpha(
                    require('@/components/theme').colorsLight.accent,
                    0.08,
                  ),
                }
              : undefined,
          ],
          onPress,
          onLongPress,
          disabled,
          accessibilityRole,
          accessibilityLabel,
        },
        children,
      ),
  };
});

describe('DashboardCardShell', () => {
  it.each([
    ['small', dashboardCardSizes.small.height],
    ['large', dashboardCardSizes.large.height],
  ] as const)('setzt die feste %s-Widgetgröße aus dem zentralen Token', async (size, height) => {
    await render(
      <DashboardCardShell
        size={size}
        shadow="prominent"
        accessibilityLabel={`${size} widget`}
        onLongPress={jest.fn()}>
        <Pressable />
      </DashboardCardShell>,
    );

    expect(screen.getByTestId('dashboard-card-shell')).toHaveStyle({
      height,
      padding: dashboardCardSizes[size].padding,
      overflow: 'hidden',
      borderWidth: borderWidth.base,
      borderColor: colorsLight.border,
      backgroundColor: withAlpha(colorsLight.accent, 0.08),
    });
    expect(screen.getByTestId('dashboard-card-shell').props.accessibilityHint).toBe('prominent');
  });

  it('behält Dashboard-Rahmen und Tönung bei einer anderen Schattenauswahl', async () => {
    await render(
      <DashboardCardShell size="small" shadow="card" accessibilityLabel="Widget">
        <Pressable />
      </DashboardCardShell>,
    );

    const card = screen.getByTestId('dashboard-card-shell');
    expect(card.props.accessibilityHint).toBe('card');
    expect(card).toHaveStyle({
      borderColor: colorsLight.border,
      borderWidth: borderWidth.base,
      backgroundColor: withAlpha(colorsLight.accent, 0.08),
    });
  });

  it('reicht die Interaktion an die gemeinsame Card-Basis weiter', async () => {
    const onPress = jest.fn();
    const onLongPress = jest.fn();

    await render(
      <DashboardCardShell
        size="small"
        shadow="prominent"
        accessibilityLabel="Widget"
        onPress={onPress}
        onLongPress={onLongPress}>
        <Pressable />
      </DashboardCardShell>,
    );

    const card = screen.getByTestId('dashboard-card-shell');
    await fireEvent.press(card);
    await fireEvent(card, 'longPress');

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });
});
