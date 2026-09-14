# Spezifikation: Vollständige NativeWind-Ablösung durch Unistyles v3

Status: Abgeschlossen · iOS nachgewiesen, Android für diesen Release ausgenommen
Datum: 2026-09-13
Beads: `fam-978`

## 1. Objective

Die Haushaltsapp erhält eine einzige, typisierte Styling-Laufzeit auf Basis
von `react-native-unistyles` v3. Die bestehende NativeWind-Nutzung wird
vollständig abgelöst und anschließend aus Produktionscode, Abhängigkeiten,
Babel-/Metro-Konfiguration, Tailwind-Bestandsdateien und aktiven Verträgen
entfernt.

Die Migration ist verhaltenskonservativ. Light-/Dark-Mode, die bestehende
warme Fam-Palette, Typografie, Abstände, Plattformvarianten,
Accessibility-Verträge und alle interaktiven Zustände bleiben erhalten, sofern
keine ausdrücklich dokumentierte Contract-Korrektur erforderlich ist.

Während der schrittweisen Umsetzung darf ein kurzfristiger gemischter Zustand
existieren. Er ist kein Zielzustand und darf nach `nativewind-retirement` nicht
mehr vorhanden sein.

## 2. Operationsvertrag und Architektur

Das Design-System behält genau drei zentrale Produktionscode-Owner. Unistyles
wird in diese Owner integriert; es wird keine vierte globale Theme- oder
Style-Quelle eingeführt.

| Verantwortung | Einziger Owner | Vertrag |
| --- | --- | --- |
| Tokens, Light-/Dark-Paletten, gemeinsame Maße und Unistyles-Konfiguration | `src/components/theme/index.ts` | Liefert den typisierten Theme-Raum für alle Styles. |
| Präferenz, Auflösung von `system \| light \| dark`, aktive Palette und Theme-Hooks | `src/components/theme/ThemeProvider.tsx` | Besitzt Laufzeitpräferenz und öffentliche Theme-Hooks. |
| Semantische Typografie, Farbrollen, Flächen, Konturen, Schatten und Interaktionszustände | `src/constants/ui.tsx` | Liefert die gemeinsamen UI-Primitiven und ihre Darstellung. |

Feature- und Komponenten-Styles dürfen nur lokales, nicht semantisches Layout,
berechnete Laufzeitwerte und native Integrationsgrenzen enthalten. Semantische
Entscheidungen werden in den drei Ownern ergänzt und dort getestet.

Der Zielpfad verwendet `StyleSheet` aus `react-native-unistyles`, eine
konfigurierte typed Theme-Struktur und callback-basierte Styles:

```tsx
import { StyleSheet } from 'react-native-unistyles';

const styles = StyleSheet.create((theme) => ({
  root: {
    backgroundColor: theme.background,
    borderColor: theme.border,
  },
}));
```

Die konkreten Theme-Feldnamen werden in der Core-Spezifikation aus dem
bestehenden `Colors`-/Token-Vertrag abgeleitet. Keine Komponente darf eine
zweite Palette, `vars()`-Bridge oder semantische Farbklasse einführen.

## 3. Commands und Nachweise

Die folgenden vorhandenen Projektkommandos bilden die Qualitätsgates. Exakte
Unistyles-Version, Peer-Abhängigkeiten und Installationssyntax werden vor der
Foundation-Implementierung gegen die offiziellen v3-Quellen verifiziert.

| Zweck | Kommando / Nachweis |
| --- | --- |
| Format und Lint | `bun run check` |
| Typecheck | `bun run typecheck` |
| Fokussierte Unit-/Komponententests | `bun run test <file>` |
| Native Fingerprint prüfen | `bun run native:status -- --diff` |
| Dev-Client inner loop | `bun run native:dev -- --target <dev-target>` |
| Reproduzierbaren Native-Rebuild ausführen | `bun run native:rebuild -- --target <target> --approve-rebuild` |
| Vollständigkeit der Entfernung | Repo-weiter, auf historische Doku begrenzter `rg`-Scan für verbotene NativeWind-/Tailwind-/`className`-Reste |

`bun test` und die vollständige Testsuite werden nicht verwendet. Datenbank-
und Sync-Kommandos sind für diese Styling-Migration nicht betroffen.

## 4. Project Structure

### Zentrale Quellen

- `src/components/theme/index.ts`: Tokens, Paletten und Unistyles-
  Konfiguration.
- `src/components/theme/ThemeProvider.tsx`: Theme-Präferenz und Laufzeit-
  Hooks.
- `src/constants/ui.tsx`: semantische Primitive und Zustandsdarstellung.
- `src/components/`, `src/features/` und `src/app/`: Verbraucher, die auf
  typed Unistyles-Styles oder begründete native Style-Grenzen umgestellt
  werden.

### Technische Integrationsflächen

- `package.json` und Lockfile: NativeWind/Tailwind entfernen, Unistyles und
  offiziell erforderliche native Peer-Abhängigkeiten verankern.
- `babel.config.js` und gegebenenfalls Metro-Konfiguration: NativeWind-
  Integration entfernen, Unistyles v3 korrekt konfigurieren.
- `tailwind.config.js` und `src/global.css`: nach vollständiger Verbraucher-
  migration entfernen, sofern kein unabhängiger aktiver Verbraucher besteht.
- `docs/design-system/contracts/`, `AGENTS.md`, `CLAUDE.md` und `docs/adr/`:
  aktive Regeln synchronisieren und die neue Entscheidung dokumentieren.
- `docs/specs/nativewind-styling/`: historische Entstehungsgeschichte
  behalten und deutlich auf den supersedierenden Vertrag verweisen.
- `docs/specs/nativewind-unistyles-migration/`: lebender Scope, Spec und
  später die freigegebenen Modul-Spezifikationen.

## 5. Code Style

- `StyleSheet` wird ausschließlich aus `react-native-unistyles` importiert,
  sobald ein Stylesheet Unistyles benötigt.
- Styles werden mit `StyleSheet.create(theme => ({ ... }))` definiert; die
  bestehenden Unistyles-v3-Regeln zu typed Themes, Varianten und
  plattformgerechten Style-Grenzen gelten als Implementierungsvertrag.
- Keine `className`- oder `contentContainerClassName`-Props im Endzustand.
- Keine Style-Spreads, keine `any`-/Cast-Workarounds und keine neuen
  Suppression-Kommentare.
- Semantische Werte kommen aus den drei Ownern. Lokale Styles bleiben auf
  Layout, berechnete Werte und native Integrationsgrenzen beschränkt.
- Bestehende öffentliche Primitive-APIs, Accessibility-Props und
  Plattformdateien bleiben kompatibel, sofern die Modul-Spezifikation keine
  begründete Contract-Änderung ausweist.
- Der Diff darf keine fachliche Doppelentscheidung erzeugen. Neue Dateien
  brauchen nach `CONSTRAINTS.md` eine begründete, einzelne Verantwortung.

## 6. Testing Strategy

### Verhalten

- Fokussierte Tests der jeweils migrierten Theme-Owner und UI-Primitiven prüfen
  beobachtbares Rendering, semantische Farben, Typografie, Light-/Dark-Mode,
  Accessibility und pressed-/focused-/selected-/disabled-/loading-Zustände.
- Plattform- und native Integrationsgrenzen werden an ihren bestehenden
  Verträgen getestet, besonders bei FlashList, Bottom Sheets, SVG,
  `expo-image`, Reanimated und Pressable-Callbacks.
- Bestehende Tests werden nicht entfernt oder durch lockere Snapshots ersetzt.

### Architektur und statische Vollständigkeit

- Ein Architektur-Gate erkennt verbotene Imports und aktive Verwendungen von
  `nativewind`, `tailwindcss`, Tailwind-Styles, `className` und
  `contentContainerClassName`; es zählt nicht nur Dateien.
- Historische Dokumente unter `docs/specs/nativewind-styling/` dürfen die
  Begriffe als Geschichte enthalten, müssen aber als historisch und nicht
  bindend gekennzeichnet sein.
- Die Gates laufen mindestens nach jedem Migrationsslice: `bun run check`,
  `bun run typecheck` und die betroffenen fokussierten Tests.

### Plattformen und native Artefakte

- iOS wird mit dem Dev Client in Light- und Dark-Mode geprüft; Android ist für
  diesen Release ausgenommen.
- Die bekannte Pressable-Callback-Gerätegrenze wird als konkreter
  Laufzeitnachweis berücksichtigt.
- Nach Dependency- oder Native-Konfigurationsänderungen werden Fingerprint,
  Dev-Client und erforderlicher Rebuild gemäß Projektvertrag geprüft.
- Eine Web-Vorschau wird nicht vorausgesetzt; Web-Kompatibilität wird durch
  statische Checks und vorhandene projektweite Gates abgesichert.

## 7. Boundaries

### Immer einhalten

- Vor Produktionscode werden dieser Operationsvertrag, die aktiven
  Design-System-Verträge und das neue ADR freigegeben bzw. aktualisiert.
- Native API-Details werden vor Implementierung gegen die versionierten
  Expo-SDK-57-Dokumente und die offiziellen Unistyles-v3-Quellen geprüft.
- Native Abhängigkeiten lösen einen Dev-Client-Rebuild und eine Prüfung des
  Fingerprint-Locks aus.
- `AGENTS.md` und `CLAUDE.md` bleiben inhaltlich synchron.
- Historische Dokumente bleiben erhalten, werden aber nicht als aktuelle
  Styling-Quelle verwendet.

### Vorher nachfragen

- Visuelles Redesign, neue semantische Rollen oder Änderungen an der
  bestehenden Theme-Präferenz.
- Weitere native Abhängigkeiten oder Config-Plugins, die nicht als
  offizielle Unistyles-v3-Voraussetzung bestätigt sind.
- Änderungen an CI, Release-Workflow, Datenbank, Offline-Sync oder
  Authentifizierungsverträgen.
- Löschen historischer Spezifikationen oder des ADR `0006`.

### Niemals im Zielzustand

- NativeWind oder Tailwind als Runtime, Paket, Babel-/Metro-Integration oder
  aktive Styling-Quelle.
- `className` und `contentContainerClassName` in aktivem Produktionscode.
- Eine parallele Runtime-Theme-Schicht, `vars()`-Bridge oder semantische
  Token-Duplikation.
- Style-Spreads oder Typ-Casts zur Umgehung des Unistyles-Vertrags.
- Manuelle Supabase-Migrationen, `bun test`, gelöschte Tests oder gelockerte
  Assertions als Migrationsabkürzung.

## 8. Success Criteria

Die Migration ist abgeschlossen, wenn alle Punkte nachweisbar erfüllt sind:

1. `nativewind` und `tailwindcss` sind weder Abhängigkeiten noch Teil der
   Babel-, Metro-, Tailwind- oder globalen Styling-Konfiguration.
2. Aktiver Produktionscode enthält keine `className`- oder
   `contentContainerClassName`-Verwendungen und keine verbotenen NativeWind-
   oder Tailwind-Imports.
3. Unistyles v3 ist mit gegen offizielle Quellen verifizierter Version,
   Babel-Plugin und `StyleSheet.configure` integriert; erforderliche native
   Peer-Abhängigkeiten und New-Architecture-Annahmen sind nachgewiesen.
4. Die drei bestehenden Design-System-Owner bleiben die einzigen Quellen für
   Theme-, Token- und semantische UI-Entscheidungen.
5. Bestehende visuelle, Accessibility- und Interaktionsverträge bleiben auf
   iOS erhalten, einschließlich Light-/Dark-Mode und aller relevanten
   Zustände. Android ist für diesen Release explizit ausgenommen.
6. Betroffene fokussierte Tests, `bun run check`, `bun run typecheck`, der
   statische Architektur-Gate sowie der iOS-Laufzeitnachweis sind grün.
7. Aktive Verträge, `AGENTS.md`, `CLAUDE.md` und ein supersedierendes ADR sind
   synchron; die historische NativeWind-Spezifikation ist klar als nicht
   bindend markiert.
8. Es gibt keine Änderungen an Datenbank-, RLS-, SQLite-, Outbox- oder
   Sync-Verträgen.

## 9. Assumptions und offene Verifikationen

### Bestätigte Annahmen

- „Vollständige Ablösung“ umfasst aktiven Produktionscode, Dependencies,
  Konfiguration und aktive Dokumentation.
- Historische NativeWind-Dokumentation bleibt erhalten.
- Die drei bestehenden Styling-Owner bleiben bestehen und werden nicht durch
  eine neue globale Abstraktion ersetzt.
- Die Migration enthält kein absichtliches visuelles Redesign.
- Ein gemischter Zustand ist nur während der inkrementellen Umsetzung erlaubt.

### Vor der Foundation zu verifizieren

- Exakte `react-native-unistyles`-v3-Version und Peer-Kompatibilität mit Expo
  SDK 57, React Native 0.86, React 19 und der bestehenden Reanimated-Version.
- Ob und wie `react-native-edge-to-edge` in dieser Expo-/Android-Konfiguration
  erforderlich ist.
- Die repo-konforme Installationssyntax mit `bun` und Expo SDK 57.
- Der aktuelle New-Architecture- und native-build-Zustand des Repositories.
- Der kleinste sichere Slice für die erste Implementierung und die konkrete
  Testdatei jedes Slices.

Diese Punkte sind Implementierungsverifikationen, keine Erlaubnis, den
bestätigten Scope zu erweitern.

## 10. Review-Gate

Diese Phase ist abgeschlossen, sobald die Maintainer diesen Spec einschließlich
Scope, Ownern, Boundaries und Success Criteria freigeben. Erst danach werden
Modul-Spezifikationen, der Ausführungsplan und die Beads-Tasks erstellt. Bis zu
dieser Freigabe wird kein Produktionscode geändert.
