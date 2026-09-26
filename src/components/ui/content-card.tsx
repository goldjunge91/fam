import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Card as FoundationCard, Txt } from '@/constants/ui';

type ContentCardProps = {
  children: ReactNode;
  title?: string;
  footer?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Flaeche fuer zusammengehoerende Inhalte. Interaktion gehoert in den Inhalt. */
export function ContentCard({ children, title, footer, style }: ContentCardProps) {
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

const styles = StyleSheet.create((theme) => ({
  content: {
    gap: theme.space.sm,
  },
}));
