import * as Haptics from 'expo-haptics';
import { type ReactElement, useCallback } from 'react';
import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/theme/themed-text';
import { useSession } from '@/features/auth/session-provider';
import { type CardSize, type DashboardCardDef, getCards } from '@/features/dashboard/registry';
import { useCardSizes } from '@/features/dashboard/use-card-sizes';
import { useModulePreferences } from '@/features/settings/module-preferences';
import { useTheme } from '@/hooks/use-theme';
import { DashboardDragProvider } from './drag-context';
import { JiggleWrapper } from './jiggle-wrapper';
import { WidgetRow } from './widget-row';

// Seiteneffekt-Imports: Registrieren die Cards beim Module-Load.
// Neue Cards? Hier eine Zeile ergänzen.
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

/**
 * Zentrale Render-Logik fuer Dashboard-Cards.
 * - Filtert nach aktiven Modulen und nicht-ausgeblendeten Karten.
 * - Sortiert nach der benutzerdefinierten Drag & Drop Reihenfolge (`getOrderedCards`).
 * - Gruppiert aufeinanderfolgende Small-Cards in `WidgetRow`-Paare.
 * - Im Edit-Modus (iOS Wackel-Modus) wackeln die Karten via JiggleWrapper,
 *   bieten Drag & Drop mit Hover-Displacement und Drop-Commit und zeigen Badges an.
 */
export function CardList({
  isEditing = false,
  onEnterEditMode,
  onOpenGallery,
  onDragStateChange,
}: CardListProps) {
  const theme = useTheme();
  const { session } = useSession();
  const userId = session?.user.id;
  const { data: modules } = useModulePreferences(userId);
  const { getSize, setSize, hideCard, isCardHidden, getOrderedCards, moveCardByIndex } =
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
    if (onDragStateChange) onDragStateChange(true);
  }, [onDragStateChange]);

  const handleDragEnd = useCallback(() => {
    if (onDragStateChange) onDragStateChange(false);
  }, [onDragStateChange]);

  const allCards = getCards();

  // Filtern: 1. Modul aktiv, 2. Nicht vom Nutzer von der Uebersicht geloescht/ausgeblendet
  const rawVisibleCards = allCards.filter(
    (card) => (!card.moduleKey || modules?.[card.moduleKey]) && !isCardHidden(card.id),
  );

  // Sortieren nach gespeicherter Drag & Drop Reihenfolge
  const visibleCards = getOrderedCards(rawVisibleCards);
  const visibleCardIds = visibleCards.map((c) => c.id);

  const handleDrop = useCallback(
    (fromIdx: number, toIdx: number) => {
      moveCardByIndex(fromIdx, toIdx, visibleCardIds);
    },
    [moveCardByIndex, visibleCardIds],
  );

  // Warten bis Module-Praefereenzen geladen sind
  if (!modules) return null;

  // Leerer Zustand wenn alle Karten geloescht/ausgeblendet wurden
  if (visibleCards.length === 0) {
    return (
      <View
        className="rounded-fam-large p-five items-center justify-center gap-three bg-background-element"
        style={{ minHeight: 180 }}>
        <ThemedText type="smallBold" className="text-center">
          Keine Karten auf der Übersicht
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" className="text-center">
          Füge Karten über die Galerie hinzu oder passe deine Ansicht an.
        </ThemedText>
        {onOpenGallery ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Karten hinzufügen"
            onPress={onOpenGallery}
            className="px-four py-two rounded-control bg-accent mt-one">
            <ThemedText style={{ color: theme.onAccent, fontWeight: '600', fontSize: 14 }}>
              + Karten hinzufügen
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
    );
  }

  // Gruppieren: aufeinanderfolgende Small-Cards in Paare packen.
  const elements: ReactElement[] = [];
  let i = 0;
  let cardIndex = 0;

  while (i < visibleCards.length) {
    const card = visibleCards[i];
    const currentSize = getSize(card);

    if (currentSize === 'small') {
      // Sammle aufeinanderfolgende Small-Cards fuer eine WidgetRow
      const smallGroup: DashboardCardDef[] = [card];
      let j = i + 1;
      while (j < visibleCards.length && getSize(visibleCards[j]) === 'small') {
        smallGroup.push(visibleCards[j]);
        j++;
      }

      // In Zweier-Paare aufteilen
      for (let k = 0; k < smallGroup.length; k += 2) {
        const pair = smallGroup.slice(k, k + 2);
        elements.push(
          <WidgetRow key={`row-${pair.map((c) => c.id).join('-')}`}>
            {pair.map((c) => {
              const idx = cardIndex++;
              return (
                <JiggleWrapper
                  key={c.id}
                  id={c.id}
                  index={idx}
                  totalCards={visibleCards.length}
                  size="small"
                  isEditing={isEditing}
                  onDelete={() => hideCard(c.id)}
                  onToggleSize={() => handleToggleSize(c.id, 'small')}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDrop={handleDrop}>
                  <c.component size="small" onLongPress={() => handleLongPress(c.id, 'small')} />
                </JiggleWrapper>
              );
            })}
            {pair.length === 1 ? <View key="empty-slot" style={{ flex: 1 }} /> : null}
          </WidgetRow>,
        );
      }

      i = j;
    } else {
      const idx = cardIndex++;
      elements.push(
        <JiggleWrapper
          key={card.id}
          id={card.id}
          index={idx}
          totalCards={visibleCards.length}
          size="large"
          isEditing={isEditing}
          onDelete={() => hideCard(card.id)}
          onToggleSize={() => handleToggleSize(card.id, 'large')}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDrop={handleDrop}>
          <card.component size="large" onLongPress={() => handleLongPress(card.id, 'large')} />
        </JiggleWrapper>,
      );
      i++;
    }
  }

  return <DashboardDragProvider>{elements}</DashboardDragProvider>;
}
