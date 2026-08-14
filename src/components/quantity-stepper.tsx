import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText, Typography } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

type QuantityStepperProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
  size?: 'default' | 'large';
};

/** Kompakter Mengen-Stepper fuer ganzzahlige Einkaufs- und Portionsmengen. */
export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  label = 'Menge',
  size = 'default',
}: QuantityStepperProps) {
  const theme = useTheme();
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
      style={[
        styles.root,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
      ]}>
      <Pressable
        onPress={() => update(-1)}
        disabled={value <= min}
        accessibilityRole="button"
        accessibilityLabel={`${label} verringern`}
        style={({ pressed }) => [
          styles.action,
          { backgroundColor: theme.backgroundSelected },
          value <= min && styles.disabled,
          pressed && styles.pressed,
        ]}>
        <ThemedText
          style={[
            styles.actionLabel,
            size === 'large' && styles.largeActionLabel,
            { color: theme.accent },
          ]}>
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
          style={[
            styles.value,
            styles.valueInput,
            size === 'large' && styles.largeValue,
            { color: theme.text },
          ]}
        />
      ) : (
        <Pressable
          onPress={startEditing}
          accessibilityRole="button"
          accessibilityLabel={`${label} direkt eingeben`}
          style={styles.valueButton}>
          <ThemedText style={[styles.value, size === 'large' && styles.largeValue]}>
            {value}
          </ThemedText>
        </Pressable>
      )}

      <Pressable
        onPress={() => update(1)}
        disabled={value >= max}
        accessibilityRole="button"
        accessibilityLabel={`${label} erhöhen`}
        style={({ pressed }) => [
          styles.action,
          { backgroundColor: theme.backgroundSelected },
          value >= max && styles.disabled,
          pressed && styles.pressed,
        ]}>
        <ThemedText
          style={[
            styles.actionLabel,
            size === 'large' && styles.largeActionLabel,
            { color: theme.accent },
          ]}>
          +
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: 13,
    borderCurve: 'continuous',
  },
  action: {
    width: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    ...Typography.controlAction,
  },
  largeActionLabel: {
    ...Typography.controlActionLarge,
  },
  value: {
    textAlign: 'center',
    ...Typography.controlValue,
    fontWeight: 600,
    fontVariant: ['tabular-nums'],
  },
  valueButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueInput: {
    flex: 1,
    alignSelf: 'stretch',
    paddingHorizontal: 8,
    paddingVertical: 0,
  },
  largeValue: {
    ...Typography.controlValueLarge,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.72,
  },
});
