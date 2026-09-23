import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Screen } from '@/components/layout/screen';
import { Press, Txt } from '@/constants/ui';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { type LocalReceiptRow, useConfirmedReceipts } from '@/features/ocr/authority/api';
import { debugLogEvent } from '@/lib/observability/debug-log';
import { formatReceiptDate, formatReceiptMoney } from './formatting';
import { sortReceiptHistory } from './model';

const styles = StyleSheet.create((theme) => ({
  list: { flex: 1 },
  listContent: { paddingBottom: theme.space.xxxl },
  separator: { height: theme.space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
    padding: theme.space.lg,
    borderRadius: theme.radius.md,
    borderWidth: theme.borderWidth.base,
    borderColor: theme.border,
    backgroundColor: theme.backgroundElement,
  },
  rowCopy: { flex: 1, gap: theme.space.xs },
  date: { textTransform: 'capitalize' },
  total: { textAlign: 'right' },
  empty: { paddingVertical: theme.space.xxxl },
}));

function ReceiptHistoryRow({ receipt }: { receipt: LocalReceiptRow }) {
  const { t, i18n } = useTranslation();
  const date = receipt.purchase_date
    ? formatReceiptDate(receipt.purchase_date, i18n.language)
    : t('ocr.history.noDate');
  const store = receipt.store_name ?? t('ocr.history.noStore');
  const total =
    receipt.total_cents === null
      ? t('ocr.history.totalUnknown')
      : formatReceiptMoney(receipt.total_cents, receipt.currency, i18n.language);

  return (
    <Press
      onPress={() => {
        debugLogEvent('receipt.history.button_pressed', { button: 'open_receipt' });
        router.push(`/household/receipt/${receipt.id}`);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${store}, ${date}, ${total}`}
      haptic="none"
      scaleTo={0.99}>
      <View style={styles.row}>
        <View style={styles.rowCopy}>
          <Txt variant="heading">{store}</Txt>
          <Txt variant="body" tone="secondary" style={styles.date}>
            {date}
          </Txt>
        </View>
        <Txt variant="subheading" weight="700" style={styles.total}>
          {total}
        </Txt>
        <Txt variant="title" tone="secondary">
          ›
        </Txt>
      </View>
    </Press>
  );
}

export function ReceiptHistoryScreen() {
  const { t } = useTranslation();
  const { activeHouseholdId } = useActiveHousehold();
  const receiptsQuery = useConfirmedReceipts(activeHouseholdId ?? undefined);
  const receipts = sortReceiptHistory(receiptsQuery.data ?? []);

  return (
    <Screen
      title={t('ocr.history.title')}
      back={{ label: t('settings.backToSettings'), href: '/settings' }}
      backStyle="icon"
      scroll={false}>
      {receiptsQuery.isLoading ? (
        <Txt variant="body" tone="secondary">
          {t('common.loading')}
        </Txt>
      ) : receiptsQuery.isError ? (
        <Txt variant="body" tone="danger">
          {t('ocr.history.loadError')}
        </Txt>
      ) : (
        <FlashList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={receipts}
          keyExtractor={(receipt) => receipt.id}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <Txt variant="body" tone="secondary" center style={styles.empty}>
              {t('ocr.history.empty')}
            </Txt>
          }
          renderItem={({ item }) => <ReceiptHistoryRow receipt={item} />}
        />
      )}
    </Screen>
  );
}
