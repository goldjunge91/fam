import { formatIsoDate, fromTime, parseIsoDate, toIsoDate, toTime } from './format-date';

/**
 * Die Formatierung nutzt lokale Datumsmethoden, damit ein Tag nicht über UTC
 * verschoben wird. Die Tests rechnen deshalb mit lokalen `new Date(...)`, nicht
 * mit `toISOString()` — sonst prüften sie in einer UTC-Umgebung etwas anderes
 * als in der App.
 */
function localDate(year: number, month: number, day: number, hours = 0, minutes = 0): Date {
  return new Date(year, month - 1, day, hours, minutes);
}

describe('toIsoDate', () => {
  it('formatiert Datum und Uhrzeit mit zweistelligen Monat und Tag', () => {
    expect(toIsoDate(localDate(2026, 9, 28))).toBe('2026-09-28');
    expect(toIsoDate(localDate(2026, 1, 5))).toBe('2026-01-05');
  });

  it('behaelt einen Datumsobjekt am frühen Morgen unverschoben', () => {
    // `toISOString()` wuerde hier in westlichen Zonen den Vortag liefern.
    expect(toIsoDate(localDate(2026, 1, 1, 0, 5))).toBe('2026-01-01');
  });
});

describe('formatIsoDate', () => {
  it('schreibt das Datum in deutscher Reihenfolge ohne fuehrende Nullen', () => {
    expect(formatIsoDate('2026-09-28')).toBe('28.09.2026');
    expect(formatIsoDate('2026-01-05')).toBe('05.01.2026');
  });
});

describe('parseIsoDate', () => {
  it('liest eine ISO-Zeichenkette als lokales Datum', () => {
    const parsed = parseIsoDate('2026-01-01');

    // Genau hier bricht `new Date('2026-01-01')`: das wird als UTC gelesen.
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(0);
    expect(parsed.getDate()).toBe(1);
  });

  it('liefert fuer jede Jahreszeit ihr eigenes Datum, auch am Monatswechsel', () => {
    expect(toIsoDate(parseIsoDate('2026-02-28'))).toBe('2026-02-28');
    expect(toIsoDate(parseIsoDate('2026-03-01'))).toBe('2026-03-01');
  });
});

describe('toTime und fromTime', () => {
  it('formatiert die Uhrzeit mit fuehrender Null', () => {
    expect(toTime(localDate(2026, 9, 28, 7, 5))).toBe('07:05');
    expect(toTime(localDate(2026, 9, 28, 19, 30))).toBe('19:30');
  });

  it('liest eine Uhrzeit auf den heutigen Tag zurueck', () => {
    const restored = fromTime('07:05');

    expect(restored.getHours()).toBe(7);
    expect(restored.getMinutes()).toBe(5);
    // Sekunden und Millisekunden werden genullt, sonst zeigt das Picker
    // Sekunden an, die es in der Eingabe nicht gab.
    expect(restored.getSeconds()).toBe(0);
    expect(restored.getMilliseconds()).toBe(0);
  });

  it('faellt bei fehlender oder unparsbarer Uhrzeit auf Mitternacht zurueck', () => {
    expect(fromTime('').getHours()).toBe(0);
    expect(fromTime('keine Uhrzeit').getHours()).toBe(0);
    expect(fromTime('12').getHours()).toBe(12);
  });
});
