import { useNavigationContainerRef } from 'expo-router';
import { useEffect } from 'react';
import { startQueryEnvironmentSync } from '@/lib/data/query-client';
import { debugLog, debugWarn } from '@/lib/observability/debug-log';
import {
  markPerformance,
  measurePerformance,
  metricPerformance,
} from '@/lib/observability/performance';
import { navigationIntegration } from '@/lib/observability/providers/sentry';
import { registerBackgroundSync } from '@/lib/sync/remote-background-sync';
import { addDiagnosticStep, reportError, trackEvent } from '@/lib/telemetry';
import { recordLifecycleEvent } from '@/lib/telemetry/lifecycle-log';
import { startSessionDiagnostics } from '@/lib/telemetry/session-diagnostics';

type LifecycleProperties = NonNullable<Parameters<typeof trackEvent>[1]>;

/** Kurze, nicht sensible Beschreibung fuer den Lifecycle-Log-Eintrag. */
function describeLifecycleProperties(properties: LifecycleProperties): string {
  const parts: string[] = [];
  if (typeof properties.last_operation === 'string') parts.push(`op=${properties.last_operation}`);
  if (typeof properties.last_route === 'string') parts.push(`route=${properties.last_route}`);
  if (typeof properties.duration_ms === 'number') parts.push(`${properties.duration_ms}ms`);
  if (typeof properties.seconds_since_last_event === 'number') {
    parts.push(`${properties.seconds_since_last_event}s`);
  }
  return parts.join(' ');
}

/** Verbindet einmalige App-Lifecycle-Dienste mit dem gemounteten Root-Layout. */
export function useAppLifecycle(): void {
  const navigationRef = useNavigationContainerRef();

  useEffect(() => {
    navigationIntegration.registerNavigationContainer(navigationRef);
  }, [navigationRef]);

  useEffect(() => startQueryEnvironmentSync(), []);

  useEffect(() => {
    debugLog('[APPTRACE:ROOT-MOUNT]');
    markPerformance('app.root.mounted', { phase: 'react' });
    markPerformance('app.startup.ready', { phase: 'startup', first_render: true });
    measurePerformance(
      'app.startup.to-root',
      'app.runtime.initialization.start',
      'app.root.mounted',
      { phase: 'startup' },
    );
    measurePerformance('app.startup.total', 'app.start', 'app.startup.ready', {
      phase: 'startup',
      first_render: true,
    });
    metricPerformance('app.startup.completed', 1, {
      phase: 'startup',
      first_render: true,
    });
    addDiagnosticStep('app.started', { operation: 'app.start', outcome: 'started' });
    recordLifecycleEvent({ name: 'app.started', level: 'info' });
    let cancelled = false;
    let stop: (() => void) | undefined;

    void startSessionDiagnostics({
      onPreviousSessionUnclean: (properties) => {
        trackEvent('app.previous_session.unclean', properties);
        recordLifecycleEvent({
          name: 'app.previous_session.unclean',
          level: 'warn',
          detail: describeLifecycleProperties(properties),
        });
      },
      onEventLoopStalled: (properties) => {
        trackEvent('app.event_loop.stalled', properties);
        recordLifecycleEvent({
          name: 'app.event_loop.stalled',
          level: 'warn',
          detail: describeLifecycleProperties(properties),
        });
      },
      onBackgrounded: () => {
        addDiagnosticStep('app.backgrounded', {
          operation: 'app.lifecycle',
          outcome: 'backgrounded',
        });
        recordLifecycleEvent({ name: 'app.backgrounded', level: 'info' });
      },
      onForegrounded: () => {
        recordLifecycleEvent({ name: 'app.foregrounded', level: 'info' });
      },
    })
      .then((dispose) => {
        if (cancelled) dispose();
        else stop = dispose;
      })
      .catch((error) => {
        reportError(error, {
          operation: 'app.session_diagnostics',
          error_code: 'session_diagnostics_failed',
        });
      });

    return () => {
      debugLog('[APPTRACE:ROOT-UNMOUNT]');
      cancelled = true;
      stop?.();
    };
  }, []);

  useEffect(() => {
    registerBackgroundSync().catch((error) => {
      debugWarn('[BackgroundSync] Registrierung fehlgeschlagen:', error);
    });
  }, []);
}
