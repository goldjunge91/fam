import PagerView from '@expo/ui/community/pager-view';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  type LayoutChangeEvent,
  Linking,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { withAlpha } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { useAddShoppingItem } from '@/features/shopping-list/hooks/use-shopping-list-mutations';
import { findStoreByName, useStores } from '@/features/shopping-list/hooks/use-stores';
import { resolveCategoryForItem } from '@/features/shopping-list/preferences/api';
import { debugLog } from '@/lib/debug-log';
import { formatEuro } from '@/lib/format-currency';
import { BrochureHotspot } from '../components/brochure-hotspot';
import { useBrochurePages } from '../hooks/use-brochures';
import type { Hotspot, LocalBrochurePage } from '../types';
import { calculateContainedImageFrame, type Size } from './brochure-page-layout';

function priceValuesFromDiscount(discount: string | undefined): number[] {
  if (!discount) return [];

  return [...discount.matchAll(/\b(\d+(?:[.,]\d{1,2})?)(?=\s*(?:€|\*?\s+statt|$))/g)]
    .map((match) => Number(match[1].replace(',', '.')))
    .filter((price) => Number.isFinite(price))
    .map((price) => Math.round(price * 100));
}

function hotspotPrices(hotspot: Hotspot): { priceCents?: number; oldPriceCents?: number } {
  const discountPrices = priceValuesFromDiscount(hotspot.discount);
  return {
    priceCents: hotspot.priceCents ?? discountPrices[0],
    oldPriceCents: hotspot.oldPriceCents ?? discountPrices[1],
  };
}

function hotspotPrice(hotspot: Hotspot): string | null {
  const { priceCents } = hotspotPrices(hotspot);
  if (hotspot.priceLabel) return hotspot.priceLabel;
  return priceCents === undefined ? null : formatEuro(priceCents / 100);
}

function imageHost(imageUrl: string): string {
  try {
    return new URL(imageUrl).host;
  } catch {
    return 'invalid-url';
  }
}

function BrochurePage({
  page,
  activeHotspot,
  hotspotsVisible,
  isCurrent,
  onSelectHotspot,
}: {
  page: LocalBrochurePage;
  activeHotspot: Hotspot | null;
  hotspotsVisible: boolean;
  isCurrent: boolean;
  onSelectHotspot: (hotspot: Hotspot, imageUrl: string, imageSize: Size) => void;
}) {
  const [containerSize, setContainerSize] = useState<Size>({ width: 0, height: 0 });
  const [imageSize, setImageSize] = useState<Size>({ width: 0, height: 0 });
  const imageFrame = calculateContainedImageFrame(containerSize, imageSize);

  function handleLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    setContainerSize({ width, height });
    if (isCurrent) {
      debugLog('[brochures] viewer page layout', {
        pageNumber: page.pageNumber,
        container: { width, height },
        image: imageSize,
        overlay: calculateContainedImageFrame({ width, height }, imageSize),
        hotspotCount: page.hotspots.length,
      });
    }
  }

  return (
    <View style={styles.page} onLayout={handleLayout}>
      <Image
        source={{ uri: page.imageUrl }}
        style={styles.pageImage}
        contentFit="contain"
        transition={200}
        blurRadius={activeHotspot ? 12 : 0}
        pointerEvents="none"
        onLoad={({ source }) => {
          const nextImageSize = { width: source.width, height: source.height };
          setImageSize(nextImageSize);
          if (isCurrent) {
            debugLog('[brochures] viewer image loaded', {
              pageNumber: page.pageNumber,
              imageHost: imageHost(page.imageUrl),
              image: nextImageSize,
              container: containerSize,
              overlay: calculateContainedImageFrame(containerSize, nextImageSize),
              hotspotCount: page.hotspots.length,
            });
          }
        }}
        onError={({ error }) => {
          if (isCurrent) {
            debugLog('[brochures] viewer image failed', {
              pageNumber: page.pageNumber,
              imageHost: imageHost(page.imageUrl),
              error,
            });
          }
        }}
      />
      {imageFrame ? (
        <View
          style={[styles.hotspotsOverlay, imageFrame]}
          pointerEvents={hotspotsVisible ? 'auto' : 'none'}>
          {page.hotspots.map((hotspot) => (
            <BrochureHotspot
              key={hotspot.id}
              hotspot={hotspot}
              isActive={activeHotspot?.id === hotspot.id}
              isVisible={hotspotsVisible}
              onPress={(hotspot) => onSelectHotspot(hotspot, page.imageUrl, imageSize)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ProductCropPreview({
  imageUrl,
  imageSize,
  hotspot,
}: {
  imageUrl: string;
  imageSize: Size;
  hotspot: Hotspot;
}) {
  const previewWidth = 248;
  const cropWidth = (imageSize.width * hotspot.width) / 100;
  const cropHeight = (imageSize.height * hotspot.height) / 100;
  if (cropWidth <= 0 || cropHeight <= 0) return null;

  const scale = previewWidth / cropWidth;
  const previewHeight = cropHeight * scale;
  const imageScale = scale;

  return (
    <View style={[styles.productCrop, { width: previewWidth, height: previewHeight }]}>
      <Image
        source={{ uri: imageUrl }}
        style={{
          position: 'absolute',
          width: imageSize.width * imageScale,
          height: imageSize.height * imageScale,
          left: -(imageSize.width * imageScale * hotspot.x) / 100,
          top: -(imageSize.height * imageScale * hotspot.y) / 100,
        }}
        contentFit="fill"
      />
    </View>
  );
}

export default function BrochureViewerScreen({ brochureId }: { brochureId: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { activeHouseholdId } = useActiveHousehold();
  const addShoppingItem = useAddShoppingItem();
  const { data: pages, isLoading } = useBrochurePages(brochureId);
  const { data: householdStores = [] } = useStores(activeHouseholdId ?? undefined);
  const [activeHotspot, setActiveHotspot] = useState<Hotspot | null>(null);
  const [activePageImage, setActivePageImage] = useState<{
    url: string;
    size: Size;
  } | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [hotspotsVisible, setHotspotsVisible] = useState(true);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  useEffect(() => {
    if (!pages) return;
    debugLog('[brochures] viewer data ready', {
      brochureId,
      pageCount: pages.length,
      hotspotCount: pages.reduce((total, page) => total + page.hotspots.length, 0),
      pagesWithHotspots: pages.filter((page) => page.hotspots.length > 0).length,
      firstPage: pages[0]
        ? {
            pageNumber: pages[0].pageNumber,
            imageHost: imageHost(pages[0].imageUrl),
            hotspotCount: pages[0].hotspots.length,
          }
        : null,
    });
  }, [brochureId, pages]);

  if (isLoading || !pages) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.accent} />
        <Txt variant="body" tone="secondary">
          Prospekt wird geladen...
        </Txt>
      </View>
    );
  }

  function selectHotspot(hotspot: Hotspot, imageUrl: string, imageSize: Size) {
    debugLog('[brochures] hotspot selected', {
      pageIndex: currentPageIndex,
      hotspotId: hotspot.id,
      title: hotspot.title,
    });
    if (hotspot.kind === 'linkout' || (hotspot.kind === 'unknown' && hotspot.linkoutUrl)) {
      if (hotspot.linkoutUrl) void Linking.openURL(hotspot.linkoutUrl);
      return;
    }

    setQuantity(1);
    setActiveHotspot(hotspot);
    setActivePageImage({ url: imageUrl, size: imageSize });
  }

  function closeProductSheet() {
    setActiveHotspot(null);
    setActivePageImage(null);
    setQuantity(1);
  }

  async function addActiveHotspot() {
    if (!activeHotspot || !activeHouseholdId) {
      Alert.alert('Kein Haushalt ausgewählt', 'Wähle zuerst einen Haushalt aus.');
      return;
    }

    try {
      const brochureStoreName = pages?.[0]?.storeName;
      const householdStore = brochureStoreName
        ? findStoreByName(householdStores, brochureStoreName)
        : undefined;
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
        store_id: householdStore?.id ?? null,
        price_estimate: (() => {
          const { priceCents } = hotspotPrices(activeHotspot);
          return priceCents === undefined ? null : (priceCents * quantity) / 100;
        })(),
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
      <PagerView
        style={styles.pagerView}
        initialPage={0}
        onPageSelected={({ nativeEvent }) => {
          const page = pages[nativeEvent.position];
          setCurrentPageIndex(nativeEvent.position);
          debugLog('[brochures] viewer page selected', {
            pageIndex: nativeEvent.position,
            pageNumber: page?.pageNumber ?? null,
            hotspotCount: page?.hotspots.length ?? 0,
            imageHost: page ? imageHost(page.imageUrl) : null,
          });
        }}>
        {pages.map((page: LocalBrochurePage, index) => (
          <BrochurePage
            key={page.id}
            page={page}
            activeHotspot={activeHotspot}
            hotspotsVisible={hotspotsVisible}
            isCurrent={index === currentPageIndex}
            onSelectHotspot={selectHotspot}
          />
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
                backgroundColor: colors.backgroundElement,
                borderColor: colors.border,
              },
            ]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Pressable
              role="button"
              aria-label="Artikeldetails schließen"
              style={[styles.sheetClose, { backgroundColor: colors.background }]}
              onPress={closeProductSheet}>
              <Txt variant="body" style={[styles.sheetCloseText, { color: colors.text }]}>
                ×
              </Txt>
            </Pressable>

            {activePageImage && activePageImage.size.width > 0 ? (
              <ProductCropPreview
                imageUrl={activePageImage.url}
                imageSize={activePageImage.size}
                hotspot={activeHotspot}
              />
            ) : activeHotspot.imageUrl ? (
              <Image source={{ uri: activeHotspot.imageUrl }} style={styles.productPreviewImage} />
            ) : null}

            <View style={[styles.productCard, { backgroundColor: colors.accent }]}>
              <View style={styles.productCopy}>
                <Txt variant="bodySmall" tone="onAccent" weight="600" numberOfLines={2}>
                  {activeHotspot.title}
                </Txt>
                <Txt variant="detail" tone="onAccent" weight="600">
                  {pages?.[0]?.storeName ?? 'Supermarkt'}
                </Txt>
              </View>
              {hotspotPrice(activeHotspot) ? (
                <Txt variant="controlValue" tone="onAccent" weight="800">
                  {hotspotPrice(activeHotspot)}
                </Txt>
              ) : null}
            </View>

            {activeHotspot.description ? (
              <Txt variant="bodySmall" tone="secondary">
                {activeHotspot.description}
              </Txt>
            ) : null}

            <View style={styles.actionRow}>
              <View
                style={[
                  styles.stepper,
                  { borderColor: colors.border, backgroundColor: colors.background },
                ]}>
                <Pressable
                  role="button"
                  aria-label="Menge verringern"
                  disabled={quantity === 1}
                  style={styles.stepperButton}
                  onPress={() => setQuantity((current) => Math.max(1, current - 1))}>
                  <Txt variant="stepperAction" tone={quantity === 1 ? 'secondary' : 'primary'}>
                    −
                  </Txt>
                </Pressable>
                <Txt
                  variant="controlValue"
                  weight="700"
                  style={[styles.quantity, { color: colors.text }]}>
                  {quantity}×
                </Txt>
                <Pressable
                  role="button"
                  aria-label="Menge erhöhen"
                  style={styles.stepperButton}
                  onPress={() => setQuantity((current) => current + 1)}>
                  <Txt variant="stepperAction" tone="primary">
                    +
                  </Txt>
                </Pressable>
              </View>
              <Pressable
                role="button"
                aria-label="Auf die Einkaufsliste"
                disabled={addShoppingItem.isPending}
                style={[
                  styles.addButton,
                  {
                    backgroundColor: colors.accent,
                    opacity: addShoppingItem.isPending ? 0.6 : 1,
                  },
                ]}
                onPress={addActiveHotspot}>
                {addShoppingItem.isPending ? (
                  <ActivityIndicator color={colors.onAccent} />
                ) : (
                  <Txt variant="bodyRelaxed" tone="onAccent" weight="700">
                    Auf die Liste
                  </Txt>
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
            backgroundColor: hotspotsVisible ? colors.accent : withAlpha(colors.text, 0.7),
          },
        ]}
        onPress={() => setHotspotsVisible((visible) => !visible)}>
        <Txt variant="bodySmall" tone="onAccent" weight="700">
          Artikel
        </Txt>
      </Pressable>
      <Pressable
        role="button"
        aria-label="Prospekt schließen"
        style={[
          styles.closeButton,
          { top: Math.max(insets.top, 16), backgroundColor: withAlpha(colors.text, 0.7) },
        ]}
        onPress={() => router.back()}>
        <Txt variant="bodySmall" tone="onAccent" weight="700">
          ✕
        </Txt>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  pagerView: { flex: 1 },
  page: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pageImage: { position: 'absolute', inset: 0, zIndex: 0 },
  hotspotsOverlay: { position: 'absolute', zIndex: 1 },
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
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 11,
    gap: 12,
  },
  productCopy: { flex: 1, gap: 2 },
  sheetDiscount: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  sheetDiscountText: { fontSize: 12, fontWeight: '800' },
  productPreviewImage: { width: 248, height: 300, alignSelf: 'center', borderRadius: 4 },
  productCrop: { alignSelf: 'center', overflow: 'hidden', borderRadius: 4 },
  sheetClose: {
    position: 'absolute',
    top: 18,
    right: 18,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  sheetCloseText: { fontSize: 38, fontWeight: '300', lineHeight: 42 },
  actionRow: { flexDirection: 'row', gap: 12 },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12 },
  stepperButton: { width: 42, minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  quantity: { minWidth: 30, textAlign: 'center' },
  addButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
