import { Modal, Pressable, ScrollView, View } from 'react-native';

import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';
import type { TrackingMethod } from '@/features/calorie-tracking/api';

export type TrackingMethodOption = {
  id: TrackingMethod;
  label: string;
  icon: string;
  desc: string;
};

type TrackingMethodSheetProps = {
  visible: boolean;
  methods: readonly TrackingMethodOption[];
  selected: TrackingMethod;
  onSelect: (method: TrackingMethod) => void;
  onClose: () => void;
};

/** Auswahlmenü für die Tracking-Methode. Ein Tap wählt aus und schließt sofort. */
export function TrackingMethodSheet({
  visible,
  methods,
  selected,
  onSelect,
  onClose,
}: TrackingMethodSheetProps) {
  const { colors } = useTheme();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}>
      <View className="profile-food-rules-sheet-backdrop">
        <View className="profile-food-rules-sheet" style={{ backgroundColor: colors.surface }}>
          <View className="modal-handle" />
          <View className="profile-food-rules-sheet-header">
            <View className="flex-1 gap-half">
              <Txt variant="heading">Tracking-Methode</Txt>
              <Txt variant="caption" tone="secondary">
                Bestimmt dein Ernährungstagebuch
              </Txt>
            </View>
            <Pressable
              onPress={onClose}
              role="button"
              aria-label="Tracking-Methode schließen"
              className="modal-close-btn">
              <Txt variant="body" tone="secondary" aria-hidden>
                ✕
              </Txt>
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerClassName="pb-two"
            role="radiogroup"
            aria-label="Tracking-Methode">
            {methods.map((method, index) => {
              const isSelected = method.id === selected;
              return (
                <Pressable
                  key={method.id}
                  onPress={() => onSelect(method.id)}
                  role="radio"
                  aria-label={method.label}
                  aria-checked={isSelected}
                  className="profile-food-rules-option"
                  style={{
                    backgroundColor: isSelected ? colors.basilSoft : colors.surface,
                    borderBottomColor: colors.border,
                    borderBottomWidth: index < methods.length - 1 ? 1 : 0,
                  }}>
                  <Txt variant="body" style={{ fontSize: 16 }}>
                    {method.icon}
                  </Txt>
                  <View className="flex-1">
                    <Txt variant="label" weight="700">
                      {method.label}
                    </Txt>
                    <Txt variant="caption" tone="secondary">
                      {method.desc}
                    </Txt>
                  </View>
                  <View
                    className="checkbox-base"
                    style={{
                      backgroundColor: isSelected ? colors.basil : 'transparent',
                      borderColor: colors.basil,
                      borderWidth: 1.5,
                    }}>
                    {isSelected ? (
                      <Txt variant="caption" tone="onAccent">
                        ✓
                      </Txt>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
