import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Card, Press, Txt } from '@/constants/ui';

type CorrelationMenuItemProps = {
  logicalDate: string;
  dayStartTime: string;
  childProfileId?: string | null;
};

const styles = StyleSheet.create((theme) => ({
  pressContainer: {
    alignSelf: 'stretch',
  },
  pressSurface: {
    alignSelf: 'stretch',
  },
  item: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.space.sm,
    paddingHorizontal: theme.space.lg,
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
  const { t } = useTranslation();

  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={t('glp1.correlation.open')}
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
      containerStyle={styles.pressContainer}
      style={styles.pressSurface}>
      <Card padded={false} style={styles.item}>
        <View style={styles.content}>
          <Txt variant="label" weight="700">
            {t('glp1.correlation.title')}
          </Txt>
          <Txt variant="caption" tone="secondary">
            {t('glp1.correlation.sectionTitle')}
          </Txt>
        </View>
        <Txt variant="label" weight="700" tone="primary">
          {t('glp1.correlation.openAction')}
        </Txt>
      </Card>
    </Press>
  );
}
