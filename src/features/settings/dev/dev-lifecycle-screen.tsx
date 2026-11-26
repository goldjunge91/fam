import { Redirect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Platform, ScrollView, View } from 'react-native';

import { Screen } from '@/components/layout/screen';
import { ContentCard } from '@/components/ui/content-card';
import { Txt } from '@/constants/ui';
import { useSession } from '@/features/auth/session-provider';
import { useDevToolsAccess } from '@/hooks/use-dev-tools-access';
import { getDeviceStorage } from '@/lib/storage/local-device-storage';
import {
  getLifecycleLog,
  type LifecycleLogEvent,
  type LifecycleLogLevel,
} from '@/lib/telemetry/lifecycle-log';
import { devStyles, Zeile } from './dev-screen-shared';

const SESSION_MARKER_STORAGE_KEY = '@fam/telemetry-session.v1';

type SessionMarker = {
  sessionId?: string;
  state?: 'open' | 'closed';
  startedAt?: number;
  lastEventAt?: number;
  lastAppState?: string | null;
  lastOperation?: string;
  lastRoute?: string;
};

function readSessionMarker(): SessionMarker | null {
  try {
    const raw = getDeviceStorage().getString(SESSION_MARKER_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SessionMarker) : null;
  } catch {
    return null;
  }
}

function formatZeit(at: number, locale: string): string {
  const datum = new Date(at);
  return Number.isNaN(datum.getTime()) ? '—' : datum.toLocaleString(locale);
}

const LEVEL_TONE: Record<LifecycleLogLevel, 'primary' | 'warning' | 'danger'> = {
  debug: 'primary',
  info: 'primary',
  warn: 'warning',
  error: 'danger',
};

export function DevLifecycleScreen() {
  const { t, i18n } = useTranslation();
  const hasAccess = useDevToolsAccess();
  const { session } = useSession();
  const events = getLifecycleLog();
  const marker = readSessionMarker();
  const newestFirst = [...events].reverse();
  const locale = i18n.language;

  if (!hasAccess) {
    return <Redirect href="/settings" />;
  }

  return (
    <Screen
      title={t('dev.lifecycle.title')}
      subtitle={t('dev.lifecycle.subtitle')}
      back={{ label: t('dev.tools.title'), href: '/settings/dev' }}
      backStyle="icon">
      <ContentCard title={t('dev.lifecycle.session')}>
        <Zeile
          label={t('dev.lifecycle.state')}
          wert={
            marker?.state === 'open'
              ? t('dev.lifecycle.open')
              : marker?.state === 'closed'
                ? t('dev.lifecycle.closed')
                : t('dev.states.none')
          }
        />
        <Zeile
          label={t('dev.lifecycle.sessionId')}
          wert={marker?.sessionId ?? t('dev.states.none')}
        />
        <Zeile
          label={t('dev.lifecycle.started')}
          wert={marker?.startedAt ? formatZeit(marker.startedAt, locale) : t('dev.states.none')}
        />
        <Zeile
          label={t('dev.lifecycle.lastEvent')}
          wert={marker?.lastEventAt ? formatZeit(marker.lastEventAt, locale) : t('dev.states.none')}
        />
        <Zeile
          label={t('dev.lifecycle.lastAppState')}
          wert={marker?.lastAppState ?? t('dev.states.none')}
        />
        <Zeile
          label={t('dev.lifecycle.lastOperation')}
          wert={marker?.lastOperation ?? t('dev.states.none')}
        />
        <Zeile
          label={t('dev.lifecycle.lastRoute')}
          wert={marker?.lastRoute ?? t('dev.states.none')}
        />
        <Zeile label={t('dev.lifecycle.device')} wert={`${Platform.OS} ${Platform.Version}`} />
        <Zeile
          label={t('dev.environment.userId')}
          wert={session?.user.id ?? t('dev.states.none')}
        />
      </ContentCard>

      <ContentCard title={t('dev.lifecycle.events', { count: newestFirst.length })}>
        {newestFirst.length === 0 ? (
          <Txt variant="caption" tone="secondary">
            {t('dev.lifecycle.empty')}
          </Txt>
        ) : (
          <ScrollView style={devStyles.logScroll} nestedScrollEnabled>
            {newestFirst.map((event) => (
              <LifecycleRow key={`${event.at}-${event.name}`} event={event} locale={locale} />
            ))}
          </ScrollView>
        )}
      </ContentCard>
    </Screen>
  );
}

function LifecycleRow({ event, locale }: { event: LifecycleLogEvent; locale: string }) {
  return (
    <View style={devStyles.logRow}>
      <Txt variant="caption" weight="700" tone={LEVEL_TONE[event.level]}>
        {event.name}
      </Txt>
      <Txt variant="caption" tone="secondary">
        {formatZeit(event.at, locale)}
      </Txt>
      {event.detail ? (
        <Txt variant="caption" tone="secondary">
          {event.detail}
        </Txt>
      ) : null}
    </View>
  );
}
