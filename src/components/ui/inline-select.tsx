import { useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { radius, space } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Press, Txt } from '@/constants/ui';

export type InlineSelectOption = {
  value: string;
  label: string;
  icon?: string;
  /** Zeigt die Option an, aber deaktiviert sie (z. B. noch nicht gebaute Filter). */
  disabled?: boolean;
  /** Kurzer Hinweistext neben einer deaktivierten Option, z. B. "bald". */
  disabledHint?: string;
};

type InlineSelectProps = {
  value: string;
  options: readonly InlineSelectOption[];
  onChange: (value: string) => void;
  accessibilityLabel: string;
};

const styles = StyleSheet.create({
  root: {
    position: 'relative',
    flex: 1,
  },
  button: {
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
  },
  buttonLabel: {
    flex: 1,
  },
  panel: {
    position: 'absolute',
    top: 46,
    left: 0,
    right: 0,
    zIndex: 20,
    borderRadius: radius.sm,
    borderWidth: 1,
    padding: space.xs,
    gap: 2,
  },
  option: {
    minHeight: 44,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  optionLabel: {
    flex: 1,
  },
});

export function InlineSelect({ value, options, onChange, accessibilityLabel }: InlineSelectProps) {
  const [open, setOpen] = useState(false);
  const { colors } = useTheme();
  const selected = options.find((option) => option.value === value);

  return (
    <View style={styles.root}>
      <Press
        haptic="selection"
        onPress={() => setOpen((current) => !current)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ expanded: open }}
        style={[
          styles.button,
          {
            backgroundColor: colors.backgroundElement,
            borderColor: open ? colors.accent : colors.border,
          },
        ]}>
        <Txt variant="body" weight="700" numberOfLines={1} style={styles.buttonLabel}>
          {selected?.icon ? `${selected.icon} ` : ''}
          {selected?.label ?? value}
        </Txt>
        <Txt variant="caption" tone="secondary">
          {open ? '︿' : '⌄'}
        </Txt>
      </Press>

      {open ? (
        <View
          style={[
            styles.panel,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
            },
          ]}>
          {options.map((option) => {
            const active = option.value === value;
            return (
              <Press
                haptic="selection"
                key={option.value}
                disabled={option.disabled}
                onPress={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                accessibilityRole="menuitem"
                accessibilityState={{ selected: active, disabled: option.disabled }}
                style={[
                  styles.option,
                  active && { backgroundColor: colors.accent },
                  option.disabled && { opacity: 0.4 },
                ]}>
                <Txt
                  variant="body"
                  weight="600"
                  tone={active ? 'onAccent' : 'primary'}
                  numberOfLines={1}
                  style={styles.optionLabel}>
                  {option.icon ? `${option.icon} ` : ''}
                  {option.label}
                </Txt>
                {option.disabled && option.disabledHint ? (
                  <Txt variant="caption" tone={active ? 'onAccent' : 'secondary'}>
                    {option.disabledHint}
                  </Txt>
                ) : null}
              </Press>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
