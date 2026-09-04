import * as Haptics from 'expo-haptics';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { withAlpha } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';
import { type CardSize, getCards } from '@/features/dashboard/registry';
import { useCardSizes } from '@/features/dashboard/use-card-sizes';

type CardGallerySheetProps = {
  visible: boolean;
  onClose: () => void;
};

const CARD_METADATA: Record<string, { title: string; desc: string; icon: string }> = {
  streak: {
    title: 'Kochstreak',
    desc: 'Sieben-Tage-Ansicht deiner Serie und persönlicher Rekord.',
    icon: '🔥',
  },
  calories: {
    title: 'Kalorien & Makros',
    desc: 'Tagesübersicht, Kalorienring und verbleibende kcal.',
    icon: '🍎',
  },
  mealPlanner: {
    title: 'Essensplan',
    desc: 'Heutige Mahlzeiten und nächstes geplantes Rezept.',
    icon: '🗓️',
  },
  inventory: {
    title: 'Vorrat & MHD',
    desc: 'Bald ablaufende Artikel und Vorrats-Schnellcheck.',
    icon: '🧊',
  },
  shoppingList: {
    title: 'Einkaufsliste',
    desc: 'Offene Artikel und Fortschritt beim Einkaufen.',
    icon: '🛒',
  },
};

/**
 * iOS-Style Widget-/Card-Galerie Sheet.
 * Erlaubt das Hinzufuegen/Entfernen von Karten und die Groessenauswahl.
 */
export function CardGallerySheet({ visible, onClose }: CardGallerySheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { getSize, setSize, showCard, hideCard, isCardHidden } = useCardSizes();
  const allCards = getCards();

  function handleSelectSize(cardId: string, size: CardSize) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSize(cardId, size);
  }

  function handleToggleCard(cardId: string, isHidden: boolean) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isHidden) {
      showCard(cardId);
    } else {
      hideCard(cardId);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={StyleSheet.absoluteFill}>
        <Pressable
          style={[styles.dim, { backgroundColor: 'rgba(0, 0, 0, 0.45)' }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Galerie schließen"
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.bg,
              paddingBottom: Math.max(insets.bottom, 24),
              boxShadow: `0 -10px 30px ${withAlpha(colors.text, 0.2)}`,
            },
          ]}>
          <View style={styles.handleWrap}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
          </View>

          <View style={styles.header}>
            <View style={styles.headerTextWrap}>
              <Txt variant="title">Karten anpassen</Txt>
              <Txt variant="body" tone="secondary">
                Füge Karten hinzu oder passe deren Größe an
              </Txt>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Fertig"
              style={[styles.doneBtn, { backgroundColor: colors.basil }]}>
              <Txt variant="label" tone="onAccent" weight="600">
                Fertig
              </Txt>
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}>
            {allCards.map((card) => {
              const meta = CARD_METADATA[card.id] ?? {
                title: card.id,
                desc: 'Dashboard Widget',
                icon: '📦',
              };
              const currentSize = getSize(card);
              const isHidden = isCardHidden(card.id);

              return (
                <View
                  key={card.id}
                  style={[
                    styles.cardRow,
                    {
                      backgroundColor: colors.surface,
                      borderColor: isHidden ? colors.border : withAlpha(colors.basil, 0.3),
                      opacity: isHidden ? 0.85 : 1,
                    },
                  ]}>
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.cardInfo}>
                      <Txt variant="body" weight="700">
                        {meta.icon} {meta.title}
                      </Txt>
                      <Txt variant="body" tone="secondary">
                        {meta.desc}
                      </Txt>
                    </View>

                    <Pressable
                      onPress={() => handleToggleCard(card.id, isHidden)}
                      accessibilityRole="button"
                      accessibilityLabel={
                        isHidden ? `${meta.title} hinzufügen` : `${meta.title} entfernen`
                      }
                      style={[
                        styles.toggleBtn,
                        isHidden
                          ? { backgroundColor: colors.basil }
                          : { backgroundColor: withAlpha(colors.tomato, 0.15) },
                      ]}>
                      <Txt variant="label" tone={isHidden ? 'onAccent' : 'danger'} weight="600">
                        {isHidden ? '+ Hinzufügen' : 'Entfernen'}
                      </Txt>
                    </Pressable>
                  </View>

                  {/* Größen-Auswahl nur sichtbar wenn Karte aktiv ist */}
                  {!isHidden ? (
                    <View style={styles.sizeSegmentWrap}>
                      <Pressable
                        onPress={() => handleSelectSize(card.id, 'small')}
                        style={[
                          styles.sizeBtn,
                          currentSize === 'small'
                            ? [styles.sizeBtnActive, { backgroundColor: colors.basil }]
                            : [styles.sizeBtnInactive, { backgroundColor: colors.surfaceSoft }],
                        ]}>
                        <Txt
                          variant="label"
                          tone={currentSize === 'small' ? 'onAccent' : 'primary'}
                          weight="600">
                          Klein
                        </Txt>
                      </Pressable>
                      <Pressable
                        onPress={() => handleSelectSize(card.id, 'large')}
                        style={[
                          styles.sizeBtn,
                          currentSize === 'large'
                            ? [styles.sizeBtnActive, { backgroundColor: colors.basil }]
                            : [styles.sizeBtnInactive, { backgroundColor: colors.surfaceSoft }],
                        ]}>
                        <Txt
                          variant="label"
                          tone={currentSize === 'large' ? 'onAccent' : 'primary'}
                          weight="600">
                          Groß
                        </Txt>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: {
    ...StyleSheet.absoluteFill,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '75%',
    paddingTop: 12,
  },
  handleWrap: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTextWrap: {
    flex: 1,
    gap: 2,
  },
  doneBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  cardRow: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardInfo: {
    flex: 1,
    gap: 4,
  },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizeSegmentWrap: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  sizeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizeBtnActive: {},
  sizeBtnInactive: {},
});
