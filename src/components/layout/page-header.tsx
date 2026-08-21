import type { ReactNode } from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/components/theme/themed-text';

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  align?: 'start' | 'center';
  /** 'large' fuer Screens, die den Titel als eigentlichen Blickfang wollen (z. B. Rezepte). */
  titleSize?: 'default' | 'large';
};

const TITLE_CLASSES = {
  default: 'text-[19px] leading-[23px] font-semibold tracking-[-0.5px]',
  large: 'text-[26px] leading-[30px] font-bold tracking-[-0.6px]',
} as const;

/** Kompakter Header fuer die zentralen App-Bereiche aus dem fam-Designsystem. */
export function PageHeader({
  title,
  subtitle,
  leading,
  trailing,
  align = 'start',
  titleSize = 'default',
}: PageHeaderProps) {
  return (
    <View className="min-h-[57px] flex-row items-center gap-[7px] px-[14px] py-two">
      <View className="min-w-[39px] min-h-[39px] flex-row items-center gap-[6px]">{leading}</View>
      <View className={`flex-1 min-w-0 ${align === 'center' ? 'items-center' : ''}`}>
        {subtitle ? (
          <ThemedText
            themeColor="textSecondary"
            className="text-[10px] leading-[12px] font-semibold mb-[1px]"
            numberOfLines={1}>
            {subtitle}
          </ThemedText>
        ) : null}
        <ThemedText className={TITLE_CLASSES[titleSize]} numberOfLines={1}>
          {title}
        </ThemedText>
      </View>
      <View className="min-w-[39px] min-h-[39px] flex-row items-center gap-[6px] justify-end">
        {trailing}
      </View>
    </View>
  );
}
