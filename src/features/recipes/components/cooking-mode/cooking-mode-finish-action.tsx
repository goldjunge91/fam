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
      style={{ backgroundColor: colors.backgroundElement }}>
      <View
        className="w-[38px] h-[38px] rounded-control"
        style={{ backgroundColor: colors.backgroundSelected }}
      />
      <View className="flex-1 min-w-0">
        <Txt variant="micro" weight="700">
          {title}
        </Txt>
        <Txt variant="micro" tone="secondary" className="pt-half">
          {subtitle}
        </Txt>
      </View>
      <Txt variant="controlAction" tone="secondary">
        ›
      </Txt>
    </Pressable>
  );
}
