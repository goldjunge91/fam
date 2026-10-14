import { render, screen } from '@testing-library/react-native';
import type React from 'react';
import { CorrelationScreen } from './correlation-screen';

let mockParams: {
  logicalDate?: string | string[];
  dayStartTime?: string | string[];
  childProfileId?: string | string[];
} = {};
let mockSession: { user: { id: string } } | null = { user: { id: 'user-1' } };
let mockProfile: { tracking_day_start_time: string } | null = null;
let mockSeriesQuery: {
  data?: { date: string }[];
  isLoading: boolean;
  isError: boolean;
} = { data: [], isLoading: false, isError: false };
const mockUseProfile = jest.fn();
const mockUseCorrelationSeries = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
}));

jest.mock('@/components/layout/screen', () => {
  const React = require('react');
  const { Text, View } = require('react-native');

  return {
    Screen: ({ title, children }: { title: string; children: React.ReactNode }) =>
      React.createElement(View, null, React.createElement(Text, null, title), children),
  };
});

jest.mock('@/constants/ui', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return {
    Txt: ({ children }: { children: React.ReactNode }) => React.createElement(Text, null, children),
  };
});

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: mockSession }),
}));

jest.mock('@/features/profile/api', () => ({
  useProfile: (...args: unknown[]) => mockUseProfile(...args),
}));

jest.mock('@/features/glp1/hooks/correlation-api', () => ({
  useCorrelationSeries: (...args: unknown[]) => mockUseCorrelationSeries(...args),
}));

jest.mock('@/features/glp1/components/correlation-section', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return {
    CorrelationSection: ({ series }: { series: { date: string }[] }) =>
      React.createElement(Text, null, `Series rows: ${series.length}`),
  };
});

describe('CorrelationScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = {};
    mockSession = { user: { id: 'user-1' } };
    mockProfile = null;
    mockSeriesQuery = { data: [], isLoading: false, isError: false };
    mockUseProfile.mockImplementation(() => ({ data: mockProfile }));
    mockUseCorrelationSeries.mockImplementation(() => mockSeriesQuery);
  });

  it('uses the first route value and profile settings while loading', async () => {
    mockParams = {
      logicalDate: ['2026-10-02', '2026-10-03'],
      dayStartTime: ['06:30', '07:00'],
      childProfileId: ['child-1', 'child-2'],
    };
    mockProfile = { tracking_day_start_time: '05:00' };
    mockSeriesQuery = { data: undefined, isLoading: true, isError: false };

    await render(<CorrelationScreen />);

    expect(screen.getByText('Korrelationsanalyse')).toBeOnTheScreen();
    expect(screen.getByText('Korrelationsanalyse wird geladen...')).toBeOnTheScreen();
    expect(mockUseProfile).toHaveBeenCalledWith('user-1');
    expect(mockUseCorrelationSeries).toHaveBeenCalledWith(
      'user-1',
      'child-1',
      '2026-10-02',
      '06:30',
    );
  });

  it('shows an error for plain route parameters', async () => {
    mockParams = {
      logicalDate: '2026-10-04',
      dayStartTime: '04:30',
      childProfileId: 'child-2',
    };
    mockSeriesQuery = { data: undefined, isLoading: false, isError: true };

    await render(<CorrelationScreen />);

    expect(screen.getByText('Korrelationsanalyse konnte nicht geladen werden.')).toBeOnTheScreen();
    expect(mockUseCorrelationSeries).toHaveBeenCalledWith(
      'user-1',
      'child-2',
      '2026-10-04',
      '04:30',
    );
  });

  it('uses profile day start and an explicit date when the session is absent', async () => {
    mockSession = null;
    mockParams = { logicalDate: '2026-10-05' };
    mockProfile = { tracking_day_start_time: '07:15' };

    await render(<CorrelationScreen />);

    expect(screen.getByText('Keine Korrelationsdaten vorhanden.')).toBeOnTheScreen();
    expect(mockUseProfile).toHaveBeenCalledWith(undefined);
    expect(mockUseCorrelationSeries).toHaveBeenCalledWith(
      undefined,
      undefined,
      '2026-10-05',
      '07:15',
    );
  });

  it('shows returned rows and defaults the day start when profile data is absent', async () => {
    mockParams = { logicalDate: '2026-10-06' };
    mockSeriesQuery = { data: [{ date: '2026-10-06' }], isLoading: false, isError: false };

    await render(<CorrelationScreen />);

    expect(screen.getByText('Series rows: 1')).toBeOnTheScreen();
    expect(mockUseCorrelationSeries).toHaveBeenCalledWith(
      'user-1',
      undefined,
      '2026-10-06',
      '00:00',
    );
  });
});
