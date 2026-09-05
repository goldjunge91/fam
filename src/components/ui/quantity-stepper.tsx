import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { font } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';

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
  const { colors } = useTheme();
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
        className="stepper-btn"
        style={{ opacity: value <= min ? 0.45 : 1 }}>
        <Txt variant="subheading">−</Txt>
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
          className="flex-1 self-stretch px-two py-0 text-center [font-variant:tabular-nums]"
          style={{
            color: colors.text,
            fontSize: size === 'large' ? font.sizes.md : font.sizes.base,
            lineHeight: size === 'large' ? font.lineHeights.subheading : font.lineHeights.body,
            fontWeight: '600',
          }}
        />
      ) : (
        <Pressable
          onPress={startEditing}
          accessibilityRole="button"
          accessibilityLabel={`${label} direkt eingeben`}
          className="flex-1 items-center justify-center">
          <Txt
            variant="body"
            weight="600"
            className="text-center [font-variant:tabular-nums]"
            style={size === 'large' ? styles.largeValue : undefined}>
            {value}
          </Txt>
        </Pressable>
      )}

      <Pressable
        onPress={() => update(1)}
        disabled={value >= max}
        accessibilityRole="button"
        accessibilityLabel={`${label} erhöhen`}
        className="stepper-btn"
        style={{ opacity: value >= max ? 0.45 : 1 }}>
        <Txt variant="subheading">+</Txt>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  largeValue: {
    fontSize: font.sizes.md,
    lineHeight: font.lineHeights.subheading,
  },
});
