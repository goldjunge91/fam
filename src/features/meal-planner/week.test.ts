import {
  addDays,
  defaultWeekPlanName,
  getWeekStart,
  nextWeekStart,
  previousWeekStart,
  weekDates,
  weekdayLabel,
} from './week';

describe('getWeekStart', () => {
  it('gibt den Montag zurueck, wenn das Datum bereits ein Montag ist', () => {
    expect(getWeekStart('2026-08-17')).toBe('2026-08-17');
  });

  it('rechnet einen Mittwoch auf den Montag derselben Woche zurueck', () => {
    expect(getWeekStart('2026-08-19')).toBe('2026-08-17');
  });

  it('rechnet einen Sonntag auf den Montag derselben (ISO-)Woche zurueck', () => {
    expect(getWeekStart('2026-08-23')).toBe('2026-08-17');
  });

  it('funktioniert ueber einen Monatswechsel hinweg', () => {
    expect(getWeekStart('2026-09-01')).toBe('2026-08-31');
  });
});

describe('addDays', () => {
  it('addiert Tage', () => {
    expect(addDays('2026-08-17', 3)).toBe('2026-08-20');
  });

  it('subtrahiert Tage', () => {
    expect(addDays('2026-08-17', -7)).toBe('2026-08-10');
  });

  it('traegt ueber einen Monatswechsel', () => {
    expect(addDays('2026-08-30', 3)).toBe('2026-09-02');
  });
});

describe('weekDates', () => {
  it('liefert die sieben Tage Montag..Sonntag', () => {
    expect(weekDates('2026-08-17')).toEqual([
      '2026-08-17',
      '2026-08-18',
      '2026-08-19',
      '2026-08-20',
      '2026-08-21',
      '2026-08-22',
      '2026-08-23',
    ]);
  });
});

describe('previousWeekStart / nextWeekStart', () => {
  it('gehen jeweils genau 7 Tage', () => {
    expect(previousWeekStart('2026-08-17')).toBe('2026-08-10');
    expect(nextWeekStart('2026-08-17')).toBe('2026-08-24');
  });
});

describe('weekdayLabel', () => {
  it('benennt den Wochentag auf Deutsch', () => {
    expect(weekdayLabel('2026-08-17')).toBe('Montag');
    expect(weekdayLabel('2026-08-23')).toBe('Sonntag');
  });
});

describe('defaultWeekPlanName', () => {
  it('formatiert einen Wochenbereich', () => {
    expect(defaultWeekPlanName('2026-08-17')).toBe('Woche 17.–23. Aug.');
  });

  it('nutzt den Monat des Wochenendes bei einem Monatswechsel', () => {
    expect(defaultWeekPlanName('2026-08-31')).toBe('Woche 31.–6. Sep.');
  });
});
