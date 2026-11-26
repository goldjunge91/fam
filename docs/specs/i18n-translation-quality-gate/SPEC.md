# Spec: i18n Translation Quality Gate

Status: Freigegeben; Abschlussprüfung abgeschlossen.

## Objective

Die App soll einen automatischen Qualitäts-Gate für Übersetzungen erhalten. Der
Gate verhindert, dass neue oder geänderte Texte nur in einer Sprache vorhanden
sind oder dass der Produktionscode auf nicht existierende Übersetzungsschlüssel
zeigt.

Der Gate deckt vier eng zusammengehörige Prüfungen ab:

1. Katalog-Parität zwischen allen unterstützten Sprachen.
2. Missing-Key-Erkennung für literale `t(...)`- und `i18n.t(...)`-Referenzen im
   Produktionscode.
3. Missing-Key-Erkennung für dynamische Übersetzungsschlüssel mit einer
   endlichen, im Produktionscode deklarierten Wertemenge.
4. Erkennung und blockierende Abschlussprüfung für reportbare hardcodierte
   UI-Texte im abgeschlossenen `main-app`-Scope; der `developer-only`-Scope
   bleibt als getrennte Diagnose verfügbar.

Gemessener Stand im aktuellen i18n-Arbeitsstand:

- Unterstützte Sprachen sind `de` und `en`.
- Die Laufzeit-Registrierung liegt in `src/i18n/index.ts`.
- Der blockierende `main-app`-Scope entdeckt alle Locale-Paare außer
  `src/i18n/features/dev.de.json` und `src/i18n/features/dev.en.json`.
- Der getrennte `developer-only`-Diagnose-Scope entdeckt das `dev`-Paar und
  behält die Developer-Runtime-Referenzen unverändert.
- Der Hardcode-Scanner misst final 228 Funde, alle im separaten
  `developer-only`-Scope. Der `main-app`-Scope ist mit 0 reportbaren Funden
  abgeschlossen; vor der Migration waren es 507 Funde (279 Main-App und 228
  Developer-Diagnose).
- Der `main-app`-Scope meldet final 0 Katalog-, 0 statische und 0 dynamische
  Übersetzungsfehler sowie 0 Hardcode-Funde.
- Der `developer-only`-Diagnose-Scope meldet weiterhin 6 Katalogfehler, 58
  statische und 46 dynamische Referenzfehler sowie 228 Hardcode-Funde. Diese
  Befunde sind absichtlich sichtbar, aber nicht Teil des Main-App-Gates.

Eine Übersetzung oder ein einzelner Schlüssel darf nicht zusätzlich in einer
Testdatei eingetragen werden müssen. Dynamische Schlüssel sind kein
Prüfgrenzfall: Jeder dynamische Key muss über eine endliche, im Produktionscode
deklarierte Wertemenge auf konkrete Keys expandierbar sein. Beliebige
Laufzeit-Strings aus Server- oder Nutzerdaten sind für i18n-Keys nicht zulässig
und werden als untestbar gemeldet.

Der kompakte Hardcode-Bericht bleibt für beide Scopes verfügbar. Die
Abschlussassertion blockiert ausschließlich den `main-app`-Scope, sobald die
abhängigen Slices ihre UI-Funde migriert haben. Developer-Befunde werden nicht
entfernt, ignoriert oder als Main-App-Erfolg gezählt.

## Tech Stack

- Expo SDK 57
- React Native 0.86
- TypeScript 6
- i18next 26
- react-i18next 17
- Jest 29 mit `jest-expo`
- Bun 1.3.x als Paketmanager und Skript-Runner

Es wird keine neue Laufzeitabhängigkeit eingeführt. Der Prüfcode ist Test- und
Konventionscode, kein neuer Produktions-Wrapper für i18next.

## Commands

Gezielter Gate:

```bash
bun run test -- --runInBand --no-watchman test/conventions/i18n-convention.test.ts
```

Der Abschlusslauf ergänzt `src/i18n/index.test.ts` und die jeweils zuständigen
fokussierten Feature-Pfade. Eine unscoped gesamte Testsuite wird für diesen Gate
nicht ausgeführt.

Qualitätsprüfungen vor einem Commit:

```bash
bun run check
bun run typecheck
```

Die bestehende CI führt `bun run test` bereits als Unit-Test-Job aus. Der neue
Convention-Test wird dadurch ohne zusätzliche Testliste automatisch ausgeführt.

## Project Structure

```text
src/i18n/index.ts                         Runtime-Registrierung und Sprachwahl
src/i18n/features/*.de.json               Deutscher Katalog
src/i18n/features/*.en.json               Englischer Katalog
test/conventions/i18n-convention.test.ts  Paritäts- und Missing-Key-Gate
test/conventions/i18n-convention-support.ts
                                         AST-Scanner und formatierter Hardcode-Bericht
docs/specs/i18n-translation-quality-gate/
  SPEC.md                                 Diese fachliche Vereinbarung
```

Der Test liest die Katalogdateien direkt vom Dateisystem und importiert nicht
die App-Runtime. Dadurch bleiben Device-Storage, Expo-Localization und
React-Kontext außerhalb dieser statischen Prüfung.

## Code Style

Die Prüfung verwendet kleine typisierte Funktionen mit einer Verantwortung:

```ts
type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

function flattenLeaves(value: JsonValue, prefix = ''): Map<string, string> {
  // Rekursive Objekte werden in dotted leaf paths umgewandelt.
  // Übersetzungswerte müssen am Ende Strings sein.
}

function hasCatalogKey(key: string, catalog: Set<string>): boolean {
  return (
    catalog.has(key) ||
    catalog.has(`${key}_one`) ||
    catalog.has(`${key}_other`)
  );
}
```

Verbindliche Stilregeln:

- Bestehende Biome-Regeln und 100 Zeichen Zeilenbreite beibehalten.
- Keine `any`-Typen, Suppression-Kommentare oder Non-null-Assertions.
- Keine statische Liste aller Übersetzungsschlüssel im Test.
- Endliche dynamische Key-Familien werden über deklarierte Produktionswerte
  expandiert; diese Werte sind keine Test-Allowlist, sondern die fachliche
  Wertemenge, aus der die App den Key tatsächlich bildet.
- Fehlermeldungen enthalten Katalogpfad oder Quellcodedatei sowie Schlüssel.
- Pluralvarianten werden als `_one` und `_other` gespeichert; eine Referenz auf
  den Basisnamen wird gegen diese Varianten aufgelöst.
- Übersetzungswerte werden nicht auf Gleichheit geprüft. Gleiche Werte wie
  `App`, `Status` oder `Offline` können in beiden Sprachen korrekt sein.

## Testing Strategy

### 1. Locale-Datei-Parität

Der Test entdeckt alle Dateien nach dem Schema `<feature>.<locale>.json` und
vergleicht die Dateimengen pro unterstützter Sprache. Eine Datei, die nur in
Deutsch oder nur in Englisch existiert, lässt den Test fehlschlagen.

Für jedes gefundene Feature werden die rekursiv flatteneten Blatt-Schlüssel
verglichen:

- Schlüssel nur in Deutsch: Fehler.
- Schlüssel nur in Englisch: Fehler.
- Leerer oder nicht-stringiger Blattwert: Fehler.

### 2. Platzhalter-Parität

Aus jedem String werden i18next-Platzhalter wie `{{count}}` oder `{{error}}`
extrahiert. Die sortierten Platzhalternamen müssen pro Schlüssel in allen
Sprachen identisch sein. Damit schlagen fehl:

- fehlende Platzhalter,
- zusätzliche Platzhalter,
- versehentlich umbenannte Platzhalter.

### 3. Missing-Key-Erkennung

Der Test untersucht Produktionsdateien unter `src/**/*.ts` und `src/**/*.tsx`
und ignoriert Testdateien. Die Erkennung verwendet den TypeScript-AST statt
einer reinen Textsuche und betrachtet literale Aufrufe von:

```ts
t('settings.title');
i18n.t('shoppingList.addItem');
```

Für jeden gefundenen Schlüssel wird geprüft, ob er in jedem unterstützten
Locale-Katalog existiert. Plural-Basisschlüssel werden gegen `_one` und
`_other` aufgelöst.

Template-Literale und String-Konkatenationen mit dynamischen Teilen werden nicht
ignoriert. Sie müssen einer endlichen, deklarierten Wertemenge zugeordnet sein.
Zum Beispiel:

```ts
const SETTING_GROUPS = ['data', 'privacy'] as const;
type SettingGroup = (typeof SETTING_GROUPS)[number];

t(`settings.groups.${group}.label`);
```

Der Gate expandiert die Wertemenge zu `settings.groups.data.label` und
`settings.groups.privacy.label` und prüft beide Keys in jedem Locale. Die
Wertemenge gehört zum Produktionscode oder zur jeweiligen Domäne und wird nicht
als manuelle Liste im Test dupliziert.

Ein dynamischer Ausdruck mit unbeschränktem `string`, Serverdaten, Nutzereingabe
oder ohne deklarierte Wertemenge lässt den Test mit `Untestable dynamic
translation key` fehlschlagen. So kann kein Übersetzungsschlüssel der Prüfung
stillschweigend entgehen.

Ein Fehler enthält mindestens:

```text
Missing translation key
src/features/settings/settings-screen.tsx:304
settings.groups.data.privacy.label
locale: de, en
```

Nicht auf eine endliche Wertemenge begrenzbare dynamische Schlüssel werden als
`Untestable dynamic translation key` gemeldet. Sie gelten nicht als zulässiger
Prüfgrenzfall.

### 4. Hardcodierte UI-Texte

Der Bericht untersucht Produktionsdateien unter `src/` und ignoriert Testdateien.
Der blockierende `main-app`-Scope umfasst alle Produktionsdateien außerhalb der
exakt abgegrenzten Developer-Flächen. Der getrennte `developer-only`-Scope
untersucht ausschließlich diese Flächen und bleibt diagnostisch. Beide Scopes
melden:

- nicht-leeren JSX-Text,
- statische Werte der Attribute `title`, `label`, `placeholder`,
  `accessibilityLabel` und `accessibilityHint`,
- statische Titel und Nachrichten von `Alert.alert(...)`.

Beliebige Props, dynamische Werte und reine Zahlen-/Sonderzeichenwerte werden
nicht als Fundstelle aufgenommen. Jede Fundstelle enthält Quelldatei, Zeile,
UI-Position und Text. Die vollständige Fundstellenliste bleibt strukturiert
verfügbar; die Jest-Konsolenausgabe wird bei großen Beständen auf eine
begrenzte Stichprobe gekürzt.

Die Developer-Grenze ist exakt:

- `src/features/settings/dev/**`
- `src/features/settings/sync-debug-screen.tsx`
- `src/app/settings/dev*.tsx`
- `src/app/settings/sync-debug.tsx`
- `src/i18n/features/dev.de.json`
- `src/i18n/features/dev.en.json`

Die bedingte `dev.info.*`-Referenz in
`src/features/settings/settings-screen.tsx` gehört wegen
`hasDevToolsAccess` ebenfalls zur Developer-Diagnose. Gemeinsame Katalogkeys,
die Developer-Dateien verwenden, bleiben normale App-Referenzen. Die
Developer-Locale-Imports und Runtime-Registrierungen bleiben erhalten. Die
Referenzfilterung berücksichtigt den Quellpfad: Ein `dev.*`-Schlüssel in einer
normalen Produktdatei bleibt im `main-app`-Scope und wird dort geprüft.

Zusätzlich enthält `test/conventions/i18n-convention.test.ts` eine blockierende
Abschlussassertion über
`findProductionHardcodedUiTextReferences('main-app')`. Sie wird erst grün,
wenn der abgeschlossene Main-App-Scope keine reportbaren Funde mehr enthält.
Die Developer-Funde werden nicht gelöscht, ignoriert oder als Main-App-Erfolg
gezählt.

### 5. Regressionen

Der Test muss mindestens diese Fälle abdecken:

- ein Schlüssel fehlt in einer Sprache,
- ein Platzhalter fehlt in einer Sprache,
- eine ganze Feature-Datei fehlt in einer Sprache,
- eine literale Quellcode-Referenz ist unbekannt,
- ein dynamischer Key fehlt für einen Wert der deklarierten Wertemenge,
- ein dynamischer Key ist nicht auf eine endliche Wertemenge begrenzt,
- ein gültiger Plural-Basisschlüssel verweist auf `_one` und `_other`,
- ein neuer gültiger Schlüssel kann ohne Teständerung in beiden Katalogen
  erkannt werden,
- statischer JSX-Text, ausgewählte sichtbare Attribute und `Alert.alert` werden
  mit UI-Position erkannt, während dynamische Werte und technische Props
  ignoriert werden.

Die Testfixtures bleiben klein und werden innerhalb der Testdatei oder in einem
konventionseigenen Fixture-Bereich gehalten. Es werden keine echten Kataloge
für absichtlich fehlerhafte Tests verändert.

## Boundaries

Always:

- Kataloge direkt aus `src/i18n/features/` prüfen und den `main-app`- sowie
  `developer-only`-Scope getrennt auswerten.
- Die unterstützten Sprachen aus der bestehenden Runtime-Definition ableiten.
- Schlüssel, Platzhalter und literale Referenzen getrennt melden.
- Dynamische Key-Familien vollständig aus ihren Produktionswertemengen
  expandieren und pro Locale prüfen.
- Den Gate über die bestehende Jest-/Bun-Pipeline ausführen.
- Neue Sprachen automatisch in den Paritätsvergleich aufnehmen, sobald sie in
  der Runtime unterstützt und als Katalogdateien registriert sind.
- Der Hardcode-Bericht bleibt für Diagnosezwecke kompakt und deterministisch.
- Nur der `main-app`-Hardcode-Scope bleibt der blockierenden Abschlussassertion
  unterworfen; Developer-Befunde bleiben als Diagnose sichtbar.

Ask first:

- Eine neue unterstützte Sprache oder ein anderes Dateinamensschema.
- Ein neues dynamisches Key-Konstrukt ohne endliche Wertemenge.
- Neue Test- oder Parser-Abhängigkeiten.
- Änderungen an CI-Triggern oder der bestehenden Testpipeline.

Never:

- Fehlende Übersetzungen automatisch mit der Fallback-Sprache auffüllen.
- Einen statischen Allowlistsatz fehlender Schlüssel als dauerhafte Lösung
  einführen.
- Den Test durch gelockerte Assertions oder ignorierte Dateien grün machen.
- Die Produktionssprache oder die Übersetzungskataloge aus dem Test heraus
  verändern.
- Dynamische Übersetzungsschlüssel ignorieren oder unbeschränkte Laufzeitwerte
  als gültig behandeln.
- Hartcodierte UI-Texte mit Übersetzungswerten verwechseln oder als gelöst
  betrachten, nur weil alle `t(...)`-Referenzen gültig sind.

## Scope classification

`useDevToolsAccess()` kann den privaten Entwicklerpfad über das lokale
Entwicklungsverhalten oder das PostHog-Feature-Flag `dev-tools` aktivieren. Die
Runtime-Flächen bleiben deshalb erhalten, werden aber aus dem blockierenden
Main-App-Gate herausgenommen. Die Developer-Diagnose umfasst exakt:

- `src/features/settings/dev/**`
- `src/features/settings/sync-debug-screen.tsx`
- `src/app/settings/dev*.tsx`
- `src/app/settings/sync-debug.tsx`
- `src/i18n/features/dev.de.json`
- `src/i18n/features/dev.en.json`

Die bedingte `dev.info.*`-Referenz in
`src/features/settings/settings-screen.tsx` wird wegen `hasDevToolsAccess`
ebenfalls im Developer-Diagnose-Scope geprüft. Gemeinsame Übersetzungsschlüssel
in Developer-Dateien bleiben gegen die normalen App-Kataloge geprüft und werden
nicht als `dev`-Fehler gezählt. Ein Redirect oder eine Zugriffskontrolle ändert
nicht die Runtime-Zuordnung. Eingehendes Teilen aus anderen Apps in den
Rezeptimport bleibt ausdrücklich außerhalb des Vorhabens.

## Success Criteria

Die Spec gilt als implementiert, wenn:

1. `test/conventions/i18n-convention.test.ts` automatisch alle aktuellen
   Locale-Dateien und unterstützten Sprachen entdeckt.
2. Schlüssel-Parität und Platzhalter-Parität für `de` und `en` geprüft werden.
3. Jede literale Produktionsreferenz auf einen Übersetzungsschlüssel in beiden
   Sprachen auflösbar ist.
4. Alle beschriebenen Fehlerklassen, einschließlich dynamischer Keys, den Test
   reproduzierbar fehlschlagen lassen.
5. Neue gültige Katalogschlüssel keine Teständerung benötigen.
6. Der abgeschlossene `main-app`-Scope ist ohne Allowlist und ohne
   Sonderfall-Ausnahmen grün; der `developer-only`-Scope bleibt als getrennte
   Diagnose mit seinen Befunden sichtbar.
7. Der Test unter `bun run test` in der bestehenden CI automatisch läuft.
8. Hardcodierte UI-Texte mit Datei, Zeile und UI-Position reportet werden und die
   Abschlussassertion ausschließlich den `main-app`-Scope blockiert.
9. `bun run check` und `bun run typecheck` erfolgreich bleiben.
10. Keine Runtime- oder UI-Verhaltensänderung durch den Gate entsteht.

## Entscheidungen aus der Klärung

1. Dynamische Übersetzungsschlüssel müssen testbar sein. Endliche Wertemengen
   werden automatisch expandiert; unbeschränkte dynamische Keys sind Fehler.
2. Hardcodierte UI-Texte gehören zum Main-App-Qualitätsziel. Der kompakte Bericht
   bleibt während der Migration diagnostisch verfügbar; die Abschlussassertion
   blockiert ausschließlich den `main-app`-Scope. Developer-Befunde werden nicht
   gelöscht oder versteckt.
3. Ein neues Locale ist nur gültig, wenn es in `SUPPORTED_LANGUAGES` registriert
   ist. Ein Dateipaar allein aktiviert keine Sprache.

## Approval Gate

Scope und Prüfgrenzen wurden vom Maintainer bestätigt. Die automatische
Abschlussassertion für den `main-app`-Scope ist grün: 0 Katalog-, 0 statische,
0 dynamische und 0 reportbare Hardcode-Funde. Die getrennte Developer-Diagnose
bewahrt 6 Katalogfehler, 58 fehlende statische Keys, 46 dynamische
Referenzfehler und 228 Hardcode-Funde sichtbar; diese Werte sind kein Main-App-
Blocker.
