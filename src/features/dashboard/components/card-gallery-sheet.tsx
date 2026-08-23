import * as Haptics from 'expo-haptics';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/theme/themed-text';
import { withAlpha } from '@/constants/theme';
import { type CardSize, getCards } from '@/features/dashboard/registry';
import { useCardSizes } from '@/features/dashboard/use-card-sizes';
import { useTheme } from '@/hooks/use-theme';

type CardGallerySheetProps = {
  visible: boolean;
  onClose: () => void;
};

const CARD_METADATA: Record<string, { title: string; desc: string; icon: string }> = {
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

export function CardGallerySheet({ visible, onClose }: CardGallerySheetProps) {
  const theme = useTheme();
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
              backgroundColor: theme.background,
              paddingBottom: Math.max(insets.bottom, 24),
              boxShadow: `0 -10px 30px ${withAlpha(theme.shadowSheet, 0.2)}`,
            },
          ]}>
          <View style={styles.handleWrap}>
            <View style={[styles.handle, { backgroundColor: theme.border }]} />
          </View>

          <View style={styles.header}>
            <View style={styles.headerTextWrap}>
              <ThemedText type="subtitle">Karten anpassen</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Füge Karten hinzu oder passe deren Größe an
              </ThemedText>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Fertig"
              style={[styles.doneBtn, { backgroundColor: theme.accent }]}>
              <ThemedText style={styles.doneBtnText}>Fertig</ThemedText>
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
                      backgroundColor: theme.backgroundElement,
                      borderColor: isHidden ? theme.border : withAlpha(theme.accent, 0.3),
                      opacity: isHidden ? 0.85 : 1,
                    },
                  ]}>
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.cardInfo}>
                      <ThemedText type="smallBold">
                        {meta.icon} {meta.title}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {meta.desc}
                      </ThemedText>
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
                          ? { backgroundColor: theme.accent }
                          : { backgroundColor: withAlpha(theme.danger, 0.15) },
                      ]}>
                      <ThemedText
                        style={[
                          styles.toggleBtnText,
                          isHidden ? { color: theme.onAccent } : { color: theme.danger },
                        ]}>
                        {isHidden ? '+ Hinzufügen' : 'Entfernen'}
                      </ThemedText>
                    </Pressable>
                  </View>

                  {!isHidden ? (
                    <View style={styles.sizeSegmentWrap}>
                      <Pressable
                        onPress={() => handleSelectSize(card.id, 'small')}
                        style={[
                          styles.sizeBtn,
                          currentSize === 'small'
                            ? [styles.sizeBtnActive, { backgroundColor: theme.accent }]
                            : [
                                styles.sizeBtnInactive,
                                { backgroundColor: theme.backgroundSelected },
                              ],
                        ]}>
                        <ThemedText
                          style={[
                            styles.sizeBtnText,
                            currentSize === 'small'
                              ? { color: theme.onAccent }
                              : { color: theme.text },
                          ]}>
                          Klein
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        onPress={() => handleSelectSize(card.id, 'large')}
                        style={[
                          styles.sizeBtn,
                          currentSize === 'large'
                            ? [styles.sizeBtnActive, { backgroundColor: theme.accent }]
                            : [
                                styles.sizeBtnInactive,
                                { backgroundColor: theme.backgroundSelected },
                              ],
                        ]}>
                        <ThemedText
                          style={[
                            styles.sizeBtnText,
                            currentSize === 'large'
                              ? { color: theme.onAccent }
                              : { color: theme.text },
                          ]}>
                          Groß
                        </ThemedText>
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
  doneBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
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
  toggleBtnText: {
    fontSize: 12,
    fontWeight: '600',
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
  sizeBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
