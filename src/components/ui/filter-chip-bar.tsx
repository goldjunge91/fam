import { Pressable, ScrollView, Text } from 'react-native';

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

export function FilterChipBar<T extends string>({
  label,
  options,
  selected,
  onSelect,
}: FilterChipBarProps<T>) {
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
            className={`min-h-[28px] justify-center px-[13px] rounded-control active:opacity-75 ${
              active ? 'bg-accent' : 'bg-background-element/70'
            }`}>
            <Text
              className={`text-caption-compact font-semibold ${
                active ? 'text-white' : 'text-text-secondary'
              }`}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
