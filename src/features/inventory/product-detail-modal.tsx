import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { FridgeItem } from '@/features/fridge/use-fridge-mutations';
import { getProductDetails } from '@/features/inventory/product-details-catalog';

type ProductDetailModalProps = {
  visible: boolean;
  item: FridgeItem | null;
  onClose: () => void;
};

const NUTRI_SCORES = [
  { score: 'A', bg: '#D1FAE5', activeBg: '#10B981', text: '#065F46' },
  { score: 'B', bg: '#E4F4C0', activeBg: '#84CC16', text: '#3F6212' },
  { score: 'C', bg: '#FEF3C7', activeBg: '#F59E0B', text: '#78350F' },
  { score: 'D', bg: '#FFEDD5', activeBg: '#F97316', text: '#7C2D12' },
  { score: 'E', bg: '#FEE2E2', activeBg: '#EF4444', text: '#7F1D1D' },
] as const;

export function ProductDetailModal({ visible, item, onClose }: ProductDetailModalProps) {
  const insets = useSafeAreaInsets();

  if (!item) return null;

  const details = getProductDetails(item.name);

  // Datum formatieren
  let formattedMhd = '—';
  if (item.expiry_date) {
    const parts = item.expiry_date.split('-');
    if (parts.length === 3) {
      formattedMhd = `${parts[2]}.${parts[1]}.${parts[0]}`;
    } else {
      formattedMhd = item.expiry_date;
    }
  }

  // Makronährwert-Balken Prozentwerte (relativ zur Max-Skala von ca. 30g)
  const maxScale = 30;
  const pWidth = Math.min(100, Math.max(8, (details.macros.proteinG / maxScale) * 100));
  const cWidth = Math.min(100, Math.max(8, (details.macros.carbsG / maxScale) * 100));
  const sugWidth = Math.min(100, Math.max(8, (details.macros.sugarG / maxScale) * 100));
  const fWidth = Math.min(100, Math.max(8, (details.macros.fatG / maxScale) * 100));
  const satWidth = Math.min(100, Math.max(8, (details.macros.satFatG / maxScale) * 100));
  const sWidth = Math.min(100, Math.max(4, (details.macros.saltG / maxScale) * 100));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlayContainer}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.three) }]}>
          {/* Top Bar mit Griffbalken & Schließen-Button (✕) */}
          <View style={styles.topBar}>
            <Pressable style={styles.handleBarContainer} onPress={onClose} hitSlop={12}>
              <View style={styles.handleBar} />
            </Pressable>
            <Pressable
              style={styles.closeButtonCircle}
              onPress={onClose}
              hitSlop={12}
              accessibilityLabel="Schließen">
              <ThemedText style={styles.closeButtonText}>✕</ThemedText>
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollBody}>
            {/* Header Card */}
            <View style={styles.headerCard}>
              <View style={styles.headerLeft}>
                <View style={styles.iconBox}>
                  <ThemedText style={styles.iconEmoji}>{details.icon}</ThemedText>
                </View>

                <View style={styles.headerInfo}>
                  <ThemedText type="subtitle" style={styles.headerTitle}>
                    {item.name}
                  </ThemedText>
                  <ThemedText type="small" style={styles.brandText}>
                    {details.brand}
                  </ThemedText>

                  <View style={styles.badgeRow}>
                    <View style={styles.categoryBadge}>
                      <ThemedText type="smallBold" style={styles.categoryBadgeText}>
                        {details.category}
                      </ThemedText>
                    </View>
                    <ThemedText type="small" style={styles.unitText}>
                      {item.quantity} {item.unit}
                    </ThemedText>
                  </View>

                  <ThemedText type="small" style={styles.mhdText}>
                    MHD: {formattedMhd}
                  </ThemedText>
                </View>
              </View>

              {/* Big Nutri-Score Badge Top Right */}
              <View style={styles.nutriBadgeTop}>
                <ThemedText style={styles.nutriBadgeTopText}>{details.nutriScore}</ThemedText>
              </View>
            </View>

            {/* Kalorien Card */}
            <View style={styles.card}>
              <View style={styles.kcalRow}>
                <View>
                  <View style={styles.kcalTextGroup}>
                    <ThemedText style={styles.kcalNumber}>{details.kcal}</ThemedText>
                    <ThemedText style={styles.kcalUnit}>kcal</ThemedText>
                  </View>
                  <ThemedText type="small" themeColor="textSecondary">
                    {details.unitReference}
                  </ThemedText>
                </View>

                {/* Macro Ring Graphic */}
                <View style={styles.donutRing}>
                  <View style={styles.donutCenter}>
                    <ThemedText type="smallBold" style={styles.donutCenterText}>
                      K/P/F
                    </ThemedText>
                  </View>
                </View>
              </View>
            </View>

            {/* Makronährstoffe Card */}
            <View style={styles.card}>
              <ThemedText style={styles.sectionHeaderTitle}>MAKRONÄHRSTOFFE</ThemedText>

              <View style={styles.macroList}>
                {/* Protein */}
                <View style={styles.macroRow}>
                  <ThemedText type="small" style={styles.macroLabel}>
                    Protein
                  </ThemedText>
                  <View style={styles.trackContainer}>
                    <View style={styles.trackBackground}>
                      <View
                        style={[
                          styles.trackFill,
                          { width: `${pWidth}%`, backgroundColor: '#3B82F6' },
                        ]}
                      />
                    </View>
                  </View>
                  <ThemedText type="smallBold" style={styles.macroVal}>
                    {details.macros.proteinG}g
                  </ThemedText>
                </View>

                {/* Kohlenhydrate */}
                <View style={styles.macroRow}>
                  <ThemedText type="small" style={styles.macroLabel}>
                    Kohlenhydrate
                  </ThemedText>
                  <View style={styles.trackContainer}>
                    <View style={styles.trackBackground}>
                      <View
                        style={[
                          styles.trackFill,
                          { width: `${cWidth}%`, backgroundColor: '#F59E0B' },
                        ]}
                      />
                    </View>
                  </View>
                  <ThemedText type="smallBold" style={styles.macroVal}>
                    {details.macros.carbsG}g
                  </ThemedText>
                </View>

                {/* davon Zucker */}
                <View style={styles.macroRowSub}>
                  <ThemedText type="small" style={styles.macroLabelSub}>
                    davon Zucker
                  </ThemedText>
                  <View style={styles.trackContainer}>
                    <View style={styles.trackBackground}>
                      <View
                        style={[
                          styles.trackFill,
                          { width: `${sugWidth}%`, backgroundColor: '#FBBF24' },
                        ]}
                      />
                    </View>
                  </View>
                  <ThemedText type="smallBold" style={styles.macroVal}>
                    {details.macros.sugarG}g
                  </ThemedText>
                </View>

                {/* Fett */}
                <View style={styles.macroRow}>
                  <ThemedText type="small" style={styles.macroLabel}>
                    Fett
                  </ThemedText>
                  <View style={styles.trackContainer}>
                    <View style={styles.trackBackground}>
                      <View
                        style={[
                          styles.trackFill,
                          { width: `${fWidth}%`, backgroundColor: '#EC4899' },
                        ]}
                      />
                    </View>
                  </View>
                  <ThemedText type="smallBold" style={styles.macroVal}>
                    {details.macros.fatG}g
                  </ThemedText>
                </View>

                {/* davon gesättigt */}
                <View style={styles.macroRowSub}>
                  <ThemedText type="small" style={styles.macroLabelSub}>
                    davon gesättigt
                  </ThemedText>
                  <View style={styles.trackContainer}>
                    <View style={styles.trackBackground}>
                      <View
                        style={[
                          styles.trackFill,
                          { width: `${satWidth}%`, backgroundColor: '#F472B6' },
                        ]}
                      />
                    </View>
                  </View>
                  <ThemedText type="smallBold" style={styles.macroVal}>
                    {details.macros.satFatG}g
                  </ThemedText>
                </View>

                {/* Salz */}
                <View style={styles.macroRow}>
                  <ThemedText type="small" style={styles.macroLabel}>
                    Salz
                  </ThemedText>
                  <View style={styles.trackContainer}>
                    <View style={styles.trackBackground}>
                      <View
                        style={[
                          styles.trackFill,
                          { width: `${sWidth}%`, backgroundColor: '#4B5563' },
                        ]}
                      />
                    </View>
                  </View>
                  <ThemedText type="smallBold" style={styles.macroVal}>
                    {details.macros.saltG}g
                  </ThemedText>
                </View>
              </View>
            </View>

            {/* Nutri-Score Card */}
            <View style={styles.card}>
              <ThemedText style={styles.sectionHeaderTitle}>NUTRI-SCORE</ThemedText>
              <View style={styles.nutriRow}>
                {NUTRI_SCORES.map((ns) => {
                  const isActive = details.nutriScore === ns.score;
                  return (
                    <View
                      key={ns.score}
                      style={[
                        styles.nutriPill,
                        {
                          backgroundColor: isActive ? ns.activeBg : ns.bg,
                          transform: isActive ? [{ scale: 1.08 }] : [{ scale: 1.0 }],
                          shadowColor: isActive ? '#000' : 'transparent',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: isActive ? 0.2 : 0,
                          shadowRadius: 4,
                          elevation: isActive ? 3 : 0,
                        },
                      ]}>
                      <ThemedText
                        style={[styles.nutriPillText, { color: isActive ? '#FFFFFF' : ns.text }]}>
                        {ns.score}
                      </ThemedText>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Zutaten Card */}
            <View style={styles.card}>
              <ThemedText style={styles.sectionHeaderTitle}>ZUTATEN</ThemedText>
              <ThemedText style={styles.ingredientsText}>{details.ingredients}</ThemedText>
            </View>

            {/* Allergene Card */}
            <View style={styles.allergenCard}>
              <ThemedText style={styles.allergenHeaderTitle}>ALLERGENE</ThemedText>
              {details.allergens.length > 0 ? (
                <View style={styles.allergenPillRow}>
                  {details.allergens.map((alg) => (
                    <View key={alg} style={styles.allergenBadge}>
                      <ThemedText type="smallBold" style={styles.allergenBadgeText}>
                        {alg}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              ) : (
                <ThemedText type="small" style={{ color: '#9A3412', marginTop: 4 }}>
                  Keine Allergene deklariert.
                </ThemedText>
              )}
            </View>

            {/* Footer Attribution */}
            <ThemedText type="small" style={styles.footerNote}>
              Daten: Open Food Facts · Nährwerte pro 100 g
            </ThemedText>

            {/* Unterer Schließen Button */}
            <Pressable style={styles.bottomCloseButton} onPress={onClose}>
              <ThemedText type="smallBold" style={styles.bottomCloseButtonText}>
                Schließen
              </ThemedText>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    paddingHorizontal: Spacing.three,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    position: 'relative',
  },
  handleBarContainer: {
    paddingVertical: 6,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  handleBar: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#D1D5DB',
  },
  closeButtonCircle: {
    position: 'absolute',
    right: 4,
    top: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '700',
  },
  scrollBody: {
    paddingBottom: Spacing.four,
    gap: Spacing.three,
  },
  headerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: '#F0F5FF',
    borderRadius: 20,
    padding: Spacing.three,
  },
  headerLeft: {
    flexDirection: 'row',
    gap: Spacing.three,
    flex: 1,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  iconEmoji: {
    fontSize: 28,
  },
  headerInfo: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    fontWeight: '800',
    fontSize: 18,
    color: '#1F2937',
  },
  brandText: {
    color: '#6B7280',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: 4,
  },
  categoryBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  categoryBadgeText: {
    color: '#15803D',
    fontSize: 11,
  },
  unitText: {
    color: '#6B7280',
    fontSize: 12,
  },
  mhdText: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
  },
  nutriBadgeTop: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#84CC16',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nutriBadgeTopText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 22,
  },
  card: {
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
    padding: Spacing.three,
  },
  kcalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kcalTextGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  kcalNumber: {
    fontSize: 32,
    fontWeight: '900',
    color: '#111827',
  },
  kcalUnit: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6B7280',
  },
  donutRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 6,
    borderColor: '#F59E0B',
    borderTopColor: '#3B82F6',
    borderRightColor: '#EC4899',
    justifyContent: 'center',
    alignItems: 'center',
  },
  donutCenter: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  donutCenterText: {
    fontSize: 9,
    color: '#6B7280',
    fontWeight: '700',
  },
  sectionHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#9CA3AF',
    letterSpacing: 1,
    marginBottom: Spacing.two,
  },
  macroList: {
    gap: Spacing.two,
  },
  macroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  macroRowSub: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingLeft: Spacing.two,
  },
  macroLabel: {
    width: 100,
    color: '#374151',
    fontWeight: '500',
  },
  macroLabelSub: {
    width: 100,
    color: '#6B7280',
  },
  trackContainer: {
    flex: 1,
  },
  trackBackground: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: 4,
  },
  macroVal: {
    width: 44,
    textAlign: 'right',
    color: '#111827',
  },
  nutriRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  nutriPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nutriPillText: {
    fontWeight: '900',
    fontSize: 16,
  },
  ingredientsText: {
    color: '#374151',
    lineHeight: 20,
    fontSize: 13,
  },
  allergenCard: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    borderRadius: 20,
    padding: Spacing.three,
  },
  allergenHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#9A3412',
    letterSpacing: 1,
    marginBottom: Spacing.one,
  },
  allergenPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    marginTop: 4,
  },
  allergenBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  allergenBadgeText: {
    color: '#991B1B',
    fontSize: 12,
  },
  footerNote: {
    textAlign: 'center',
    color: '#9CA3AF',
    marginVertical: Spacing.two,
    fontSize: 11,
  },
  bottomCloseButton: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: Spacing.two,
    marginBottom: Spacing.two,
  },
  bottomCloseButtonText: {
    color: '#374151',
    fontSize: 15,
  },
});
