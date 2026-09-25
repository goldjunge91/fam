import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import { PageHeader } from '@/components/layout/page-header';
import { ProfileButton } from '@/components/layout/profile-button';
import { CONTENT_MAX_WIDTH } from '@/components/theme/index';
import { useSyncBannerVisible } from '@/components/ui/sync-status-banner';
import { useNavigationChrome } from '@/features/navigation/navigation-chrome-provider';
import { useProfileAvatar } from '@/features/navigation/use-profile-initials';

type HubScreenProps = {
  header: React.ComponentProps<typeof PageHeader>;
  children: ReactNode;
};

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.background,
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
}));

export function HubScreen({ header, children }: HubScreenProps) {
  const { openProfile } = useNavigationChrome();
  const { initials, avatarUrl } = useProfileAvatar();
  // Der sichtbare Sync-Banner übernimmt die obere Safe Area selbst.
  const bannerVisible = useSyncBannerVisible();
  const edges = bannerVisible ? (['left', 'right'] as const) : (['top', 'left', 'right'] as const);

  return (
    <View style={styles.root}>
      <SafeAreaView edges={edges} style={styles.safeArea}>
        <PageHeader
          {...header}
          trailing={
            <>
              {header.trailing}
              <ProfileButton initials={initials} avatarUrl={avatarUrl} onPress={openProfile} />
            </>
          }
        />
        {children}
      </SafeAreaView>
    </View>
  );
}
