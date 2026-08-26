import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/theme/themed-text';

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
      {}
      <View
        className="w-[12px] h-[7px]"
        style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}>
        <View className="absolute top-[2px] left-0 w-[7px] h-[1.5px] rounded-hairline bg-text-secondary rotate-[38deg]" />
        <View className="absolute top-[2px] right-0 w-[7px] h-[1.5px] rounded-hairline bg-text-secondary -rotate-[38deg]" />
      </View>
    </Pressable>
  );
}
