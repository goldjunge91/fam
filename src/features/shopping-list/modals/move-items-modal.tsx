import { Modal, Pressable, View } from 'react-native';

import { ThemedText } from '@/components/theme/themed-text';
import { useTheme } from '@/hooks/use-theme';
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
  const theme = useTheme();
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
        accessibilityLabel={`Auf ${label} verschieben`}
        accessibilityState={{ disabled }}
        className={`move-items-target ${disabled ? 'opacity-40' : ''}`}>
        <View className="store-picker-dot" style={{ backgroundColor: color }} />
        <ThemedText type="default" className="flex-1">
          {label}
        </ThemedText>
        {disabled ? (
          <ThemedText type="caption" themeColor="textSecondary">
            aktuell
          </ThemedText>
        ) : null}
      </Pressable>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="move-items-backdrop">
        <View className="move-items-panel" style={{ backgroundColor: theme.background }}>
          <View className="row-between items-start mb-three">
            <View className="flex-1 gap-half">
              <ThemedText type="subtitle">Artikel verschieben</ThemedText>
              <ThemedText type="smallMuted">
                {count} {count === 1 ? 'Artikel' : 'Artikel'} in eine andere Liste verschieben
              </ThemedText>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Verschieben schließen"
              className="modal-close-btn">
              <ThemedText>✕</ThemedText>
            </Pressable>
          </View>

          <View className="gap-one">
            {stores.map((store) => renderTarget(store.name, store.id, store.color))}
            {renderTarget('Ohne Markt', null, theme.textSecondary)}
          </View>
        </View>
      </View>
    </Modal>
  );
}
