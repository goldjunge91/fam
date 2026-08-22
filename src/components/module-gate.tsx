import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Screen } from '@/components/layout/screen';
import { Button } from '@/components/ui/buttons';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { useSession } from '@/features/auth/session-provider';
import {
  type ModulePreferences,
  useModulePreferences,
} from '@/features/settings/module-preferences';
import { type FeatureFlagKey, useFeatureFlagState } from '@/lib/posthog';

type ModuleGateProps = {
  module: keyof ModulePreferences;
  /** Titel des Ersatz-Screens, wenn das Modul deaktiviert ist (z. B. "Vorrat"). */
  title: string;
  /**
   * Zusaetzliches Remote-Gate ueber PostHog (#183) — nur fuer Module, die
   * gestaffelt ausgerollt werden sollen (aktuell recipes/mealPlanner/
   * calories), NICHT fuer die Kern-Module Vorrat/Einkauf. Nur ein bestaetigtes
   * `false` vom Server blendet das Modul aus, auch wenn `ModulePreferences` es
   * erlaubt — die Freischaltung passiert ausschliesslich ueber PostHog, nie
   * automatisch. Solange der Flag noch nicht bestaetigt ist (Cold Start,
   * offline), wird optimistisch gerendert statt der Hold-Screen gezeigt.
   */
  featureFlag?: FeatureFlagKey;
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
export function ModuleGate({ module, title, featureFlag, children }: ModuleGateProps) {
  const { session } = useSession();
  const { data: modules } = useModulePreferences(session?.user.id);
  // Tri-State: `undefined` (Cold Start/offline, noch nicht hydriert, oder kein
  // featureFlag-Prop) wird wie die Praeferenz optimistisch behandelt und
  // rendert die Kinder. Nur ein bestaetigtes `false` blockt — sonst blitzt der
  // Gate-Hinweis auf, bevor der Flag geladen ist.
  const featureFlagState = useFeatureFlagState(featureFlag);

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

  if (featureFlagState === false) {
    return (
      <Screen title={title}>
        <Card>
          <EmptyState
            symbol="hourglass"
            title="Noch nicht verfügbar"
            hint="Dieser Bereich wird gerade schrittweise ausgerollt und ist für dich noch nicht freigeschaltet."
          />
        </Card>
      </Screen>
    );
  }

  return <>{children}</>;
}
