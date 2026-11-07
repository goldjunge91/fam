import { router } from 'expo-router';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { FamIcon } from '@/components/icons/fam-icon';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Press, Txt } from '@/constants/ui';
import { getChefKochDestination } from '@/features/chef-koch/navigation';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { usePremium } from '@/features/premium/premium-provider';

const styles = StyleSheet.create((theme) => ({
  root: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
    paddingVertical: theme.space.md,
    borderTopWidth: theme.borderWidth.base,
    borderBottomWidth: theme.borderWidth.base,
    borderColor: theme.border,
    marginBottom: theme.space.xl,
  },
  mark: {
    width: theme.controlSizes.touchTarget,
    height: theme.controlSizes.touchTarget,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.premiumGradientStart,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: theme.space.xs,
  },
}));

export function ChefKochEntry() {
  const { colors } = useTheme();
  const { activeHouseholdId } = useActiveHousehold();
  const { hasAI } = usePremium();
  const disabled = activeHouseholdId === null;

  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel="Aus Vorrat kochen"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => router.push(getChefKochDestination())}
      style={styles.root}>
      <View style={styles.mark} importantForAccessibility="no">
        <FamIcon name="recipes" size={24} color={colors.premiumOnSurface} />
      </View>
      <View style={styles.copy}>
        <Txt variant="body" weight="700">
          Aus Vorrat kochen
        </Txt>
        <Txt variant="caption" tone="secondary">
          {hasAI ? 'Chef-Koch findet passende Mahlzeiten' : 'Fam KI erforderlich'}
        </Txt>
      </View>
      <FamIcon name="chevron" size={20} color={colors.textSecondary} />
    </Press>
  );
}
