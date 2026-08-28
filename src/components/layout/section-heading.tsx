import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/theme/themed-text';

type SectionHeadingProps = {
  title: string;
  eyebrow?: string;
  actionLabel?: string;
  onActionPress?: () => void;
  titleClassName?: string;
};

/** Kleine Abschnittszeile fuer Kartenraster und horizontale Sammlungen. */
export function SectionHeading({
  title,
  eyebrow,
  actionLabel,
  onActionPress,
  titleClassName = '',
}: SectionHeadingProps) {
  return (
    <View className="min-h-[24px] flex-row items-end justify-between gap-[12px] mb-two">
      <View className="shrink">
        {eyebrow ? (
          <ThemedText
            themeColor="textSecondary"
            className="text-micro leading-[11px] font-semibold uppercase tracking-[0.7px]">
            {eyebrow}
          </ThemedText>
        ) : null}
        <ThemedText className={`text-body-small leading-[18px] font-bold ${titleClassName}`}>
          {title}
        </ThemedText>
      </View>
      {actionLabel && onActionPress ? (
        <Pressable
          onPress={onActionPress}
          role="button"
          aria-label={actionLabel}
          hitSlop={8}
          className="active:opacity-65">
          <ThemedText themeColor="accent" className="text-caption leading-[16px] font-bold">
            {actionLabel}
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}
