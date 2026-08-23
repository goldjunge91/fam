import { Pressable } from 'react-native';

import { MenuIcon } from '@/components/icons/fam-icon';
import { useTheme } from '@/hooks/use-theme';

type MenuButtonProps = {
  onPress: () => void;
};

export function MenuButton({ onPress }: MenuButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Menü öffnen"
      className="btn-menu">
      <MenuIcon color={theme.text} />
    </Pressable>
  );
}
