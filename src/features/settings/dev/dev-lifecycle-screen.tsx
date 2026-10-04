import { Redirect } from 'expo-router';
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

function formatZeit(at: number): string {
  const datum = new Date(at);
  return Number.isNaN(datum.getTime()) ? '—' : datum.toLocaleString('de-DE');
}

const LEVEL_TONE: Record<LifecycleLogLevel, 'primary' | 'warning' | 'danger'> = {
  debug: 'primary',
  info: 'primary',
  warn: 'warning',
  error: 'danger',
};

export function DevLifecycleScreen() {
  const hasAccess = useDevToolsAccess();
  const { session } = useSession();
  const events = getLifecycleLog();
  const marker = readSessionMarker();
  const newestFirst = [...events].reverse();

  if (!hasAccess) {
    return <Redirect href="/settings" />;
  }

  return (
    <Screen
      title="Lifecycle & Background"
      subtitle="Was die App vor dem letzten Wechsel tat"
      back={{ label: 'Entwickler', href: '/settings/dev' }}
      backStyle="icon">
      <ContentCard title="Aktuelle Session">
        <Zeile label="Zustand" wert={marker?.state ?? '—'} />
        <Zeile label="Session-ID" wert={marker?.sessionId ?? '—'} />
        <Zeile label="Gestartet" wert={marker?.startedAt ? formatZeit(marker.startedAt) : '—'} />
        <Zeile
          label="Letztes Ereignis"
          wert={marker?.lastEventAt ? formatZeit(marker.lastEventAt) : '—'}
        />
        <Zeile label="Letzter App-Zustand" wert={marker?.lastAppState ?? '—'} />
        <Zeile label="Letzte Operation" wert={marker?.lastOperation ?? '—'} />
        <Zeile label="Letzte Route" wert={marker?.lastRoute ?? '—'} />
        <Zeile label="Gerät" wert={`${Platform.OS} ${Platform.Version}`} />
        <Zeile label="Nutzer-ID" wert={session?.user.id ?? '—'} />
      </ContentCard>

      <ContentCard title={`Ereignisse (${newestFirst.length})`}>
        {newestFirst.length === 0 ? (
          <Txt variant="caption" tone="secondary">
            Noch keine Lifecycle-Ereignisse aufgezeichnet. Wechsle die App in den Hintergrund und
            kehre zurueck.
          </Txt>
        ) : (
          <ScrollView style={devStyles.logScroll} nestedScrollEnabled>
            {newestFirst.map((event) => (
              <LifecycleRow key={`${event.at}-${event.name}`} event={event} />
            ))}
          </ScrollView>
        )}
      </ContentCard>
    </Screen>
  );
}

function LifecycleRow({ event }: { event: LifecycleLogEvent }) {
  return (
    <View style={devStyles.logRow}>
      <Txt variant="caption" weight="700" tone={LEVEL_TONE[event.level]}>
        {event.name}
      </Txt>
      <Txt variant="caption" tone="secondary">
        {formatZeit(event.at)}
      </Txt>
      {event.detail ? (
        <Txt variant="caption" tone="secondary">
          {event.detail}
        </Txt>
      ) : null}
    </View>
  );
}
