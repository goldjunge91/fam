import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Modal, Pressable, View } from 'react-native';
import { Button } from '@/components/ui/buttons';
import { Txt } from '@/constants/ui';
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
            <Txt variant="title" weight="600">
              Haushalt wechseln
            </Txt>
            <Pressable onPress={onClose} hitSlop={10}>
              <Txt variant="body" tone="secondary" style={{ fontSize: 18, lineHeight: 22 }}>
                ✕
              </Txt>
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
                    <Txt variant="body" weight={isSelected ? '700' : '400'}>
                      🏠 {hh.name}
                    </Txt>
                  </View>
                  {isSelected && (
                    <Txt variant="body" tone="success" weight="700">
                      ✓ Aktiv
                    </Txt>
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
