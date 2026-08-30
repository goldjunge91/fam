import { type Glp1HistoryItem, sortGlp1History } from './log-history';

describe('GLP-1-Verlauf', () => {
  it('sortiert Einträge nach dem tatsächlichen Zeitpunkt und nicht nach dem Offset-Text', () => {
    const items: Glp1HistoryItem<string, string>[] = [
      {
        kind: 'injection',
        timestamp: '2026-08-30T08:00:00+02:00',
        log: 'Injektion',
      },
      {
        kind: 'symptom',
        timestamp: '2026-08-30T07:30:00Z',
        log: 'Symptome',
      },
    ];

    expect(sortGlp1History(items).map(({ log }) => log)).toEqual(['Symptome', 'Injektion']);
    expect(items[0].log).toBe('Injektion');
  });
});
