import { Pressable, View } from 'react-native';

import { Txt } from '@/constants/ui';

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
          <Txt
            variant="micro"
            tone="secondary"
            weight="600"
            className="uppercase"
            style={{ letterSpacing: 0.7 }}>
            {eyebrow}
          </Txt>
        ) : null}
        <Txt variant="bodySmall" weight="700" className={titleClassName}>
          {title}
        </Txt>
      </View>
      {actionLabel && onActionPress ? (
        <Pressable
          onPress={onActionPress}
          role="button"
          aria-label={actionLabel}
          hitSlop={8}
          className="active:opacity-65">
          <Txt variant="detail" tone="primary" weight="700">
            {actionLabel}
          </Txt>
        </Pressable>
      ) : null}
    </View>
  );
}
