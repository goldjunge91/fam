import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { BackButton } from '@/components/layout/back-button';
import { GradientBackground } from '@/components/layout/gradient-background';
import { PageHeader } from '@/components/layout/page-header';
import { useHubGradient } from '@/hooks/use-hub-gradient';

const styles = StyleSheet.create(() => ({
  root: {
    flex: 1,
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
  const hubGradient = useHubGradient();

  return (
    <View style={styles.root}>
      <GradientBackground {...hubGradient} />
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
