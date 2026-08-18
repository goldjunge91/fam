import { createContext, type ReactNode, useContext } from 'react';
import { type SharedValue, useSharedValue } from 'react-native-reanimated';

export type DashboardDragContextValue = {
  activeDragIndex: SharedValue<number>;
  hoverIndex: SharedValue<number>;
  dragTranslationY: SharedValue<number>;
  isDraggingShared: SharedValue<boolean>;
  rowHeight: number;
};

const DashboardDragContext = createContext<DashboardDragContextValue | null>(null);

export const DEFAULT_DASHBOARD_ROW_HEIGHT = 155;

export function DashboardDragProvider({
  children,
  rowHeight = DEFAULT_DASHBOARD_ROW_HEIGHT,
}: {
  children: ReactNode;
  rowHeight?: number;
}) {
  const activeDragIndex = useSharedValue(-1);
  const hoverIndex = useSharedValue(-1);
  const dragTranslationY = useSharedValue(0);
  const isDraggingShared = useSharedValue(false);

  return (
    <DashboardDragContext.Provider
      value={{
        activeDragIndex,
        hoverIndex,
        dragTranslationY,
        isDraggingShared,
        rowHeight,
      }}>
      {children}
    </DashboardDragContext.Provider>
  );
}

export function useDashboardDrag() {
  return useContext(DashboardDragContext);
}
