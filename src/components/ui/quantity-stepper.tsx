import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/theme/themed-text';

type QuantityStepperProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
  size?: 'default' | 'large';
};

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 9999,
  label = 'Menge',
  size = 'default',
}: QuantityStepperProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftValue, setDraftValue] = useState(String(value));

  function update(delta: number) {
    onChange(Math.min(max, Math.max(min, value + delta)));
  }

  function startEditing() {
    setDraftValue(String(value));
    setIsEditing(true);
  }

  function commitDraft() {
    const parsed = Number.parseInt(draftValue, 10);
    const nextValue = Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : value;
    setDraftValue(String(nextValue));
    setIsEditing(false);
    if (nextValue !== value) onChange(nextValue);
  }

  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value }}
      className="stepper-container">
      <Pressable
        onPress={() => update(-1)}
        disabled={value <= min}
        accessibilityRole="button"
        accessibilityLabel={`${label} verringern`}
        className={`stepper-btn ${value <= min ? 'opacity-45' : ''}`}>
        <ThemedText
          themeColor="accent"
          className={`text-control-action ${size === 'large' ? 'text-control-action-lg' : ''}`}>
          −
        </ThemedText>
      </Pressable>

      {isEditing ? (
        <TextInput
          value={draftValue}
          onChangeText={(text) => setDraftValue(text.replace(/[^0-9]/g, ''))}
          onBlur={commitDraft}
          autoFocus
          selectTextOnFocus
          keyboardType="number-pad"
          returnKeyType="done"
          accessibilityLabel={`${label} eingeben`}
          className={`flex-1 self-stretch px-two py-0 text-center text-control-value font-semibold [font-variant:tabular-nums] text-text ${
            size === 'large' ? 'text-control-value-lg' : ''
          }`}
        />
      ) : (
        <Pressable
          onPress={startEditing}
          accessibilityRole="button"
          accessibilityLabel={`${label} direkt eingeben`}
          className="flex-1 items-center justify-center">
          <ThemedText
            className={`text-center text-control-value font-semibold [font-variant:tabular-nums] ${
              size === 'large' ? 'text-control-value-lg' : ''
            }`}>
            {value}
          </ThemedText>
        </Pressable>
      )}

      <Pressable
        onPress={() => update(1)}
        disabled={value >= max}
        accessibilityRole="button"
        accessibilityLabel={`${label} erhöhen`}
        className={`stepper-btn ${value >= max ? 'opacity-45' : ''}`}>
        <ThemedText
          themeColor="accent"
          className={`text-control-action ${size === 'large' ? 'text-control-action-lg' : ''}`}>
          +
        </ThemedText>
      </Pressable>
    </View>
  );
}
