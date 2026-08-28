import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GradientBackground } from '@/components/layout/gradient-background';
import { PageHeader } from '@/components/layout/page-header';
import { BackButton } from '@/components/ui/buttons';
import { useHubGradient } from '@/hooks/use-hub-gradient';

type CookingModeShellProps = {
  title: string;
  backLabel: string;
  onBack?: () => void;
  children: ReactNode;
};

export function CookingModeShell({ title, backLabel, onBack, children }: CookingModeShellProps) {
  const hubGradient = useHubGradient();

  return (
    <View className="flex-1">
      <GradientBackground {...hubGradient} />
      <SafeAreaView
        className="flex-1 w-full max-w-[800px] self-center"
        edges={['top', 'left', 'right']}>
        <PageHeader
          title={title}
          leading={<BackButton label={backLabel} variant="header" onPress={onBack} />}
        />
        {children}
      </SafeAreaView>
    </View>
  );
}
