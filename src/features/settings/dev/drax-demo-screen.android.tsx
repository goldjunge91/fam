import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  DraxProvider,
  type GridItemSpan,
  packGrid,
  SortableContainer,
  SortableItem,
  useDraxContext,
  useSortableList,
} from 'react-native-drax';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/components/layout/screen';
import { space } from '@/components/theme/index';
import { Button, Surface, Txt } from '@/constants/ui';

// Source: nuclearpasta/react-native-drax, docs-site/docs/examples/mixed-grid.mdx.
// Keep Drax's grid/hover mechanics intact; only labels and theme use fam primitives.
const INITIAL_ITEMS = [
  { id: 'A', colSpan: 2, rowSpan: 2 },
  { id: 'B', colSpan: 1, rowSpan: 1 },
  { id: 'C', colSpan: 1, rowSpan: 1 },
  { id: 'D', colSpan: 1, rowSpan: 1 },
  { id: 'E', colSpan: 1, rowSpan: 1 },
  { id: 'F', colSpan: 2, rowSpan: 1 },
  { id: 'G', colSpan: 1, rowSpan: 1 },
  { id: 'H', colSpan: 1, rowSpan: 2 },
  { id: 'I', colSpan: 1, rowSpan: 1 },
  { id: 'J', colSpan: 1, rowSpan: 1 },
  { id: 'K', colSpan: 2, rowSpan: 2 },
  { id: 'L', colSpan: 1, rowSpan: 1 },
  { id: 'M', colSpan: 1, rowSpan: 1 },
  { id: 'N', colSpan: 2, rowSpan: 1 },
  { id: 'O', colSpan: 1, rowSpan: 1 },
  { id: 'P', colSpan: 1, rowSpan: 1 },
];
const COLUMNS = 4;
const GAP = 8;
const PADDING = 16;
type DemoItem = (typeof INITIAL_ITEMS)[number];

function getItemSpan(item: DemoItem): GridItemSpan {
  return { colSpan: item.colSpan, rowSpan: item.rowSpan };
}

export function DraxDemoScreen() {
  const [withScreen, setWithScreen] = useState(false);
  const [generation, setGeneration] = useState(0);
  const insets = useSafeAreaInsets();
  const controls = (
    <View style={styles.controls}>
      <Button title="Zurück" variant="secondary" size="sm" onPress={() => router.back()} />
      <Button
        title={withScreen ? 'Ohne Screen' : 'Mit Screen'}
        variant="secondary"
        size="sm"
        onPress={() => setWithScreen((previous) => !previous)}
      />
      <Button
        title="Reset"
        variant="secondary"
        size="sm"
        onPress={() => setGeneration((previous) => previous + 1)}
      />
    </View>
  );
  const grid = <DemoGrid key={`${withScreen}:${generation}`} />;

  if (withScreen) {
    return (
      <Screen title="Drax-Demo" scroll={false} padded={false} applyBottomPadding={false}>
        {controls}
        {grid}
      </Screen>
    );
  }
  return (
    <Surface style={[styles.fill, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <Txt variant="subheading" style={styles.heading}>
        Drax-Demo: Basis
      </Txt>
      {controls}
      {grid}
    </Surface>
  );
}

function DemoGrid() {
  const [data, setData] = useState(INITIAL_ITEMS);
  const [diagnostic, setDiagnostic] = useState('A kurz halten: Messung erscheint hier.');
  const scrollRef = useRef<ScrollView>(null);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const gridWidth = width - insets.left - insets.right - PADDING * 2;
  const cellSize = (gridWidth - (COLUMNS - 1) * GAP) / COLUMNS;
  const sortable = useSortableList({
    data,
    numColumns: COLUMNS,
    keyExtractor: (item) => item.id,
    getItemSpan,
    animationConfig: 'spring',
    onReorder: ({ data: nextData }) => setData(nextData),
  });
  const layout = useMemo(() => {
    const packing = packGrid(sortable.data.length, COLUMNS, (index) =>
      getItemSpan(sortable.data[index]),
    );
    return {
      height: packing.totalRows * (cellSize + GAP) - GAP,
      positions: packing.positions.map((position, index) => {
        const item = sortable.data[index];
        return {
          left: position.col * (cellSize + GAP),
          top: position.row * (cellSize + GAP),
          width: item.colSpan * cellSize + (item.colSpan - 1) * GAP,
          height: item.rowSpan * cellSize + (item.rowSpan - 1) * GAP,
        };
      }),
    };
  }, [sortable.data, cellSize]);

  return (
    <DraxProvider>
      <View style={[styles.fill, styles.grid]}>
        <SortableContainer sortable={sortable} scrollRef={scrollRef} style={styles.fill}>
          <ScrollView
            ref={scrollRef}
            onScroll={sortable.onScroll}
            onContentSizeChange={sortable.onContentSizeChange}
            scrollEventThrottle={16}>
            <View style={{ height: layout.height }}>
              {sortable.data.map((item, index) => (
                <SortableItem
                  key={sortable.stableKeyExtractor(item, index)}
                  sortable={sortable}
                  index={index}
                  accessibilityLabel={`Kachel ${item.id}, ${item.colSpan} mal ${item.rowSpan}`}
                  style={[styles.tile, layout.positions[index]]}>
                  <DemoTile item={item} index={index} onDiagnostic={setDiagnostic} />
                </SortableItem>
              ))}
            </View>
          </ScrollView>
        </SortableContainer>
      </View>
      <Surface tone="surface" pointerEvents="none" style={styles.diagnostic}>
        <Txt variant="caption">{diagnostic}</Txt>
      </Surface>
    </DraxProvider>
  );
}

function DemoTile({
  item,
  index,
  onDiagnostic,
}: {
  item: DemoItem;
  index: number;
  onDiagnostic: (message: string) => void;
}) {
  const tileRef = useRef<View>(null);
  const { rootViewRef, rootOffsetSV, hoverPositionSV, draggedIdSV } = useDraxContext();

  useEffect(() => {
    // The default hover mounts a second copy of these children. Original tiles
    // mount before a drag exists, so only the hover copy schedules a measurement.
    if (!draggedIdSV.value) return;
    const timer = setTimeout(() => {
      if (!draggedIdSV.value) return;
      rootViewRef.current?.measureInWindow((rootX, rootY) => {
        tileRef.current?.measureInWindow((x, y, width, height) => {
          if (!draggedIdSV.value) return;
          const root = rootOffsetSV.value;
          const hover = hoverPositionSV.value;
          const point = (a: number, b: number) => `${Math.round(a)}, ${Math.round(b)}`;
          const message = [
            `${item.id}: Hover-Messung (x, y)`,
            `Root Fenster: ${point(rootX, rootY)} | Drax: ${point(root.x, root.y)}`,
            `Hover relativ: ${point(hover.x, hover.y)}`,
            `Erwartet: ${point(rootX + hover.x, rootY + hover.y)} | Ist: ${point(x, y)}`,
            `Größe: ${point(width, height)}`,
          ].join('\n');
          onDiagnostic(message);
          console.info('[Drax demo]', message);
        });
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [draggedIdSV, hoverPositionSV, item.id, onDiagnostic, rootOffsetSV, rootViewRef]);

  return (
    <View ref={tileRef} collapsable={false} style={styles.fill}>
      <Surface tone={index % 2 === 0 ? 'soft' : 'surface'} style={styles.tileContent}>
        <Txt variant="subheading">{item.id}</Txt>
        <Txt variant="caption">
          {item.colSpan}×{item.rowSpan}
        </Txt>
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  heading: { paddingHorizontal: PADDING },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, padding: PADDING },
  grid: { paddingHorizontal: PADDING },
  tile: { position: 'absolute' },
  tileContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  diagnostic: { position: 'absolute', left: PADDING, right: PADDING, bottom: 0, padding: space.sm },
});
