import { useNavigationContainerRef } from 'expo-router';
import { useEffect } from 'react';

import { markPerformance, measurePerformance, metricPerformance } from '@/lib/performance';
import { startQueryEnvironmentSync } from '@/lib/query-client';
import { navigationIntegration } from '@/lib/sentry';
import { registerBackgroundSync } from '@/lib/sync/background-sync';
import { addDiagnosticStep, reportError, trackEvent } from '@/lib/telemetry';
import { startSessionDiagnostics } from '@/lib/telemetry/session-diagnostics';

/** Verbindet einmalige App-Lifecycle-Dienste mit dem gemounteten Root-Layout. */
export function useAppLifecycle(): void {
  const navigationRef = useNavigationContainerRef();

  useEffect(() => {
    navigationIntegration.registerNavigationContainer(navigationRef);
  }, [navigationRef]);

  useEffect(() => startQueryEnvironmentSync(), []);

  useEffect(() => {
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
    let cancelled = false;
    let stop: (() => void) | undefined;

    void startSessionDiagnostics({
      onPreviousSessionUnclean: (properties) =>
        trackEvent('app.previous_session.unclean', properties),
      onEventLoopStalled: (properties) => trackEvent('app.event_loop.stalled', properties),
      onBackgrounded: () =>
        addDiagnosticStep('app.backgrounded', {
          operation: 'app.lifecycle',
          outcome: 'backgrounded',
        }),
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
      cancelled = true;
      stop?.();
    };
  }, []);

  useEffect(() => {
    registerBackgroundSync().catch((error) => {
      console.warn('[BackgroundSync] Registrierung fehlgeschlagen:', error);
    });
  }, []);
}
