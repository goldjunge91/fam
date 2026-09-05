import type { ReactNode } from 'react';
import { Pressable, type ViewStyle } from 'react-native';

import { Card as FoundationCard, Txt } from '@/constants/ui';

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
    <FoundationCard className={`gap-two ${className}`.trim()} style={style}>
      {title ? (
        <Txt variant="body" weight="700">
          {title}
        </Txt>
      ) : null}
      {children}
      {footer}
    </FoundationCard>
  );

  if (!onPress) return content;

  return (
    <Pressable onPress={onPress} accessibilityRole="button" className="active:opacity-70">
      {content}
    </Pressable>
  );
}
