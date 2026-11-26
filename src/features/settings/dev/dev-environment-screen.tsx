import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { Redirect } from 'expo-router';
import { useTranslation } from 'react-i18next';
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
import { useDevToolsAccess } from '@/hooks/use-dev-tools-access';
import { getAptabaseInitializationError, isAptabaseConfigured } from '@/lib/analytics/aptabase';
import { env } from '@/lib/config/env';
import {
  getPostHogInitializationError,
  isPostHogConfigured,
} from '@/lib/observability/providers/posthog';
import { Zeile } from './dev-screen-shared';

export function DevEnvironmentScreen() {
  const { t } = useTranslation();
  const hasAccess = useDevToolsAccess();
  const { session } = useSession();
  const { activeHousehold } = useActiveHousehold();
  const { hasPlus, hasAI, isForced, isAiForced } = usePremium();
  const adsEnabled = useAdsEnabled();

  const supabaseTarget = classifySupabaseTarget(env.supabaseUrl);
  const tokenExpiry = formatTokenExpiry(session?.expires_at, Date.now());
  const posthogError = getPostHogInitializationError();
  const aptabaseError = getAptabaseInitializationError();

  if (!hasAccess) {
    return <Redirect href="/settings" />;
  }

  return (
    <Screen
      title={t('dev.environment.title')}
      subtitle={t('dev.environment.subtitle')}
      back={{ label: t('dev.tools.title'), href: '/settings/dev' }}
      backStyle="icon">
      <ContentCard title={t('dev.environment.environment')}>
        <Zeile
          label={t('dev.environment.supabase')}
          wert={t(supabaseTarget.labelKey)}
          tone={supabaseTarget.tone}
        />
        <Zeile label={t('dev.environment.url')} wert={env.supabaseUrl} />
        <Zeile label={t('dev.environment.key')} wert={maskSecret(env.supabasePublishableKey)} />
        <Zeile
          label={t('dev.environment.build')}
          wert={__DEV__ ? t('dev.environment.development') : t('dev.environment.production')}
        />
        <Zeile
          label={t('dev.environment.appVersion')}
          wert={t('dev.environment.appVersionValue', {
            version: Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '—',
            build: Application.nativeBuildVersion ?? '—',
            platform: Platform.OS,
            osVersion: Platform.Version,
          })}
        />
        <Zeile
          label={t('dev.environment.forceOnboarding')}
          wert={env.forceOnboarding ? t('dev.states.yes') : t('dev.states.no')}
        />
        <Zeile
          label={t('dev.environment.plus')}
          wert={
            hasPlus
              ? isForced
                ? t('dev.states.forced')
                : t('dev.states.active')
              : t('dev.states.inactive')
          }
          tone={isForced ? 'warning' : hasPlus ? 'accent' : undefined}
        />
        <Zeile
          label={t('dev.environment.ai')}
          wert={
            hasAI
              ? isAiForced
                ? t('dev.states.forced')
                : t('dev.states.active')
              : t('dev.states.inactive')
          }
          tone={isAiForced ? 'warning' : hasAI ? 'accent' : undefined}
        />
        <Zeile
          label={t('dev.environment.ads')}
          wert={adsEnabled ? t('dev.states.onLower') : t('dev.states.offLower')}
          tone={adsEnabled ? undefined : 'warning'}
        />
        <Zeile
          label={t('dev.environment.posthog')}
          wert={
            isPostHogConfigured()
              ? t('dev.states.configured')
              : posthogError
                ? t('dev.environment.clientStartFailed')
                : t('dev.states.noApiKey')
          }
          tone={isPostHogConfigured() ? undefined : posthogError ? 'danger' : 'warning'}
        />
        <Zeile
          label={t('dev.environment.aptabase')}
          wert={
            isAptabaseConfigured()
              ? t('dev.states.configured')
              : aptabaseError
                ? t('dev.environment.initFailed')
                : t('dev.states.noAppKey')
          }
          tone={isAptabaseConfigured() ? undefined : aptabaseError ? 'danger' : 'warning'}
        />
      </ContentCard>

      <ContentCard title={t('dev.environment.session')}>
        <Zeile
          label={t('dev.environment.userId')}
          wert={session?.user.id ?? t('dev.states.none')}
        />
        <Zeile
          label={t('dev.environment.email')}
          wert={session?.user.email ?? t('dev.states.none')}
        />
        <Zeile
          label={t('dev.environment.tokenValid')}
          wert={t(tokenExpiry.key, 'minutes' in tokenExpiry ? tokenExpiry : undefined)}
          tone={tokenExpiry.key === 'dev.info.tokenExpired' ? 'danger' : undefined}
        />
        <Zeile
          label={t('dev.environment.activeHousehold')}
          wert={activeHousehold?.name ?? t('dev.states.none')}
        />
        <Zeile
          label={t('dev.environment.householdId')}
          wert={activeHousehold?.id ?? t('dev.states.none')}
        />
      </ContentCard>
    </Screen>
  );
}
