import { FlashList } from '@shopify/flash-list';
import { useEffect } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import { BackButton } from '@/components/layout/back-button';
import { radius, space, withAlpha } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Button, IconButton, Txt } from '@/constants/ui';
import { useSheetShadowStyle } from '@/hooks/use-sheet-shadow-style';
import { formatAmount } from '@/lib/format/package-size';

import { debugLog } from '@/lib/observability/debug-log';
import {
  groupTransactionsByDay,
  isInventoryTransactionUndoable,
  type LocalInventoryTransaction,
  transactionLabel,
  transactionReasonLabel,
  transactionUndoLabel,
} from '../use-inventory-transactions';

type InventoryHistorySheetProps = {
  visible: boolean;
  title: string;
  subtitle: string;
  transactions: LocalInventoryTransaction[];
  onClose: () => void;
  onBack?: () => void;
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
  onUndo?: (transaction: LocalInventoryTransaction) => void;
  undoPending?: boolean;
  loading?: boolean;
  error?: boolean;
  offline?: boolean;
  onRetry?: () => void;
};

type HistoryRow =
  | { kind: 'header'; id: string; label: string }
  | { kind: 'transaction'; id: string; transaction: LocalInventoryTransaction };

const styles = StyleSheet.create((theme) => ({
  sheet: {
    flex: 1,
  },
  fullScreenSheet: {
    backgroundColor: theme.background,
  },
  bottomSheet: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    flex: 1,
    maxHeight: '85%',
    overflow: 'hidden',
    gap: theme.space.lg,
    paddingHorizontal: theme.space.lg,
    paddingTop: theme.space.md,
    borderRadius: theme.radius.famLarge,
    backgroundColor: theme.backgroundElement,
  },
  handle: {
    width: 42,
    height: 4,
    alignSelf: 'center',
    borderRadius: radius.micro,
    backgroundColor: theme.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: theme.space.md,
  },
  closeButton: {
    borderRadius: theme.radius.lg,
  },
  fullScreenHeader: {
    paddingHorizontal: theme.space.lg,
    paddingTop: theme.space.xs,
  },
  titleCopy: {
    flex: 1,
    gap: theme.space.xs,
    paddingRight: theme.space.lg,
  },
  headerWithBack: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: theme.space.sm,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleBelow: {
    alignItems: 'flex-start',
    gap: theme.space.xs,
  },
  fullScreenSummary: {
    paddingHorizontal: theme.space.lg,
    marginBottom: theme.space.sm,
  },
  fullScreenOffline: {
    paddingHorizontal: theme.space.lg,
    marginBottom: theme.space.xs,
  },
  list: {
    flex: 1,
  },
  fullScreenListContent: {
    paddingHorizontal: theme.space.lg,
  },
  historyHeading: {
    marginTop: theme.space.lg,
    marginBottom: theme.space.sm,
    textTransform: 'uppercase',
  },
  transactionHeading: {
    letterSpacing: 0.5,
  },
  footerNote: {
    marginTop: theme.space.lg,
    paddingTop: theme.space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.border,
  },
  loadingEmpty: {
    paddingVertical: theme.space.xxxl,
  },
  errorEmpty: {
    alignItems: 'flex-start',
    gap: theme.space.sm,
    paddingVertical: theme.space.xxxl,
  },
  empty: {
    paddingVertical: theme.space.xxxl,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: theme.scrim,
  },
  fullScreenContainer: {
    flex: 1,
    backgroundColor: theme.background,
  },
  stateSummary: {
    flexDirection: 'row',
    gap: theme.space.sm,
  },
  stateCard: {
    flex: 1,
    gap: theme.space.xs / 2,
    padding: theme.space.lg,
    borderRadius: theme.radius.md,
    backgroundColor: theme.backgroundSoft,
  },
  stateCardOpen: {
    borderWidth: theme.borderWidth.base,
    borderColor: theme.warning,
    backgroundColor: withAlpha(theme.warning, 0.16),
  },
  stateCardLabel: {
    textTransform: 'uppercase',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: theme.space.sm,
    marginBottom: theme.space.sm,
    paddingBottom: theme.space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  timeline: {
    position: 'relative',
    width: 16,
    alignItems: 'center',
  },
  timelineLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: theme.border,
  },
  timelineDot: {
    zIndex: 1,
    width: 12,
    height: 12,
    marginTop: theme.space.sm,
    borderRadius: theme.radius.pill,
  },
  transactionContent: {
    flex: 1,
    gap: theme.space.xs / 2,
  },
  transactionTitleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.space.xs,
  },
  lotTag: {
    paddingHorizontal: theme.space.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    borderRadius: radius.xs,
  },
  amountColumn: {
    alignItems: 'flex-end',
    gap: theme.space.xs,
    paddingRight: theme.space.sm,
  },
  amount: {
    fontVariant: ['tabular-nums'],
  },
}));

export function InventoryHistorySheet({
  visible,
  title,
  subtitle,
  transactions,
  onClose,
  onBack,
  productSummary,
  historyHeading,
  footerNote,
  lotLabels,
  fullScreen = false,
  onUndo,
  undoPending = false,
  loading = false,
  error = false,
  offline = false,
  onRetry,
}: InventoryHistorySheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const sheetStyle = useSheetShadowStyle();
  const transactionCount = transactions.length;

  useEffect(() => {
    if (!__DEV__ || !visible) return;
    debugLog('[InventorySheet] inventory.history-sheet.open', {
      sheetId: 'inventory.history-sheet',
      transactionCount,
      fullScreen,
      title,
    });
  }, [fullScreen, title, transactionCount, visible]);

  const rows: HistoryRow[] = groupTransactionsByDay(transactions).flatMap((group) => [
    {
      kind: 'header' as const,
      id: `header-${group.key}`,
      label: group.label,
    },
    ...group.transactions.map((transaction) => ({
      kind: 'transaction' as const,
      id: transaction.id,
      transaction,
    })),
  ]);

  const topInset = insets.top > 0 ? insets.top : space.xl;

  const sheet = (
    <View
      style={[
        styles.sheet,
        fullScreen ? styles.fullScreenSheet : [styles.bottomSheet, sheetStyle],
      ]}>
      {!fullScreen ? <View style={styles.handle} /> : null}
      <View
        style={[
          styles.header,
          fullScreen && styles.fullScreenHeader,
          onBack && styles.headerWithBack,
        ]}>
        {onBack ? (
          <>
            <View style={styles.headerActions}>
              <BackButton label={title} variant="header" onPress={onBack} />
              <IconButton
                icon="x"
                onPress={onClose}
                accessibilityLabel="Schließen"
                bg={withAlpha(colors.danger, 1)}
                size={40}
                iconSize={22}
                style={styles.closeButton}
              />
            </View>
            <View style={styles.headerTitleBelow}>
              <Txt variant="title">{title}</Txt>
              <Txt variant="caption" tone="secondary">
                {subtitle}
              </Txt>
            </View>
          </>
        ) : (
          <>
            <View style={styles.titleCopy}>
              <Txt variant="title">{title}</Txt>
              <Txt variant="caption" tone="secondary">
                {subtitle}
              </Txt>
            </View>
            <IconButton
              icon="x"
              onPress={onClose}
              accessibilityLabel="Schließen"
              bg={withAlpha(colors.danger, 1)}
              size={40}
              iconSize={22}
              style={styles.closeButton}
            />
          </>
        )}
      </View>

      {productSummary ? (
        <View style={[styles.stateSummary, fullScreen && styles.fullScreenSummary]}>
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
        <View style={fullScreen && styles.fullScreenOffline}>
          <Txt variant="caption" tone="secondary">
            Offline: lokale Daten werden angezeigt.
          </Txt>
        </View>
      ) : null}

      <FlashList
        data={rows}
        keyExtractor={(row) => row.id}
        style={styles.list}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          fullScreen && styles.fullScreenListContent,
          { paddingBottom: Math.max(insets.bottom, space.xl) },
        ]}
        ListHeaderComponent={
          historyHeading ? (
            <Txt variant="caption" tone="secondary" weight="700" style={styles.historyHeading}>
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
              style={[styles.historyHeading, styles.transactionHeading]}>
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
              undoPending={undoPending}
            />
          )
        }
        ListFooterComponent={
          footerNote ? (
            <Txt variant="caption" tone="secondary" style={styles.footerNote}>
              {footerNote}
            </Txt>
          ) : null
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingEmpty}>
              <Txt variant="body" tone="secondary">
                Verlauf wird geladen…
              </Txt>
            </View>
          ) : error ? (
            <View style={styles.errorEmpty}>
              <Txt variant="body" tone="secondary">
                Verlauf konnte nicht geladen werden.
              </Txt>
              {onRetry ? (
                <Button title="Erneut versuchen" variant="secondary" onPress={onRetry} />
              ) : null}
            </View>
          ) : (
            <View style={styles.empty}>
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
      animationType="slide"
      presentationStyle={fullScreen ? 'fullScreen' : undefined}
      onRequestClose={onBack ?? onClose}>
      <View style={StyleSheet.absoluteFill}>
        {!fullScreen ? (
          <Pressable
            style={styles.backdrop}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Verlauf schließen"
          />
        ) : null}
        {fullScreen ? (
          <View
            style={[
              styles.fullScreenContainer,
              {
                paddingTop: topInset,
                paddingBottom: insets.bottom,
                paddingLeft: insets.left,
                paddingRight: insets.right,
              },
            ]}>
            {sheet}
          </View>
        ) : (
          <SafeAreaView
            style={StyleSheet.absoluteFill}
            edges={['top', 'bottom', 'left', 'right']}
            pointerEvents="box-none">
            {sheet}
          </SafeAreaView>
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
    <View style={[styles.stateCard, open && styles.stateCardOpen]}>
      <Txt variant="caption" tone="secondary" weight="700" style={styles.stateCardLabel}>
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
  undoPending,
}: {
  transaction: LocalInventoryTransaction;
  colors: ReturnType<typeof useTheme>['colors'];
  compactLabel: boolean;
  lotLabel?: string;
  onUndo?: (transaction: LocalInventoryTransaction) => void;
  undoPending: boolean;
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
  const undoAvailable = isInventoryTransactionUndoable(transaction);
  const userVisibleNotes =
    transaction.notes && !transaction.notes.startsWith('[Split]') ? transaction.notes : null;
  const quantityPrefix =
    transaction.type === 'waste' || transaction.type === 'out'
      ? '−'
      : transaction.type === 'in'
        ? '+'
        : '';

  return (
    <View style={styles.historyRow}>
      <View style={styles.timeline}>
        <View style={styles.timelineLine} />
        <View style={[styles.timelineDot, { backgroundColor: edgeColor }]} />
      </View>
      <View style={styles.transactionContent}>
        <View style={styles.transactionTitleRow}>
          <Txt variant="body" weight="700">
            {transactionLabel(transaction, compactLabel ? null : transaction.item_name)}
          </Txt>
          {lotLabel ? (
            <View style={styles.lotTag}>
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
        {userVisibleNotes ? (
          <Txt variant="caption" tone="secondary">
            {userVisibleNotes}
          </Txt>
        ) : null}
      </View>
      <View style={styles.amountColumn}>
        <Txt variant="body" weight="700" style={styles.amount}>
          {quantityPrefix}
          {formatAmount(transaction.quantity, transaction.item_unit ?? '')}
        </Txt>
        {undoAvailable && onUndo ? (
          <Pressable
            disabled={undoPending}
            onPress={() => onUndo(transaction)}
            accessibilityRole="button"
            accessibilityLabel={transactionUndoLabel(transaction)}
            accessibilityState={{ disabled: undoPending }}>
            <Txt variant="caption" color={colors.accent} weight="700">
              Rückgängig
            </Txt>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
