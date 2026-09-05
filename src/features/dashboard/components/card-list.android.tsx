import * as Haptics from 'expo-haptics';
import { type ReactElement, useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  DraxProvider,
  type GridItemSpan,
  packGrid,
  SortableContainer,
  SortableItem,
  useSortableList,
} from 'react-native-drax';

import { radius, space } from '@/components/theme/index';
import { Button, Surface, Txt } from '@/constants/ui';
import { useSession } from '@/features/auth/session-provider';
import { type CardSize, type DashboardCardDef, getCards } from '@/features/dashboard/registry';
import { useCardSizes } from '@/features/dashboard/use-card-sizes';
import { useModulePreferences } from '@/features/settings/module-preferences';
import { JiggleWrapper } from './jiggle-wrapper';
import { WidgetRow } from './widget-row';

// Registriert Dashboard-Karten beim Laden.
import '@/features/calorie-tracking/components/dashboard-card';
import '@/features/meal-planner/components/dashboard-card';
import '@/features/inventory/components/dashboard-card';
import '@/features/shopping-list/components/ui/dashboard-card';
import '@/features/dashboard/components/streak-dashboard-card';

const styles = StyleSheet.create({
  emptyCard: {
    minHeight: 180,
    padding: space.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.lg,
    borderRadius: radius.xl,
  },
  centeredText: {
    textAlign: 'center',
  },
  emptyAction: {
    marginTop: space.xs,
  },
  editingList: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

const TOGGLE: Record<CardSize, CardSize> = { large: 'small', small: 'large' };

type CardListProps = {
  isEditing?: boolean;
  onEnterEditMode?: () => void;
  onOpenGallery?: () => void;
  onDragStateChange?: (isDragging: boolean) => void;
};

export function CardList({
  isEditing = false,
  onEnterEditMode,
  onOpenGallery,
  onDragStateChange,
}: CardListProps) {
  const { width, fontScale } = useWindowDimensions();
  const stackSmallCards = width < 360 || fontScale >= 1.2;
  const { session } = useSession();
  const userId = session?.user.id;
  const { data: modules } = useModulePreferences(userId);
  const { getSize, setSize, hideCard, isCardHidden, getOrderedCards, reorderCards } =
    useCardSizes();

  const handleToggleSize = useCallback(
    (cardId: string, currentSize: CardSize) => {
      setSize(cardId, TOGGLE[currentSize]);
    },
    [setSize],
  );

  const handleLongPress = useCallback(
    (cardId: string, currentSize: CardSize) => {
      if (!isEditing && onEnterEditMode) {
        onEnterEditMode();
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        handleToggleSize(cardId, currentSize);
      }
    },
    [isEditing, onEnterEditMode, handleToggleSize],
  );

  const handleDragStart = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (onDragStateChange) onDragStateChange(true);
  }, [onDragStateChange]);

  const handleDragEnd = useCallback(() => {
    if (onDragStateChange) onDragStateChange(false);
  }, [onDragStateChange]);

  const allCards = getCards();

  // Nur aktivierte und nicht ausgeblendete Karten anzeigen.
  const rawVisibleCards = allCards.filter(
    (card) => (!card.moduleKey || modules?.[card.moduleKey]) && !isCardHidden(card.id),
  );

  // Gespeicherte Drag-and-Drop-Reihenfolge anwenden.
  const visibleCards = getOrderedCards(rawVisibleCards);

  if (!modules) return null;

  if (visibleCards.length === 0) {
    return (
      <Surface tone="surface" style={styles.emptyCard}>
        <Txt variant="body" weight="700" style={styles.centeredText}>
          Keine Karten auf der Übersicht
        </Txt>
        <Txt variant="body" tone="secondary" style={styles.centeredText}>
          Füge Karten über die Galerie hinzu oder passe deine Ansicht an.
        </Txt>
        {onOpenGallery ? (
          <Button
            title="+ Karten hinzufügen"
            onPress={onOpenGallery}
            variant="accent"
            accentKey="pantry"
            size="sm"
            style={styles.emptyAction}
          />
        ) : null}
      </Surface>
    );
  }

  if (isEditing) {
    return (
      <EditingCardGrid
        key={visibleCards
          .map((card) => `${card.id}:${getSize(card)}`)
          .sort()
          .join('|')}
        cards={visibleCards}
        allCards={allCards}
        getSize={getSize}
        hideCard={hideCard}
        onToggleSize={handleToggleSize}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        reorderCards={reorderCards}
      />
    );
  }

  // Aufeinanderfolgende kleine Karten in responsive Reihen gruppieren.
  const elements: ReactElement[] = [];
  let i = 0;
  let cardIndex = 0;
  let rowIndex = 0;

  while (i < visibleCards.length) {
    const card = visibleCards[i];
    const currentSize = getSize(card);

    if (currentSize === 'small') {
      const smallGroup: DashboardCardDef[] = [card];
      let j = i + 1;
      while (j < visibleCards.length && getSize(visibleCards[j]) === 'small') {
        smallGroup.push(visibleCards[j]);
        j++;
      }

      const cardsPerRow = stackSmallCards ? 1 : 2;
      for (let k = 0; k < smallGroup.length; k += cardsPerRow) {
        const pair = smallGroup.slice(k, k + cardsPerRow);
        const currentRowIndex = rowIndex++;
        elements.push(
          <WidgetRow key={`row-${currentRowIndex}`} stacked={false}>
            {pair.map((c) => {
              const idx = cardIndex++;
              return (
                <JiggleWrapper
                  key={c.id}
                  index={idx}
                  size="small"
                  isEditing={isEditing}
                  onDelete={() => hideCard(c.id)}
                  onToggleSize={() => handleToggleSize(c.id, 'small')}>
                  <c.component size="small" onLongPress={() => handleLongPress(c.id, 'small')} />
                </JiggleWrapper>
              );
            })}
            {pair.length === 1 && !stackSmallCards ? (
              <View key="empty-slot" style={{ flex: 1 }} />
            ) : null}
          </WidgetRow>,
        );
      }

      i = j;
    } else {
      const idx = cardIndex++;
      const currentRowIndex = rowIndex++;
      elements.push(
        <WidgetRow key={`row-${currentRowIndex}`} stacked>
          <JiggleWrapper
            index={idx}
            size="large"
            isEditing={isEditing}
            onDelete={() => hideCard(card.id)}
            onToggleSize={() => handleToggleSize(card.id, 'large')}>
            <card.component size="large" onLongPress={() => handleLongPress(card.id, 'large')} />
          </JiggleWrapper>
        </WidgetRow>,
      );
      i++;
    }
  }

  return elements;
}

type EditingCardGridProps = {
  cards: DashboardCardDef[];
  allCards: readonly DashboardCardDef[];
  getSize: (card: DashboardCardDef) => CardSize;
  hideCard: (cardId: string) => void;
  onToggleSize: (cardId: string, currentSize: CardSize) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  reorderCards: (orderedIds: string[]) => void;
};

function EditingCardGrid({
  cards,
  allCards,
  getSize,
  hideCard,
  onToggleSize,
  onDragStart,
  onDragEnd,
  reorderCards,
}: EditingCardGridProps) {
  const scrollRef = useRef<ScrollView>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const { width, fontScale } = useWindowDimensions();
  const stackSmallCards = width < 360 || fontScale >= 1.2;
  const columns = 2;
  const gap = space.md;
  // Drax requires integer row spans. Small row units fit natural widget heights
  // without reserving a full 180pt cell for every card.
  const rowUnit = 4;
  const getItemSpan = useCallback(
    (card: DashboardCardDef): GridItemSpan => ({
      colSpan: getSize(card) === 'small' && !stackSmallCards ? 1 : 2,
      rowSpan: Math.ceil(((heights[card.id] ?? 140) + gap) / rowUnit),
    }),
    [getSize, stackSmallCards, heights],
  );

  const sortable = useSortableList({
    data: cards,
    numColumns: columns,
    keyExtractor: (card) => card.id,
    getItemSpan,
    animationConfig: 'spring',
    onDragStart,
    onDragEnd,
    onReorder: ({ data }) => {
      const nextIds = data.map((card) => card.id);
      const visibleIds = new Set(nextIds);
      let visibleIndex = 0;
      reorderCards(
        allCards.map((card) => (visibleIds.has(card.id) ? nextIds[visibleIndex++] : card.id)),
      );
    },
  });

  // Official mixed-grid pattern: render Drax's stable data and let Drax own shifts.
  const layout = useMemo(
    () => packGrid(sortable.data.length, columns, (index) => getItemSpan(sortable.data[index])),
    [sortable.data, getItemSpan],
  );
  const cellWidth = Math.max(0, (containerWidth - gap) / columns);
  const contentHeight =
    Math.max(
      layout.totalRows,
      packGrid(cards.length, columns, (index) => getItemSpan(cards[index])).totalRows,
    ) * rowUnit;

  return (
    <DraxProvider>
      <View style={styles.editingList}>
        <SortableContainer sortable={sortable} scrollRef={scrollRef} style={styles.editingList}>
          <ScrollView
            ref={scrollRef}
            onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}
            onScroll={sortable.onScroll}
            onContentSizeChange={sortable.onContentSizeChange}
            scrollEventThrottle={16}
            contentInsetAdjustmentBehavior="never"
            showsVerticalScrollIndicator={false}>
            <View style={{ height: contentHeight }}>
              {containerWidth > 0 &&
                sortable.data.map((card, index) => {
                  const position = layout.positions[index];
                  const span = getItemSpan(card);
                  const size = getSize(card);
                  return (
                    <SortableItem
                      key={sortable.stableKeyExtractor(card, index)}
                      sortable={sortable}
                      index={index}
                      style={{
                        position: 'absolute',
                        left: position.col * (cellWidth + gap),
                        top: position.row * rowUnit,
                        width: span.colSpan * cellWidth + (span.colSpan - 1) * gap,
                        height: span.rowSpan * rowUnit,
                      }}>
                      <JiggleWrapper
                        index={index}
                        size={size}
                        isEditing
                        onDelete={() => hideCard(card.id)}
                        onToggleSize={() => onToggleSize(card.id, size)}>
                        <View
                          onLayout={(event) => {
                            const height = Math.ceil(event.nativeEvent.layout.height);
                            if (height <= 0) return;
                            setHeights((previous) =>
                              previous[card.id] === height
                                ? previous
                                : { ...previous, [card.id]: height },
                            );
                          }}>
                          <card.component size={size} disabled />
                        </View>
                      </JiggleWrapper>
                    </SortableItem>
                  );
                })}
            </View>
          </ScrollView>
        </SortableContainer>
      </View>
    </DraxProvider>
  );
}
