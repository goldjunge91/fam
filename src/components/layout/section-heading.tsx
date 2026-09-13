import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { space } from '@/components/theme/index';
import { Txt, type TxtVariant } from '@/constants/ui';

type SectionHeadingProps = {
  title: string;
  eyebrow?: string;
  actionLabel?: string;
  onActionPress?: () => void;
  titleVariant?: TxtVariant;
};

const styles = StyleSheet.create({
  root: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: space.md,
    marginBottom: space.md,
  },
  content: {
    flexShrink: 1,
  },
  eyebrow: {
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  actionPressed: {
    opacity: 0.65,
  },
});

/** Kleine Abschnittszeile fuer Kartenraster und horizontale Sammlungen. */
export function SectionHeading({
  title,
  eyebrow,
  actionLabel,
  onActionPress,
  titleVariant = 'body',
}: SectionHeadingProps) {
  const [actionPressed, setActionPressed] = useState(false);

  return (
    <View style={styles.root}>
      <View style={styles.content}>
        {eyebrow ? (
          <Txt variant="caption" tone="secondary" weight="600" style={styles.eyebrow}>
            {eyebrow}
          </Txt>
        ) : null}
        <Txt variant={titleVariant} weight="700">
          {title}
        </Txt>
      </View>
      {actionLabel && onActionPress ? (
        <Pressable
          onPress={onActionPress}
          role="button"
          aria-label={actionLabel}
          hitSlop={8}
          onPressIn={() => setActionPressed(true)}
          onPressOut={() => setActionPressed(false)}
          style={actionPressed ? styles.actionPressed : undefined}>
          <Txt variant="caption" tone="primary" weight="700">
            {actionLabel}
          </Txt>
        </Pressable>
      ) : null}
    </View>
  );
}
