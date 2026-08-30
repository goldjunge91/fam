import {
  correlationSeriesQueryKey,
  correlationSeriesScopeQueryKey,
} from '@/features/glp1/domain/query-keys';

it('bildet einen gezielt oder accountweit invalidierbaren Korrelations-Key', () => {
  expect(correlationSeriesScopeQueryKey('user-1', 'child-1')).toEqual([
    'glp1',
    'correlation',
    'user-1',
    'child-1',
  ]);
  expect(correlationSeriesQueryKey('user-1', null, '2026-08-30', '06:00')).toEqual([
    'glp1',
    'correlation',
    'user-1',
    null,
    '2026-08-30',
    '06:00',
  ]);
});
