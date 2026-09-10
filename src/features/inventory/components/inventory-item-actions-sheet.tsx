import { Feather } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GradientBackground } from '@/components/layout/gradient-background';
import {
  BUTTON_DEPTH,
  type GradientSpec,
  radius,
  space,
  withAlpha,
} from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { BackButton } from '@/components/ui/buttons';
import { QuantityStepper } from '@/components/ui/quantity-stepper';
import { Card, IconButton, Press, Txt } from '@/constants/ui';
import { useSheetShadowStyle } from '@/hooks/use-sheet-shadow-style';
import { formatAmount, formatPackageHint } from '@/lib/package-size';

import { type ExpiryThemeColor, getExpiryInfo } from '../expiry';
import type { LocalInventoryItem } from '../use-inventory-items';

type InventoryItemActionsSheetProps = {
  visible: boolean;
  item: LocalInventoryItem | null;
  onClose: () => void;
  onQuantityChange: (value: number) => void;
  onConsume: () => void;
  onRemove?: () => void;
  onWaste: () => void;
  backgroundGradient?: GradientSpec;
};

function formatExpiryDate(value: string | null): string {
  if (!value) return 'ohne MHD';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatExpiryStatus(item: LocalInventoryItem): string {
  const expiry = getExpiryInfo(item.expiry_date, new Date());
  if (expiry.daysLeft === null) return 'ohne MHD';
  if (expiry.daysLeft < 0) return expiry.label;
  return expiry.daysLeft === 0 ? 'heute' : expiry.label;
}

export function InventoryItemActionsSheet({
  visible,
  item,
  onClose,
  onQuantityChange,
  onConsume,
  onRemove,
  onWaste,
  backgroundGradient,
}: InventoryItemActionsSheetProps) {
  const { colors } = useTheme();
  const sheetStyle = useSheetShadowStyle();

  if (!item) return null;

  if (Platform.OS === 'ios') {
    return (
      <IosInventoryItemActionsView
        visible={visible}
        item={item}
        onClose={onClose}
        onQuantityChange={onQuantityChange}
        onConsume={onConsume}
        onWaste={onWaste}
        backgroundGradient={backgroundGradient}
      />
    );
  }

  const expiry = getExpiryInfo(item.expiry_date, new Date());
  const amount = formatAmount(item.quantity, item.unit);
  const packageHint = formatPackageHint(item.package_size, item.package_size_unit);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={StyleSheet.absoluteFill}>
        <Pressable
          className="fridge-actions-backdrop"
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Artikelaktionen schließen"
        />
        <View className="fridge-actions-sheet" style={sheetStyle}>
          <View className="fridge-actions-handle" />

          <View className="fridge-actions-item-header">
            {/* Farbe pro Item dynamisch (Ablaufstatus). */}
            <View
              className="fridge-actions-expiry-bar"
              style={{ backgroundColor: expiryColor(expiry.themeColor, colors, !!item.opened_at) }}
            />
            <View className="fridge-actions-item-copy">
              <Txt variant="title">{item.name}</Txt>
              <Txt variant="body" color={expiryColor(expiry.themeColor, colors, !!item.opened_at)}>
                {expiry.label}
              </Txt>
            </View>
            {/* fontVariant hat keine Tailwind-Entsprechung. */}
            <Txt variant="body" weight="700" style={{ fontVariant: ['tabular-nums'] }}>
              {amount}
            </Txt>
          </View>

          <View className="fridge-actions-quantity-row">
            <View className="fridge-actions-quantity-copy">
              <QuantityStepper
                value={item.quantity}
                onChange={onQuantityChange}
                label="Aktuelle Menge"
                size="large"
              />
              <Txt variant="body" tone="secondary">
                {packageHint ?? `${amount} aktuelle Menge`}
              </Txt>
            </View>
          </View>

          <View className="fridge-actions-row">
            <SheetAction label="Verbraucht" onPress={onConsume} variant="success" />
            <SheetAction label="Wegwerfen" onPress={onWaste} variant="danger" />
            {onRemove ? (
              <SheetAction label="Entfernen" onPress={onRemove} variant="danger" fullWidth />
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function IosInventoryItemActionsView({
  visible,
  item,
  onClose,
  onQuantityChange,
  onConsume,
  onWaste,
  backgroundGradient,
}: Omit<InventoryItemActionsSheetProps, 'onRemove'>) {
  const { colors } = useTheme();
  const styles = useThemedActionStyles();
  const expiry = getExpiryInfo(item?.expiry_date ?? null, new Date());
  const amount = item ? formatAmount(item.quantity, item.unit) : '';
  const packageHint = item ? formatPackageHint(item.package_size, item.package_size_unit) : null;

  if (!item) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
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
                bg={colors.backgroundSoft}
                size={45}
                iconSize={24}
                style={{ borderRadius: radius.lg, shadowOpacity: 0, elevation: 0 }}
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

            <Card padded={false} elevation="sm" style={styles.lotHero}>
              <View
                style={[
                  styles.heroStatus,
                  { backgroundColor: expiryColor(expiry.themeColor, colors, !!item.opened_at) },
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
  styles: ReturnType<typeof useThemedActionStyles>;
}) {
  const { colors } = useTheme();
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const isSuccess = variant === 'success';
  const isFilled = isPrimary || isDanger;
  const foreground = isFilled ? colors.onAccent : colors.text;
  const depth = isDanger ? colors.buttonDangerDepth : colors.buttonPrimaryDepth;
  const tileVariantStyle = isPrimary
    ? styles.tilePrimary
    : isSuccess
      ? styles.tileSuccess
      : isDanger
        ? styles.tileDanger
        : undefined;
  const hintColor = isFilled ? withAlpha(colors.onAccent, 0.76) : colors.textSecondary;

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

function useThemedActionStyles() {
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
    content: { paddingHorizontal: space.lg, paddingBottom: space.xxxl, gap: space.lg },
    detailLead: {
      paddingBottom: space.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    detailSubtitle: { marginTop: space.xs },
    lotHero: {
      minHeight: 78,
      flexDirection: 'row',
      alignItems: 'center',
      padding: space.md,
      borderRadius: radius.lg,
    },
    heroStatus: { width: 5, height: 54, marginRight: space.md, borderRadius: 3 },
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
      borderBottomColor: colors.border,
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
      borderColor: colors.border,
      borderRadius: radius.lg,
      backgroundColor: colors.backgroundSoft,
    },
    tilePrimary: { borderColor: colors.accent, backgroundColor: colors.accent },
    tileDanger: {
      borderColor: colors.danger,
      backgroundColor: colors.danger,
    },
    tileSuccess: {
      borderColor: colors.success,
      backgroundColor: withAlpha(colors.success, 0.5),
    },
    tileIcon: {
      width: 30,
      height: 30,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.sm,
      marginBottom: space.xs,
    },
  });
}

const ACTION_VARIANT_CLASSES = {
  neutral: 'fridge-action-btn-neutral',
  primary: 'bg-accent',
  success: 'fridge-action-btn-success border border-success',
  danger: 'fridge-action-btn-danger',
} as const;

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
  variant: keyof typeof ACTION_VARIANT_CLASSES;
  fullWidth?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`fridge-action-btn ${fullWidth ? 'fridge-action-btn-full' : ''} ${ACTION_VARIANT_CLASSES[variant]}`}>
      <Txt variant="body" tone={ACTION_VARIANT_TEXT_COLOR[variant]} weight="700">
        {label}
      </Txt>
    </Pressable>
  );
}

function expiryColor(
  themeColor: ExpiryThemeColor,
  colors: ReturnType<typeof useTheme>['colors'],
  opened: boolean,
): string {
  if (themeColor === 'danger') return colors.tomato;
  if (themeColor === 'warning') return colors.carrot;
  if (opened) return colors.carrot;
  return colors.textMuted;
}
