import { useTranslation } from 'react-i18next';
import { Modal, Pressable, View } from 'react-native';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';
import type { LocalShoppingItem } from '../hooks/use-shopping-list';
import type { Store } from '../hooks/use-stores';

type MoveItemsModalProps = {
  visible: boolean;
  selectedItems: LocalShoppingItem[];
  stores: Store[];
  onSelect: (storeId: string | null) => void;
  onClose: () => void;
};

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
      <Pressable
        key={storeId ?? 'unassigned'}
        onPress={() => onSelect(storeId)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={t('shoppingList.moveItems.moveToAccessibility', { target: label })}
        accessibilityState={{ disabled }}
        className={`move-items-target ${disabled ? 'opacity-40' : ''}`}>
        <View className="store-picker-dot" style={{ backgroundColor: color }} />
        <Txt variant="body" className="flex-1">
          {label}
        </Txt>
        {disabled ? (
          <Txt variant="caption" tone="secondary">
            {t('shoppingList.moveItems.current')}
          </Txt>
        ) : null}
      </Pressable>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="move-items-backdrop">
        <View className="move-items-panel" style={{ backgroundColor: theme.bg }}>
          <View className="row-between items-start mb-three">
            <View className="flex-1 gap-half">
              <Txt variant="heading" weight="700">
                {t('shoppingList.moveItems.title')}
              </Txt>
              <Txt variant="body" tone="secondary">
                {t('shoppingList.moveItems.subtitle', { count })}
              </Txt>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('shoppingList.moveItems.closeAccessibility')}
              className="modal-close-btn">
              <Txt>✕</Txt>
            </Pressable>
          </View>

          <View className="gap-one">
            {stores.map((store) => renderTarget(store.name, store.id, store.color))}
            {renderTarget(t('shoppingList.moveItems.unassignedTarget'), null, theme.textMuted)}
          </View>
        </View>
      </View>
    </Modal>
  );
}
