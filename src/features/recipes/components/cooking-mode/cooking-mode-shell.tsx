import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { BackButton } from '@/components/layout/back-button';
import { PageHeader } from '@/components/layout/page-header';

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.background,
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: 800,
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
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <PageHeader
          title={title}
          leading={<BackButton label={backLabel} variant="header" onPress={onBack} />}
        />
        {children}
      </SafeAreaView>
    </View>
  );
}
