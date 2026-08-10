import { router } from 'expo-router';
import type { ReactNode } from 'react';

import { Button } from '@/components/button';
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
 * Blendet Tab-*Inhalte* aus, wenn ein Modul deaktiviert ist (#95) — nicht den
 * Tab selbst. Siehe Kommentar in `app-tabs.tsx`: `NativeTabs` sind statisch,
 * ein Remount beim Hinzufuegen/Entfernen eines Triggers wuerde den gesamten
 * Navigationszustand verlieren.
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
