import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import { space } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { CloseButton, Press, Txt } from '@/constants/ui';
import { useProduct } from '@/features/inventory/use-product';
import { offApiSource } from '@/features/product-search/sources/off-api-source';
import { formatAmount } from '@/lib/format/package-size';
import { debugLog } from '@/lib/observability/debug-log';

export type ProductInformationItem = {
  product_id: string | null;
  name: string;
  quantity: number;
  unit: string;
  expiry_date?: string | null;
};

type ProductInformationProps = {
  visible: boolean;
  item: ProductInformationItem | null;
  onClose: () => void;
};

const NUTRI_BADGE_COLORS = {
  a: '#038141',
  b: '#85BB2F',
  c: '#FECB02',
  d: '#EE8100',
  e: '#E63E11',
};

const styles = StyleSheet.create((theme) => ({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    position: 'absolute',
    left: theme.space.md,
    right: theme.space.md,
    bottom: theme.space.md,
    maxHeight: '82%',
    borderRadius: theme.radius.famLarge,
    overflow: 'hidden',
    backgroundColor: theme.backgroundElement,
  },
  grabHandle: {
    width: 42,
    height: 4,
    borderRadius: theme.radius.pill,
    alignSelf: 'center',
    marginTop: theme.space.md,
    backgroundColor: theme.border,
  },
  content: {
    padding: theme.space.xl,
    gap: theme.space.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.space.md,
  },
  titleGroup: {
    flex: 1,
  },
  metaStack: {
    gap: theme.space.md,
  },
  closeButton: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: theme.radius.lg,
  },
  scoreCard: {
    minHeight: 88,
    borderRadius: theme.radius.lg,
    padding: theme.space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
    backgroundColor: theme.background,
  },
  scoreBadge: {
    width: 62,
    height: 62,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreContent: {
    flex: 1,
  },
  details: {
    borderWidth: theme.borderWidth.base,
    borderColor: theme.border,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
  },
  detailRow: {
    minHeight: 50,
    paddingHorizontal: theme.space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.lg,
  },
  detailLabel: {
    flex: 1,
    flexShrink: 1,
  },
  detailValue: {
    flexShrink: 1,
    textAlign: 'right',
  },
  detailRowWithDivider: {
    borderBottomWidth: 0.5,
    borderBottomColor: theme.border,
  },
  section: {
    borderRadius: theme.radius.lg,
    padding: theme.space.lg,
    gap: theme.space.md,
    backgroundColor: theme.background,
  },
  nutrients: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.sm,
  },
  nutrientCard: {
    width: '31.6%',
    minHeight: 62,
    borderRadius: theme.radius.md,
    padding: theme.space.md,
    gap: theme.space.md,
    backgroundColor: theme.backgroundSoft,
  },
}));

function formatNumber(value: number | null | undefined, digits = 1, locale = 'de-DE'): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '–';
  return value.toLocaleString(locale, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function formatExpiry(value: string | null | undefined, locale: string, fallback: string): string {
  if (!value) return fallback;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}

export function ProductInformation({ visible, item, onClose }: ProductInformationProps) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();

  const insets = useSafeAreaInsets();
  const itemId = item?.product_id ?? null;
  const hasItem = Boolean(item);

  useEffect(() => {
    if (!__DEV__ || !visible) return;
    debugLog('[InventorySheet] inventory.product-information.open', {
      sheetId: 'inventory.product-information',
      itemId,
      hasItem,
    });
  }, [hasItem, itemId, visible]);

  const { data: localProduct } = useProduct(item?.product_id);
  const { data: openFoodFactsProduct, isFetching } = useQuery({
    queryKey: ['open-food-facts-product', localProduct?.barcode],
    queryFn: ({ signal }) => offApiSource.findByBarcode(localProduct?.barcode ?? '', signal),
    enabled: visible && !!localProduct?.barcode,
    staleTime: 24 * 60 * 60 * 1000,
  });

  if (!item) return null;

  const brand =
    openFoodFactsProduct?.brand ?? localProduct?.brand ?? t('inventory.information.brandUnknown');
  const score = openFoodFactsProduct?.nutriScore;
  const nutrients = [
    {
      label: t('inventory.information.calories'),
      value: `${formatNumber(openFoodFactsProduct?.caloriesPer100g ?? localProduct?.kcal_per_100, 0, i18n.language)} kcal`,
    },
    {
      label: t('inventory.information.protein'),
      value: `${formatNumber(openFoodFactsProduct?.proteinsPer100g ?? localProduct?.protein_g_per_100, 1, i18n.language)} g`,
    },
    {
      label: t('inventory.information.carbs'),
      value: `${formatNumber(openFoodFactsProduct?.carbsPer100g ?? localProduct?.carbs_g_per_100, 1, i18n.language)} g`,
    },
    {
      label: t('inventory.information.fat'),
      value: `${formatNumber(openFoodFactsProduct?.fatPer100g ?? localProduct?.fat_g_per_100, 1, i18n.language)} g`,
    },
    {
      label: t('inventory.information.sugar'),
      value: `${formatNumber(openFoodFactsProduct?.sugarsPer100g ?? localProduct?.sugar_g_per_100, 1, i18n.language)} g`,
    },
    {
      label: t('inventory.information.salt'),
      value: `${formatNumber(openFoodFactsProduct?.saltPer100g ?? localProduct?.salt_g_per_100, 1, i18n.language)} g`,
    },
  ];
  const referenceUnit =
    item.unit === 'ml' || item.unit === 'l'
      ? t('inventory.information.per100Ml')
      : t('inventory.information.per100G');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Press
          haptic="none"
          scaleTo={1}
          containerStyle={StyleSheet.absoluteFill}
          style={[styles.backdrop, { backgroundColor: colors.scrim }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('inventory.information.close')}
        />

        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.xl }]}>
          <View style={styles.grabHandle} />
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            <View style={styles.header}>
              <View style={[styles.titleGroup, styles.metaStack]}>
                <Txt variant="title" weight="600" selectable>
                  {item.name}
                </Txt>
                <Txt variant="body" tone="secondary" weight="500" selectable>
                  {brand}
                </Txt>
              </View>
              <CloseButton
                onPress={onClose}
                accessibilityLabel={t('common.actions.close')}
                style={styles.closeButton}
              />
            </View>

            <View style={styles.scoreCard}>
              <View
                style={[
                  styles.scoreBadge,
                  {
                    backgroundColor: score ? NUTRI_BADGE_COLORS[score] : colors.backgroundSoft,
                  },
                ]}>
                <Txt variant="subheading" weight="700" tone={score ? 'onAccent' : 'primary'}>
                  {score?.toUpperCase() ?? '–'}
                </Txt>
              </View>
              <View style={[styles.scoreContent, styles.metaStack]}>
                <Txt variant="body" weight="700">
                  {t('inventory.information.nutriScore')} {score?.toUpperCase() ?? '–'}
                </Txt>
                <Txt variant="body" tone="secondary" weight="500">
                  {t('inventory.information.source')}
                </Txt>
              </View>
              {isFetching ? <ActivityIndicator size="small" color={colors.accent} /> : null}
            </View>

            <View style={styles.details}>
              <View style={[styles.detailRow, styles.detailRowWithDivider]}>
                <Txt variant="body" tone="secondary" weight="500" style={styles.detailLabel}>
                  {t('inventory.information.amountAndUnit')}
                </Txt>
                <Txt variant="body" weight="700" selectable style={styles.detailValue}>
                  {formatAmount(item.quantity, item.unit, t, i18n.language)}
                </Txt>
              </View>
              <View style={styles.detailRow}>
                <Txt variant="body" tone="secondary" weight="500" style={styles.detailLabel}>
                  {t('inventory.information.expiry')}
                </Txt>
                <Txt variant="body" weight="700" selectable style={styles.detailValue}>
                  {formatExpiry(
                    item.expiry_date,
                    i18n.language,
                    t('inventory.information.notSpecified'),
                  )}
                </Txt>
              </View>
            </View>

            <View style={styles.section}>
              <Txt variant="body" weight="700">
                {t('inventory.information.ingredients')}
              </Txt>
              <Txt variant="body" tone="secondary" weight="500" selectable>
                {openFoodFactsProduct?.ingredients ?? t('inventory.information.noIngredients')}
              </Txt>
            </View>

            <View style={styles.section}>
              <Txt variant="body" weight="700">
                {t('inventory.information.allergens')}
              </Txt>
              <Txt variant="body" tone="secondary" weight="500" selectable>
                {openFoodFactsProduct?.allergens?.join(', ') ??
                  t('inventory.information.noAllergens')}
              </Txt>
            </View>

            <Txt variant="body" weight="700">
              {t('inventory.information.nutritionPer', { unit: referenceUnit })}
            </Txt>
            <View style={styles.nutrients}>
              {nutrients.map((nutrient) => (
                <View key={nutrient.label} style={styles.nutrientCard}>
                  <Txt variant="body" weight="700" selectable>
                    {nutrient.value}
                  </Txt>
                  <Txt variant="body" tone="secondary" weight="500">
                    {nutrient.label}
                  </Txt>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
