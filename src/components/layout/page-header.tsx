import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Txt } from '@/constants/ui';

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  align?: 'start' | 'center';
  /** 'large' fuer Screens, die den Titel als eigentlichen Blickfang wollen (z. B. Rezepte). */
  titleSize?: 'default' | 'large';
};

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
          <Txt
            variant="pageSubtitle"
            tone="secondary"
            className="mb-[1px]"
            weight="600"
            numberOfLines={1}>
            {subtitle}
          </Txt>
        ) : null}
        <Txt variant={titleSize === 'large' ? 'pageTitleLarge' : 'pageTitle'} numberOfLines={1}>
          {title}
        </Txt>
      </View>
      <View className="min-w-[39px] min-h-[39px] flex-row items-center gap-[6px] justify-end">
        {trailing}
      </View>
    </View>
  );
}
