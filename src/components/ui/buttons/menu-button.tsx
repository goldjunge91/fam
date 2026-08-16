import { Pressable, StyleSheet } from 'react-native';

import { MenuIcon } from '@/components/fam-icon';
import { Radius, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type MenuButtonProps = {
  onPress: () => void;
};

/** Einheitlicher Menuebutton fuer die zentralen App-Bereiche. */
export function MenuButton({ onPress }: MenuButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Menü öffnen"
      style={[styles.button, { backgroundColor: withAlpha(theme.backgroundElement, 0.7) }]}>
      <MenuIcon color={theme.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 58,
    height: 58,
    borderRadius: Radius.sheet,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
