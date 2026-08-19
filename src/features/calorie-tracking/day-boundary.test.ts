import {
  getLogicalDateForTimestamp,
  getTimeRangeForLogicalDate,
  parseDayStartTime,
} from './day-boundary';

describe('day-boundary (#174)', () => {
  describe('parseDayStartTime', () => {
    it('parst standard "00:00"', () => {
      expect(parseDayStartTime('00:00')).toEqual({ hours: 0, minutes: 0 });
    });

    it('parst "06:30"', () => {
      expect(parseDayStartTime('06:30')).toEqual({ hours: 6, minutes: 30 });
    });

    it('faellt bei ungueltigem Format auf 00:00 zurueck', () => {
      expect(parseDayStartTime('invalid')).toEqual({ hours: 0, minutes: 0 });
    });
  });

  describe('getLogicalDateForTimestamp', () => {
    it('ordnet mit 00:00 Standard-Startzeit den normalen Kalendertag zu', () => {
      const d = new Date(2026, 7, 18, 14, 30); // 18. Aug 2026, 14:30
      expect(getLogicalDateForTimestamp(d, '00:00')).toBe('2026-08-18');
    });

    it('ordnet mit 06:00 Startzeit einen Zeitpunkt um 02:00 Uhr dem Vortag zu', () => {
      const earlyMorning = new Date(2026, 7, 19, 2, 15); // 19. Aug 2026, 02:15
      expect(getLogicalDateForTimestamp(earlyMorning, '06:00')).toBe('2026-08-18');
    });

    it('ordnet mit 06:00 Startzeit einen Zeitpunkt um 06:00 Uhr dem neuen Tag zu', () => {
      const exactStart = new Date(2026, 7, 19, 6, 0); // 19. Aug 2026, 06:00
      expect(getLogicalDateForTimestamp(exactStart, '06:00')).toBe('2026-08-19');
    });

    it('ordnet mit 06:00 Startzeit einen Zeitpunkt um 23:30 Uhr dem aktuellen Tag zu', () => {
      const lateEvening = new Date(2026, 7, 19, 23, 30); // 19. Aug 2026, 23:30
      expect(getLogicalDateForTimestamp(lateEvening, '06:00')).toBe('2026-08-19');
    });
  });

  describe('getTimeRangeForLogicalDate', () => {
    it('erzeugt exakte Zeitspanne fuer einen Tag mit 06:00 Startzeit', () => {
      const range = getTimeRangeForLogicalDate('2026-08-18', '06:00');
      expect(range.start.getFullYear()).toBe(2026);
      expect(range.start.getMonth()).toBe(7);
      expect(range.start.getDate()).toBe(18);
      expect(range.start.getHours()).toBe(6);
      expect(range.start.getMinutes()).toBe(0);

      expect(range.end.getDate()).toBe(19);
      expect(range.end.getHours()).toBe(5);
      expect(range.end.getMinutes()).toBe(59);
    });
  });
});
