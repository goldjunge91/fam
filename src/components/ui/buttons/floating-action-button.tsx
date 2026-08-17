import type { ReactNode } from 'react';
import { Pressable } from 'react-native';

type FloatingActionButtonProps = {
  label: string;
  onPress: () => void;
  children: ReactNode;
};

/** Grosse, schwebende Primaeraktion am unteren Bildschirmrand. */
export function FloatingActionButton({ label, onPress, children }: FloatingActionButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="btn-fab">
      {children}
    </Pressable>
  );
}


