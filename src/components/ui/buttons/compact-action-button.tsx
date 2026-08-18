import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

type CompactActionButtonProps = {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  expanded?: boolean;
};

/** Vollbreite 34-Punkt-Aktion für kompakte Menüs und Bottom Sheets. */
export function CompactActionButton({
  label,
  onPress,
  accessibilityLabel,
  expanded = false,
}: CompactActionButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ expanded }}
      className="btn-compact-action">
      <ThemedText type="default">{label}</ThemedText>
      {/* Rotation als natives Transform statt dynamischer `rotate-180`-Klasse:
          Ein Klassenwechsel nach dem ersten Render loest bei NativeWind einen
          "Upgrade"-Rewrap aus, dessen Dev-Warnung an einem Navigation-Context-
          Getter abstuerzt (react-native-css-interop-Bug). Das Transform hier
          selbst hat keine Tailwind-Entsprechung fuer einen zur Laufzeit
          umschaltbaren Winkel. */}
      <View
        className="w-[12px] h-[7px]"
        style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}>
        <View className="absolute top-[2px] left-0 w-[7px] h-[1.5px] rounded-hairline bg-text-secondary rotate-[38deg]" />
        <View className="absolute top-[2px] right-0 w-[7px] h-[1.5px] rounded-hairline bg-text-secondary -rotate-[38deg]" />
      </View>
    </Pressable>
  );
}

