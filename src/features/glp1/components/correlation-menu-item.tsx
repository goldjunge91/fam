import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { ThemedText } from '@/components/theme/themed-text';

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
      className="flex-row items-center justify-between py-two px-three rounded-xl bg-card border border-border">
      <View className="gap-one">
        <ThemedText type="labelBold">Korrelationsanalyse</ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          Injektion, Kalorien und Gewicht
        </ThemedText>
      </View>
      <ThemedText type="labelBold" themeColor="accent">
        Öffnen
      </ThemedText>
    </Pressable>
  );
}
