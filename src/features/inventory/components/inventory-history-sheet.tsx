import { FlashList } from '@shopify/flash-list';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { radius } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Button, IconButton, Txt } from '@/constants/ui';
import { useSheetShadowStyle } from '@/hooks/use-sheet-shadow-style';
import { formatAmount } from '@/lib/package-size';

import {
  getInventoryTransactionLabel,
  groupInventoryTransactions,
  type LocalInventoryTransaction,
} from '../use-inventory-transactions';

type InventoryHistorySheetProps = {
  visible: boolean;
  title: string;
  subtitle: string;
  transactions: LocalInventoryTransaction[];
  onClose: () => void;
  productSummary?: {
    sealed: number;
    opened: number;
    unit: string;
    sealedSubtitle?: string;
    openedSubtitle?: string;
  };
  historyHeading?: string;
  footerNote?: string;
  lotLabels?: ReadonlyMap<string, string>;
  fullScreen?: boolean;
  loading?: boolean;
  error?: boolean;
  offline?: boolean;
  onRetry?: () => void;
};

type HistoryRow =
  | { kind: 'header'; id: string; label: string }
  | { kind: 'transaction'; id: string; transaction: LocalInventoryTransaction };

function selectHistoryTransactions(
  transactions: readonly LocalInventoryTransaction[],
): LocalInventoryTransaction[] {
  const singleLegTransactions: LocalInventoryTransaction[] = [];
  const operationRepresentatives = new Map<string, LocalInventoryTransaction>();

  for (const transaction of transactions) {
    if (transaction.operation_leg_count <= 1) {
      singleLegTransactions.push(transaction);
      continue;
    }

    const representative = operationRepresentatives.get(transaction.operation_id);
    if (!representative || (transaction.type === 'in' && representative.type !== 'in')) {
      operationRepresentatives.set(transaction.operation_id, transaction);
    }
  }

  return [...singleLegTransactions, ...operationRepresentatives.values()];
}

function transactionReasonLabel(reason: LocalInventoryTransaction['reason']): string | null {
  if (reason === 'expired') return 'Abgelaufen';
  if (reason === 'spoiled') return 'Schlecht geworden';
  if (reason === 'other') return 'Sonstiges';
  return null;
}

export function InventoryHistorySheet({
  visible,
  title,
  subtitle,
  transactions,
  onClose,
  productSummary,
  historyHeading,
  footerNote,
  lotLabels,
  fullScreen = false,
  loading = false,
  error = false,
  offline = false,
  onRetry,
}: InventoryHistorySheetProps) {
  const { colors } = useTheme();
  const sheetStyle = useSheetShadowStyle();
  const rows: HistoryRow[] = groupInventoryTransactions(
    selectHistoryTransactions(transactions),
  ).flatMap((group) => [
    { kind: 'header' as const, id: `header-${group.key}`, label: group.label },
    ...group.transactions.map((transaction) => ({
      kind: 'transaction' as const,
      id: transaction.id,
      transaction,
    })),
  ]);

  const sheet = (
    <View
      className={
        fullScreen ? 'flex-1 gap-three bg-background px-four pt-two' : 'fridge-actions-sheet flex-1'
      }
      style={fullScreen ? undefined : sheetStyle}>
      {!fullScreen ? <View className="fridge-actions-handle" /> : null}
      <View className="flex-row items-start justify-between">
        <View className="gap-one">
          <Txt variant="title">{title}</Txt>
          <Txt variant="caption" tone="secondary">
            {subtitle}
          </Txt>
        </View>
        <IconButton
          icon="x"
          onPress={onClose}
          accessibilityLabel="Schließen"
          bg={colors.backgroundSoft}
          size={45}
          iconSize={24}
          style={{ borderRadius: radius.lg, shadowOpacity: 0, elevation: 0 }}
        />
      </View>

      {productSummary ? (
        <View className="inventory-state-summary">
          {productSummary.sealed > 0 ? (
            <StateSummaryCard
              label="Versiegelt"
              value={formatAmount(productSummary.sealed, productSummary.unit)}
              subtitle={productSummary.sealedSubtitle}
            />
          ) : null}
          {productSummary.opened > 0 ? (
            <StateSummaryCard
              label="Geöffnet"
              value={formatAmount(productSummary.opened, productSummary.unit)}
              subtitle={productSummary.openedSubtitle}
              open
            />
          ) : null}
        </View>
      ) : null}

      {offline ? (
        <Txt variant="caption" tone="secondary">
          Offline: lokale Daten werden angezeigt.
        </Txt>
      ) : null}

      <FlashList
        data={rows}
        keyExtractor={(row) => row.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListHeaderComponent={
          historyHeading ? (
            <Txt
              variant="caption"
              tone="secondary"
              weight="700"
              className="mb-two mt-four uppercase">
              {historyHeading}
            </Txt>
          ) : null
        }
        renderItem={({ item: row }) =>
          row.kind === 'header' ? (
            <Txt
              variant="caption"
              tone="secondary"
              weight="700"
              className="mb-two mt-four uppercase tracking-[0.5px]">
              {row.label}
            </Txt>
          ) : (
            <HistoryTransactionRow
              transaction={row.transaction}
              colors={colors}
              compactLabel={!!productSummary}
              lotLabel={
                row.transaction.fridge_item_id
                  ? lotLabels?.get(row.transaction.fridge_item_id)
                  : undefined
              }
            />
          )
        }
        ListFooterComponent={
          footerNote ? (
            <Txt variant="caption" tone="secondary" className="inventory-history-footer-note">
              {footerNote}
            </Txt>
          ) : null
        }
        ListEmptyComponent={
          loading ? (
            <View className="py-six">
              <Txt variant="body" tone="secondary">
                Verlauf wird geladen…
              </Txt>
            </View>
          ) : error ? (
            <View className="items-start gap-two py-six">
              <Txt variant="body" tone="secondary">
                Verlauf konnte nicht geladen werden.
              </Txt>
              {onRetry ? (
                <Button title="Erneut versuchen" variant="secondary" onPress={onRetry} />
              ) : null}
            </View>
          ) : (
            <View className="py-six">
              <Txt variant="body" tone="secondary">
                Noch keine Bewegungen vorhanden.
              </Txt>
            </View>
          )
        }
      />
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent={!fullScreen}
      animationType={fullScreen ? 'fade' : 'slide'}
      presentationStyle={fullScreen ? 'fullScreen' : undefined}
      onRequestClose={onClose}>
      <View style={StyleSheet.absoluteFill}>
        {!fullScreen ? (
          <Pressable
            className="fridge-actions-backdrop"
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Verlauf schließen"
          />
        ) : null}
        {fullScreen ? (
          <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom', 'left', 'right']}>
            {sheet}
          </SafeAreaView>
        ) : (
          sheet
        )}
      </View>
    </Modal>
  );
}

function StateSummaryCard({
  label,
  value,
  subtitle,
  open = false,
}: {
  label: string;
  value: string;
  subtitle?: string;
  open?: boolean;
}) {
  return (
    <View
      className={`inventory-state-card ${open ? 'inventory-state-card-open' : 'inventory-state-card-sealed'}`}>
      <Txt variant="caption" tone="secondary" weight="700" className="uppercase">
        {label}
      </Txt>
      <Txt variant="body" weight="700">
        {value}
      </Txt>
      {subtitle ? (
        <Txt variant="caption" tone="secondary">
          {subtitle}
        </Txt>
      ) : null}
    </View>
  );
}

function HistoryTransactionRow({
  transaction,
  colors,
  compactLabel,
  lotLabel,
}: {
  transaction: LocalInventoryTransaction;
  colors: ReturnType<typeof useTheme>['colors'];
  compactLabel: boolean;
  lotLabel?: string;
}) {
  const isWaste = transaction.type === 'waste';
  const edgeColor = isWaste
    ? colors.danger
    : transaction.reversal_of !== null || transaction.operation_leg_count > 1
      ? colors.warning
      : transaction.type === 'in'
        ? colors.success
        : colors.border;
  const reason = transactionReasonLabel(transaction.reason);
  const time = new Date(transaction.created_at).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const label = getInventoryTransactionLabel(transaction);

  return (
    <View className="inventory-history-row">
      <View className="relative w-[16px] items-center">
        <View className="absolute inset-y-0 w-[2px] bg-border" />
        <View
          className="z-10 mt-two h-[12px] w-[12px] rounded-pill"
          style={{ backgroundColor: edgeColor }}
        />
      </View>
      <View className="flex-1 gap-half">
        <View className="flex-row flex-wrap items-center gap-one">
          <Txt variant="body" weight="700">
            {compactLabel || !transaction.item_name ? label : `${label} · ${transaction.item_name}`}
          </Txt>
          {lotLabel ? (
            <View className="inventory-history-lot-tag">
              <Txt variant="caption" tone="secondary" weight="700">
                {lotLabel}
              </Txt>
            </View>
          ) : null}
        </View>
        <Txt variant="caption" tone="secondary">
          {transaction.actor ? `${transaction.actor.slice(0, 8)} · ` : ''}
          {time}
          {reason && transaction.type !== 'waste' ? ` · ${reason}` : ''}
          {transaction.location_name ? ` · ${transaction.location_name}` : ''}
        </Txt>
        {transaction.notes ? (
          <Txt variant="caption" tone="secondary">
            {transaction.notes}
          </Txt>
        ) : null}
      </View>
      <View className="items-end gap-one">
        <Txt variant="body" weight="700" style={{ fontVariant: ['tabular-nums'] }}>
          {transaction.type === 'waste' || transaction.type === 'out' ? '−' : '+'}
          {formatAmount(transaction.quantity, transaction.item_unit ?? '')}
        </Txt>
      </View>
    </View>
  );
}
