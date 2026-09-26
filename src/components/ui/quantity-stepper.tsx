import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { font, radius, space } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Press, Txt } from '@/constants/ui';

type QuantityStepperProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
  size?: 'default' | 'large';
  /** Fills the available width and distributes all three segments evenly. */
  fullWidth?: boolean;
};

const styles = StyleSheet.create((theme) => ({
  container: {
    height: 44,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
    borderWidth: theme.borderWidth.base,
    borderColor: theme.border,
    borderRadius: radius.sm,
    borderCurve: 'continuous',
    backgroundColor: theme.backgroundElement,
  },
  btn: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.backgroundSoft,
  },
  largeValue: {
    fontSize: font.sizes.md,
    lineHeight: font.lineHeights.subheading,
  },
}));

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 9999,
  label = 'Menge',
  size = 'default',
  fullWidth = false,
}: QuantityStepperProps) {
  const { colors } = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [draftValue, setDraftValue] = useState(String(value));
  const decrementDisabled = value <= min;
  const incrementDisabled = value >= max;

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
      style={[styles.container, fullWidth && staticStyles.fullWidthContainer]}>
      <Press
        onPress={() => update(-1)}
        disabled={decrementDisabled}
        accessibilityRole="button"
        accessibilityLabel={`${label} verringern`}
        containerStyle={fullWidth ? staticStyles.fullWidthSegment : undefined}
        style={[
          styles.btn,
          fullWidth && staticStyles.fullWidthSegment,
          staticStyles.fullHeightSegment,
          decrementDisabled ? staticStyles.disabled : staticStyles.enabled,
        ]}>
        <Txt variant="subheading">−</Txt>
      </Press>

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
            fullWidth ? staticStyles.fullWidthSegment : staticStyles.fixedWidth,
            {
              paddingHorizontal: space.sm,
              paddingVertical: 0,
              textAlign: 'center',
              fontVariant: ['tabular-nums'],
              color: colors.text,
              fontSize: size === 'large' ? font.sizes.md : font.sizes.base,
              lineHeight: size === 'large' ? font.lineHeights.subheading : font.lineHeights.body,
              fontWeight: '600',
            },
          ]}
        />
      ) : (
        <Press
          onPress={startEditing}
          accessibilityRole="button"
          accessibilityLabel={`${label} direkt eingeben`}
          containerStyle={fullWidth ? staticStyles.fullWidthSegment : undefined}
          style={[
            fullWidth ? staticStyles.fullWidthSegment : staticStyles.fixedWidth,
            staticStyles.fullHeightSegment,
            staticStyles.centerContent,
          ]}>
          <Txt
            variant="body"
            weight="600"
            style={[
              { textAlign: 'center', fontVariant: ['tabular-nums'] },
              size === 'large' ? styles.largeValue : undefined,
            ]}>
            {value}
          </Txt>
        </Press>
      )}

      <Press
        onPress={() => update(1)}
        disabled={incrementDisabled}
        accessibilityRole="button"
        accessibilityLabel={`${label} erhöhen`}
        containerStyle={fullWidth ? staticStyles.fullWidthSegment : undefined}
        style={[
          styles.btn,
          fullWidth && staticStyles.fullWidthSegment,
          staticStyles.fullHeightSegment,
          incrementDisabled ? staticStyles.disabled : staticStyles.enabled,
        ]}>
        <Txt variant="subheading">+</Txt>
      </Press>
    </View>
  );
}

/** Static styles that don't depend on theme colors. */
const staticStyles = StyleSheet.create({
  fullWidthContainer: { width: '100%' },
  fullWidthSegment: { flex: 1 },
  fullHeightSegment: { height: '100%' },
  fixedWidth: { width: 44 },
  centerContent: { alignItems: 'center', justifyContent: 'center' },
  enabled: { opacity: 1 },
  disabled: { opacity: 0.45 },
});
