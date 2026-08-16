import { Pressable, StyleSheet, View } from 'react-native';

import { FontSize, ThemedText } from '@/components/themed-text';

type SectionHeadingProps = {
  title: string;
  eyebrow?: string;
  actionLabel?: string;
  onActionPress?: () => void;
};

/** Kleine Abschnittszeile fuer Kartenraster und horizontale Sammlungen. */
export function SectionHeading({
  title,
  eyebrow,
  actionLabel,
  onActionPress,
}: SectionHeadingProps) {
  return (
    <View style={styles.row}>
      <View style={styles.titleWrap}>
        {eyebrow ? <ThemedText type="title">{eyebrow}</ThemedText> : null}
        <ThemedText type="subheading">{title}</ThemedText>
      </View>
      {actionLabel && onActionPress ? (
        <Pressable
          onPress={onActionPress}
          role="button"
          aria-label={actionLabel}
          hitSlop={8}
          style={({ pressed }) => pressed && styles.pressed}>
          <ThemedText themeColor="accent" style={styles.action}>
            {actionLabel}
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  titleWrap: {
    flexShrink: 1,
  },
  action: {
    ...FontSize[11],
    lineHeight: 16,
    fontWeight: 700,
  },
  pressed: {
    opacity: 0.65,
  },
});
