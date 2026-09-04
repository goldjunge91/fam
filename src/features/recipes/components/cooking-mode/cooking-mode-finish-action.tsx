import { Pressable, View } from 'react-native';

import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';

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
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      role="button"
      className="min-h-[62px] rounded-sheet px-[11px] py-[9px] flex-row items-center gap-[10px] active:opacity-75"
      style={{ backgroundColor: colors.surface }}>
      <View
        className="w-[38px] h-[38px] rounded-control"
        style={{ backgroundColor: colors.surfaceSoft }}
      />
      <View className="flex-1 min-w-0">
        <Txt variant="caption" weight="700" style={{ fontSize: 10, lineHeight: 12 }}>
          {title}
        </Txt>
        <Txt
          variant="caption"
          tone="secondary"
          className="pt-half"
          style={{ fontSize: 8, lineHeight: 10 }}>
          {subtitle}
        </Txt>
      </View>
      <Txt variant="body" tone="secondary" style={{ fontSize: 18, lineHeight: 20 }}>
        ›
      </Txt>
    </Pressable>
  );
}
