import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GradientBackground } from '@/components/layout/gradient-background';
import { PageHeader } from '@/components/layout/page-header';
import { CONTENT_MAX_WIDTH } from '@/components/theme/index';
import { useSyncBannerVisible } from '@/components/ui/sync-status-banner';
import { useHubGradient } from '@/hooks/use-hub-gradient';

type HubScreenProps = {
  header: React.ComponentProps<typeof PageHeader>;
  children: ReactNode;
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
});

export function HubScreen({ header, children }: HubScreenProps) {
  const hubGradient = useHubGradient();
  // Der sichtbare Sync-Banner übernimmt die obere Safe Area selbst.
  const bannerVisible = useSyncBannerVisible();
  const edges = bannerVisible ? (['left', 'right'] as const) : (['top', 'left', 'right'] as const);

  return (
    <View style={styles.root}>
      <GradientBackground {...hubGradient} />
      <SafeAreaView edges={edges} style={styles.safeArea}>
        <PageHeader {...header} />
        {children}
      </SafeAreaView>
    </View>
  );
}
