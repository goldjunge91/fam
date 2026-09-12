# NativeWind als auslaufende Layout-Hilfe

## Status

Akzeptiert, schrittweise Migration

## Datum

2026-09-11

## Kontext

Das fam-Design-System besitzt mit `src/components/theme/index.ts`,
`ThemeProvider.tsx` und `src/constants/ui.tsx` bereits drei zentrale Owner für
Tokens, Themeauflösung und semantische Darstellung. NativeWind wird aktuell
noch für einen Teil des statischen Layouts verwendet und bleibt deshalb zunächst
als Bestandsabhängigkeit installiert.

Die NativeWind-v4-Interop kann jedoch die offizielle React-Native-API von
`Pressable` mit einer dynamischen `style`-Funktion beeinflussen. Die
[React-Native-Dokumentation](https://reactnative.dev/docs/pressable#style)
erlaubt `style={({ pressed }) => ...}` ausdrücklich. NativeWind dokumentiert
den Verlust dieser Callback-Styles in [Issue #1105](https://github.com/nativewind/nativewind/issues/1105)
und [Issue #847](https://github.com/nativewind/nativewind/issues/847). Ein
passender Fix ist in [PR #1383](https://github.com/nativewind/nativewind/pull/1383)
als offene v4-Arbeit sichtbar. Der Effekt wurde außerdem mit React Native 0.86
und NativeWind 4.2.6 in [Issue #1834](https://github.com/nativewind/nativewind/issues/1834)
erneut reproduziert.

Im Projekt wurde derselbe Fehler auf dem Gerät am Profilbutton sichtbar: Die
Pressable-Style-Funktion wurde in Jest ausgeführt, die sichtbare Face-Fläche
fehlte auf dem Gerät. Das ist ein Beleg für die technische Grenze, nicht für
eine fachliche Besonderheit des Profilbuttons.

## Entscheidung

NativeWind ist eine auslaufende technische Abhängigkeit. Wir bauen NativeWind
nicht weiter aus und entfernen es schrittweise, sobald die bestehenden
Verbraucher migriert sind.

Der benannte Produktionscode-Owner für den semantischen Zielzustand ist
`src/constants/ui.tsx`. Die Theme-Tokens und die aktive Palette bleiben in
`src/components/theme/index.ts` und `src/components/theme/ThemeProvider.tsx`.

Bis zur vollständigen Migration gelten diese Grenzen:

- Neue Komponenten führen keine NativeWind-`className`-Verwendungen ein.
- Neue semantische Farben, Typografie, Zustände, Konturen und Schatten werden
  ausschließlich in den drei Design-System-Ownern definiert.
- Bestehende NativeWind-Verwendungen bleiben als Migrationsbestand zulässig,
  dürfen aber keine neue fachliche Verantwortung erhalten.
- Die Migration erfolgt verbraucherorientiert zu den zentralen UI-Rezepten und
  zu nativen Layoutstilen. Eine `vars()`-Bridge und eine neue Styling-Runtime
  werden nicht eingeführt.
- NativeWind wird nicht durch eine weitere Styling-Bibliothek ersetzt. Ein
  Big-Bang-Rewrite ist nicht Teil dieser Entscheidung.

## Alternativen

### NativeWind dauerhaft als zweite Styling-Schicht behalten

Verworfen. Das würde die bereits festgelegten Design-System-Owner dauerhaft um
eine zweite Styling- und Laufzeitgrenze ergänzen und die Pressable-Interop als
bekannte Geräteunsicherheit bestehen lassen.

### Sofortiger Komplettumbau

Verworfen. Die bestehende App besitzt noch Verbraucher und Plattformvarianten.
Ein Big-Bang-Rewrite würde den Scope erhöhen, ohne das fachliche Verhalten zu
verbessern.

### NativeWind direkt durch eine andere Styling-Bibliothek ersetzen

Verworfen. Es gibt keinen Bedarf für eine neue Laufzeit oder neue semantische
Quelle. Die vorhandenen Theme- und UI-Owner decken den Zielzustand bereits ab.

## Folgen und Abschlusskriterien

- Bis zur Migration bleibt ein ausdrücklich begrenzter Mischbetrieb bestehen.
- Neue Buttons und interaktive Flächen verwenden statische native Styles für
  ihre essenzielle Geometrie und semantische Rezepte aus `ui.tsx`.
- Die Entfernung beginnt erst nach einer Verbraucherprüfung für iOS, Android
  und Web sowie der Referenzseite.
- Danach werden NativeWind, seine Babel-/Metro-Integration und unbenutzte
  Legacy-Definitionen gemeinsam entfernt. Die genaue Reihenfolge wird im
  jeweiligen Beads-Arbeitspaket festgelegt.
- Der Abschluss ist durch fokussierte Code-/Importprüfung, Biome,
  Typecheck, relevante Tests und reale Geräteprüfung nachzuweisen.
