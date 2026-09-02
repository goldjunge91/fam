import { Modal, Pressable, ScrollView, View } from 'react-native';

import { ThemedText } from '@/components/theme/themed-text';
import { ThemedView } from '@/components/theme/themed-view';
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
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}>
      <View className="profile-food-rules-sheet-backdrop">
        <ThemedView className="profile-food-rules-sheet">
          <View className="modal-handle" />
          <View className="profile-food-rules-sheet-header">
            <View className="flex-1 gap-half">
              <ThemedText type="headingSmall">Tracking-Methode</ThemedText>
              <ThemedText type="smallMuted">Bestimmt dein Ernährungstagebuch</ThemedText>
            </View>
            <Pressable
              onPress={onClose}
              role="button"
              aria-label="Tracking-Methode schließen"
              className="modal-close-btn">
              <ThemedText aria-hidden>✕</ThemedText>
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
                  className={`profile-food-rules-option ${
                    index < methods.length - 1 ? 'profile-food-rules-option-bordered' : ''
                  }`}>
                  <ThemedText className="text-[16px]">{method.icon}</ThemedText>
                  <View className="flex-1">
                    <ThemedText type="smallBold">{method.label}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {method.desc}
                    </ThemedText>
                  </View>
                  <View
                    className={`checkbox-base ${
                      isSelected ? 'checkbox-checked' : 'checkbox-unchecked'
                    }`}>
                    {isSelected ? (
                      <ThemedText type="caption" themeColor="onAccent">
                        ✓
                      </ThemedText>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </ThemedView>
      </View>
    </Modal>
  );
}
