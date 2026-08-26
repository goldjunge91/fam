import type { ReactNode } from 'react';
import { View } from 'react-native';

type WidgetRowProps = {
  children: ReactNode;
};

export function WidgetRow({ children }: WidgetRowProps) {
  return <View className="dashboard-widget-row mb-[15px]">{children}</View>;
}
