import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

// Ein Kalenderblatt-Icon je Kalendertag (1.–31.) — fuer den Essensplan-Eintrag
// im Menue, der jeden Tag das tatsaechliche Datum zeigen soll statt eines
// statischen Symbols. `require()` braucht statisch auswertbare Pfade
// (Metro-Bundler), deshalb eine feste Lookup-Tabelle statt einer
// Template-String-Konstruktion.
const CALENDAR_DAY_ICONS = {
  1: require('@/assets/images/figma/calendar/calendar-1.svg'),
  2: require('@/assets/images/figma/calendar/calendar-2.svg'),
  3: require('@/assets/images/figma/calendar/calendar-3.svg'),
  4: require('@/assets/images/figma/calendar/calendar-4.svg'),
  5: require('@/assets/images/figma/calendar/calendar-5.svg'),
  6: require('@/assets/images/figma/calendar/calendar-6.svg'),
  7: require('@/assets/images/figma/calendar/calendar-7.svg'),
  8: require('@/assets/images/figma/calendar/calendar-8.svg'),
  9: require('@/assets/images/figma/calendar/calendar-9.svg'),
  10: require('@/assets/images/figma/calendar/calendar-10.svg'),
  11: require('@/assets/images/figma/calendar/calendar-11.svg'),
  12: require('@/assets/images/figma/calendar/calendar-12.svg'),
  13: require('@/assets/images/figma/calendar/calendar-13.svg'),
  14: require('@/assets/images/figma/calendar/calendar-14.svg'),
  15: require('@/assets/images/figma/calendar/calendar-15.svg'),
  16: require('@/assets/images/figma/calendar/calendar-16.svg'),
  17: require('@/assets/images/figma/calendar/calendar-17.svg'),
  18: require('@/assets/images/figma/calendar/calendar-18.svg'),
  19: require('@/assets/images/figma/calendar/calendar-19.svg'),
  20: require('@/assets/images/figma/calendar/calendar-20.svg'),
  21: require('@/assets/images/figma/calendar/calendar-21.svg'),
  22: require('@/assets/images/figma/calendar/calendar-22.svg'),
  23: require('@/assets/images/figma/calendar/calendar-23.svg'),
  24: require('@/assets/images/figma/calendar/calendar-24.svg'),
  25: require('@/assets/images/figma/calendar/calendar-25.svg'),
  26: require('@/assets/images/figma/calendar/calendar-26.svg'),
  27: require('@/assets/images/figma/calendar/calendar-27.svg'),
  28: require('@/assets/images/figma/calendar/calendar-28.svg'),
  29: require('@/assets/images/figma/calendar/calendar-29.svg'),
  30: require('@/assets/images/figma/calendar/calendar-30.svg'),
  31: require('@/assets/images/figma/calendar/calendar-31.svg'),
} as const;

function currentDayOfMonth(): number {
  return new Date().getDate();
}

/**
 * Essensplan-Icon fuer das Menue: kein statisches Symbol, sondern ein
 * Kalenderblatt mit dem heutigen Datum (#??? , "Icon soll jeden Tag
 * wechseln"). Aktualisiert sich beim Ruecksprung aus dem Hintergrund und –
 * falls die App ueber Mitternacht hinweg offen bleibt – per Minutentakt.
 */
export function CalendarDayIcon({ size: _size }: { size?: number }) {
  const [day, setDay] = useState(currentDayOfMonth);

  useEffect(() => {
    const sync = () => setDay(currentDayOfMonth());

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    // Faengt den Mitternachts-Wechsel ab, waehrend die App durchgehend im
    // Vordergrund bleibt — AppState allein wuerde das nicht mitbekommen.
    const interval = setInterval(sync, 60_000);

    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, []);

  const source =
    CALENDAR_DAY_ICONS[day as keyof typeof CALENDAR_DAY_ICONS] ?? CALENDAR_DAY_ICONS[1];

  return (
    // Image (expo-image) ist bei NativeWind nicht registriert.
    <Image
      source={source}
      contentFit="contain"
      accessibilityLabel={`Essensplan, heute der ${day}.`}
      style={{ width: 35, height: 35 }}
    />
  );
}
