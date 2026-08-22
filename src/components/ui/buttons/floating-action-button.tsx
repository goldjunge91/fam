import type { ReactNode } from 'react';
import { Pressable } from 'react-native';

type FloatingActionButtonProps = {
  label: string;
  onPress: () => void;
  children: ReactNode;
};

/**
 * Primaeraktion in der unteren Bildschirmecke (links/rechts konfigurierbar,
 * siehe `fab-position-settings.ts`) — bewusst kleiner und randnah statt
 * mittig schwebend, damit sie den Inhalt nicht verdeckt.
 */
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
