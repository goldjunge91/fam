import type { ReactNode } from 'react';
import Animated from 'react-native-reanimated';

import { DASHBOARD_LAYOUT_TRANSITION } from './drag-context';

type WidgetRowProps = {
  children: ReactNode;
  stacked?: boolean;
};

export function WidgetRow({ children, stacked = false }: WidgetRowProps) {
  return (
    <Animated.View
      layout={DASHBOARD_LAYOUT_TRANSITION}
      className={`${stacked ? 'dashboard-widget-row-stacked' : 'dashboard-widget-row'} mb-[15px]`}>
      {children}
    </Animated.View>
  );
}
