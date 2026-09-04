import type { ReactNode } from 'react';
import { Pressable } from 'react-native';
import { useTheme } from '@/components/theme/ThemeProvider';

type FloatingActionButtonProps = {
  label: string;
  onPress: () => void;
  children: ReactNode;
};

export function FloatingActionButton({ label, onPress, children }: FloatingActionButtonProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="btn-fab-corner"
      // Der globale Speed-Dial bleibt bewusst vom grünen Primary-Button
      // getrennt und behält den violetten Fam-Akzent.
      style={{ backgroundColor: colors.grape }}>
      {children}
    </Pressable>
  );
}
