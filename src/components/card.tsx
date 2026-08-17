import type { ReactNode } from 'react';
import { Pressable, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

type CardProps = {
  children: ReactNode;
  title?: string;
  footer?: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  className?: string;
};

/** Flaeche fuer zusammengehoerende Inhalte. Antippbar, sobald `onPress` gesetzt ist. */
export function Card({ children, title, footer, onPress, style, className = '' }: CardProps) {
  const content = (
    <ThemedView type="backgroundElement" className={`card-fam ${className}`.trim()} style={style}>
      {title ? <ThemedText type="smallBold">{title}</ThemedText> : null}
      {children}
      {footer}
    </ThemedView>
  );

  if (!onPress) return content;

  return (
    <Pressable onPress={onPress} accessibilityRole="button" className="active:opacity-70">
      {content}
    </Pressable>
  );
}
