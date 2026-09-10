import { useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GradientBackground } from '@/components/layout/gradient-background';
import { type GradientSpec, radius, space, withAlpha } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { BackButton } from '@/components/ui/buttons';
import { Button, Card, IconButton, Press, Row, Txt } from '@/constants/ui';
import { useSheetShadowStyle } from '@/hooks/use-sheet-shadow-style';
import type { FridgeItemConflict } from '@/lib/db/outbox-conflicts';
import { sumInventoryQuantities } from '@/lib/inventory-quantity';
import { formatAmount, formatPackageHint } from '@/lib/package-size';

import { formatExpiryDate, formatExpiryStatus, getExpiryInfo } from '../expiry';
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
  /** Dauerhaft gescheiterte Mengen-Konflikte, keyed by MHD-Los-id (`lot.id`). */
  conflictsByLotId?: Map<string, FridgeItemConflict>;
  onDiscardConflict?: (conflict: FridgeItemConflict) => void;
  onReconfirmConflict?: (conflict: FridgeItemConflict) => void;
  /** itemId des Konflikts, dessen Aufloesung gerade laeuft (Buttons deaktivieren). */
  resolvingConflictItemId?: string | null;
};

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
  const sheetStyle = useSheetShadowStyle();
  const { colors } = useTheme();

  if (!conflict) return null;
  const correction = conflict.correction;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={StyleSheet.absoluteFill}>
        <Pressable
          className="fridge-actions-backdrop"
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Konflikt schließen"
        />
        <View className="fridge-actions-sheet" style={sheetStyle}>
          <View className="fridge-actions-handle" />
          <Txt variant="title">{itemName}</Txt>
          <Txt variant="caption" tone="secondary">
            Korrektur nicht übernommen
          </Txt>

          <View
            style={{
              borderRadius: radius.md,
              backgroundColor: colors.backgroundSoft,
              padding: space.md,
              gap: space.xs,
            }}>
            {correction ? (
              <>
                <Row justify="space-between">
                  <Txt variant="body" tone="secondary">
                    Deine Korrektur
                  </Txt>
                  <Txt variant="body" weight="700">
                    {formatAmount(correction.new_quantity, unit)}
                  </Txt>
                </Row>
                <Row justify="space-between">
                  <Txt variant="body" tone="secondary">
                    Erwarteter Ausgangswert
                  </Txt>
                  <Txt variant="body" weight="700">
                    {formatAmount(correction.expected_quantity, unit)}
                  </Txt>
                </Row>
              </>
            ) : null}
            <Txt variant="caption" tone="secondary" style={{ marginTop: space.xs }}>
              {conflict.lastError}
            </Txt>
          </View>

          <Button
            title="Verwerfen"
            variant="danger"
            icon="trash-2"
            loading={resolving}
            onPress={() => onDiscard(conflict)}
            full
          />
          {correction ? (
            <Button
              title={`Auf aktuellen Bestand neu bestätigen`}
              variant="primary"
              icon="check"
              loading={resolving}
              onPress={() => onReconfirm(conflict)}
              full
            />
          ) : (
            <Txt variant="caption" tone="secondary">
              Diese Kette aus Mengenänderungen lässt sich nicht eindeutig neu bestätigen. Bitte
              verwerfen und die Menge danach neu setzen.
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
  onSelectLot,
  onHistory,
  onQuickOpen,
  onQuickConsume,
  quickActionLoading = false,
  backgroundGradient,
  conflictsByLotId,
  onDiscardConflict,
  onReconfirmConflict,
  resolvingConflictItemId,
}: InventoryItemGroupSheetProps) {
  const sheetStyle = useSheetShadowStyle();
  const { colors } = useTheme();
  const [activeConflictLotId, setActiveConflictLotId] = useState<string | null>(null);
  const lastGroupRef = useRef<InventoryItemGroup | null>(null);
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
        onSelectLot={onSelectLot}
        onHistory={onHistory}
        onQuickOpen={onQuickOpen}
        onQuickConsume={onQuickConsume}
        quickActionLoading={quickActionLoading}
        backgroundGradient={backgroundGradient}
        conflictsByLotId={conflictsByLotId}
        onDiscardConflict={onDiscardConflict}
        onReconfirmConflict={onReconfirmConflict}
        resolvingConflictItemId={resolvingConflictItemId}
      />
    );
  }

  return (
    <Modal visible={isVisible} transparent animationType="slide" onRequestClose={onClose}>
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
              <Txt variant="title">{displayGroup.name}</Txt>
              <Txt variant="caption" tone="secondary">
                {formatAmount(displayGroup.quantity, displayGroup.unit)} gesamt ·{' '}
                {displayGroup.lots.length} MHD-
                {displayGroup.lots.length === 1 ? 'Eintrag' : 'Einträge'}
              </Txt>
            </View>
            <IconButton
              icon="x"
              onPress={onClose}
              accessibilityLabel="Schließen"
              bg={colors.tomato}
              size={45}
              iconSize={24}
              style={{
                borderRadius: radius.lg,
                shadowOpacity: 0,
                elevation: 0,
              }}
            />
          </View>

          <View className="inventory-state-summary">
            {sealedLots.length > 0 ? (
              <View className="inventory-state-card inventory-state-card-sealed">
                <Txt variant="caption" tone="secondary" weight="700" className="uppercase">
                  Versiegelt
                </Txt>
                <Txt variant="body" weight="700">
                  {formatAmount(sumQuantity(sealedLots), displayGroup.unit)}
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
                  {formatAmount(sumQuantity(openedLots), displayGroup.unit)}
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

          <Button
            title="Produkt-Verlauf öffnen"
            variant="secondary"
            size="sm"
            onPress={onHistory}
            accessibilityLabel={`${displayGroup.name} Verlauf öffnen`}
            style={{ alignSelf: 'flex-start' }}
          />

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerClassName="fridge-group-lots-content">
            {displayGroup.lots.map((lot) => {
              // Konflikt-Los: eigene Zeile statt der normalen MHD-Zeile
              // darunter, die fuer diesen Fall unveraendert (auskommentiert
              // nichts) bestehen bleibt.
              const conflict = conflictsByLotId?.get(lot.id);
              if (conflict) {
                return (
                  <Pressable
                    key={lot.id}
                    onPress={() => setActiveConflictLotId(lot.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`${displayGroup.name}, Konflikt: ${conflict.lastError}`}
                    className="fridge-group-lot">
                    <View
                      className="fridge-group-lot-status"
                      style={{ backgroundColor: colors.danger }}
                    />
                    <View className="fridge-group-lot-copy">
                      <Txt variant="body" weight="700">
                        MHD {formatExpiryDate(lot.expiry_date)}
                      </Txt>
                      <Txt variant="caption" tone="danger" weight="700" numberOfLines={1}>
                        Konflikt: nicht übernommen
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
                      {formatAmount(lot.quantity, lot.unit)}
                    </Txt>
                    <Txt variant="body" tone="secondary">
                      ›
                    </Txt>
                  </Pressable>
                );
              }

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
                  accessibilityLabel={`${displayGroup.name}, ${amount}, MHD ${expiryDate}, ${location}`}
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
  onSelectLot,
  onHistory,
  onQuickOpen,
  onQuickConsume,
  quickActionLoading = false,
  backgroundGradient,
  conflictsByLotId,
  onDiscardConflict,
  onReconfirmConflict,
  resolvingConflictItemId,
}: InventoryItemGroupSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useThemedGroupStyles();
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
      onRequestClose={onClose}>
      <View style={styles.root}>
        {backgroundGradient ? <GradientBackground {...backgroundGradient} /> : null}
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
              <BackButton label="Vorrat" variant="header" onPress={onClose} />
            </View>
            <Txt variant="heading" center>
              {group.name}
            </Txt>
            <View style={[styles.headerSide, styles.headerRight]}>
              {/* Schließen-Button im Sheet beim ersten Klick auf ein Lebensmittel. */}
              <IconButton
                icon="x"
                onPress={onClose}
                accessibilityLabel="MHD-Details schließen"
                bg={colors.tomato}
                size={40}
                iconSize={22}
                style={{
                  borderRadius: radius.lg,
                  shadowOpacity: 0,
                  elevation: 0,
                }}
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
              <Txt variant="title">{formatAmount(group.quantity, group.unit)} gesamt</Txt>
              <Txt variant="label" tone="secondary" style={styles.detailSubtitle}>
                {group.lots.length} MHD-
                {group.lots.length === 1 ? 'Eintrag' : 'Einträge'} ·{' '}
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
                  />
                );
              })}
            </View>

            <Button
              title="Produkt-Verlauf öffnen"
              variant="secondary"
              size="sm"
              onPress={onHistory}
              accessibilityLabel={`${group.name} Verlauf öffnen`}
              style={styles.historyButton}
            />
            <Txt variant="caption" tone="secondary" style={styles.helperText}>
              Tippe auf eine Zustandskarte oder ein MHD-Los, um genau diese Gläser zu bearbeiten
              oder zu verbrauchen.
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
  conflict = null,
  onPress,
  styles,
  colors,
}: {
  group: InventoryItemGroup;
  lot: LocalInventoryItem;
  conflict?: FridgeItemConflict | null;
  onPress: () => void;
  styles: ReturnType<typeof useThemedGroupStyles>;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  // Konflikt-Los: eigene Zeile statt der normalen Rueckgabe darunter, die
  // fuer diesen Fall unveraendert bestehen bleibt.
  if (conflict) {
    return (
      <Press
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${group.name}, Konflikt: ${conflict.lastError}`}
        style={styles.lotRow}>
        <View style={[styles.lotStatus, { backgroundColor: colors.danger }]} />
        <View style={styles.lotCopy}>
          <View style={styles.lotTitleLine}>
            <Txt variant="body" weight="800" numberOfLines={1} style={styles.lotTitle}>
              MHD {formatExpiryDate(lot.expiry_date)}
            </Txt>
            <Txt
              variant="body"
              weight="800"
              tone="danger"
              style={[styles.lotAmount, { textDecorationLine: 'line-through' }]}>
              {formatAmount(lot.quantity, lot.unit)}
            </Txt>
          </View>
          <Txt variant="caption" tone="danger" weight="700" numberOfLines={1}>
            Konflikt: nicht übernommen
          </Txt>
        </View>
      </Press>
    );
  }

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
    headerSide: { flex: 1, minWidth: 42, alignItems: 'flex-start' },
    headerRight: { alignItems: 'flex-end' },
    scroll: { flex: 1 },
    content: { paddingHorizontal: space.lg, paddingBottom: space.xxxl },
    detailLead: {
      paddingBottom: space.lg,
      marginBottom: space.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
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
    stateValue: { marginTop: space.xs, marginBottom: 2 },
    stateCardAction: {
      minHeight: 44,
      paddingHorizontal: space.md,
      justifyContent: 'center',
      borderTopWidth: StyleSheet.hairlineWidth,
      backgroundColor: withAlpha(colors.accent, 0.08),
    },
    sectionLabel: {
      marginBottom: space.sm,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    lotRow: {
      minHeight: 82,
      flexDirection: 'row',
      alignItems: 'stretch',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    lotStatus: {
      width: 4,
      marginVertical: space.md,
      marginRight: space.md,
      borderRadius: 3,
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
  });
}
