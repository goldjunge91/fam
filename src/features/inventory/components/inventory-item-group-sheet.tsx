import type { TFunction } from 'i18next';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { BackButton } from '@/components/layout/back-button';
import { radius, space, withAlpha } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Button, Card, IconButton, MIN_TOUCH_SIZE, Press, Row, Txt } from '@/constants/ui';
import { useSheetShadowStyle } from '@/hooks/use-sheet-shadow-style';
import type { FridgeItemConflict } from '@/lib/db/outbox-conflicts';
import { formatAmount, formatPackageHint } from '@/lib/format/package-size';
import { sumInventoryQuantities } from '@/lib/inventory-quantity';

import { debugLog } from '@/lib/observability/debug-log';
import { formatExpiryDate, formatExpiryStatus, getExpiryInfo } from '../expiry';
import type { InventoryItemGroup } from '../grouped-items';
import type { LocalInventoryItem } from '../use-inventory-items';

type InventoryItemGroupSheetProps = {
  visible: boolean;
  group: InventoryItemGroup | null;
  onClose: () => void;
  onDismissFinished?: () => void;
  onSelectLot: (lot: LocalInventoryItem) => void;
  onHistory: () => void;
  onQuickOpen?: (lot: LocalInventoryItem) => void;
  onQuickConsume?: (lot: LocalInventoryItem) => void;
  quickActionLoading?: boolean;
  /** Dauerhaft gescheiterte Mengen-Konflikte, keyed by MHD-Los-id (`lot.id`). */
  conflictsByLotId?: Map<string, FridgeItemConflict>;
  onDiscardConflict?: (conflict: FridgeItemConflict) => void;
  onReconfirmConflict?: (conflict: FridgeItemConflict) => void;
  /** itemId des Konflikts, dessen Aufloesung gerade laeuft (Buttons deaktivieren). */
  resolvingConflictItemId?: string | null;
};

const androidStyles = StyleSheet.create((theme) => ({
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: theme.scrim,
  },
  sheet: {
    position: 'absolute',
    left: theme.space.md,
    right: theme.space.md,
    bottom: theme.space.md,
    maxHeight: '86%',
    gap: theme.space.md,
    paddingHorizontal: theme.space.md,
    paddingTop: theme.space.md,
    borderRadius: theme.radius.famLarge,
    backgroundColor: theme.backgroundElement,
  },
  handle: {
    width: 42,
    height: 4,
    alignSelf: 'center',
    borderRadius: theme.radius.s,
    backgroundColor: theme.border,
  },
  header: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.lg,
    paddingBottom: theme.space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    gap: theme.space.xs,
  },
  stateSummary: {
    flexDirection: 'row',
    gap: theme.space.md,
  },
  stateCard: {
    flex: 1,
    gap: theme.space.xs,
    padding: theme.space.lg,
    borderRadius: theme.radius.md,
    backgroundColor: theme.backgroundSoft,
  },
  stateCardOpen: {
    borderWidth: theme.borderWidth.base,
    borderColor: theme.warning,
    backgroundColor: withAlpha(theme.warning, 0.16),
  },
  uppercase: {
    textTransform: 'uppercase',
  },
  historyButton: {
    alignSelf: 'flex-start',
  },
  lotsContent: {
    paddingBottom: theme.space.md,
  },
  lotRow: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  lotStatus: {
    width: 5,
    height: 42,
    borderRadius: theme.radius.s,
  },
  lotCopy: {
    flex: 1,
    gap: theme.space.xs,
  },
  lotAmount: {
    fontVariant: ['tabular-nums'],
  },
  lotChevron: {
    marginLeft: theme.space.xs,
  },
  conflictSummary: {
    gap: theme.space.xs,
    padding: theme.space.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.backgroundSoft,
  },
  conflictError: {
    marginTop: theme.space.xs,
  },
}));

export function formatStateSubtitle(lots: LocalInventoryItem[], t?: TFunction): string {
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
  if (!earliest?.expiry_date) return t?.('inventory.group.unlimited') ?? 'unbegrenzt haltbar';
  return formatExpiryStatus(earliest, new Date(), t);
}

/**
 * Panel fuer einen dauerhaft gescheiterten Mengen-Konflikt an einem MHD-Los
 * (siehe push.ts blockedItemIds). Verwerfen loescht die blockierten Outbox-
 * Zeilen und spiegelt den kanonischen Serverstand; Bestaetigen ist nur
 * moeglich, wenn sich der Konflikt eindeutig einer Korrektur zuordnen liess
 * (`conflict.correction`) und legt sie mit dem aktuellen Bestand als frischer
 * Vergleichsbasis neu an.
 */
function InventoryConflictPanel({
  visible,
  itemName,
  unit,
  conflict,
  onClose,
  onDiscard,
  onReconfirm,
  resolving,
}: {
  visible: boolean;
  itemName: string;
  unit: string;
  conflict: FridgeItemConflict | null;
  onClose: () => void;
  onDiscard: (conflict: FridgeItemConflict) => void;
  onReconfirm: (conflict: FridgeItemConflict) => void;
  resolving: boolean;
}) {
  const { t, i18n } = useTranslation();
  const sheetStyle = useSheetShadowStyle();
  const conflictItemId = conflict?.itemId ?? null;
  const hasConflict = Boolean(conflict);

  useEffect(() => {
    if (!__DEV__ || !visible) return;
    debugLog('[InventorySheet] inventory.conflict-modal.open', {
      sheetId: 'inventory.conflict-modal',
      itemId: conflictItemId,
      hasConflict,
    });
  }, [conflictItemId, hasConflict, visible]);

  if (!conflict) return null;
  const correction = conflict.correction;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={StyleSheet.absoluteFill}>
        <Press
          style={androidStyles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('inventory.group.conflictClose')}
        />
        <View style={[androidStyles.sheet, sheetStyle]}>
          <View style={androidStyles.handle} />
          <Txt variant="title">{itemName}</Txt>
          <Txt variant="caption" tone="secondary">
            {t('inventory.group.conflictTitle')}
          </Txt>

          <View style={androidStyles.conflictSummary}>
            {correction ? (
              <>
                <Row justify="space-between">
                  <Txt variant="body" tone="secondary">
                    {t('inventory.group.yourCorrection')}
                  </Txt>
                  <Txt variant="body" weight="700">
                    {formatAmount(correction.new_quantity, unit, t, i18n.language)}
                  </Txt>
                </Row>
                <Row justify="space-between">
                  <Txt variant="body" tone="secondary">
                    {t('inventory.group.expectedValue')}
                  </Txt>
                  <Txt variant="body" weight="700">
                    {formatAmount(correction.expected_quantity, unit, t, i18n.language)}
                  </Txt>
                </Row>
              </>
            ) : null}
            <Txt variant="caption" tone="secondary" style={androidStyles.conflictError}>
              {conflict.lastError}
            </Txt>
          </View>

          <Button
            title={t('inventory.group.discard')}
            variant="danger"
            icon="trash-2"
            loading={resolving}
            onPress={() => onDiscard(conflict)}
            full
          />
          {correction ? (
            <Button
              title={t('inventory.group.reconfirm')}
              variant="primary"
              icon="check"
              loading={resolving}
              onPress={() => onReconfirm(conflict)}
              full
            />
          ) : (
            <Txt variant="caption" tone="secondary">
              {t('inventory.group.reconfirmHint')}
            </Txt>
          )}
        </View>
      </View>
    </Modal>
  );
}

export function InventoryItemGroupSheet({
  visible,
  group,
  onClose,
  onDismissFinished,
  onSelectLot,
  onHistory,
  onQuickOpen,
  onQuickConsume,
  quickActionLoading = false,
  conflictsByLotId,
  onDiscardConflict,
  onReconfirmConflict,
  resolvingConflictItemId,
}: InventoryItemGroupSheetProps) {
  const { t, i18n } = useTranslation();
  const sheetStyle = useSheetShadowStyle();
  const { colors } = useTheme();
  const [activeConflictLotId, setActiveConflictLotId] = useState<string | null>(null);
  const lastGroupRef = useRef<InventoryItemGroup | null>(null);
  const groupId = group?.id ?? null;
  const lotCount = group?.lots.length ?? 0;
  const hasGroup = Boolean(group);

  useEffect(() => {
    if (!__DEV__ || !visible) return;
    debugLog('[InventorySheet] inventory.group-sheet.open', {
      sheetId: 'inventory.group-sheet',
      groupId,
      lotCount,
      hasGroup,
      platform: Platform.OS,
    });
  }, [groupId, hasGroup, lotCount, visible]);

  if (group) {
    lastGroupRef.current = group;
  }
  const displayGroup = group ?? lastGroupRef.current;
  const isVisible = visible && Boolean(group);

  if (!displayGroup) return null;

  const sealedLots = displayGroup.lots.filter((lot) => !lot.opened_at);
  const openedLots = displayGroup.lots.filter((lot) => !!lot.opened_at);
  const activeConflict = activeConflictLotId
    ? (conflictsByLotId?.get(activeConflictLotId) ?? null)
    : null;

  if (Platform.OS === 'ios') {
    return (
      <IosInventoryItemGroupView
        visible={isVisible}
        group={displayGroup}
        onClose={onClose}
        onDismissFinished={onDismissFinished}
        onSelectLot={onSelectLot}
        onHistory={onHistory}
        onQuickOpen={onQuickOpen}
        onQuickConsume={onQuickConsume}
        quickActionLoading={quickActionLoading}
        conflictsByLotId={conflictsByLotId}
        onDiscardConflict={onDiscardConflict}
        onReconfirmConflict={onReconfirmConflict}
        resolvingConflictItemId={resolvingConflictItemId}
      />
    );
  }

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onDismiss={onDismissFinished}>
      <View style={StyleSheet.absoluteFill}>
        <Press
          style={androidStyles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('inventory.group.detailsClose')}
        />
        <View style={[androidStyles.sheet, sheetStyle]}>
          <View style={androidStyles.handle} />

          <View style={androidStyles.header}>
            <View style={androidStyles.headerCopy}>
              <Txt
                variant="title"
                numberOfLines={1}
                ellipsizeMode="tail"
                accessibilityLabel={displayGroup.name}>
                {displayGroup.name}
              </Txt>
              <Txt variant="caption" tone="secondary">
                {t('inventory.group.total', {
                  amount: formatAmount(displayGroup.quantity, displayGroup.unit, t, i18n.language),
                })}{' '}
                · {t('inventory.group.lotsCount', { count: displayGroup.lots.length })}
              </Txt>
            </View>
            <IconButton
              icon="x"
              onPress={onClose}
              accessibilityLabel={t('inventory.group.close')}
              bg={colors.danger}
              color={colors.onDanger}
              size={45}
              iconSize={24}
              style={{ borderRadius: radius.lg }}
            />
          </View>

          <View style={androidStyles.stateSummary}>
            {sealedLots.length > 0 ? (
              <View style={androidStyles.stateCard}>
                <Txt
                  variant="caption"
                  tone="secondary"
                  weight="700"
                  style={androidStyles.uppercase}>
                  {t('inventory.group.sealed')}
                </Txt>
                <Txt variant="body" weight="700">
                  {formatAmount(sumQuantity(sealedLots), displayGroup.unit, t, i18n.language)}
                </Txt>
                <Txt variant="caption" tone="secondary">
                  {formatStateSubtitle(sealedLots, t)}
                </Txt>
              </View>
            ) : null}
            {openedLots.length > 0 ? (
              <View style={[androidStyles.stateCard, androidStyles.stateCardOpen]}>
                <Txt
                  variant="caption"
                  tone="secondary"
                  weight="700"
                  style={androidStyles.uppercase}>
                  {t('inventory.group.opened')}
                </Txt>
                <Txt variant="body" weight="700">
                  {formatAmount(sumQuantity(openedLots), displayGroup.unit, t, i18n.language)}
                </Txt>
                <Txt variant="caption" tone="secondary">
                  {formatStateSubtitle(openedLots, t)}
                </Txt>
              </View>
            ) : null}
          </View>

          <Txt variant="caption" tone="secondary" weight="700" style={androidStyles.uppercase}>
            {t('inventory.group.lotsHeading')}
          </Txt>

          <Button
            title={t('inventory.group.history')}
            variant="secondary"
            size="sm"
            onPress={onHistory}
            accessibilityLabel={t('inventory.group.historyAccessibility', {
              name: displayGroup.name,
            })}
            style={androidStyles.historyButton}
          />

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={androidStyles.lotsContent}>
            {displayGroup.lots.map((lot) => {
              // Konflikt-Los: eigene Zeile statt der normalen MHD-Zeile
              // darunter, die fuer diesen Fall unveraendert (auskommentiert
              // nichts) bestehen bleibt.
              const conflict = conflictsByLotId?.get(lot.id);
              if (conflict) {
                return (
                  <Press
                    key={lot.id}
                    onPress={() => setActiveConflictLotId(lot.id)}
                    accessibilityRole="button"
                    accessibilityLabel={t('inventory.group.conflictAccessibility', {
                      name: displayGroup.name,
                      error: conflict.lastError,
                    })}
                    style={androidStyles.lotRow}>
                    <View style={[androidStyles.lotStatus, { backgroundColor: colors.danger }]} />
                    <View style={androidStyles.lotCopy}>
                      <Txt variant="body" weight="700">
                        {t('inventory.actions.mhd')}{' '}
                        {formatExpiryDate(lot.expiry_date, i18n.language, t)}
                      </Txt>
                      <Txt variant="caption" tone="danger" weight="700" numberOfLines={1}>
                        {t('inventory.group.conflict')}
                      </Txt>
                    </View>
                    <Txt
                      variant="body"
                      weight="700"
                      tone="danger"
                      style={{
                        fontVariant: ['tabular-nums'],
                        textDecorationLine: 'line-through',
                      }}>
                      {formatAmount(lot.quantity, lot.unit, t, i18n.language)}
                    </Txt>
                    <Txt variant="body" tone="secondary">
                      ›
                    </Txt>
                  </Press>
                );
              }

              const packageHint = formatPackageHint(
                lot.package_size,
                lot.package_size_unit,
                t,
                i18n.language,
              );
              const location = lot.location_name ?? t('inventory.actions.noLocation');
              const amount = formatAmount(lot.quantity, lot.unit, t, i18n.language);
              const expiryDate = formatExpiryDate(lot.expiry_date, i18n.language, t);
              const expiry = getExpiryInfo(lot.expiry_date, new Date(), t);
              const statusColor =
                expiry.themeColor === 'danger'
                  ? colors.danger
                  : lot.opened_at || expiry.themeColor === 'warning'
                    ? colors.warning
                    : colors.success;
              return (
                <Press
                  key={lot.id}
                  onPress={() => onSelectLot(lot)}
                  accessibilityRole="button"
                  accessibilityLabel={`${displayGroup.name}, ${amount}, ${t('inventory.actions.mhd')} ${expiryDate}, ${location}`}
                  style={androidStyles.lotRow}>
                  <View style={[androidStyles.lotStatus, { backgroundColor: statusColor }]} />
                  <View style={androidStyles.lotCopy}>
                    <Txt variant="body" weight="700">
                      {t('inventory.actions.mhd')} {expiryDate}
                    </Txt>
                    <Txt variant="caption" tone="secondary" numberOfLines={1}>
                      {lot.opened_at
                        ? t('inventory.actions.opened')
                        : t('inventory.actions.sealed')}{' '}
                      · {formatExpiryStatus(lot, new Date(), t)} · {location}
                      {packageHint ? ` · ${packageHint}` : ''}
                    </Txt>
                  </View>
                  <Txt variant="body" weight="700" style={androidStyles.lotAmount}>
                    {amount}
                  </Txt>
                  <Txt variant="body" tone="secondary">
                    ›
                  </Txt>
                </Press>
              );
            })}
          </ScrollView>
        </View>
      </View>
      <InventoryConflictPanel
        visible={activeConflict !== null}
        itemName={displayGroup.name}
        unit={displayGroup.unit}
        conflict={activeConflict}
        onClose={() => setActiveConflictLotId(null)}
        onDiscard={(conflict) => {
          onDiscardConflict?.(conflict);
          setActiveConflictLotId(null);
        }}
        onReconfirm={(conflict) => {
          onReconfirmConflict?.(conflict);
          setActiveConflictLotId(null);
        }}
        resolving={resolvingConflictItemId === activeConflict?.itemId}
      />
    </Modal>
  );
}

function IosInventoryItemGroupView({
  visible,
  group,
  onClose,
  onDismissFinished,
  onSelectLot,
  onHistory,
  onQuickOpen,
  onQuickConsume,
  quickActionLoading = false,
  conflictsByLotId,
  onDiscardConflict,
  onReconfirmConflict,
  resolvingConflictItemId,
}: InventoryItemGroupSheetProps) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = groupStyles;
  const [activeConflictLotId, setActiveConflictLotId] = useState<string | null>(null);
  const sealedLots = group?.lots.filter((lot) => !lot.opened_at) ?? [];
  const openedLots = group?.lots.filter((lot) => !!lot.opened_at) ?? [];
  const activeConflict = activeConflictLotId
    ? (conflictsByLotId?.get(activeConflictLotId) ?? null)
    : null;

  if (!group) return null;

  const topInset = insets.top > 0 ? insets.top : space.xl;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      onDismiss={onDismissFinished}>
      <View style={styles.root}>
        <View
          style={[
            styles.safeArea,
            {
              paddingTop: topInset,
              paddingLeft: insets.left,
              paddingRight: insets.right,
            },
          ]}>
          <View style={styles.header}>
            <View style={styles.headerSide}>
              <BackButton label={t('inventory.group.back')} variant="header" onPress={onClose} />
            </View>
            <View style={styles.headerTitle}>
              <Txt
                variant="heading"
                center
                numberOfLines={1}
                ellipsizeMode="tail"
                accessibilityLabel={group.name}>
                {group.name}
              </Txt>
            </View>
            <View style={[styles.headerSide, styles.headerRight]}>
              {/* Schließen-Button im Sheet beim ersten Klick auf ein Lebensmittel. */}
              <IconButton
                icon="x"
                onPress={onClose}
                accessibilityLabel={t('inventory.group.detailsClose')}
                bg={colors.danger}
                color={colors.onDanger}
                size={40}
                iconSize={22}
                style={{ borderRadius: radius.lg }}
              />
            </View>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.content,
              { paddingBottom: Math.max(insets.bottom, space.xl) },
            ]}
            showsVerticalScrollIndicator={false}>
            <View style={styles.detailLead}>
              <Txt variant="title">
                {t('inventory.group.total', {
                  amount: formatAmount(group.quantity, group.unit, t, i18n.language),
                })}
              </Txt>
              <Txt variant="label" tone="secondary" style={styles.detailSubtitle}>
                {t('inventory.group.lotsCount', { count: group.lots.length })} ·{' '}
                {group.lots[0]?.location_name ?? t('inventory.actions.noLocation')}
              </Txt>
            </View>

            <View style={styles.stateSummary} accessibilityLabel={t('inventory.group.overview')}>
              <IosStateCard
                label={t('inventory.group.sealed')}
                amount={sumQuantity(sealedLots)}
                unit={group.unit}
                hint={
                  sealedLots.length
                    ? formatStateSubtitle(sealedLots, t)
                    : t('inventory.group.noEntries')
                }
                disabled={!sealedLots.length}
                onPress={sealedLots.length ? () => onSelectLot(sealedLots[0]) : undefined}
                styles={styles}
                colors={colors}
                t={t}
                locale={i18n.language}
              />
              <IosStateCard
                label={t('inventory.group.opened')}
                amount={sumQuantity(openedLots)}
                unit={group.unit}
                hint={
                  openedLots.length
                    ? formatStateSubtitle(openedLots, t)
                    : t('inventory.group.noEntries')
                }
                disabled={!openedLots.length}
                onPress={openedLots.length ? () => onSelectLot(openedLots[0]) : undefined}
                actionLabel={
                  openedLots.length
                    ? t('inventory.group.quickConsume', {
                        amount: formatAmount(1, openedLots[0].unit, t, i18n.language),
                      })
                    : sealedLots.length
                      ? t('inventory.group.quickOpen', {
                          amount: formatAmount(1, sealedLots[0].unit, t, i18n.language),
                        })
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
                t={t}
                locale={i18n.language}
                tone="open"
              />
            </View>

            <Txt variant="label" tone="secondary" weight="700" style={styles.sectionLabel}>
              {t('inventory.group.lotsHeading')}
            </Txt>

            <View>
              {group.lots.map((lot) => {
                const conflict = conflictsByLotId?.get(lot.id);
                return (
                  <IosLotRow
                    key={lot.id}
                    group={group}
                    lot={lot}
                    conflict={conflict ?? null}
                    onPress={() => (conflict ? setActiveConflictLotId(lot.id) : onSelectLot(lot))}
                    styles={styles}
                    colors={colors}
                    t={t}
                    i18n={i18n}
                  />
                );
              })}
            </View>

            <Button
              title={t('inventory.group.history')}
              variant="secondary"
              size="sm"
              onPress={onHistory}
              accessibilityLabel={t('inventory.group.historyAccessibility', { name: group.name })}
              style={styles.historyButton}
            />
            <Txt variant="caption" tone="secondary" style={styles.helperText}>
              {t('inventory.group.helper')}
            </Txt>
          </ScrollView>
        </View>
      </View>
      <InventoryConflictPanel
        visible={activeConflict !== null}
        itemName={group.name}
        unit={group.unit}
        conflict={activeConflict}
        onClose={() => setActiveConflictLotId(null)}
        onDiscard={(conflict) => {
          onDiscardConflict?.(conflict);
          setActiveConflictLotId(null);
        }}
        onReconfirm={(conflict) => {
          onReconfirmConflict?.(conflict);
          setActiveConflictLotId(null);
        }}
        resolving={resolvingConflictItemId === activeConflict?.itemId}
      />
    </Modal>
  );
}

function sumQuantity(lots: LocalInventoryItem[]): number {
  return sumInventoryQuantities(lots.map((lot) => lot.quantity));
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
  actionLoading = false,
  styles,
  colors,
  t,
  locale,
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
  actionLoading?: boolean;
  styles: typeof groupStyles;
  colors: ReturnType<typeof useTheme>['colors'];
  t: TFunction;
  locale: string;
  tone?: 'sealed' | 'open';
}) {
  return (
    <Card
      padded={false}
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
        accessibilityLabel={t('inventory.group.stateShow', {
          label,
          amount: formatAmount(amount, unit, t, locale),
        })}
        accessibilityState={{ disabled }}
        containerStyle={{ flex: 1 }}
        style={[styles.stateCardMain, disabled && styles.disabledStateCard]}>
        <Txt variant="label" tone="secondary" weight="700">
          {label}
        </Txt>
        <Txt variant="body" weight="800" style={styles.stateValue}>
          {formatAmount(amount, unit, t, locale)}
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
            {actionLoading ? t('inventory.group.updating') : actionLabel}
          </Txt>
        </Press>
      ) : null}
    </Card>
  );
}

function IosLotRow({
  group,
  lot,
  conflict = null,
  onPress,
  styles,
  colors,
  t,
  i18n,
}: {
  group: InventoryItemGroup;
  lot: LocalInventoryItem;
  conflict?: FridgeItemConflict | null;
  onPress: () => void;
  styles: typeof groupStyles;
  colors: ReturnType<typeof useTheme>['colors'];
  t: TFunction;
  i18n: { language: string };
}) {
  // Konflikt-Los: eigene Zeile statt der normalen Rueckgabe darunter, die
  // fuer diesen Fall unveraendert bestehen bleibt.
  if (conflict) {
    return (
      <Press
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={t('inventory.group.conflictAccessibility', {
          name: group.name,
          error: conflict.lastError,
        })}
        style={styles.lotRow}>
        <View style={[styles.lotStatus, { backgroundColor: colors.danger }]} />
        <View style={styles.lotCopy}>
          <View style={styles.lotTitleLine}>
            <Txt variant="body" weight="800" numberOfLines={1} style={styles.lotTitle}>
              {t('inventory.actions.mhd')} {formatExpiryDate(lot.expiry_date, i18n.language, t)}
            </Txt>
            <Txt
              variant="body"
              weight="800"
              tone="danger"
              style={[styles.lotAmount, { textDecorationLine: 'line-through' }]}>
              {formatAmount(lot.quantity, lot.unit, t, i18n.language)}
            </Txt>
          </View>
          <Txt variant="caption" tone="danger" weight="700" numberOfLines={1}>
            {t('inventory.group.conflict')}
          </Txt>
        </View>
      </Press>
    );
  }

  const packageHint = formatPackageHint(lot.package_size, lot.package_size_unit, t, i18n.language);
  const location = lot.location_name ?? t('inventory.actions.noLocation');
  const amount = formatAmount(lot.quantity, lot.unit, t, i18n.language);
  const expiryDate = formatExpiryDate(lot.expiry_date, i18n.language, t);
  const expiry = getExpiryInfo(lot.expiry_date, new Date(), t);
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
      accessibilityLabel={`${group.name}, ${amount}, ${t('inventory.actions.mhd')} ${expiryDate}, ${location}`}
      style={styles.lotRow}>
      <View style={[styles.lotStatus, { backgroundColor: statusColor }]} />
      <View style={styles.lotCopy}>
        <View style={styles.lotTitleLine}>
          <Txt variant="body" weight="800" numberOfLines={1} style={styles.lotTitle}>
            {t('inventory.actions.mhd')} {expiryDate}
          </Txt>
          <Txt variant="body" weight="800" style={styles.lotAmount}>
            {amount}
          </Txt>
        </View>
        <Txt variant="caption" tone="secondary" numberOfLines={1}>
          {lot.opened_at ? t('inventory.actions.opened') : t('inventory.actions.sealed')} ·{' '}
          {formatExpiryStatus(lot, new Date(), t)} · {location}
          {packageHint ? ` · ${packageHint}` : ''}
        </Txt>
      </View>
      <Txt variant="heading" tone="secondary" style={styles.lotChevron}>
        ›
      </Txt>
    </Press>
  );
}

const groupStyles = StyleSheet.create((theme) => ({
  root: { flex: 1, backgroundColor: theme.background },
  safeArea: { flex: 1 },
  header: {
    minHeight: 64,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerSide: {
    flex: 1,
    minWidth: MIN_TOUCH_SIZE,
    minHeight: MIN_TOUCH_SIZE,
    flexShrink: 0,
    alignItems: 'flex-start',
  },
  headerTitle: { flex: 1, minWidth: 0, flexShrink: 1 },
  headerRight: { alignItems: 'flex-end' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xxxl },
  detailLead: {
    paddingBottom: space.lg,
    marginBottom: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  detailSubtitle: { marginTop: space.xs },
  stateSummary: {
    flexDirection: 'row',
    gap: space.md,
    marginBottom: space.xxl,
  },
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
  stateValue: { marginTop: space.xs, marginBottom: space.md },
  stateCardAction: {
    minHeight: 44,
    paddingHorizontal: space.md,
    justifyContent: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    backgroundColor: withAlpha(theme.accent, 0.08),
  },
  sectionLabel: {
    marginBottom: space.sm,
    textTransform: 'uppercase',
  },
  lotRow: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  lotStatus: {
    width: 4,
    marginVertical: space.md,
    marginRight: space.md,
    borderRadius: theme.radius.s,
  },
  lotCopy: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    paddingVertical: space.md,
  },
  lotTitleLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.sm,
  },
  lotTitle: { flex: 1 },
  lotAmount: { fontVariant: ['tabular-nums'] },
  lotChevron: { alignSelf: 'center', marginLeft: space.sm },
  historyButton: { alignSelf: 'flex-start', marginTop: space.lg },
  helperText: { marginTop: space.sm },
}));
