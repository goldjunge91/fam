import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import { BackButton } from '@/components/layout/back-button';
import { PageHeader } from '@/components/layout/page-header';
import { CONTENT_MAX_WIDTH } from '@/components/theme/index';

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

type CookingModeShellProps = {
  title: string;
  backLabel: string;
  onBack?: () => void;
  children: ReactNode;
};

export function CookingModeShell({ title, backLabel, onBack, children }: CookingModeShellProps) {
  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <PageHeader
          title={title}
          leading={<BackButton label={backLabel} variant="header" onPress={onBack} />}
        />
        {children}
      </SafeAreaView>
    </View>
  );
}
