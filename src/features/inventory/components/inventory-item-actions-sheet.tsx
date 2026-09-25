import { Feather } from '@expo/vector-icons';
import { type ComponentProps, useEffect, useRef } from 'react';
import { Modal, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { DateWheelField } from '@/components/forms/date-wheel-field';
import { BackButton } from '@/components/layout/back-button';
import { BUTTON_DEPTH, radius, space, withAlpha } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { QuantityStepper } from '@/components/ui/quantity-stepper';
import { Card, IconButton, Press, Txt } from '@/constants/ui';
import { useSheetShadowStyle } from '@/hooks/use-sheet-shadow-style';
import { formatAmount, formatPackageHint } from '@/lib/format/package-size';

import { debugLog } from '@/lib/observability/debug-log';
import {
  type ExpiryThemeColor,
  formatExpiryDate,
  formatExpiryStatus,
  getExpiryInfo,
} from '../expiry';
import type { LocalInventoryItem } from '../use-inventory-items';

type InventoryItemActionsSheetProps = {
  visible: boolean;
  item: LocalInventoryItem | null;
  onClose: () => void;
  onDismissFinished?: () => void;
  onQuantityChange: (value: number) => void;
  onEdit: () => void;
  onConsume: () => void;
  onRemove?: () => void;
  onOpen: () => void;
  onWaste: () => void;
  onExpiryChange: (expiryDate: string) => void;
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
    left: theme.space.sm + theme.space.xs / 2,
    right: theme.space.sm + theme.space.xs / 2,
    bottom: theme.space.sm + theme.space.xs / 2,
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
    borderRadius: theme.radius.xs / 4,
    backgroundColor: theme.border,
  },
  itemHeader: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
    paddingBottom: theme.space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  expiryBar: {
    width: 6,
    height: 52,
    borderRadius: theme.radius.xs / 2,
  },
  itemCopy: {
    flex: 1,
    gap: theme.space.xs / 2,
  },
  quantityRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
  },
  quantityCopy: {
    flex: 1,
    alignItems: 'stretch',
    gap: theme.space.md,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.md,
  },
  action: {
    width: '48%',
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
  },
  actionFull: {
    width: '100%',
  },
  actionNeutral: {
    backgroundColor: theme.backgroundSoft,
  },
  actionPrimary: {
    backgroundColor: theme.accent,
  },
  actionSuccess: {
    backgroundColor: withAlpha(theme.success, 0.5),
    borderWidth: theme.borderWidth.base,
    borderColor: theme.success,
  },
  actionDanger: {
    backgroundColor: withAlpha(theme.danger, 0.13),
  },
}));

export function InventoryItemActionsSheet({
  visible,
  item,
  onClose,
  onDismissFinished,
  onQuantityChange,
  onEdit,
  onConsume,
  onRemove,
  onOpen,
  onWaste,
  onExpiryChange,
}: InventoryItemActionsSheetProps) {
  const { colors } = useTheme();
  const sheetStyle = useSheetShadowStyle();
  const lastItemRef = useRef<LocalInventoryItem | null>(null);
  const itemId = item?.id ?? null;
  const hasItem = Boolean(item);

  useEffect(() => {
    if (!__DEV__ || !visible) return;
    debugLog('[InventorySheet] inventory.actions-sheet.open', {
      sheetId: 'inventory.actions-sheet',
      itemId,
      hasItem,
      platform: Platform.OS,
    });
  }, [hasItem, itemId, visible]);

  if (item) {
    lastItemRef.current = item;
  }
  const displayItem = item ?? lastItemRef.current;
  const isVisible = visible && Boolean(item);

  if (!displayItem) return null;

  if (Platform.OS === 'ios') {
    return (
      <IosInventoryItemActionsView
        visible={isVisible}
        item={displayItem}
        onClose={onClose}
        onDismissFinished={onDismissFinished}
        onQuantityChange={onQuantityChange}
        onEdit={onEdit}
        onConsume={onConsume}
        onOpen={onOpen}
        onWaste={onWaste}
        onExpiryChange={onExpiryChange}
      />
    );
  }

  const expiry = getExpiryInfo(displayItem.expiry_date, new Date());
  const expiryPair = expiryColors(expiry.themeColor, colors, !!displayItem.opened_at);
  const amount = formatAmount(displayItem.quantity, displayItem.unit);
  const packageHint = formatPackageHint(displayItem.package_size, displayItem.package_size_unit);

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
          accessibilityLabel="Artikelaktionen schließen"
        />
        <View style={[androidStyles.sheet, sheetStyle]}>
          <View style={androidStyles.handle} />

          <View style={androidStyles.itemHeader}>
            {/* Farbe pro Item dynamisch (Ablaufstatus). */}
            <View
              style={[
                androidStyles.expiryBar,
                {
                  backgroundColor: expiryPair.fill,
                },
              ]}
            />
            <View style={androidStyles.itemCopy}>
              <Txt variant="title">{displayItem.name}</Txt>
              <Txt variant="body" color={expiryPair.text}>
                {expiry.label}
              </Txt>
            </View>
            {/* fontVariant hat keine Tailwind-Entsprechung. */}
            <Txt variant="body" weight="700" style={{ fontVariant: ['tabular-nums'] }}>
              {amount}
            </Txt>
          </View>

          <View style={androidStyles.quantityRow}>
            <View style={androidStyles.quantityCopy}>
              <QuantityStepper
                value={displayItem.quantity}
                onChange={onQuantityChange}
                label="Aktuelle Menge"
                size="large"
              />
              <Txt variant="body" tone="secondary">
                {packageHint ?? `${amount} aktuelle Menge`}
              </Txt>
            </View>
          </View>

          <View style={androidStyles.actionRow}>
            <SheetAction label="Bearbeiten" onPress={onEdit} variant="neutral" />
            {!displayItem.opened_at ? (
              <SheetAction label="Öffnen" onPress={onOpen} variant="primary" />
            ) : null}
            <SheetAction label="Verbraucht" onPress={onConsume} variant="success" />
            <SheetAction label="Wegwerfen" onPress={onWaste} variant="danger" />
            {onRemove ? (
              <SheetAction label="Entfernen" onPress={onRemove} variant="danger" fullWidth />
            ) : null}
          </View>

          <DateWheelField
            label="Mindesthaltbarkeitsdatum"
            value={displayItem.expiry_date ?? ''}
            onChange={onExpiryChange}
          />
        </View>
      </View>
    </Modal>
  );
}

function IosInventoryItemActionsView({
  visible,
  item,
  onClose,
  onDismissFinished,
  onQuantityChange,
  onEdit,
  onConsume,
  onOpen,
  onWaste,
  onExpiryChange,
}: Omit<InventoryItemActionsSheetProps, 'onRemove'>) {
  const { colors } = useTheme();
  const styles = actionStyles;
  const insets = useSafeAreaInsets();
  const expiry = getExpiryInfo(item?.expiry_date ?? null, new Date());
  const expiryPair = expiryColors(expiry.themeColor, colors, !!item?.opened_at);
  const amount = item ? formatAmount(item.quantity, item.unit) : '';
  const packageHint = item ? formatPackageHint(item.package_size, item.package_size_unit) : null;

  if (!item) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      onDismiss={onDismissFinished}>
      <View style={styles.root}>
        <SafeAreaView
          accessibilityViewIsModal
          style={[styles.safeArea, { paddingTop: insets.top }]}
          edges={['bottom', 'left', 'right']}>
          <View style={styles.header}>
            <View style={styles.headerSide}>
              <BackButton label={item.name} variant="header" onPress={onClose} />
            </View>
            <Txt variant="heading" center>
              Los-Aktionen
            </Txt>
            <View style={[styles.headerSide, styles.headerRight]}>
              <IconButton
                icon="x"
                onPress={onClose}
                accessibilityLabel="Artikelaktionen schließen"
                bg={colors.danger}
                color={colors.onDanger}
                size={45}
                iconSize={24}
                style={{ borderRadius: radius.lg }}
              />
            </View>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            <View style={styles.detailLead}>
              <Txt variant="title">{item.name}</Txt>
              <Txt variant="label" tone="secondary" style={styles.detailSubtitle}>
                {amount} · {item.opened_at ? 'geöffnet' : 'versiegelt'} ·{' '}
                {item.location_name ?? 'Kein Lagerort'}
              </Txt>
            </View>

            <Card padded={false} style={styles.lotHero}>
              <View
                style={[
                  styles.heroStatus,
                  {
                    backgroundColor: expiryPair.fill,
                  },
                ]}
              />
              <View style={styles.heroCopy}>
                <Txt variant="body" weight="800">
                  MHD {formatExpiryDate(item.expiry_date)}
                </Txt>
                <Txt variant="caption" tone="secondary" style={styles.heroHint}>
                  {formatExpiryStatus(item)} · {item.location_name ?? 'Kein Lagerort'}
                </Txt>
              </View>
              <Txt variant="body" weight="800" style={styles.heroAmount}>
                {amount}
              </Txt>
            </Card>

            <View style={styles.quantityRow}>
              <View style={styles.quantityCopy}>
                <Txt variant="label" weight="700">
                  Aktuelle Menge
                </Txt>
                <Txt variant="caption" tone="secondary">
                  {packageHint ?? amount}
                </Txt>
              </View>
              <QuantityStepper
                value={item.quantity}
                onChange={onQuantityChange}
                label="Aktuelle Menge"
                size="large"
              />
            </View>

            <View style={styles.actionGrid}>
              {!item.opened_at ? (
                <IosActionTile
                  icon="package"
                  label="Öffnen"
                  hint="Menge aufteilen"
                  variant="primary"
                  onPress={onOpen}
                  styles={styles}
                />
              ) : null}
              <IosActionTile
                icon="edit-3"
                label="Bearbeiten"
                hint="MHD oder Ort"
                onPress={onEdit}
                styles={styles}
              />
              <IosActionTile
                icon="check"
                label="Verbrauchen"
                hint={`${amount} aufbrauchen`}
                variant="success"
                onPress={onConsume}
                styles={styles}
              />
              <IosActionTile
                icon="trash-2"
                label="Wegwerfen"
                hint="Grund dokumentieren"
                variant="danger"
                onPress={onWaste}
                styles={styles}
              />
            </View>

            <DateWheelField
              label="Mindesthaltbarkeitsdatum"
              value={item.expiry_date ?? ''}
              onChange={onExpiryChange}
            />
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function IosActionTile({
  icon,
  label,
  hint,
  variant = 'neutral',
  onPress,
  styles,
}: {
  icon: ComponentProps<typeof Feather>['name'];
  label: string;
  hint: string;
  variant?: 'neutral' | 'primary' | 'success' | 'danger';
  onPress: () => void;
  styles: typeof actionStyles;
}) {
  const { colors } = useTheme();
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const isSuccess = variant === 'success';
  const isFilled = isPrimary || isDanger;
  const foreground = isDanger ? colors.onDanger : isPrimary ? colors.onAccent : colors.text;
  const depth = isDanger ? colors.buttonDangerDepth : colors.buttonPrimaryDepth;
  const tileVariantStyle = isPrimary
    ? styles.tilePrimary
    : isSuccess
      ? styles.tileSuccess
      : isDanger
        ? styles.tileDanger
        : undefined;
  const hintColor = isFilled ? withAlpha(foreground, 0.76) : colors.textSecondary;

  return (
    <View
      style={[
        styles.tileDepth,
        !isFilled && styles.tileDepthFlat,
        { backgroundColor: isFilled ? depth : 'transparent' },
      ]}>
      <Press
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={[styles.tile, tileVariantStyle]}
        containerStyle={styles.tileContainer}>
        <View
          style={[
            styles.tileIcon,
            { backgroundColor: withAlpha(foreground, isFilled ? 0.18 : 0.14) },
          ]}>
          <Feather name={icon} size={18} color={foreground} />
        </View>
        <Txt variant="label" color={foreground} weight="800">
          {label}
        </Txt>
        <Txt variant="caption" color={hintColor}>
          {hint}
        </Txt>
      </Press>
    </View>
  );
}

const actionStyles = StyleSheet.create((theme) => ({
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
  headerSide: { flex: 1, minWidth: 42, alignItems: 'flex-start' },
  headerRight: { alignItems: 'flex-end' },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: space.lg,
    paddingBottom: space.xxxl,
    gap: space.lg,
  },
  detailLead: {
    paddingBottom: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  detailSubtitle: { marginTop: space.xs },
  lotHero: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.md,
    borderRadius: radius.lg,
  },
  heroStatus: {
    width: 5,
    height: 54,
    marginRight: space.md,
    borderRadius: theme.radius.xs / 2,
  },
  heroCopy: { flex: 1, minWidth: 0 },
  heroHint: { marginTop: space.xs },
  heroAmount: { marginLeft: space.sm, fontVariant: ['tabular-nums'] },
  quantityRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingBottom: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  quantityCopy: { flex: 1, minWidth: 0, gap: space.xs },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  tileContainer: { flex: 1 },
  tileDepth: {
    width: '47.5%',
    minHeight: 108 + BUTTON_DEPTH,
    minWidth: 140,
    borderRadius: radius.lg,
    paddingBottom: BUTTON_DEPTH,
  },
  tileDepthFlat: { minHeight: 108, paddingBottom: 0 },
  tile: {
    minHeight: 108,
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: space.xs,
    padding: space.md,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: radius.lg,
    backgroundColor: theme.backgroundSoft,
  },
  tilePrimary: { borderColor: theme.accent, backgroundColor: theme.accent },
  tileDanger: {
    borderColor: theme.danger,
    backgroundColor: theme.danger,
  },
  tileSuccess: {
    borderColor: theme.success,
    backgroundColor: withAlpha(theme.success, 0.5),
  },
  tileIcon: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    marginBottom: space.xs,
  },
}));

const ACTION_VARIANT_TEXT_COLOR = {
  neutral: 'primary',
  primary: 'onAccent',
  success: 'success',
  danger: 'danger',
} as const;

function SheetAction({
  label,
  onPress,
  variant,
  fullWidth = false,
}: {
  label: string;
  onPress: () => void;
  variant: 'neutral' | 'primary' | 'success' | 'danger';
  fullWidth?: boolean;
}) {
  return (
    <Press
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        androidStyles.action,
        fullWidth && androidStyles.actionFull,
        variant === 'neutral' && androidStyles.actionNeutral,
        variant === 'primary' && androidStyles.actionPrimary,
        variant === 'success' && androidStyles.actionSuccess,
        variant === 'danger' && androidStyles.actionDanger,
      ]}>
      <Txt variant="body" tone={ACTION_VARIANT_TEXT_COLOR[variant]} weight="700">
        {label}
      </Txt>
    </Press>
  );
}

function expiryColors(
  themeColor: ExpiryThemeColor,
  colors: ReturnType<typeof useTheme>['colors'],
  opened: boolean,
): { fill: string; text: string } {
  if (themeColor === 'danger') return { fill: colors.danger, text: colors.dangerText };
  if (themeColor === 'warning' || opened) {
    return { fill: colors.warning, text: colors.warningText };
  }
  return { fill: colors.textSecondary, text: colors.textSecondary };
}
