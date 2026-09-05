import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import { space } from '@/components/theme/index';
import { DASHBOARD_LAYOUT_TRANSITION } from './drag-context';

type WidgetRowProps = {
  children: ReactNode;
  stacked?: boolean;
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: space.md,
    marginBottom: 15,
  },
  stacked: {
    flexDirection: 'column',
    gap: 15,
    marginBottom: 15,
  },
});

export function WidgetRow({ children, stacked = false }: WidgetRowProps) {
  return (
    <Animated.View
      layout={DASHBOARD_LAYOUT_TRANSITION}
      style={stacked ? styles.stacked : styles.row}>
      {children}
    </Animated.View>
  );
}
