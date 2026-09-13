import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Txt } from '@/constants/ui';

type CorrelationMenuItemProps = {
  logicalDate: string;
  dayStartTime: string;
  childProfileId?: string | null;
};

const styles = StyleSheet.create((theme) => ({
  item: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.space.sm,
    paddingHorizontal: theme.space.lg,
    borderRadius: theme.radius.sm,
    borderWidth: theme.borderWidth.base,
    backgroundColor: theme.backgroundElement,
    borderColor: theme.border,
  },
  content: {
    gap: theme.space.xs,
  },
}));

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
      style={styles.item}>
      <View style={styles.content}>
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
