import { render, screen, userEvent } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { useSession } from '@/features/auth/session-provider';
import {
  createEmptyNaturalLanguageAdditionBetaState,
  getNaturalLanguageAdditionBetaState,
} from '@/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/beta-storage';
import { createEmptyBetaQualityMetrics } from '@/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/domain/quality-metrics';
import { sanitizeQualitySnapshot } from '@/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/domain/quality-snapshot';
import { readQualityTestSnapshots } from '@/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/services/quality-test-results';
import type {
  BetaQualityMetrics,
  BetaStorageState,
} from '@/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/types';
import { DevQualityMetricsScreen } from './dev-quality-metrics-screen';

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: jest.fn(),
}));

jest.mock(
  '@/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/beta-storage',
  () => {
    const actual = jest.requireActual(
      '@/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/beta-storage',
    ) as typeof import('@/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/beta-storage');

    return {
      ...actual,
      getNaturalLanguageAdditionBetaState: jest.fn(),
    };
  },
);

jest.mock(
  '@/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/services/quality-test-results',
  () => {
    const actual = jest.requireActual(
      '@/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/services/quality-test-results',
    ) as typeof import('@/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/services/quality-test-results');

    return {
      ...actual,
      readQualityTestSnapshots: jest.fn(),
    };
  },
);

jest.mock('@/components/layout/screen', () => {
  const { Text: MockText, View: MockView } = jest.requireActual(
    'react-native',
  ) as typeof import('react-native');
  type MockProps = { action?: ReactNode; children: ReactNode; title?: string };

  return {
    Screen: ({ action, children, title }: MockProps) => (
      <MockView>
        {title ? <MockText>{title}</MockText> : null}
        {action}
        {children}
      </MockView>
    ),
  };
});

jest.mock('@/components/ui/card', () => {
  const { Text: MockText, View: MockView } = jest.requireActual(
    'react-native',
  ) as typeof import('react-native');
  type MockProps = { children: ReactNode; title?: string };

  return {
    Card: ({ children, title }: MockProps) => (
      <MockView>
        {title ? <MockText>{title}</MockText> : null}
        {children}
      </MockView>
    ),
  };
});

jest.mock('@/constants/ui', () => {
  const {
    Pressable: MockPressable,
    Text: MockText,
    View: MockView,
  } = jest.requireActual('react-native') as typeof import('react-native');
  type MockButtonProps = { title: string; onPress?: () => void; disabled?: boolean };
  type MockTextProps = { children: ReactNode };
  type MockRowProps = { children: ReactNode };

  return {
    Button: ({ disabled, onPress, title }: MockButtonProps) => (
      <MockPressable
        accessibilityRole="button"
        accessibilityLabel={title}
        disabled={disabled}
        onPress={onPress}>
        <MockText>{title}</MockText>
      </MockPressable>
    ),
    Row: ({ children }: MockRowProps) => <MockView>{children}</MockView>,
    Txt: ({ children }: MockTextProps) => <MockText>{children}</MockText>,
  };
});

const mockUseSession = jest.mocked(useSession);
const mockGetState = jest.mocked(getNaturalLanguageAdditionBetaState);
const mockReadQualityTestSnapshots = jest.mocked(readQualityTestSnapshots);

function createGrantedState(): BetaStorageState {
  const state = createEmptyNaturalLanguageAdditionBetaState();
  return {
    ...state,
    consent: { ...state.consent, qualityMetrics: 'granted' },
    qualityMetrics: {
      ...state.qualityMetrics,
      confirmedItemCount: 20,
      automaticAssignmentCount: 20,
      correctAutomaticAssignmentCount: 19,
      falseListAssignmentCount: 1,
      manualCorrectionCount: 2,
      completionDurationsMs: Array.from({ length: 10 }, () => 5000),
    },
  };
}

function createTestSnapshot(
  overrides: Partial<BetaQualityMetrics> = {},
  fixtureSetVersion: string | null = null,
) {
  const metrics = {
    ...createEmptyBetaQualityMetrics(),
    confirmedItemCount: 4,
    automaticAssignmentCount: 4,
    correctAutomaticAssignmentCount: 4,
    completionDurationsMs: [1_000],
    ...overrides,
  };

  const snapshot = sanitizeQualitySnapshot({
    metrics,
    captureKind: 'maestro-preview-test',
    fixtureSetVersion,
    experimentVariant: 'baseline',
    createdAt: '2026-09-19T12:00:00.000Z',
  });
  if (!snapshot) throw new Error('Test snapshot fixture invalid');
  return snapshot;
}

describe('DevQualityMetricsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSession.mockReturnValue({
      session: { user: { id: 'user-1' } },
    } as ReturnType<typeof useSession>);
    mockReadQualityTestSnapshots.mockResolvedValue([]);
  });

  it('zeigt Messwerte und den bereinigten Payload in einer A+C-Ansicht', async () => {
    mockGetState.mockResolvedValue(createGrantedState());

    await render(<DevQualityMetricsScreen />);

    expect(await screen.findByText('Automatische Genauigkeit')).toBeOnTheScreen();
    expect(screen.getByText('95 %')).toBeOnTheScreen();
    expect(screen.getByText('Bereinigter Übertragungs-Payload')).toBeOnTheScreen();
    expect(screen.getByText(/Artikeltexte, Transkripte, Audio und/)).toBeOnTheScreen();

    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Payload kopieren' }));

    const { setStringAsync } = jest.requireMock('expo-clipboard') as {
      setStringAsync: jest.Mock;
    };
    expect(setStringAsync).toHaveBeenCalledWith(expect.stringContaining('"metrics"'));
    expect(setStringAsync).not.toHaveBeenCalledWith(expect.stringContaining('user-1'));
  });

  it('zeigt bei fehlendem Consent keine alten Messwerte', async () => {
    const state = createGrantedState();
    state.consent.qualityMetrics = 'revoked';
    mockGetState.mockResolvedValue(state);
    mockReadQualityTestSnapshots.mockResolvedValue([createTestSnapshot()]);

    await render(<DevQualityMetricsScreen />);

    expect(
      await screen.findByText(
        'Die Übertragung ist widerrufen. Lokale Qualitätsmetriken wurden gelöscht.',
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByText('95 %')).not.toBeOnTheScreen();
    expect(screen.queryByText('Speech-Testmessungen')).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Payload kopieren' })).not.toBeOnTheScreen();
    expect(mockReadQualityTestSnapshots).not.toHaveBeenCalled();
  });

  it('trennt einen leeren Snapshot vom Ladefehler', async () => {
    mockGetState.mockResolvedValue({
      ...createEmptyNaturalLanguageAdditionBetaState(),
      consent: {
        ...createEmptyNaturalLanguageAdditionBetaState().consent,
        qualityMetrics: 'granted',
      },
    });

    await render(<DevQualityMetricsScreen />);

    expect(await screen.findByText('Noch keine Messwerte')).toBeOnTheScreen();

    mockGetState.mockRejectedValueOnce(new Error('Speicher nicht verfügbar'));
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Neu laden' }));

    expect(await screen.findByText('Speicher nicht verfügbar')).toBeOnTheScreen();
  });

  it('zeigt gespeicherte Speech-Testmessungen getrennt vom persistenten Beta-Zustand', async () => {
    mockGetState.mockResolvedValue({
      ...createEmptyNaturalLanguageAdditionBetaState(),
      consent: {
        ...createEmptyNaturalLanguageAdditionBetaState().consent,
        qualityMetrics: 'granted',
      },
    });
    mockReadQualityTestSnapshots.mockResolvedValue([
      createTestSnapshot(),
      createTestSnapshot({
        automaticAssignmentCount: 0,
        correctAutomaticAssignmentCount: 0,
        completionDurationsMs: [],
      }),
    ]);

    await render(<DevQualityMetricsScreen />);

    expect(await screen.findByText('Speech-Testmessungen')).toBeOnTheScreen();
    expect(screen.getByText(/2 gespeicherte Testmessungen/)).toBeOnTheScreen();
    expect(
      screen.getByText('Datengrundlage: 8 bestätigte Artikel · 4 automatische Zuordnungen'),
    ).toBeOnTheScreen();
    expect(screen.getByText('100 %')).toBeOnTheScreen();
  });

  it('zeigt bei fehlenden automatischen Zuordnungen den 0/0-Nenner an', async () => {
    mockGetState.mockResolvedValue({
      ...createEmptyNaturalLanguageAdditionBetaState(),
      consent: {
        ...createEmptyNaturalLanguageAdditionBetaState().consent,
        qualityMetrics: 'granted',
      },
    });
    mockReadQualityTestSnapshots.mockResolvedValue([
      createTestSnapshot({
        automaticAssignmentCount: 0,
        correctAutomaticAssignmentCount: 0,
        completionDurationsMs: [],
      }),
    ]);

    await render(<DevQualityMetricsScreen />);

    expect(await screen.findAllByText('0 / 0 Beobachtungen · kein gültiger Nenner')).toHaveLength(
      2,
    );
    expect(screen.getByText('0 Zeit-Samples · keine Samples')).toBeOnTheScreen();
  });

  it('trennt alte und versionierte Fixture-Sets, ohne die Qualitätsseite zu blockieren', async () => {
    mockGetState.mockResolvedValue({
      ...createEmptyNaturalLanguageAdditionBetaState(),
      consent: {
        ...createEmptyNaturalLanguageAdditionBetaState().consent,
        qualityMetrics: 'granted',
      },
    });
    mockReadQualityTestSnapshots.mockResolvedValue([
      createTestSnapshot(),
      createTestSnapshot({}, '20-saetze-neu-v1'),
    ]);

    await render(<DevQualityMetricsScreen />);

    expect(await screen.findAllByText(/1 gespeicherte Testmessung/)).toHaveLength(2);
    expect(screen.getByText('Fixture-Set: 20-saetze-neu-v1')).toBeOnTheScreen();
  });

  it('zeigt eine kleine Stichprobe, blockiert aber den manuellen Export', async () => {
    const state = createGrantedState();
    state.qualityMetrics = {
      ...state.qualityMetrics,
      confirmedItemCount: 2,
      automaticAssignmentCount: 2,
      correctAutomaticAssignmentCount: 1,
      falseListAssignmentCount: 1,
      manualCorrectionCount: 1,
      completionDurationsMs: [1_000, 2_000],
    };
    mockGetState.mockResolvedValue(state);

    await render(<DevQualityMetricsScreen />);

    const button = await screen.findByRole('button', { name: 'Zu wenig Daten für Export' });
    expect(button).toBeDisabled();

    const user = userEvent.setup();
    await user.press(button);

    const { setStringAsync } = jest.requireMock('expo-clipboard') as {
      setStringAsync: jest.Mock;
    };
    expect(setStringAsync).not.toHaveBeenCalled();
  });
});
