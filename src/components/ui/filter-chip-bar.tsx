import { Pressable, ScrollView } from 'react-native';
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
      contentContainerClassName="gap-[6px] pr-[15px]">
      {options.map((option) => {
        const active = option.value === selected;
        return (
          <Pressable
            key={option.value}
            onPress={() => onSelect(option.value)}
            role="button"
            aria-label={`${label}: ${option.label}`}
            aria-pressed={active}
            className="min-h-[28px] justify-center px-[13px] rounded-control active:opacity-75"
            style={{ backgroundColor: active ? colors.basil : colors.surface }}>
            <Txt
              variant="caption"
              tone={active ? 'onAccent' : 'secondary'}
              weight="600">
              {option.label}
            </Txt>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
