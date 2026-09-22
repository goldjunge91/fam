import { useQueries } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Modal, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Screen } from '@/components/layout/screen';
import { Button, Press, Txt } from '@/constants/ui';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import {
  createReceiptAssetSignedUrl,
  receiptAssetsQueryKey,
  useConfirmedReceiptItems,
  useDeleteReceiptAssetMutation,
  useReceipt,
  useReceiptAssets,
} from '@/features/ocr/authority/api';
import { categoryLabelForId } from '@/features/shopping-list/domain-logik/shopping-categories';
import { formatReceiptDate, formatReceiptMoney, formatReceiptNumber } from './formatting';

const styles = StyleSheet.create((theme) => ({
  content: { gap: theme.space.lg },
  fieldList: { gap: theme.space.sm },
  field: { gap: theme.space.xs / 2 },
  itemList: { gap: theme.space.sm },
  item: {
    gap: theme.space.xs,
    padding: theme.space.lg,
    borderRadius: theme.radius.md,
    borderWidth: theme.borderWidth.base,
    borderColor: theme.border,
    backgroundColor: theme.backgroundElement,
  },
  itemPrice: { alignSelf: 'flex-end' },
  assetList: { gap: theme.space.md },
  assetRow: { gap: theme.space.xs },
  assetPreview: {
    width: '100%',
    height: 260,
    borderRadius: theme.radius.md,
    backgroundColor: theme.backgroundSoft,
  },
  assetActions: { flexDirection: 'row', gap: theme.space.sm },
  viewer: {
    flex: 1,
    justifyContent: 'center',
    gap: theme.space.lg,
    padding: theme.space.lg,
    backgroundColor: theme.background,
  },
  viewerImage: { width: '100%', height: '80%' },
}));

function paramValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function formatItemMeasure(
  quantity: number | null,
  unit: string | null,
  packageSize: number | null,
  packageSizeUnit: string | null,
  locale: string,
  unknown: string,
): string {
  const quantityText = quantity === null ? null : formatReceiptNumber(quantity, locale);
  const packageText = packageSize === null ? null : formatReceiptNumber(packageSize, locale);
  const quantityPart =
    quantity === null
      ? unit
        ? `${unknown} (${unit})`
        : null
      : [quantityText, unit].filter(Boolean).join(' ');
  const packagePart = [packageText, packageSizeUnit].filter(Boolean).join(' ');
  return [quantityPart, packagePart].filter(Boolean).join(' · ') || unknown;
}

export function ReceiptDetailScreen() {
  const { t, i18n } = useTranslation();
  const { activeHouseholdId } = useActiveHousehold();
  const { receiptId: rawReceiptId } = useLocalSearchParams<{ receiptId?: string | string[] }>();
  const receiptId = paramValue(rawReceiptId);
  const receiptQuery = useReceipt(activeHouseholdId ?? undefined, receiptId);
  const itemsQuery = useConfirmedReceiptItems(activeHouseholdId ?? undefined, receiptId);
  const assetsQuery = useReceiptAssets(activeHouseholdId ?? undefined, receiptId);
  const deleteAssetMutation = useDeleteReceiptAssetMutation();
  const [viewer, setViewer] = useState<{ uri: string; number: number } | null>(null);

  const assets = assetsQuery.data ?? [];
  const previewQueries = useQueries({
    queries: assets.map((asset) => ({
      queryKey: [
        ...receiptAssetsQueryKey(activeHouseholdId ?? undefined, receiptId),
        'signed-url',
        asset.id,
      ],
      queryFn: () =>
        createReceiptAssetSignedUrl(
          {
            householdId: activeHouseholdId as string,
            receiptId: receiptId as string,
            storagePath: asset.storage_path,
          },
          {},
        ),
      enabled: Boolean(activeHouseholdId && receiptId),
      staleTime: 50 * 60 * 1000,
    })),
  });

  async function confirmDeleteAsset(assetId: string, storagePath: string) {
    if (!activeHouseholdId || !receiptId) return;
    Alert.alert(t('ocr.history.deleteAssetTitle'), t('ocr.history.deleteAssetBody'), [
      { text: t('ocr.history.cancel'), style: 'cancel' },
      {
        text: t('ocr.history.delete'),
        style: 'destructive',
        onPress: () =>
          void deleteAssetMutation.mutateAsync({
            householdId: activeHouseholdId,
            receiptId,
            assetId,
            storagePath,
          }),
      },
    ]);
  }

  if (receiptQuery.isLoading || itemsQuery.isLoading) {
    return (
      <Screen title={t('ocr.history.detailTitle')} back={{ label: t('ocr.history.title') }}>
        <Txt variant="body" tone="secondary">
          {t('common.loading')}
        </Txt>
      </Screen>
    );
  }

  const receipt = receiptQuery.data;
  if (!receipt || !activeHouseholdId || !receiptId) {
    return (
      <Screen title={t('ocr.history.detailTitle')} back={{ label: t('ocr.history.title') }}>
        <Txt variant="body" tone="secondary">
          {t('ocr.history.loadError')}
        </Txt>
      </Screen>
    );
  }

  const date = receipt.purchase_date
    ? formatReceiptDate(receipt.purchase_date, i18n.language)
    : t('ocr.history.noDate');
  const total =
    receipt.total_cents === null
      ? t('ocr.history.totalUnknown')
      : formatReceiptMoney(receipt.total_cents, receipt.currency, i18n.language);

  return (
    <>
      <Screen
        title={t('ocr.history.detailTitle')}
        subtitle={receipt.store_name ?? t('ocr.history.noStore')}
        back={{ label: t('ocr.history.title') }}
        contentStyle={styles.content}>
        <View style={styles.fieldList}>
          <View style={styles.field}>
            <Txt variant="caption" tone="secondary">
              {t('ocr.history.store')}
            </Txt>
            <Txt variant="body">{receipt.store_name ?? t('ocr.history.noStore')}</Txt>
          </View>
          <View style={styles.field}>
            <Txt variant="caption" tone="secondary">
              {t('ocr.history.date')}
            </Txt>
            <Txt variant="body">{date}</Txt>
          </View>
          <View style={styles.field}>
            <Txt variant="caption" tone="secondary">
              {t('ocr.history.currency')}
            </Txt>
            <Txt variant="body">{receipt.currency}</Txt>
          </View>
          <View style={styles.field}>
            <Txt variant="caption" tone="secondary">
              {t('ocr.history.total')}
            </Txt>
            <Txt variant="heading">{total}</Txt>
          </View>
          <View style={styles.field}>
            <Txt variant="caption" tone="secondary">
              {t('ocr.history.status')}
            </Txt>
            <Txt variant="body">{t('ocr.history.confirmed')}</Txt>
          </View>
        </View>

        <View style={styles.fieldList}>
          <Txt variant="heading">{t('ocr.history.items')}</Txt>
          {itemsQuery.data?.length ? (
            <View style={styles.itemList}>
              {itemsQuery.data.map((item) => {
                const measure = formatItemMeasure(
                  item.quantity,
                  item.unit,
                  item.package_size,
                  item.package_size_unit,
                  i18n.language,
                  t('ocr.history.quantityUnknown'),
                );
                const price =
                  item.line_total_cents === null
                    ? t('ocr.history.priceUnknown')
                    : formatReceiptMoney(item.line_total_cents, receipt.currency, i18n.language);
                const category = item.category_id
                  ? (categoryLabelForId(item.category_id) ?? item.category_id)
                  : null;
                return (
                  <View key={item.id} style={styles.item}>
                    <Txt variant="subheading">{item.name}</Txt>
                    <Txt variant="body" tone="secondary">
                      {measure}
                    </Txt>
                    <Txt variant="subheading" weight="700" style={styles.itemPrice}>
                      {price}
                    </Txt>
                    {item.product_id ? (
                      <Txt variant="caption" tone="secondary">
                        {t('ocr.history.product')}: {item.product_name ?? item.product_id}
                        {item.product_brand ? ` · ${item.product_brand}` : ''}
                      </Txt>
                    ) : null}
                    {category ? (
                      <Txt variant="caption" tone="secondary">
                        {t('ocr.history.category')}: {category}
                      </Txt>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : (
            <Txt variant="body" tone="secondary">
              {t('ocr.history.noItems')}
            </Txt>
          )}
        </View>

        <View style={styles.fieldList}>
          <Txt variant="heading">{t('ocr.history.assets')}</Txt>
          {assetsQuery.isError ? (
            <Txt variant="body" tone="secondary">
              {t('ocr.history.assetsUnavailable')}
            </Txt>
          ) : assets.length === 0 ? (
            <Txt variant="body" tone="secondary">
              {t('ocr.history.noAssets')}
            </Txt>
          ) : (
            <View style={styles.assetList}>
              {assets.map((asset, index) => {
                const uri = previewQueries[index]?.data;
                return (
                  <View key={asset.id} style={styles.assetRow}>
                    {uri ? (
                      <Press
                        onPress={() => setViewer({ uri, number: index + 1 })}
                        accessibilityRole="button"
                        accessibilityLabel={t('ocr.history.openAsset', { number: index + 1 })}
                        haptic="none"
                        scaleTo={0.99}>
                        <Image source={{ uri }} style={styles.assetPreview} contentFit="contain" />
                      </Press>
                    ) : (
                      <Txt variant="body" tone="secondary">
                        {t('ocr.history.assetsUnavailable')}
                      </Txt>
                    )}
                    <View style={styles.assetActions}>
                      <Button
                        title={t('ocr.history.deleteAsset', { number: index + 1 })}
                        variant="danger"
                        size="sm"
                        onPress={() => void confirmDeleteAsset(asset.id, asset.storage_path)}
                        loading={deleteAssetMutation.isPending}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </Screen>

      <Modal visible={viewer !== null} animationType="fade" onRequestClose={() => setViewer(null)}>
        <View style={styles.viewer}>
          <Press
            onPress={() => setViewer(null)}
            accessibilityRole="button"
            accessibilityLabel={t('ocr.history.closeViewer')}
            haptic="none">
            <Txt variant="body" tone="accent">
              {t('ocr.history.closeViewer')}
            </Txt>
          </Press>
          {viewer ? (
            <Image source={{ uri: viewer.uri }} style={styles.viewerImage} contentFit="contain" />
          ) : null}
        </View>
      </Modal>
    </>
  );
}
