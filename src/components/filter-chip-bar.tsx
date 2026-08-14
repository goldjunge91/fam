import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { FontSize } from '@/components/themed-text';

import { useTheme } from '@/hooks/use-theme';

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

/** Horizontal scrollbare Einzelauswahl, wiederverwendbar fuer Filter und Segmente. */
export function FilterChipBar<T extends string>({
  label,
  options,
  selected,
  onSelect,
}: FilterChipBarProps<T>) {
  const theme = useTheme();

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
              {
                backgroundColor: active ? theme.accent : `${theme.backgroundElement}B8`,
              },
              pressed && styles.pressed,
            ]}>
            <Text style={[styles.label, { color: active ? '#FFFFFF' : theme.textSecondary }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 6,
    paddingRight: 15,
  },
  chip: {
    minHeight: 28,
    justifyContent: 'center',
    paddingHorizontal: 13,
    borderRadius: 12,
    borderCurve: 'continuous',
  },
  label: {
    ...FontSize[11],
    lineHeight: 14,
    fontWeight: 600,
  },
  pressed: {
    opacity: 0.75,
  },
});
