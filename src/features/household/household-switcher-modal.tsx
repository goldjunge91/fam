import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { useTheme } from '@/hooks/use-theme';

interface HouseholdSwitcherModalProps {
  visible: boolean;
  selectedHouseholdId?: string;
  onSelectHousehold?: (householdId: string) => void;
  onClose: () => void;
}

export function HouseholdSwitcherModal({
  visible,
  selectedHouseholdId: propSelectedId,
  onSelectHousehold,
  onClose,
}: HouseholdSwitcherModalProps) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { activeHouseholdId, households, setActiveHouseholdId } = useActiveHousehold();

  const currentSelectedId = propSelectedId ?? activeHouseholdId;

  const handleSelect = async (id: string) => {
    await setActiveHouseholdId(id);
    queryClient.invalidateQueries();
    if (onSelectHousehold) {
      onSelectHousehold(id);
    }
    onClose();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.modalBox, { backgroundColor: theme.background }]}>
          <View style={styles.headerRow}>
            <ThemedText type="subtitle">Haushalt wechseln</ThemedText>
            <Pressable onPress={onClose} hitSlop={10}>
              <ThemedText style={{ fontSize: 18, color: theme.textSecondary }}>✕</ThemedText>
            </Pressable>
          </View>

          <View style={styles.list}>
            {households.map((hh) => {
              const isSelected = hh.id === currentSelectedId;
              return (
                <Pressable
                  key={hh.id}
                  onPress={() => handleSelect(hh.id)}
                  style={[
                    styles.hhRow,
                    { borderBottomColor: theme.border },
                    isSelected && { backgroundColor: theme.backgroundElement },
                  ]}>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={{ fontWeight: isSelected ? 'bold' : 'normal' }}>
                      🏠 {hh.name}
                    </ThemedText>
                  </View>
                  {isSelected && (
                    <ThemedText style={{ color: '#10B981', fontWeight: 'bold' }}>
                      ✓ Aktiv
                    </ThemedText>
                  )}
                </Pressable>
              );
            })}
          </View>

          <View style={styles.actionButtons}>
            <Button
              label="+ Neuen Haushalt erstellen"
              onPress={() => {
                onClose();
                router.push('/household/create');
              }}
            />
            <Button
              label="Haushalt beitreten (Code/Link)"
              variant="secondary"
              onPress={() => {
                onClose();
                router.push('/household/join');
              }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  modalBox: {
    borderRadius: 20,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  list: {
    gap: Spacing.one,
  },
  hhRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    borderRadius: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  actionButtons: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
});
