import * as Haptics from 'expo-haptics';
import { type ReactElement, useCallback } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import {
  Sortable,
  SortableItem,
  type SortableRenderItemProps,
} from 'react-native-reanimated-dnd';

import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';
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
  const { colors } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const stackSmallCards = width < 360 || fontScale >= 1.2;
  const { session } = useSession();
  const userId = session?.user.id;
  const { data: modules } = useModulePreferences(userId);
  const { getSize, setSize, hideCard, isCardHidden, getOrderedCards, reorderCards } = useCardSizes();

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
  const visibleCardIds = visibleCards.map((c) => c.id);

  const handleSortableDrop = useCallback(
    (_id: string, _position: number, allPositions?: Record<string, number>) => {
      if (!allPositions) {
        handleDragEnd();
        return;
      }

      const nextVisibleIds = Object.entries(allPositions)
        .sort(([, left], [, right]) => left - right)
        .map(([id]) => id);
      if (nextVisibleIds.length !== visibleCardIds.length) {
        handleDragEnd();
        return;
      }

      const nextOrder = getOrderedCards([...allCards]).map((card) => card.id);
      let visibleIndex = 0;
      const visibleIdSet = new Set(visibleCardIds);
      for (let orderIndex = 0; orderIndex < nextOrder.length; orderIndex++) {
        if (visibleIdSet.has(nextOrder[orderIndex])) {
          nextOrder[orderIndex] = nextVisibleIds[visibleIndex];
          visibleIndex++;
        }
      }

      reorderCards(nextOrder);
      handleDragEnd();
    },
    [allCards, getOrderedCards, handleDragEnd, reorderCards, visibleCardIds],
  );

  const renderSortableCard = useCallback(
    ({
      item,
      index,
      ...sortableItemProps
    }: SortableRenderItemProps<DashboardCardDef>) => {
      const cardSize = getSize(item);

      return (
        <SortableItem
          key={`${item.id}-${cardSize}`}
          {...sortableItemProps}
          id={item.id}
          data={item}
          style={{ width: '100%' }}
          onDragStart={handleDragStart}
          onDrop={handleSortableDrop}>
          <JiggleWrapper
            index={index}
            size={cardSize}
            fill
            isEditing
            onDelete={() => hideCard(item.id)}
            onToggleSize={() => handleToggleSize(item.id, cardSize)}>
            <item.component size={cardSize} />
          </JiggleWrapper>
        </SortableItem>
      );
    },
    [getSize, handleDragStart, handleSortableDrop, handleToggleSize, hideCard],
  );

  if (!modules) return null;

  if (visibleCards.length === 0) {
    return (
      <View
        className="rounded-fam-large p-five items-center justify-center gap-three"
        style={{ minHeight: 180, backgroundColor: colors.surface }}>
        <Txt variant="body" weight="700" className="text-center">
          Keine Karten auf der Übersicht
        </Txt>
        <Txt variant="body" tone="secondary" className="text-center">
          Füge Karten über die Galerie hinzu oder passe deine Ansicht an.
        </Txt>
        {onOpenGallery ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Karten hinzufügen"
            onPress={onOpenGallery}
            className="px-four py-two rounded-control mt-one"
            style={{ backgroundColor: colors.basil }}>
            <Txt variant="body" tone="onAccent" weight="600">
              + Karten hinzufügen
            </Txt>
          </Pressable>
        ) : null}
      </View>
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
          <WidgetRow
            key={`row-${currentRowIndex}`}
            stacked={false}>
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
        <WidgetRow
          key={`row-${currentRowIndex}`}
          stacked>
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

  if (isEditing) {
    return (
      <Sortable
        data={visibleCards}
        renderItem={renderSortableCard}
        enableDynamicHeights
        estimatedItemHeight={fontScale >= 1.2 ? 170 : 150}
        style={{ flex: 1, backgroundColor: 'transparent' }}
      />
    );
  }

  return elements;
}
