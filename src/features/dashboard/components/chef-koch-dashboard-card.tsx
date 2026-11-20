import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { FamIcon } from '@/components/icons/fam-icon';
import { space } from '@/components/theme/index';
import { Txt } from '@/constants/ui';
import { DashboardCardShell } from '@/features/dashboard/components/dashboard-card-shell';
import { type DashboardCardProps, registerCard } from '@/features/dashboard/registry';

const styles = StyleSheet.create((theme) => ({
  card: {
    flex: 1,
    justifyContent: 'space-between',
    gap: theme.space.md,
  },
  copy: {
    gap: theme.space.xs,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.sm,
  },
}));

function ChefKochDashboardCard({ size, onLongPress, disabled }: DashboardCardProps) {
  const { t } = useTranslation();
  const title = t('dashboard.cards.chefKoch.title');
  const description = t('dashboard.cards.chefKoch.description');

  return (
    <DashboardCardShell
      size={size}
      onPress={() => router.push('/chef-koch')}
      onLongPress={onLongPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={t('dashboard.cards.chefKoch.accessibility')}
      style={styles.card}>
      <View style={styles.copy}>
        <Txt variant="body" weight="700" numberOfLines={2}>
          {title}
        </Txt>
        {size === 'large' ? (
          <Txt variant="caption" tone="secondary" numberOfLines={2}>
            {description}
          </Txt>
        ) : null}
      </View>
      <View style={styles.footer}>
        <Txt variant="caption" tone="secondary" numberOfLines={1}>
          {description}
        </Txt>
        <FamIcon name="chevron" size={space.xl} />
      </View>
    </DashboardCardShell>
  );
}

registerCard({
  id: 'chefKoch',
  moduleKey: 'recipes',
  order: 25,
  defaultSize: 'small',
  component: ChefKochDashboardCard,
});
