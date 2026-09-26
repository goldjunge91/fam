import { useTranslation } from 'react-i18next';
import { Modal, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTheme } from '@/components/theme/ThemeProvider';
import { CloseButton, Press, Surface, Txt } from '@/constants/ui';
import type { LocalShoppingItem } from '../hooks/use-shopping-list';
import type { Store } from '../hooks/use-stores';

type MoveItemsModalProps = {
  visible: boolean;
  selectedItems: LocalShoppingItem[];
  stores: Store[];
  onSelect: (storeId: string | null) => void;
  onClose: () => void;
};

const styles = StyleSheet.create((theme) => ({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: theme.scrim,
  },
  panel: {
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    borderTopWidth: theme.borderWidth.base,
    borderTopColor: theme.border,
    paddingHorizontal: theme.space.xxl,
    paddingTop: theme.space.xxl,
    paddingBottom: theme.space.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.space.sm,
    marginBottom: theme.space.lg,
  },
  headingGroup: {
    flex: 1,
    gap: theme.space.xs,
  },
  targetList: {
    gap: theme.space.xs,
  },
  target: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.lg,
    borderRadius: theme.radius.sm,
    borderWidth: theme.borderWidth.base,
    borderColor: theme.border,
    minHeight: 44,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.lg,
  },
  targetDisabled: {
    opacity: 0.4,
  },
  targetDot: {
    width: theme.space.sm,
    height: theme.space.sm,
    borderRadius: theme.radius.pill,
  },
  targetLabel: {
    flex: 1,
  },
}));

export function MoveItemsModal({
  visible,
  selectedItems,
  stores,
  onSelect,
  onClose,
}: MoveItemsModalProps) {
  const { t } = useTranslation();
  const { colors: theme } = useTheme();
  const count = selectedItems.length;

  function isCurrentTarget(storeId: string | null) {
    return count > 0 && selectedItems.every((item) => item.store_id === storeId);
  }

  function renderTarget(label: string, storeId: string | null, color: string) {
    const disabled = isCurrentTarget(storeId);
    return (
      <Press
        haptic="selection"
        key={storeId ?? 'unassigned'}
        onPress={() => onSelect(storeId)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={t('shoppingList.moveItems.moveToAccessibility', { target: label })}
        accessibilityState={{ disabled }}
        style={[styles.target, disabled && styles.targetDisabled]}>
        <View style={[styles.targetDot, { backgroundColor: color }]} />
        <Txt variant="body" style={styles.targetLabel}>
          {label}
        </Txt>
        {disabled ? (
          <Txt variant="caption" tone="secondary">
            {t('shoppingList.moveItems.current')}
          </Txt>
        ) : null}
      </Press>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Surface tone="page" style={styles.panel}>
          <View style={styles.header}>
            <View style={styles.headingGroup}>
              <Txt variant="heading" weight="700">
                {t('shoppingList.moveItems.title')}
              </Txt>
              <Txt variant="body" tone="secondary">
                {t('shoppingList.moveItems.subtitle', { count })}
              </Txt>
            </View>
            <CloseButton
              onPress={onClose}
              accessibilityLabel={t('shoppingList.moveItems.closeAccessibility')}
            />
          </View>

          <View style={styles.targetList}>
            {stores.map((store) => renderTarget(store.name, store.id, store.color))}
            {renderTarget(t('shoppingList.moveItems.unassignedTarget'), null, theme.textSecondary)}
          </View>
        </Surface>
      </View>
    </Modal>
  );
}
