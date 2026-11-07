import { formatAiCreditRenewalDate, nextUtcMonthStart } from './month';

describe('AI credit month boundaries', () => {
  it('starts the next month in UTC for January', () => {
    expect(nextUtcMonthStart(new Date('2026-01-15T23:59:59.999Z')).toISOString()).toBe(
      '2026-02-01T00:00:00.000Z',
    );
  });

  it('crosses the year boundary without using local time', () => {
    expect(nextUtcMonthStart(new Date('2026-12-31T23:59:59.999Z')).toISOString()).toBe(
      '2027-01-01T00:00:00.000Z',
    );
  });

  it('formats the next renewal date from the UTC month model', () => {
    expect(formatAiCreditRenewalDate(new Date('2026-11-30T23:59:59.999Z'))).toBe(
      '1. Dezember 2026',
    );
  });
});
