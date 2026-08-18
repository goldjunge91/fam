import type { ReactNode } from 'react';
import { View } from 'react-native';

type WidgetRowProps = {
  children: ReactNode;
};

/**
 * Layout-Wrapper fuer Small-Card-Paare auf dem Dashboard. Rendert
 * Kinder nebeneinander mit dem Standard-Widget-Gap. Ist nach
 * Modul-Filterung nur ein Kind uebrig, nimmt es die volle Breite.
 */
export function WidgetRow({ children }: WidgetRowProps) {
  return <View className="dashboard-widget-row mb-[15px]">{children}</View>;
}
