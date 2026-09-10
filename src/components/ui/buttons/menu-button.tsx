import { StyleSheet } from 'react-native';

import { radius } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { IconButton } from '@/constants/ui';

type MenuButtonProps = {
  onPress: () => void;
};

/** Einheitlicher Menuebutton fuer die zentralen App-Bereiche. */
export function MenuButton({ onPress }: MenuButtonProps) {
  const { colors } = useTheme();

  return (
    <IconButton
      icon="menu"
      onPress={onPress}
      accessibilityLabel="Menü öffnen"
      color={colors.premiumActionText}
      bg={colors.backgroundSoft}
      size={54}
      iconSize={20}
      style={styles.button}
    />
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.lg,
  },
});
