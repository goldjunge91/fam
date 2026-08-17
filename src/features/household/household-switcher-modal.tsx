import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Modal, Pressable, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/buttons';
import { useActiveHousehold } from '@/features/household/active-household-provider';

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
      <View className="modal-backdrop">
        <View className="modal-sheet">
          <View className="modal-header-row">
            <ThemedText type="subtitle">Haushalt wechseln</ThemedText>
            <Pressable onPress={onClose} hitSlop={10}>
              <ThemedText themeColor="textSecondary" className="text-[18px]">
                ✕
              </ThemedText>
            </Pressable>
          </View>

          <View className="gap-one">
            {households.map((hh) => {
              const isSelected = hh.id === currentSelectedId;
              return (
                <Pressable
                  key={hh.id}
                  onPress={() => handleSelect(hh.id)}
                  className={`hh-row ${isSelected ? 'bg-background-element' : ''}`}>
                  <View className="flex-1">
                    <ThemedText className={isSelected ? 'font-bold' : 'font-normal'}>
                      🏠 {hh.name}
                    </ThemedText>
                  </View>
                  {isSelected && (
                    <ThemedText className="text-[#10B981] font-bold">✓ Aktiv</ThemedText>
                  )}
                </Pressable>
              );
            })}
          </View>

          <View className="hh-actions">
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
