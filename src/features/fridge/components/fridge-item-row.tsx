import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { type ExpiryBucket, getExpiryInfo } from '../expiry';
import type { LocalFridgeItem } from '../use-fridge-items';

const EXPIRY_LEFT_BORDER: Record<ExpiryBucket, string> = {
  expired: '#C62828',
  critical: '#C62828',
  soon: '#B26A00',
  ok: '#1A7F4B',
  none: 'transparent',
};

interface FridgeItemRowProps {
  item: LocalFridgeItem;
  onPress: () => void;
  onDecrement: () => void;
  onIncrement: () => void;
  onDelete: () => void;
}

export function FridgeItemRow({
  item,
  onPress,
  onDecrement,
  onIncrement,
  onDelete,
}: FridgeItemRowProps) {
  const theme = useTheme();
  const expiry = getExpiryInfo(item.expiry_date, new Date());
  const borderColor = EXPIRY_LEFT_BORDER[expiry.bucket];

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onDelete}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${item.quantity} ${item.unit}`}
      accessibilityHint="Tippen für Nährwerte, lang drücken zum Löschen"
      style={[styles.itemRow, { borderBottomColor: theme.border }]}>
      {/* MHD-Ampel — linker farbiger Streifen */}
      <View style={[styles.expiryBar, { backgroundColor: borderColor }]} />

      {/* Inhalt */}
      <View style={styles.itemMain}>
        <ThemedText type="smallBold">{item.name}</ThemedText>
        <View style={styles.itemMeta}>
          {item.location_name ? (
            <ThemedText type="small" themeColor="textSecondary">
              {item.location_name}
            </ThemedText>
          ) : null}
          {expiry.bucket !== 'none' ? (
            <View style={[styles.mhdBadge, { backgroundColor: `${theme[expiry.themeColor]}22` }]}>
              <ThemedText type="small" style={{ color: theme[expiry.themeColor], fontSize: 11 }}>
                {item.expiry_date
                  ? new Date(item.expiry_date).toLocaleDateString('de-DE', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })
                  : ''}
                {' · '}
                {expiry.bucket === 'critical' || expiry.bucket === 'expired' ? 'Kritisch' : 'Bald'}
              </ThemedText>
            </View>
          ) : null}
        </View>
      </View>

      {/* Mengen-Stepper */}
      <View style={styles.stepper}>
        <Pressable
          onPress={onDecrement}
          accessibilityRole="button"
          accessibilityLabel="Menge reduzieren"
          hitSlop={8}
          style={[styles.stepperButton, { borderColor: theme.border }]}>
          <ThemedText style={styles.stepperIcon}>−</ThemedText>
        </Pressable>

        <ThemedText type="smallBold" style={styles.quantity}>
          {item.quantity} {item.unit}
        </ThemedText>

        <Pressable
          onPress={onIncrement}
          accessibilityRole="button"
          accessibilityLabel="Menge erhöhen"
          hitSlop={8}
          style={[
            styles.stepperButton,
            styles.stepperButtonPlus,
            { borderColor: theme.success, backgroundColor: `${theme.success}18` },
          ]}>
          <ThemedText style={[styles.stepperIcon, { color: theme.success }]}>+</ThemedText>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.three,
  },
  expiryBar: {
    width: 4,
    height: '100%',
    minHeight: 44,
    borderRadius: 2,
  },
  itemMain: {
    flex: 1,
    gap: Spacing.half,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  mhdBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: 6,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  stepperButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonPlus: {
    borderWidth: 1,
  },
  stepperIcon: {
    fontSize: 18,
    lineHeight: 22,
  },
  quantity: {
    minWidth: 54,
    textAlign: 'center',
  },
});
