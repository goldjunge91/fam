import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { Screen } from '@/components/layout/screen';
import { ContentCard } from '@/components/ui/content-card';
import { useAdsEnabled } from '@/features/ads';
import { useSession } from '@/features/auth/session-provider';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { usePremium } from '@/features/premium/premium-provider';
import {
  classifySupabaseTarget,
  formatTokenExpiry,
  maskSecret,
} from '@/features/settings/dev/dev-info';
import { getAptabaseInitializationError, isAptabaseConfigured } from '@/lib/analytics/aptabase';
import { env } from '@/lib/config/env';
import {
  getPostHogInitializationError,
  isPostHogConfigured,
} from '@/lib/observability/providers/posthog';
import { Zeile } from './dev-screen-shared';

export function DevEnvironmentScreen() {
  const { session } = useSession();
  const { activeHousehold } = useActiveHousehold();
  const { hasPlus, hasAI, isForced, isAiForced } = usePremium();
  const adsEnabled = useAdsEnabled();

  const supabaseTarget = classifySupabaseTarget(env.supabaseUrl);
  const tokenExpiry = formatTokenExpiry(session?.expires_at, Date.now());
  const posthogError = getPostHogInitializationError();
  const aptabaseError = getAptabaseInitializationError();

  return (
    <Screen
      title="Umgebung & Zugang"
      subtitle="Build, Dienste, Session und Haushalt"
      back={{ label: 'Entwickler', href: '/settings/dev' }}
      backStyle="icon">
      <ContentCard title="Umgebung">
        <Zeile label="Supabase" wert={supabaseTarget.label} tone={supabaseTarget.tone} />
        <Zeile label="URL" wert={env.supabaseUrl} />
        <Zeile label="Schlüssel" wert={maskSecret(env.supabaseKey)} />
        <Zeile label="Build" wert={__DEV__ ? 'Development' : 'Production'} />
        <Zeile
          label="App-Version"
          wert={`${Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? '—'} (Build ${Constants.nativeBuildVersion ?? (Platform.OS === 'ios' ? Constants.expoConfig?.ios?.buildNumber : Constants.expoConfig?.android?.versionCode) ?? '—'}, ${Platform.OS} ${Platform.Version})`}
        />
        <Zeile label="Onboarding erzwungen" wert={env.forceOnboarding ? 'ja' : 'nein'} />
        <Zeile
          label="Plus"
          wert={hasPlus ? (isForced ? 'aktiv (erzwungen)' : 'aktiv') : 'inaktiv'}
          tone={isForced ? 'warning' : hasPlus ? 'accent' : undefined}
        />
        <Zeile
          label="KI"
          wert={hasAI ? (isAiForced ? 'aktiv (erzwungen)' : 'aktiv') : 'inaktiv'}
          tone={isAiForced ? 'warning' : hasAI ? 'accent' : undefined}
        />
        <Zeile
          label="Werbung"
          wert={adsEnabled ? 'an' : 'aus'}
          tone={adsEnabled ? undefined : 'warning'}
        />
        <Zeile
          label="PostHog"
          wert={
            isPostHogConfigured()
              ? 'konfiguriert'
              : posthogError
                ? 'Client-Start fehlgeschlagen'
                : 'kein API-Key'
          }
          tone={isPostHogConfigured() ? undefined : posthogError ? 'danger' : 'warning'}
        />
        <Zeile
          label="Aptabase"
          wert={
            isAptabaseConfigured()
              ? 'konfiguriert'
              : aptabaseError
                ? 'Init fehlgeschlagen'
                : 'kein App-Key'
          }
          tone={isAptabaseConfigured() ? undefined : aptabaseError ? 'danger' : 'warning'}
        />
      </ContentCard>

      <ContentCard title="Session">
        <Zeile label="Nutzer-ID" wert={session?.user.id ?? '—'} />
        <Zeile label="E-Mail" wert={session?.user.email ?? '—'} />
        <Zeile
          label="Token gültig"
          wert={tokenExpiry}
          tone={tokenExpiry === 'abgelaufen' ? 'danger' : undefined}
        />
        <Zeile label="Aktiver Haushalt" wert={activeHousehold?.name ?? '—'} />
        <Zeile label="Haushalts-ID" wert={activeHousehold?.id ?? '—'} />
      </ContentCard>
    </Screen>
  );
}
