import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/theme/themed-text';

type CookingModeFinishActionProps = {
  title: string;
  subtitle: string;
  onPress: () => void;
};

export function CookingModeFinishAction({
  title,
  subtitle,
  onPress,
}: CookingModeFinishActionProps) {
  return (
    <Pressable
      onPress={onPress}
      role="button"
      className="min-h-[62px] rounded-sheet px-[11px] py-[9px] flex-row items-center gap-[10px] bg-background-element/85 active:opacity-75">
      <View className="w-[38px] h-[38px] rounded-control bg-background-selected" />
      <View className="flex-1 min-w-0">
        <ThemedText type="detail" className="text-[10px] leading-[12px] font-bold">
          {title}
        </ThemedText>
        <ThemedText
          type="detail"
          themeColor="textSecondary"
          className="pt-half text-[8px] leading-[10px] font-medium">
          {subtitle}
        </ThemedText>
      </View>
      <ThemedText type="detail" themeColor="textSecondary" className="text-[18px] leading-[20px]">
        ›
      </ThemedText>
    </Pressable>
  );
}
