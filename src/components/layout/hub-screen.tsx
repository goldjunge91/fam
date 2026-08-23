import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GradientBackground } from '@/components/layout/gradient-background';
import { PageHeader } from '@/components/layout/page-header';
import { useSyncBannerVisible } from '@/components/ui/sync-status-banner';
import { useHubGradient } from '@/hooks/use-hub-gradient';

type HubScreenProps = {
  rootClassName?: string;
  safeAreaClassName?: string;
  header: React.ComponentProps<typeof PageHeader>;
  children: ReactNode;
};

export function HubScreen({
  rootClassName = 'flex-1',
  safeAreaClassName = 'flex-1',
  header,
  children,
}: HubScreenProps) {
  const hubGradient = useHubGradient();
  // Das sichtbare Sync-Banner konsumiert die obere Safe Area bereits.
  const bannerVisible = useSyncBannerVisible();
  const edges = bannerVisible ? (['left', 'right'] as const) : (['top', 'left', 'right'] as const);

  return (
    <View className={rootClassName}>
      <GradientBackground {...hubGradient} />
      <SafeAreaView className={safeAreaClassName} edges={edges}>
        <PageHeader {...header} />
        {children}
      </SafeAreaView>
    </View>
  );
}
