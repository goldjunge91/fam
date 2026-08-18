import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GradientBackground } from '@/components/gradient-background';
import { PageHeader } from '@/components/page-header';
import { useHubGradient } from '@/hooks/use-hub-gradient';

type HubScreenProps = {
  /** Klassen fuer die aeusserste View, z. B. um eine Breitenbegrenzung zu setzen. */
  rootClassName?: string;
  /** Klassen fuer die SafeAreaView, z. B. feature-eigene Innenabstaende. */
  safeAreaClassName?: string;
  header: React.ComponentProps<typeof PageHeader>;
  children: ReactNode;
};

/**
 * Gemeinsames Geruest fuer die Hub- und Detailansichten mit `PageHeader`
 * (Essensplan, Tagebuch, Rezepte, Einstellungen, Premium, ...): warmer
 * Verlaufshintergrund, Safe Area und Kopfzeile. Der eigentliche Bildschirm-
 * inhalt (Scroll-Verhalten, Tabs, Formulare) bleibt Sache des Aufrufers —
 * dieses Geruest loest nur die zuvor mehrfach kopierte oberste Schicht ab
 * (#153).
 *
 * Fuer die Uebersichts-Screens mit Hamburger + Avatar (`chrome`) und fuer
 * einfache Detailseiten ohne `PageHeader` bleibt `@/components/screen`
 * zustaendig.
 */
export function HubScreen({
  rootClassName = 'flex-1',
  safeAreaClassName = 'flex-1',
  header,
  children,
}: HubScreenProps) {
  const hubGradient = useHubGradient();

  return (
    <View className={rootClassName}>
      <GradientBackground {...hubGradient} />
      <SafeAreaView className={safeAreaClassName} edges={['top', 'left', 'right']}>
        <PageHeader {...header} />
        {children}
      </SafeAreaView>
    </View>
  );
}
