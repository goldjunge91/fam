import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import { StyleSheet } from 'react-native-unistyles';

import { useTheme } from '@/components/theme/ThemeProvider';
import { Press, Txt } from '@/constants/ui';
import { formatAmount, formatPackageHint } from '@/lib/format/package-size';

import { type ExpiryBucket, formatExpiryRowStatus } from '../expiry';
import { groupInventoryItems, type InventoryItemGroup } from '../grouped-items';
import type { LocalInventoryItem } from '../use-inventory-items';

const styles = StyleSheet.create((theme) => ({
  row: {
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.lg,
    paddingRight: theme.space.xs,
    paddingVertical: theme.space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  expiryBar: {
    width: 5,
    height: 53,
    borderRadius: theme.radius.xs,
  },
  main: {
    flex: 1,
    gap: theme.space.xs,
  },
  quantity: {
    minWidth: 58,
    textAlign: 'right',
  },
  removeAction: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeActionContainer: {
    width: 96,
    justifyContent: 'center',
  },
  rowContainer: {
    flex: 1,
  },
}));

const EXPIRY_COLOR_KEY: Record<ExpiryBucket, 'danger' | 'warning' | 'success' | null> = {
  expired: 'danger',
  critical: 'danger',
  soon: 'warning',
  ok: 'success',
  none: null,
};

interface InventoryItemRowProps {
  item: LocalInventoryItem | InventoryItemGroup;
  onPress: () => void;
  onLongPress: () => void;
  onRemove: () => void;
}

function toGroup(item: LocalInventoryItem | InventoryItemGroup): InventoryItemGroup {
  return 'lots' in item ? item : groupInventoryItems([item])[0];
}

export const InventoryItemRow = memo(function InventoryItemRow({
  item,
  onPress,
  onLongPress,
  onRemove,
}: InventoryItemRowProps) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const group = toGroup(item);
  const expiry = group.expiry;
  const expiryColorKey = EXPIRY_COLOR_KEY[expiry.bucket];
  const expiryColor = expiryColorKey ? colors[expiryColorKey] : 'transparent';
  const expiryLabel = expiry.daysLeft === null ? null : formatExpiryRowStatus(expiry, t);
  const groupMeta =
    group.lots.length > 1
      ? [
          expiryLabel ?? t('inventory.row.noDate'),
          t('inventory.row.lotsCount', { count: group.lots.length }),
        ].join(' · ')
      : (expiryLabel ?? t('inventory.row.noDate'));
  const packageHint = formatPackageHint(
    group.package_size,
    group.package_size_unit,
    t,
    i18n.language,
  );
  const amount = formatAmount(group.quantity, group.unit, t, i18n.language);
  const removeLabel =
    group.lots.length > 1 ? t('inventory.row.showLots') : t('inventory.row.remove');

  function renderRemoveAction(
    _progress: unknown,
    _translation: unknown,
    swipeable: SwipeableMethods,
  ) {
    return (
      <Press
        containerStyle={styles.removeActionContainer}
        style={[styles.removeAction, { backgroundColor: colors.danger }]}
        accessibilityRole="button"
        accessibilityLabel={t('inventory.row.actionAccessibility', {
          name: group.name,
          action: removeLabel.toLocaleLowerCase(i18n.language),
        })}
        onPress={() => {
          swipeable.close();
          onRemove();
        }}>
        <Txt variant="body" tone="onDanger" weight="700">
          {removeLabel}
        </Txt>
      </Press>
    );
  }

  return (
    <ReanimatedSwipeable
      testID={`swipeable-${item.id}`}
      friction={1.5}
      rightThreshold={48}
      overshootRight={false}
      renderRightActions={renderRemoveAction}
      containerStyle={{ overflow: 'hidden' }}>
      <Press
        containerStyle={styles.rowContainer}
        style={styles.row}
        onPress={onPress}
        onLongPress={onLongPress}
        accessibilityRole="button"
        accessibilityLabel={t('inventory.row.itemAccessibility', {
          name: group.name,
          amount,
          lots:
            group.lots.length > 1
              ? `, ${t('inventory.row.lotsCount', { count: group.lots.length })}`
              : packageHint
                ? `, ${packageHint}`
                : '',
        })}
        accessibilityHint={t('inventory.row.accessibilityHint')}>
        <View style={[styles.expiryBar, { backgroundColor: expiryColor }]} />

        <View style={styles.main}>
          <Txt variant="body" weight="800" numberOfLines={1}>
            {group.name}
          </Txt>
          {groupMeta ? (
            <Txt variant="label" tone="secondary" weight="600" numberOfLines={1}>
              {groupMeta}
            </Txt>
          ) : null}
        </View>

        <Txt
          variant="subheading"
          weight="800"
          style={[styles.quantity, { fontVariant: ['tabular-nums'] }]}>
          {amount}
        </Txt>
      </Press>
    </ReanimatedSwipeable>
  );
});
