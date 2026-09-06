import type { ReactNode } from 'react';
import { type StyleProp, StyleSheet, type ViewStyle } from 'react-native';

import { space } from '@/components/theme/index';
import { Card as FoundationCard, Txt } from '@/constants/ui';

type CardProps = {
  children: ReactNode;
  title?: string;
  footer?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Flaeche fuer zusammengehoerende Inhalte. Interaktion gehoert in den Inhalt. */
export function Card({ children, title, footer, style }: CardProps) {
  return (
    <FoundationCard style={[styles.content, style]}>
      {title ? (
        <Txt variant="body" weight="700">
          {title}
        </Txt>
      ) : null}
      {children}
      {footer}
    </FoundationCard>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: space.sm,
  },
});
