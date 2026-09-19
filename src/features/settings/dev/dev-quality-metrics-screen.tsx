import { useCallback, useEffect, useRef, useState } from 'react';

import { Screen } from '@/components/layout/screen';
import { Button } from '@/constants/ui';
import { useSession } from '@/features/auth/session-provider';
import { getNaturalLanguageAdditionBetaState } from '@/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/beta-storage';
import { evaluateQualitySnapshot } from '@/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/domain/quality-evaluator';
import { getSpeechExperimentVariant } from '@/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/domain/speech-experiment';
import { createManualQualitySnapshotExport } from '@/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/services/quality-snapshot-export';
import { readQualityTestSnapshots } from '@/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/services/quality-test-results';
import {
  LoadingState,
  type QualityViewState,
  ReadyView,
  StateMessage,
  summarizeTestMeasurements,
  TestMeasurementsView,
} from './dev-quality-metrics-screen-content';

export function DevQualityMetricsScreen() {
  const { session } = useSession();
  const userId = session?.user.id;
  const [view, setView] = useState<QualityViewState>({ kind: 'loading' });
  const [testMeasurements, setTestMeasurements] = useState<
    ReturnType<typeof summarizeTestMeasurements>
  >([]);
  const loadRequestRef = useRef(0);

  const loadQualityMetrics = useCallback(async () => {
    const requestId = loadRequestRef.current + 1;
    loadRequestRef.current = requestId;

    if (!userId) {
      setTestMeasurements([]);
      setView({ kind: 'no-session' });
      return;
    }

    setView({ kind: 'loading' });
    setTestMeasurements([]);
    try {
      const state = await getNaturalLanguageAdditionBetaState(userId);
      if (requestId !== loadRequestRef.current) return;

      const consent = state.consent.qualityMetrics;
      if (consent !== 'granted') {
        setView({
          kind: 'consent',
          consent,
        });
        return;
      }

      const testSnapshots = await readQualityTestSnapshots();
      if (requestId !== loadRequestRef.current) return;
      setTestMeasurements(summarizeTestMeasurements(testSnapshots));

      const snapshot = createManualQualitySnapshotExport({
        metrics: state.qualityMetrics,
        qualityConsent: consent,
        captureKind: 'quality-snapshot',
        fixtureSetVersion: null,
        experimentVariant: getSpeechExperimentVariant(),
        createdAt: new Date().toISOString(),
      });

      if (snapshot.kind === 'unavailable') {
        if (snapshot.reason === 'quality-consent-required') {
          setView({ kind: 'consent', consent });
        } else if (snapshot.reason === 'insufficient-data') {
          setView({ kind: 'empty' });
        } else {
          setView({ kind: 'error', message: 'Der lokale Snapshot hat ein ungültiges Format.' });
        }
        return;
      }

      setView({
        snapshot,
        evaluation: evaluateQualitySnapshot(snapshot.payload),
        kind: 'ready',
      });
    } catch (error) {
      if (requestId !== loadRequestRef.current) return;
      setView({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Unbekannter Speicherfehler.',
      });
    }
  }, [userId]);

  useEffect(() => {
    void loadQualityMetrics();
  }, [loadQualityMetrics]);

  const isLoading = view.kind === 'loading';
  const testMeasurementViews = testMeasurements.map((summary) => (
    <TestMeasurementsView
      key={`${summary.variant}:${summary.fixtureSetVersion ?? 'none'}`}
      summary={summary}
    />
  ));

  return (
    <Screen
      title="Qualitätsmetriken"
      subtitle="Lokaler Beta-Snapshot · A+C Ansicht"
      back={{ label: 'Entwickler', href: '/settings/dev' }}
      backStyle="icon"
      refreshing={isLoading}
      onRefresh={() => void loadQualityMetrics()}
      action={
        <Button
          title="Neu laden"
          variant="secondary"
          size="sm"
          loading={isLoading}
          onPress={() => void loadQualityMetrics()}
        />
      }>
      {isLoading ? (
        <LoadingState />
      ) : view.kind === 'ready' ? (
        <>
          <ReadyView snapshot={view.snapshot} evaluation={view.evaluation} />
          {testMeasurementViews}
        </>
      ) : (
        <>
          <StateMessage view={view} />
          {testMeasurementViews}
        </>
      )}
    </Screen>
  );
}
