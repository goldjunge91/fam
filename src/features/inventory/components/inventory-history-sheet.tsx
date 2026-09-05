import { FlashList } from '@shopify/flash-list';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/components/theme/ThemeProvider';
import { Button, Txt } from '@/constants/ui';
import { useSheetShadowStyle } from '@/hooks/use-sheet-shadow-style';
import { formatAmount } from '@/lib/package-size';

import {
  groupTransactionsByDay,
  type LocalInventoryTransaction,
  transactionLabel,
  transactionReasonLabel,
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
  onOpenFullHistory?: () => void;
  onUndo?: (transaction: LocalInventoryTransaction) => void;
};

type HistoryRow =
  | { kind: 'header'; id: string; label: string }
  | { kind: 'transaction'; id: string; transaction: LocalInventoryTransaction };

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
  onOpenFullHistory,
  onUndo,
}: InventoryHistorySheetProps) {
  const { colors } = useTheme();
  const sheetStyle = useSheetShadowStyle();
  const rows: HistoryRow[] = groupTransactionsByDay(transactions).flatMap((group) => [
    { kind: 'header' as const, id: `header-${group.key}`, label: group.label },
    ...group.transactions.map((transaction) => ({
      kind: 'transaction' as const,
      id: transaction.id,
      transaction,
    })),
  ]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={StyleSheet.absoluteFill}>
        <Pressable
          className="fridge-actions-backdrop"
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Verlauf schließen"
        />
        <View className="fridge-actions-sheet flex-1" style={sheetStyle}>
          <View className="fridge-actions-handle" />
          <View className="flex-row items-start justify-between">
            <View className="gap-one">
              <Txt variant="title">{title}</Txt>
              <Txt variant="caption" tone="secondary">
                {subtitle}
              </Txt>
            </View>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Schließen">
              <Txt variant="title" tone="secondary">
                ×
              </Txt>
            </Pressable>
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

          {onOpenFullHistory ? (
            <Button
              variant="link"
              title="Gesamten Verlauf öffnen ›"
              onPress={onOpenFullHistory}
              accessibilityLabel="Gesamten Verlauf öffnen"
            />
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
                  onUndo={onUndo}
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
              <View className="py-six">
                <Txt variant="body" tone="secondary">
                  Noch keine Bewegungen vorhanden.
                </Txt>
              </View>
            }
          />
        </View>
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
  onUndo,
}: {
  transaction: LocalInventoryTransaction;
  colors: ReturnType<typeof useTheme>['colors'];
  compactLabel: boolean;
  lotLabel?: string;
  onUndo?: (transaction: LocalInventoryTransaction) => void;
}) {
  const isWaste = transaction.type === 'waste';
  const edgeColor = isWaste
    ? colors.danger
    : transaction.type === 'in'
      ? colors.success
      : transaction.type === 'open'
        ? colors.warning
        : colors.border;
  const reason = transactionReasonLabel(transaction.reason);
  const time = new Date(transaction.created_at).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const undoAvailable =
    transaction.type === 'open' &&
    !transaction.notes?.includes('[Undone]') &&
    !Number.isNaN(new Date(transaction.created_at).getTime()) &&
    Date.now() - new Date(transaction.created_at).getTime() <= 24 * 60 * 60 * 1000;

  return (
    <View className="inventory-history-row">
      <View className="inventory-history-edge" style={{ backgroundColor: edgeColor }} />
      <View className="flex-1 gap-half">
        <View className="flex-row flex-wrap items-center gap-one">
          <Txt variant="body" weight="700">
            {transactionLabel(transaction, compactLabel ? null : transaction.item_name)}
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
        {undoAvailable && onUndo ? (
          <Pressable
            onPress={() => onUndo(transaction)}
            accessibilityRole="button"
            accessibilityLabel="Öffnung rückgängig machen">
            <Txt variant="caption" color={colors.accent} weight="700">
              Undo
            </Txt>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
