import {
  FASTING_PROTOCOL_DURATIONS,
  fastingSessionsQueryKey,
} from '@/features/calorie-tracking/fasting-api';

describe('fasting-api', () => {
  it('liefert die korrekten Dauern in Minuten für Fasten-Protokolle', () => {
    expect(FASTING_PROTOCOL_DURATIONS['16:8']).toBe(960);
    expect(FASTING_PROTOCOL_DURATIONS['18:6']).toBe(1080);
    expect(FASTING_PROTOCOL_DURATIONS['20:4']).toBe(1200);
    expect(FASTING_PROTOCOL_DURATIONS.omad).toBe(1380);
  });

  it('erzeugt deterministische Query-Keys', () => {
    expect(fastingSessionsQueryKey('user-1', null)).toEqual([
      'fasting',
      'sessions',
      'user-1',
      null,
    ]);
    expect(fastingSessionsQueryKey('user-1', 'child-1')).toEqual([
      'fasting',
      'sessions',
      'user-1',
      'child-1',
    ]);
  });
});
