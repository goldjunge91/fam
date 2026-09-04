import { Pressable, ScrollView, type StyleProp, type TextStyle, View } from 'react-native';
import { withAlpha } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';

/**
 * Boxshadow des aktiven "surface"-Segments als Inline-Style statt als
 * conditional getoggelte `shadow-surface`-Klasse: NativeWind/css-interop
 * crasht beim Toggeln von `shadow-*`-Klassen ueber Renders hinweg mit einem
 * irrefuehrenden "Couldn't find a navigation context"-Fehler (bekannter Bug,
 * siehe github.com/nativewind/nativewind/issues/1557 und
 * github.com/nativewind/react-native-css/issues/264). Wert entspricht
 * `boxShadow.surface` in tailwind.config.js.
 */
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
  const { colors } = useTheme();
  const activeSurfaceShadow = {
    boxShadow: `0 3px 10px ${withAlpha(colors.shadowCard, 0.09)}`,
  };
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
      className={`flex-row ${rootClass} ${scrollable ? 'self-start' : ''}`}
      style={{ backgroundColor: colors.backgroundSelected }}>
      {options.map((option) => {
        const active = option.value === selected;
        const segmentHeightClass =
          appearance === 'surface'
            ? 'min-h-[40px]'
            : size === 'compact'
              ? 'min-h-[32px]'
              : 'min-h-[34px]';

        const isActiveSurface = active && appearance === 'surface';
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(option.value)}
            style={[
              isActiveSurface ? activeSurfaceShadow : undefined,
              {
                backgroundColor: active
                  ? appearance === 'surface'
                    ? colors.backgroundElement
                    : colors.accent
                  : 'transparent',
              },
            ]}
            className={`items-center justify-center rounded-control active:opacity-75 ${segmentHeightClass} ${
              scrollable ? 'flex-none min-w-[104px]' : 'flex-1'
            }`}>
            <Txt
              variant={appearance === 'surface' ? 'label' : 'caption'}
              tone={
                active
                  ? appearance === 'surface'
                    ? 'primary'
                    : 'onAccent'
                  : 'secondary'
              }
              weight="600"
              style={_labelStyle}>
              {option.label}
            </Txt>
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
