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
  title: string;
  featureFlag?: FeatureFlagKey;
  children: ReactNode;
};

export function ModuleGate({ module, title, featureFlag, children }: ModuleGateProps) {
  const { session } = useSession();
  const { data: modules } = useModulePreferences(session?.user.id);
  // Nur bestaetigtes `false` blockiert; unbekannte Flags bleiben offline optimistisch.
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
