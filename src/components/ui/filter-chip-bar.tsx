import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { radius } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';

export type FilterChipOption<T extends string> = {
  value: T;
  label: string;
};

type FilterChipBarProps<T extends string> = {
  label: string;
  options: readonly FilterChipOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
};

const styles = StyleSheet.create({
  content: {
    gap: 6,
    paddingRight: 15,
  },
  chip: {
    minHeight: 28,
    justifyContent: 'center',
    paddingHorizontal: 13,
    borderRadius: radius.sm,
  },
  pressed: {
    opacity: 0.75,
  },
});

/** Horizontal scrollbare Einzelauswahl, wiederverwendbar fuer Filter und Segmente. */
export function FilterChipBar<T extends string>({
  label,
  options,
  selected,
  onSelect,
}: FilterChipBarProps<T>) {
  const { colors } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      aria-label={label}
      contentContainerStyle={styles.content}>
      {options.map((option) => {
        const active = option.value === selected;
        return (
          <Pressable
            key={option.value}
            onPress={() => onSelect(option.value)}
            role="button"
            aria-label={`${label}: ${option.label}`}
            aria-pressed={active}
            style={({ pressed }) => [
              styles.chip,
              { backgroundColor: active ? colors.accent : colors.backgroundElement },
              pressed && styles.pressed,
            ]}>
            <Txt variant="caption" tone={active ? 'onAccent' : 'secondary'} weight="600">
              {option.label}
            </Txt>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
