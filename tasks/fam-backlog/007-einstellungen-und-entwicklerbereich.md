# 007: Einstellungen als Menü, Entwickler-Bereich, benannte Zurück-Wege

**Status**: completed
**Created**: 2026-08-09
**Priority**: medium

## Description

Oberflächen-Arbeiten, die während der Fehlersuche aus `006` angefallen sind.
Umgesetzt in `f58e3bf`.

## Action Items

- [x] Einstellungen von einer Sammelseite auf ein Menü mit Unterseiten
      umgestellt (Konto / Haushalt / App / Ziele & Daten). Auf der Übersicht
      steht je Zeile der aktuelle Wert — angemeldete Adresse, aktiver
      Haushalt, Sync-Zustand —, damit der häufigste Grund für einen Blick in
      die Einstellungen ohne Antippen beantwortet ist
- [x] Neue Unterseiten `/settings/notifications` und `/settings/sync`;
      `/settings/sync-debug` bleibt von dort erreichbar
- [x] Entwickler-Bereich `/settings/dev` hinter `EXPO_PUBLIC_DEV_TOOLS`:
      Ziel-Projekt (lokal vs. echte Daten, rot markiert), Restlaufzeit des
      Tokens, Besitz der lokalen DB, Schema-Version, Outbox-Zähler,
      Wartungsaktionen
- [x] Zurück-Wege: jede Seite benennt ihr Ziel (`‹ Einstellungen` statt
      `← Zurück`), immer an derselben Stelle. Kein Knopf mehr auf
      Tab-Wurzeln, und kein ungedecktes `GO_BACK` mehr

## Notes

Der Zurück-Knopf hing vorher an `router.canGoBack()`, einmal beim Rendern
gelesen. Zwei Fehler daraus: Der Wert veraltete (→ "The action 'GO_BACK' was
not handled by any navigator"), und bei `NativeTabs` landen Tab-Wechsel in der
Historie — deshalb erschien der Knopf auch auf der Übersicht, wo es nichts zu
verlassen gibt.

`EXPO_PUBLIC_DEV_TOOLS` ist bewusst getrennt von `__DEV__`: Der Bereich ist
gerade in einem echten Build nützlich (TestFlight, wo unklar ist, gegen
welches Projekt er läuft) und soll sich umgekehrt auch während der Entwicklung
abschalten lassen, um die Einstellungen so zu sehen wie Nutzer.

Nicht gemacht, bleibt als Option: native Stack-Header statt des eigenen
Kopfbereichs. Das brächte die Swipe-zurück-Geste und den Plattform-Look, würde
aber das große In-Content-Titel-Layout aller gepushten Seiten ablösen.
