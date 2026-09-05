import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GradientBackground } from '@/components/layout/gradient-background';
import { type GradientSpec, radius, shadow, space, withAlpha } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { BackButton } from '@/components/ui/buttons';
import { Card, Press, Txt } from '@/constants/ui';
import { useSheetShadowStyle } from '@/hooks/use-sheet-shadow-style';
import { formatAmount, formatPackageHint } from '@/lib/package-size';

import { getExpiryInfo } from '../expiry';
import type { InventoryItemGroup } from '../grouped-items';
import type { LocalInventoryItem } from '../use-inventory-items';

type InventoryItemGroupSheetProps = {
  visible: boolean;
  group: InventoryItemGroup | null;
  onClose: () => void;
  onSelectLot: (lot: LocalInventoryItem) => void;
  onHistory: () => void;
  onQuickOpen?: (lot: LocalInventoryItem) => void;
  onQuickConsume?: (lot: LocalInventoryItem) => void;
  quickActionLoading?: boolean;
  backgroundGradient?: GradientSpec;
};

function formatExpiryDate(value: string | null): string {
  if (!value) return 'ohne MHD';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatExpiryStatus(lot: LocalInventoryItem): string {
  const expiry = getExpiryInfo(lot.expiry_date, new Date());
  if (expiry.daysLeft === null) return 'ohne MHD';
  if (expiry.daysLeft < 0) return expiry.label;
  return expiry.daysLeft === 0 ? 'heute' : expiry.label;
}

export function formatStateSubtitle(lots: LocalInventoryItem[]): string {
  const earliest = lots.reduce<LocalInventoryItem | null>((current, lot) => {
    if (!current) return lot;
    const currentTime = current.expiry_date
      ? new Date(`${current.expiry_date}T00:00:00`).getTime()
      : Number.POSITIVE_INFINITY;
    const lotTime = lot.expiry_date
      ? new Date(`${lot.expiry_date}T00:00:00`).getTime()
      : Number.POSITIVE_INFINITY;
    return lotTime < currentTime ? lot : current;
  }, null);
  if (!earliest?.expiry_date) return 'unbegrenzt haltbar';
  return formatExpiryStatus(earliest);
}

export function InventoryItemGroupSheet({
  visible,
  group,
  onClose,
  onSelectLot,
  onHistory,
  onQuickOpen,
  onQuickConsume,
  quickActionLoading = false,
  backgroundGradient,
}: InventoryItemGroupSheetProps) {
  const sheetStyle = useSheetShadowStyle();
  const { colors } = useTheme();

  if (!group) return null;

  const sealedLots = group.lots.filter((lot) => !lot.opened_at);
  const openedLots = group.lots.filter((lot) => !!lot.opened_at);

  if (Platform.OS === 'ios') {
    return (
      <IosInventoryItemGroupView
        visible={visible}
        group={group}
        onClose={onClose}
        onSelectLot={onSelectLot}
        onHistory={onHistory}
        onQuickOpen={onQuickOpen}
        onQuickConsume={onQuickConsume}
        quickActionLoading={quickActionLoading}
        backgroundGradient={backgroundGradient}
      />
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={StyleSheet.absoluteFill}>
        <Pressable
          className="fridge-actions-backdrop"
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="MHD-Details schließen"
        />
        <View className="fridge-group-sheet" style={sheetStyle}>
          <View className="fridge-actions-handle" />

          <View className="fridge-group-header">
            <View className="fridge-group-header-copy">
              <Txt variant="title">{group.name}</Txt>
              <Txt variant="caption" tone="secondary">
                {formatAmount(group.quantity, group.unit)} gesamt · {group.lots.length} MHD-
                {group.lots.length === 1 ? 'Eintrag' : 'Einträge'}
              </Txt>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Schließen"
              className="edit-fridge-close-button">
              <Txt variant="body" tone="secondary">
                ×
              </Txt>
            </Pressable>
          </View>

          <View className="inventory-state-summary">
            {sealedLots.length > 0 ? (
              <View className="inventory-state-card inventory-state-card-sealed">
                <Txt variant="caption" tone="secondary" weight="700" className="uppercase">
                  Versiegelt
                </Txt>
                <Txt variant="body" weight="700">
                  {formatAmount(
                    sealedLots.reduce((sum, lot) => sum + lot.quantity, 0),
                    group.unit,
                  )}
                </Txt>
                <Txt variant="caption" tone="secondary">
                  {formatStateSubtitle(sealedLots)}
                </Txt>
              </View>
            ) : null}
            {openedLots.length > 0 ? (
              <View className="inventory-state-card inventory-state-card-open">
                <Txt variant="caption" tone="secondary" weight="700" className="uppercase">
                  Geöffnet
                </Txt>
                <Txt variant="body" weight="700">
                  {formatAmount(
                    openedLots.reduce((sum, lot) => sum + lot.quantity, 0),
                    group.unit,
                  )}
                </Txt>
                <Txt variant="caption" tone="secondary">
                  {formatStateSubtitle(openedLots)}
                </Txt>
              </View>
            ) : null}
          </View>

          <Txt variant="caption" tone="secondary" weight="700" className="uppercase">
            MHD-Einträge
          </Txt>

          <Pressable
            onPress={onHistory}
            accessibilityRole="button"
            accessibilityLabel={`${group.name} Verlauf öffnen`}
            className="self-start py-one">
            <Txt variant="body" color={colors.accent} weight="700">
              Produkt-Verlauf öffnen ›
            </Txt>
          </Pressable>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerClassName="fridge-group-lots-content">
            {group.lots.map((lot) => {
              const packageHint = formatPackageHint(lot.package_size, lot.package_size_unit);
              const location = lot.location_name ?? 'Kein Lagerort';
              const amount = formatAmount(lot.quantity, lot.unit);
              const expiryDate = formatExpiryDate(lot.expiry_date);
              const expiry = getExpiryInfo(lot.expiry_date, new Date());
              const statusColor =
                expiry.themeColor === 'danger'
                  ? colors.tomato
                  : lot.opened_at || expiry.themeColor === 'warning'
                    ? colors.carrot
                    : colors.success;
              return (
                <Pressable
                  key={lot.id}
                  onPress={() => onSelectLot(lot)}
                  accessibilityRole="button"
                  accessibilityLabel={`${group.name}, ${amount}, MHD ${expiryDate}, ${location}`}
                  className="fridge-group-lot">
                  <View
                    className="fridge-group-lot-status"
                    style={{
                      backgroundColor: statusColor,
                    }}
                  />
                  <View className="fridge-group-lot-copy">
                    <Txt variant="body" weight="700">
                      MHD {expiryDate}
                    </Txt>
                    <Txt variant="caption" tone="secondary" numberOfLines={1}>
                      {lot.opened_at ? 'Geöffnet' : 'Versiegelt'} · {formatExpiryStatus(lot)} ·{' '}
                      {location}
                      {packageHint ? ` · ${packageHint}` : ''}
                    </Txt>
                  </View>
                  <Txt variant="body" weight="700" style={{ fontVariant: ['tabular-nums'] }}>
                    {amount}
                  </Txt>
                  <Txt variant="body" tone="secondary">
                    ›
                  </Txt>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function IosInventoryItemGroupView({
  visible,
  group,
  onClose,
  onSelectLot,
  onHistory,
  onQuickOpen,
  onQuickConsume,
  quickActionLoading,
  backgroundGradient,
}: InventoryItemGroupSheetProps) {
  const { colors } = useTheme();
  const styles = useThemedGroupStyles();
  const sealedLots = group?.lots.filter((lot) => !lot.opened_at) ?? [];
  const openedLots = group?.lots.filter((lot) => !!lot.opened_at) ?? [];

  if (!group) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}>
      <View style={styles.root}>
        {backgroundGradient ? <GradientBackground {...backgroundGradient} /> : null}
        <SafeAreaView
          accessibilityViewIsModal
          style={styles.safeArea}
          edges={['top', 'bottom', 'left', 'right']}>
          <View style={styles.header}>
            <View style={styles.headerSide}>
              <BackButton label="Vorrat" variant="header" onPress={onClose} />
            </View>
            <Txt variant="heading" center>
              {group.name}
            </Txt>
            <View style={[styles.headerSide, styles.headerRight]}>
              <Press
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="MHD-Details schließen"
                style={[styles.closeButton, { backgroundColor: colors.backgroundSoft }]}
                hitSlop={8}>
                <Txt variant="heading" tone="secondary">
                  ×
                </Txt>
              </Press>
            </View>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}>
            <View style={styles.detailLead}>
              <Txt variant="title">
                {formatAmount(group.quantity, group.unit)} gesamt
              </Txt>
              <Txt variant="label" tone="secondary" style={styles.detailSubtitle}>
                {group.lots.length} MHD-{group.lots.length === 1 ? 'Eintrag' : 'Einträge'} ·{' '}
                {group.lots[0]?.location_name ?? 'Kein Lagerort'}
              </Txt>
            </View>

            <View style={styles.stateSummary} accessibilityLabel="Zustandsübersicht">
              <IosStateCard
                label="Versiegelt"
                amount={sumQuantity(sealedLots)}
                unit={group.unit}
                hint={sealedLots.length ? formatStateSubtitle(sealedLots) : 'Keine Einträge'}
                disabled={!sealedLots.length}
                onPress={sealedLots.length ? () => onSelectLot(sealedLots[0]) : undefined}
                styles={styles}
                colors={colors}
              />
              <IosStateCard
                label="Geöffnet"
                amount={sumQuantity(openedLots)}
                unit={group.unit}
                hint={openedLots.length ? formatStateSubtitle(openedLots) : 'Keine Einträge'}
                disabled={!openedLots.length}
                onPress={openedLots.length ? () => onSelectLot(openedLots[0]) : undefined}
                actionLabel={
                  openedLots.length
                    ? `${formatAmount(1, openedLots[0].unit)} verbrauchen ›`
                    : sealedLots.length
                      ? `${formatAmount(1, sealedLots[0].unit)} öffnen ›`
                      : undefined
                }
                onAction={
                  openedLots.length
                    ? () => onQuickConsume?.(openedLots[0])
                    : sealedLots.length
                      ? () => onQuickOpen?.(sealedLots[0])
                      : undefined
                }
                actionLoading={quickActionLoading}
                styles={styles}
                colors={colors}
                tone="open"
              />
            </View>

            <Txt variant="label" tone="secondary" weight="700" style={styles.sectionLabel}>
              MHD-Einträge
            </Txt>

            <View>
              {group.lots.map((lot) => (
                <IosLotRow
                  key={lot.id}
                  group={group}
                  lot={lot}
                  onPress={() => onSelectLot(lot)}
                  styles={styles}
                  colors={colors}
                />
              ))}
            </View>

            <Press
              onPress={onHistory}
              accessibilityRole="button"
              accessibilityLabel={`${group.name} Verlauf öffnen`}
              style={styles.historyLink}>
              <Txt variant="body" color={colors.accent} weight="700">
                Produkt-Verlauf öffnen ›
              </Txt>
            </Press>
            <Txt variant="caption" tone="secondary" style={styles.helperText}>
              Tippe auf eine Zustandskarte oder ein MHD-Los, um genau diese Gläser zu bearbeiten oder
              zu verbrauchen.
            </Txt>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function sumQuantity(lots: LocalInventoryItem[]): number {
  return lots.reduce((sum, lot) => sum + lot.quantity, 0);
}

function IosStateCard({
  label,
  amount,
  unit,
  hint,
  disabled,
  onPress,
  actionLabel,
  onAction,
  actionLoading,
  styles,
  colors,
  tone = 'sealed',
}: {
  label: string;
  amount: number;
  unit: string;
  hint: string;
  disabled: boolean;
  onPress?: () => void;
  actionLabel?: string;
  onAction?: () => void;
  actionLoading: boolean;
  styles: ReturnType<typeof useThemedGroupStyles>;
  colors: ReturnType<typeof useTheme>['colors'];
  tone?: 'sealed' | 'open';
}) {
  return (
    <Card
      padded={false}
      elevation="sm"
      style={[
        styles.stateCard,
        tone === 'open' && {
          backgroundColor: withAlpha(colors.warning, 0.12),
          borderColor: withAlpha(colors.warning, 0.4),
        },
      ]}>
      <Press
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label} ${formatAmount(amount, unit)} anzeigen`}
        accessibilityState={{ disabled }}
        style={[styles.stateCardMain, disabled && styles.disabledStateCard]}>
        <Txt variant="label" tone="secondary" weight="700">
          {label}
        </Txt>
        <Txt variant="body" weight="800" style={styles.stateValue}>
          {formatAmount(amount, unit)}
        </Txt>
        <Txt variant="caption" tone="secondary">
          {hint}
        </Txt>
      </Press>
      {actionLabel && onAction ? (
        <Press
          onPress={onAction}
          disabled={actionLoading}
          accessibilityRole="button"
          accessibilityLabel={actionLabel.replace(' ›', '')}
          accessibilityState={{ busy: actionLoading, disabled: actionLoading }}
          style={[styles.stateCardAction, { borderTopColor: colors.border }]}
          haptic="medium">
          <Txt variant="label" color={colors.accent} weight="800">
            {actionLoading ? 'Wird aktualisiert …' : actionLabel}
          </Txt>
        </Press>
      ) : null}
    </Card>
  );
}

function IosLotRow({
  group,
  lot,
  onPress,
  styles,
  colors,
}: {
  group: InventoryItemGroup;
  lot: LocalInventoryItem;
  onPress: () => void;
  styles: ReturnType<typeof useThemedGroupStyles>;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  const packageHint = formatPackageHint(lot.package_size, lot.package_size_unit);
  const location = lot.location_name ?? 'Kein Lagerort';
  const amount = formatAmount(lot.quantity, lot.unit);
  const expiryDate = formatExpiryDate(lot.expiry_date);
  const expiry = getExpiryInfo(lot.expiry_date, new Date());
  const statusColor =
    expiry.themeColor === 'danger'
      ? colors.danger
      : lot.opened_at || expiry.themeColor === 'warning'
        ? colors.warning
        : colors.success;

  return (
    <Press
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${group.name}, ${amount}, MHD ${expiryDate}, ${location}`}
      style={styles.lotRow}>
      <View style={[styles.lotStatus, { backgroundColor: statusColor }]} />
      <View style={styles.lotCopy}>
        <View style={styles.lotTitleLine}>
          <Txt variant="body" weight="800" numberOfLines={1} style={styles.lotTitle}>
            MHD {expiryDate}
          </Txt>
          <Txt variant="body" weight="800" style={styles.lotAmount}>
            {amount}
          </Txt>
        </View>
        <Txt variant="caption" tone="secondary" numberOfLines={1}>
          {lot.opened_at ? 'Geöffnet' : 'Versiegelt'} · {formatExpiryStatus(lot)} · {location}
          {packageHint ? ` · ${packageHint}` : ''}
        </Txt>
      </View>
      <Txt variant="heading" tone="secondary" style={styles.lotChevron}>
        ›
      </Txt>
    </Press>
  );
}

function useThemedGroupStyles() {
  const { colors } = useTheme();
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    safeArea: { flex: 1 },
    header: {
      minHeight: 64,
      paddingHorizontal: space.lg,
      paddingVertical: space.sm,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerSide: { width: 76, alignItems: 'flex-start' },
    headerRight: { alignItems: 'flex-end' },
    closeButton: {
      width: 42,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.md,
      ...shadow.sm,
    },
    scroll: { flex: 1 },
    content: { paddingHorizontal: space.lg, paddingBottom: space.xxxl },
    detailLead: {
      paddingBottom: space.lg,
      marginBottom: space.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    detailSubtitle: { marginTop: space.xs },
    stateSummary: { flexDirection: 'row', gap: space.md, marginBottom: space.xxl },
    stateCard: {
      flex: 1,
      minHeight: 116,
      overflow: 'hidden',
      borderRadius: radius.lg,
    },
    stateCardMain: {
      flex: 1,
      minHeight: 116,
      padding: space.md,
      justifyContent: 'center',
    },
    disabledStateCard: { opacity: 0.58 },
    stateValue: { marginTop: space.xs, marginBottom: 2 },
    stateCardAction: {
      minHeight: 44,
      paddingHorizontal: space.md,
      justifyContent: 'center',
      borderTopWidth: StyleSheet.hairlineWidth,
      backgroundColor: withAlpha(colors.accent, 0.08),
    },
    sectionLabel: { marginBottom: space.sm, textTransform: 'uppercase', letterSpacing: 1 },
    lotRow: {
      minHeight: 82,
      flexDirection: 'row',
      alignItems: 'stretch',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    lotStatus: { width: 4, marginVertical: space.md, marginRight: space.md, borderRadius: 3 },
    lotCopy: { flex: 1, minWidth: 0, justifyContent: 'center', paddingVertical: space.md },
    lotTitleLine: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
    lotTitle: { flex: 1 },
    lotAmount: { fontVariant: ['tabular-nums'] },
    lotChevron: { alignSelf: 'center', marginLeft: space.sm },
    historyLink: { alignSelf: 'flex-start', marginTop: space.lg, paddingVertical: space.sm },
    helperText: { marginTop: space.sm },
  });
}
