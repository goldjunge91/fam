import PagerView from '@expo/ui/community/pager-view';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { withAlpha } from '@/constants/theme';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { useAddShoppingItem } from '@/features/shopping-list/hooks/use-shopping-list-mutations';
import { resolveCategoryForItem } from '@/features/shopping-list/preferences/api';
import { useTheme } from '@/hooks/use-theme';
import { formatEuro } from '@/lib/format-currency';
import { BrochureHotspot } from '../components/brochure-hotspot';
import { useBrochurePages } from '../hooks/use-brochures';
import type { Hotspot, LocalBrochurePage } from '../types';

function hotspotPrice(hotspot: Hotspot): string | null {
  return hotspot.priceCents === undefined ? null : formatEuro(hotspot.priceCents / 100);
}

export default function BrochureViewerScreen({ brochureId }: { brochureId: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { activeHouseholdId } = useActiveHousehold();
  const addShoppingItem = useAddShoppingItem();
  const { data: pages, isLoading } = useBrochurePages(brochureId);
  const [activeHotspot, setActiveHotspot] = useState<Hotspot | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [hotspotsVisible, setHotspotsVisible] = useState(true);

  if (isLoading || !pages) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.accent} />
        <Text style={{ color: theme.textSecondary }}>Prospekt wird geladen...</Text>
      </View>
    );
  }

  function selectHotspot(hotspot: Hotspot) {
    setQuantity(1);
    setActiveHotspot(hotspot);
  }

  function closeProductSheet() {
    setActiveHotspot(null);
    setQuantity(1);
  }

  async function addActiveHotspot() {
    if (!activeHotspot || !activeHouseholdId) {
      Alert.alert('Kein Haushalt ausgewählt', 'Wähle zuerst einen Haushalt aus.');
      return;
    }

    try {
      const classification = await resolveCategoryForItem({
        householdId: activeHouseholdId,
        name: activeHotspot.title,
      });
      await addShoppingItem.mutateAsync({
        household_id: activeHouseholdId,
        name: activeHotspot.title,
        quantity,
        unit: 'piece',
        category_id: classification.categoryId,
        category_source: classification.source,
        category_classifier_version: classification.classifierVersion,
        // Prospekt-Haendler sind globale Slugs, Einkaufslisten-Maerkte dagegen
        // haushaltsspezifische UUIDs. Ohne explizites Mapping bleibt der Markt leer.
        store_id: null,
        price_estimate:
          activeHotspot.priceCents === undefined
            ? null
            : (activeHotspot.priceCents * quantity) / 100,
      });
      closeProductSheet();
      Alert.alert('Zur Einkaufsliste hinzugefügt', `${quantity} × ${activeHotspot.title}`);
    } catch (error) {
      Alert.alert(
        'Hinzufügen fehlgeschlagen',
        error instanceof Error ? error.message : 'Der Artikel konnte nicht hinzugefügt werden.',
      );
    }
  }

  return (
    <View style={styles.container}>
      <PagerView style={styles.pagerView} initialPage={0}>
        {pages.map((page: LocalBrochurePage) => (
          <View key={page.id} style={styles.page}>
            <Image
              source={{ uri: page.imageUrl }}
              style={styles.pageImage}
              contentFit="contain"
              transition={200}
              blurRadius={activeHotspot ? 12 : 0}
            />
            <View style={styles.hotspotsOverlay} pointerEvents={hotspotsVisible ? 'auto' : 'none'}>
              {page.hotspots.map((hotspot: Hotspot) => (
                <BrochureHotspot
                  key={hotspot.id}
                  hotspot={hotspot}
                  isActive={activeHotspot?.id === hotspot.id}
                  isVisible={hotspotsVisible}
                  onPress={selectHotspot}
                />
              ))}
            </View>
          </View>
        ))}
      </PagerView>

      {activeHotspot ? (
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(150)}
          style={StyleSheet.absoluteFill}
          pointerEvents="box-none">
          <Pressable
            role="button"
            aria-label="Artikeldetails schließen"
            style={styles.backdropPressArea}
            onPress={closeProductSheet}
          />
          <View
            style={[
              styles.bottomSheet,
              {
                paddingBottom: Math.max(insets.bottom, 24),
                backgroundColor: theme.backgroundElement,
                borderColor: theme.border,
              },
            ]}>
            <View style={[styles.sheetHandle, { backgroundColor: theme.border }]} />
            <View style={styles.productHeading}>
              {activeHotspot.imageUrl ? (
                <Image source={{ uri: activeHotspot.imageUrl }} style={styles.productImage} />
              ) : null}
              <View style={styles.productCopy}>
                <Text style={[styles.productTitle, { color: theme.text }]}>
                  {activeHotspot.title}
                </Text>
                {activeHotspot.description ? (
                  <Text style={[styles.productDescription, { color: theme.textSecondary }]}>
                    {activeHotspot.description}
                  </Text>
                ) : null}
              </View>
              {activeHotspot.discount ? (
                <View style={[styles.sheetDiscount, { backgroundColor: theme.accent }]}>
                  <Text style={[styles.sheetDiscountText, { color: theme.onAccent }]}>
                    {activeHotspot.discount}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.priceRow}>
              {hotspotPrice(activeHotspot) ? (
                <Text style={[styles.productPrice, { color: theme.accent }]}>
                  {hotspotPrice(activeHotspot)}
                </Text>
              ) : null}
              {activeHotspot.oldPriceCents !== undefined ? (
                <Text style={[styles.oldPrice, { color: theme.textSecondary }]}>
                  {formatEuro(activeHotspot.oldPriceCents / 100)}
                </Text>
              ) : null}
            </View>

            <View style={styles.actionRow}>
              <View
                style={[
                  styles.stepper,
                  { borderColor: theme.border, backgroundColor: theme.background },
                ]}>
                <Pressable
                  role="button"
                  aria-label="Menge verringern"
                  disabled={quantity === 1}
                  style={styles.stepperButton}
                  onPress={() => setQuantity((current) => Math.max(1, current - 1))}>
                  <Text
                    style={{
                      color: quantity === 1 ? theme.textSecondary : theme.text,
                      fontSize: 20,
                    }}>
                    −
                  </Text>
                </Pressable>
                <Text style={[styles.quantity, { color: theme.text }]}>{quantity}×</Text>
                <Pressable
                  role="button"
                  aria-label="Menge erhöhen"
                  style={styles.stepperButton}
                  onPress={() => setQuantity((current) => current + 1)}>
                  <Text style={{ color: theme.text, fontSize: 20 }}>+</Text>
                </Pressable>
              </View>
              <Pressable
                role="button"
                aria-label="Auf die Einkaufsliste"
                disabled={addShoppingItem.isPending}
                style={[
                  styles.addButton,
                  {
                    backgroundColor: theme.accent,
                    opacity: addShoppingItem.isPending ? 0.6 : 1,
                  },
                ]}
                onPress={addActiveHotspot}>
                {addShoppingItem.isPending ? (
                  <ActivityIndicator color={theme.onAccent} />
                ) : (
                  <Text style={[styles.addButtonText, { color: theme.onAccent }]}>
                    Auf die Liste
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </Animated.View>
      ) : null}

      <Pressable
        role="switch"
        aria-checked={hotspotsVisible}
        aria-label="Artikel-Hotspots"
        style={[
          styles.hotspotToggle,
          {
            top: Math.max(insets.top, 16),
            backgroundColor: hotspotsVisible ? theme.accent : withAlpha(theme.text, 0.7),
          },
        ]}
        onPress={() => setHotspotsVisible((visible) => !visible)}>
        <Text style={[styles.headerButtonText, { color: theme.onAccent }]}>Artikel</Text>
      </Pressable>
      <Pressable
        role="button"
        aria-label="Prospekt schließen"
        style={[
          styles.closeButton,
          { top: Math.max(insets.top, 16), backgroundColor: withAlpha(theme.text, 0.7) },
        ]}
        onPress={() => router.back()}>
        <Text style={[styles.headerButtonText, { color: theme.onAccent }]}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  pagerView: { flex: 1 },
  page: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pageImage: { width: '100%', height: '100%' },
  hotspotsOverlay: { ...StyleSheet.absoluteFill },
  hotspotToggle: {
    position: 'absolute',
    left: 16,
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    justifyContent: 'center',
    zIndex: 10,
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  headerButtonText: { fontSize: 14, fontWeight: '700' },
  backdropPressArea: { flex: 1, zIndex: 90, backgroundColor: 'rgba(0,0,0,0.22)' },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    zIndex: 100,
    gap: 16,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center' },
  productHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  productImage: { width: 56, height: 56, borderRadius: 10 },
  productCopy: { flex: 1, gap: 4 },
  productTitle: { fontSize: 20, fontWeight: '600' },
  productDescription: { fontSize: 14 },
  sheetDiscount: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  sheetDiscountText: { fontSize: 12, fontWeight: '800' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  productPrice: { fontSize: 26, fontWeight: '800' },
  oldPrice: { fontSize: 15, textDecorationLine: 'line-through' },
  actionRow: { flexDirection: 'row', gap: 12 },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12 },
  stepperButton: { width: 42, minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  quantity: { minWidth: 30, textAlign: 'center', fontSize: 16, fontWeight: '700' },
  addButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: { fontSize: 16, fontWeight: '700' },
});
