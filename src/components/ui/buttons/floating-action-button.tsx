import type { ReactNode } from 'react';
import { Pressable } from 'react-native';

type FloatingActionButtonProps = {
  label: string;
  onPress: () => void;
  children: ReactNode;
};

export function FloatingActionButton({ label, onPress, children }: FloatingActionButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="btn-fab-corner">
      {children}
    </Pressable>
  );
}
