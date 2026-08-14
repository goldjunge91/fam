import { router } from 'expo-router';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/buttons';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { useSession } from '@/features/auth/session-provider';
import {
  type ModulePreferences,
  useModulePreferences,
} from '@/features/settings/module-preferences';

type ModuleGateProps = {
  module: keyof ModulePreferences;
  /** Titel des Ersatz-Screens, wenn das Modul deaktiviert ist (z. B. "Vorrat"). */
  title: string;
  children: ReactNode;
};

/**
 * Blendet Hub-Screen-*Inhalte* aus, wenn ein Modul deaktiviert ist (#95) —
 * nicht den Drawer-Eintrag selbst. Frueher (vor #150) war das noetig, weil
 * `NativeTabs` statisch sind und ein Remount beim Hinzufuegen/Entfernen eines
 * Triggers den gesamten Navigationszustand verloren haette. Mit dem
 * Hamburger-Drawer (`NavigationDrawer`) ist die Route selbst zwar nicht mehr
 * static-empfindlich, aber ein deaktiviertes Modul soll trotzdem nicht in der
 * Navigation auftauchen wie ein volles Feature — der Ersatz-Screen bleibt.
 *
 * Waehrend `useModulePreferences` laedt, werden die Kinder optimistisch
 * gerendert (Default in der DB ist ueberall `true`) statt eines
 * Ladezustands — sonst blitzt bei jedem Tab-Wechsel kurz der Gate-Hinweis auf.
 */
export function ModuleGate({ module, title, children }: ModuleGateProps) {
  const { session } = useSession();
  const { data: modules } = useModulePreferences(session?.user.id);

  if (modules && !modules[module]) {
    return (
      <Screen title={title}>
        <Card>
          <EmptyState
            symbol="eye.slash"
            title="Modul nicht aktiviert"
            hint="Du hast dieses Modul in den Einstellungen ausgeblendet. Deine Daten bleiben erhalten."
          />
          <Button
            label="In den Einstellungen aktivieren"
            onPress={() => router.push('/settings/modules')}
          />
        </Card>
      </Screen>
    );
  }

  return <>{children}</>;
}
