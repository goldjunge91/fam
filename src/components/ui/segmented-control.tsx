import { Pressable, ScrollView, type StyleProp, Text, type TextStyle, View } from 'react-native';

/**
 * Boxshadow des aktiven "surface"-Segments als Inline-Style statt als
 * conditional getoggelte `shadow-surface`-Klasse: NativeWind/css-interop
 * crasht beim Toggeln von `shadow-*`-Klassen ueber Renders hinweg mit einem
 * irrefuehrenden "Couldn't find a navigation context"-Fehler (bekannter Bug,
 * siehe github.com/nativewind/nativewind/issues/1557 und
 * github.com/nativewind/react-native-css/issues/264). Wert entspricht
 * `boxShadow.surface` in tailwind.config.js.
 */
const ACTIVE_SURFACE_SHADOW = { boxShadow: '0 3px 10px rgba(89, 64, 89, 0.09)' } as const;

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
  accessibilityLabel?: string;
};

type SegmentedControlProps<T extends string> = {
  label: string;
  options: readonly SegmentOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
  appearance?: 'accent' | 'surface';
  scrollable?: boolean;
  size?: 'default' | 'compact';
  gap?: number;
  labelStyle?: StyleProp<TextStyle>;
};

/** Gleichbreite Einzelauswahl fuer kompakte Ansichtsmodi. */
export function SegmentedControl<T extends string>({
  label,
  options,
  selected,
  onSelect,
  appearance = 'accent',
  scrollable = false,
  size = 'default',
  gap: _gap,
  labelStyle: _labelStyle,
}: SegmentedControlProps<T>) {
  const rootClass =
    appearance === 'surface'
      ? 'h-[48px] gap-two rounded-card p-one'
      : size === 'compact'
        ? 'h-[38px] rounded-control p-[3px] gap-one'
        : 'h-[40px] rounded-control-lg p-[3px] gap-one';

  const control = (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={label}
      className={`flex-row bg-background-selected ${rootClass} ${scrollable ? 'self-start' : ''}`}>
      {options.map((option) => {
        const active = option.value === selected;
        const segmentHeightClass =
          appearance === 'surface'
            ? 'min-h-[40px]'
            : size === 'compact'
              ? 'min-h-[32px]'
              : 'min-h-[34px]';

        const isActiveSurface = active && appearance === 'surface';
        const activeBgClass = active
          ? appearance === 'surface'
            ? 'bg-background-element'
            : 'bg-accent'
          : '';

        const labelColorClass = active
          ? appearance === 'surface'
            ? 'text-text'
            : 'text-on-accent'
          : 'text-text-secondary';

        const labelSizeClass = appearance === 'surface' ? 'text-label' : 'text-caption-compact';

        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(option.value)}
            style={isActiveSurface ? ACTIVE_SURFACE_SHADOW : undefined}
            className={`items-center justify-center rounded-control active:opacity-75 ${segmentHeightClass} ${
              scrollable ? 'flex-none min-w-[104px]' : 'flex-1'
            } ${activeBgClass}`}>
            <Text className={`font-semibold ${labelSizeClass} ${labelColorClass}`}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  if (!scrollable) return control;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="grow justify-center">
      {control}
    </ScrollView>
  );
}
