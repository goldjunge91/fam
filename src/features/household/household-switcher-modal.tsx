import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Modal, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Button, CloseButton, Press, Txt } from '@/constants/ui';
import { useActiveHousehold } from '@/features/household/active-household-provider';

const styles = StyleSheet.create((theme) => ({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: theme.space.xl + theme.space.xs,
    backgroundColor: theme.scrim,
  },
  sheet: {
    gap: theme.space.lg,
    padding: theme.space.xl + theme.space.xs,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  householdList: {
    gap: theme.space.xs,
  },
  householdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    gap: theme.space.sm,
    paddingHorizontal: theme.space.sm,
    paddingVertical: theme.space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
    borderRadius: theme.radius.md,
    backgroundColor: 'transparent',
  },
  householdRowSelected: {
    backgroundColor: theme.backgroundElement,
  },
  flex: {
    flex: 1,
  },
  actions: {
    gap: theme.space.sm,
    marginTop: theme.space.sm,
  },
}));

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
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Txt variant="title" weight="600">
              Haushalt wechseln
            </Txt>
            <CloseButton
              onPress={onClose}
              hitSlop={10}
              accessibilityLabel="Haushalt wechseln schließen"
            />
          </View>

          <View
            style={styles.householdList}
            accessibilityRole="radiogroup"
            accessibilityLabel="Haushalte">
            {households.map((hh) => {
              const isSelected = hh.id === currentSelectedId;
              return (
                <Press
                  key={hh.id}
                  haptic="selection"
                  onPress={() => handleSelect(hh.id)}
                  accessibilityRole="radio"
                  accessibilityLabel={hh.name}
                  accessibilityState={{ selected: isSelected }}
                  style={[styles.householdRow, isSelected && styles.householdRowSelected]}>
                  <View style={styles.flex}>
                    <Txt variant="body" weight={isSelected ? '700' : '400'}>
                      🏠 {hh.name}
                    </Txt>
                  </View>
                  {isSelected && (
                    <Txt variant="body" tone="success" weight="700">
                      ✓ Aktiv
                    </Txt>
                  )}
                </Press>
              );
            })}
          </View>

          <View style={styles.actions}>
            <Button
              title="+ Neuen Haushalt erstellen"
              onPress={() => {
                onClose();
                router.push('/household/create');
              }}
            />
            <Button
              title="Haushalt beitreten (Code/Link)"
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
