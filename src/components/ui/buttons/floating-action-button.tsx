import type { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

type FloatingActionButtonProps = {
  label: string;
  onPress: () => void;
  children: ReactNode;
};

/** Grosse, schwebende Primaeraktion am unteren Bildschirmrand. */
export function FloatingActionButton({ label, onPress, children }: FloatingActionButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.button, { backgroundColor: theme.accent }]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateY: -27 }],
    boxShadow: '0 10px 22px rgba(51, 36, 61, 0.22)',
  },
});
