import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { useTheme } from '@/components/theme/ThemeProvider';
import { Press, Txt } from '@/constants/ui';

type CookingModeFinishActionProps = {
  title: string;
  subtitle: string;
  onPress: () => void;
};

const styles = StyleSheet.create((theme) => ({
  action: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.md,
    borderRadius: theme.radius.lg,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: theme.radius.md,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  subtitle: {
    paddingTop: theme.space.xs,
  },
}));

export function CookingModeFinishAction({
  title,
  subtitle,
  onPress,
}: CookingModeFinishActionProps) {
  const { colors } = useTheme();

  return (
    <Press
      onPress={onPress}
      role="button"
      style={[styles.action, { backgroundColor: colors.backgroundElement }]}>
      <View style={[styles.icon, { backgroundColor: colors.backgroundSoft }]} />
      <View style={styles.copy}>
        <Txt variant="caption" weight="700">
          {title}
        </Txt>
        <Txt variant="caption" tone="secondary" style={styles.subtitle}>
          {subtitle}
        </Txt>
      </View>
      <Txt variant="subheading" tone="secondary">
        ›
      </Txt>
    </Press>
  );
}
