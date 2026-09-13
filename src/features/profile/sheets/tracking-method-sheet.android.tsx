import { Modal, Pressable, ScrollView, View } from 'react-native';

import { CloseButton, Txt } from '@/constants/ui';
import type { TrackingMethod } from '@/features/calorie-tracking/api';
import { profileSheetStyles } from '@/features/profile/sheets/profile-sheet-styles';

export type TrackingMethodOption = {
  id: TrackingMethod;
  label: string;
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
      <View style={profileSheetStyles.backdrop}>
        <View style={profileSheetStyles.sheet}>
          <View style={profileSheetStyles.handle} />
          <View style={profileSheetStyles.header}>
            <View style={profileSheetStyles.headerCopy}>
              <Txt variant="heading">Tracking-Methode</Txt>
              <Txt variant="caption" tone="secondary">
                Bestimmt dein Ernährungstagebuch
              </Txt>
            </View>
            <CloseButton onPress={onClose} accessibilityLabel="Tracking-Methode schließen" />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            style={profileSheetStyles.options}
            contentContainerStyle={profileSheetStyles.optionsContent}
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
                  style={[
                    profileSheetStyles.option,
                    isSelected && profileSheetStyles.optionSelected,
                    index < methods.length - 1 && profileSheetStyles.optionBordered,
                  ]}>
                  <View style={profileSheetStyles.optionLabel}>
                    <Txt variant="label" weight="700">
                      {method.label}
                    </Txt>
                    <Txt variant="caption" tone="secondary">
                      {method.desc}
                    </Txt>
                  </View>
                  <View
                    style={[
                      profileSheetStyles.checkbox,
                      isSelected && profileSheetStyles.checkboxSelected,
                    ]}>
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
