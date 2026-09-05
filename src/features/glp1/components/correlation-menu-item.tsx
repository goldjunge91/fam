import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';

type CorrelationMenuItemProps = {
  logicalDate: string;
  dayStartTime: string;
  childProfileId?: string | null;
};

export function CorrelationMenuItem({
  logicalDate,
  dayStartTime,
  childProfileId,
}: CorrelationMenuItemProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Korrelationsanalyse öffnen"
      onPress={() =>
        router.push({
          pathname: '/glp1/correlation',
          params: {
            logicalDate,
            dayStartTime,
            ...(childProfileId ? { childProfileId } : {}),
          },
        })
      }
      className="flex-row items-center justify-between py-two px-three rounded-xl border"
      style={{ backgroundColor: colors.backgroundElement, borderColor: colors.border }}>
      <View className="gap-one">
        <Txt variant="label" weight="700">
          Korrelationsanalyse
        </Txt>
        <Txt variant="caption" tone="secondary">
          Injektion, Kalorien und Gewicht
        </Txt>
      </View>
      <Txt variant="label" weight="700" tone="primary">
        Öffnen
      </Txt>
    </Pressable>
  );
}
