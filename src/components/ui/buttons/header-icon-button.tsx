import type { ReactNode } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/components/theme/ThemeProvider';

type HeaderIconButtonProps = {
  label: string;
  onPress: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  className?: string;
};

/** Einheitlicher 39-Punkt-Glasbutton fuer kompakte Header-Aktionen. */
export function HeaderIconButton({
  label,
  onPress,
  children,
  style,
  className = '',
}: HeaderIconButtonProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`btn-header-icon ${className}`.trim()}
      style={[{ backgroundColor: colors.backgroundSoft }, style]}>
      {children}
    </Pressable>
  );
}
