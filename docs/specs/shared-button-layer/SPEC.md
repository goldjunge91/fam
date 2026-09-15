# Spec: Kanonische Shared-UI- und Button-Schicht

Status: Entwurf, noch nicht zur Implementierung freigegeben.

## Objective

Die veraltete Modulgrenze `src/components/ui/buttons/` wird entfernt. Die App
bezieht gemeinsame Interaktions- und Darstellungsentscheidungen bereits aus
`src/constants/ui.tsx` sowie `src/components/theme/index.ts`. Die verbleibende
Button-Schicht soll deshalb nicht als zweites UI-System bestehen bleiben.

Ziel ist eine reine Struktur- und Ownership-Konsolidierung:

- `src/components/theme/index.ts` bleibt Owner für Paletten, Theme-Tokens,
  Radien, Abstände, Typografie, Schatten und `BUTTON_DEPTH`.
- `src/constants/ui.tsx` bleibt Owner für `Press`, `Button`, `IconButton`,
  `CloseButton` sowie die gemeinsamen themenabhängigen Button-Style-Rezepte.
- Komponenten mit zusätzlichem Verhalten bleiben als schlanke Kompositionen an
  ihrem fachlich passenden Ort. Sie dürfen keine zweite Palette, keine eigenen
  semantischen Farbrollen und keine zweite Press-Interaktionslogik einführen.
- Das beobachtbare Verhalten bleibt erhalten: Layout, Touch-Ziel,
  Accessibility, Haptik, Reduced Motion, Navigation, Avatar-Darstellung und
  Android-Verhalten.

Der Erfolg wird nicht daran gemessen, möglichst viele Dateien zu löschen. Die
fachliche Mehrfachimplementierung soll sinken, während Verhalten und zentrale
Owner eindeutig bleiben.

### Aktueller Befund

`ui.tsx` besitzt bereits die Style-Owner `iconButtonStyles`,
`floatingActionButtonStyles`, `compactActionButtonStyles`, `backButtonStyles`
und `profileButtonStyles`. Die sechs Exporte aus `buttons/index.ts` werden noch
von Layout-, Feature- und Showcase-Code verwendet. Außerdem prüfen
`test/conventions/shared-button-contract.test.ts`,
`test/conventions/shared-touch-contract.test.ts` und
`test/conventions/dashboard-nativewind-convention.test.ts` derzeit noch die
alten Dateipfade.

## Scope

### In Scope

- Entfernung des Verzeichnisses `src/components/ui/buttons/` einschließlich
  Barrel-Datei und Testdateien.
- Migration aller produktiven und Showcase-Imports.
- Erhalt oder Verschiebung der sechs aktuellen Verhaltenskomponenten gemäß der
  Ownership-Tabelle weiter unten.
- Aktualisierung der fokussierten Komponenten- und Konventionstests.
- Statische Architekturprüfung, dass nach der Migration kein Import und keine
  Referenz auf die alte Button-Schicht verbleibt.

### Out of Scope

- Änderung der Button-Varianten, Größen, Farben, Radien, Haptik oder Animationen.
- Redesign von Headern, FAB, Navigation, Profilbereich oder Bottom Sheets.
- Einführung neuer Pakete, nativer Module oder Config-Plugins.
- Datenbank-, Sync-, Auth- oder RLS-Änderungen.
- Migration von beliebigen lokalen `Pressable`-Instanzen in Features, sofern sie
  nicht durch die Entfernung der alten Schicht direkt betroffen sind.

## Ownership und Zielstruktur

Die alte Schicht wird nicht durch eine neue allgemeine Button-Registry ersetzt.
Jede Komponente erhält den kleinsten bestehenden Owner, der ihre Verantwortung
vollständig erklärt.

| Aktuelle Komponente | Zielentscheidung | Begründung |
| --- | --- | --- |
| `MenuButton` | Als eigener Export in der gemeinsamen UI-Schicht oder als gleichwertiger zentraler `IconButton`-Preset | Die Komponente enthält nur eine wiederverwendete semantische Konfiguration. Die Entscheidung darf nicht an sieben Aufrufstellen dupliziert werden. |
| `HeaderIconButton` | In den bestehenden gemeinsamen UI-Bereich verschieben; themenabhängige Styles bleiben in `ui.tsx` | Header- und Modal-Varianten, `hitSlop`, Accessibility und beliebige Icon-Kinder bilden eine gemeinsame UI-Komposition. |
| `CompactActionButton` | In den bestehenden gemeinsamen UI-Bereich verschieben; Chevron- und Flächen-Styles bleiben zentral | Die Komponente ist ein wiederverwendetes, expandierbares UI-Muster mit einem eigenen Touch-Vertrag von 34 Punkten plus `hitSlop`. |
| `FloatingActionButton` | In den bestehenden gemeinsamen UI-Bereich verschieben; Tiefen- und Face-Styles bleiben zentral | Die Komponente kapselt die spezielle 3D-FAB-Interaktion und wird im App-Shell- und Showcase-Pfad verwendet. |
| `BackButton`, `AutoBackButton`, `goBackTo` | In den bestehenden Layout-/Navigationsbereich verschieben | Router-Fallback und Navigator-Zustand sind Navigationsverhalten und gehören nicht in das generische UI-Primitive `ui.tsx`. |
| `ProfileButton` inklusive `.android.tsx` | In den bestehenden Layout-/App-Chrome-Bereich verschieben | Avatar-/Initialen-Fallback und die Android-Variante sind Header-Komposition, keine generische Icon-Schaltfläche. |

Die konkreten neuen Dateinamen werden im Implementierungsplan endgültig
festgelegt. Neue Dateien sind nur zulässig, wenn sie genau eine der oben
begründeten Verantwortungen besitzen. Eine bloße Umbenennung ohne Owner-Gewinn
ist nicht zulässig.

### Verbindliche Zielregeln

- Alle themen- oder runtimeabhängigen Styles verwenden `StyleSheet.create` aus
  `react-native-unistyles`.
- Unistyles-Styles werden mit Style-Arrays kombiniert, nicht mit dem
  Spread-Operator.
- Keine `className`-, `contentContainerClassName`- oder NativeWind-APIs.
- Keine `Pressable`-Style-Funktion für die zentralen betroffenen Flächen. Die
  bekannte Gerätegrenze wird durch statische Styles und vorhandene `Press`
  -Kompositionen eingehalten.
- `Press` bleibt der gemeinsame Ort für Scale-, Haptik- und Reduced-Motion-
  Interaktion. Ein verschobener Wrapper darf diese Logik nicht duplizieren.
- `theme/index.ts` erhält keine neuen Button-spezifischen Farbwerte, wenn ein
  bestehender semantischer Token ausreicht.
- `ui.tsx` erhält keine Router-, Avatar- oder andere Feature-Abhängigkeit nur,
  um den alten Ordner mechanisch zu leeren.

## Tech Stack

- Expo SDK 57
- React Native 0.86
- React 19
- TypeScript
- `react-native-unistyles` v3 als einzige aktive Styling-Runtime
- React Native Reanimated für vorhandene UI-Thread-Animationen
- Jest mit `jest-expo` und `@testing-library/react-native`
- Bun als Paketmanager und Skript-Runner

Es wird keine Laufzeit- oder native Abhängigkeit eingeführt.

## Commands

### Baseline vor der Migration

```bash
bun run test --runInBand --no-watchman src/constants/ui.test.tsx src/components/ui/buttons
```

### Fokussierte Verifikation nach der Migration

```bash
bun run test --runInBand --no-watchman src/constants/ui.test.tsx src/components/ui src/components/layout test/conventions/shared-button-contract.test.ts test/conventions/shared-touch-contract.test.ts test/conventions/dashboard-nativewind-convention.test.ts
bun run check
bun run typecheck
bun run native:status
```

Die Unit-Tests laufen ausschließlich über `bun run test`, niemals über `bun
test`. Die vollständige Testsuite ist für diese Strukturänderung nicht als
Standard-Gate vorgesehen.

### Native Laufzeitprüfung

Die betroffenen Flächen werden auf iOS und Android mit den vorhandenen lokalen
Dev-Builds oder Harness-Flows geprüft. Mindestens Dashboard/App-Shell,
Screen-Header, Back-Variante, Modal-Header, compact action und Profil-Fallback
müssen einmal sichtbar und aktivierbar sein. Die Prüfung muss insbesondere
belegen, dass keine Fläche wegen einer nicht angewendeten Pressable-Style-
Funktion unsichtbar wird.

## Project Structure

```text
src/components/theme/index.ts          Theme-Tokens und Farb-/Geometrie-Owner
src/components/theme/ThemeProvider.tsx  Präferenz, Auflösung und Theme-Hooks
src/constants/ui.tsx                   Gemeinsame UI-Primitives und Style-Rezepte
src/constants/ui.test.tsx              Tests für den zentralen UI-Owner
src/components/ui/                     Wiederverwendete UI-Kompositionen
src/components/layout/                 App-Chrome und Navigations-Kompositionen
src/features/*                         Feature-Verhalten und feature-spezifische Komposition
test/conventions/                      Architektur- und Gerätegrenzen
docs/specs/shared-button-layer/SPEC.md  Diese Vereinbarung
```

Nach Abschluss darf `src/components/ui/buttons/` nicht mehr existieren. Die
Zielkomponenten dürfen nicht über einen neuen Sammel-Barrel exportiert werden,
wenn dadurch die Ownership wieder verschleiert wird.

## Code Style

Die Zielkomponenten bleiben dünne Kompositionen. Theme-Entscheidungen kommen
aus den zentralen Ownern, Verhalten bleibt lokal und typisiert:

```tsx
export function HeaderIconButton({
  label,
  onPress,
  children,
  variant = 'header',
}: HeaderIconButtonProps) {
  const sizeStyle =
    variant === 'modal-close' ? iconButtonStyles.modalClose : iconButtonStyles.header;

  return (
    <Press
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[headerIconButtonStyles.root, sizeStyle]}>
      {children}
    </Press>
  );
}
```

Verbindliche Stilregeln:

- Props und Rückgabewerte werden aus dem tatsächlichen Verhalten abgeleitet.
- Kein `any`, kein `as any`, kein `as unknown as`, keine Non-null-Assertion und
  keine Suppression-Kommentare.
- Keine reine Casting- oder Re-Export-Datei ohne begründete Ownership.
- Call Sites verwenden die semantische Komponente oder das zentrale Primitive,
  nicht kopierte Farb-, Radius- oder Touch-Konfiguration.
- Native Plattformgrenzen wie `profile-button.android.tsx` bleiben explizit und
  werden nicht durch Laufzeit-Checks zusammengelegt.

## Testing Strategy

### Komponentenverhalten

Die bestehenden Tests werden an die Zielorte verschoben oder in den bereits
vorhandenen kanonischen Test `src/constants/ui.test.tsx` konsolidiert. Keine
fachliche Assertion darf beim Verschieben verloren gehen.

Zu prüfen sind mindestens:

- genau eine Aktivierung und genau ein Callback-Aufruf,
- korrekte Accessibility-Rolle, Label und State,
- mindestens 44 Punkte effektive Touch-Fläche, auch wenn die sichtbare Fläche
  kleiner ist,
- statische Styles auf den betroffenen Geräteflächen,
- `expanded`-State des Compact-Buttons,
- Back-Navigation mit Historie, Fallback-Ziel und eigenem `onPress`,
- Reduced Motion bei Button-Tiefe und Scale,
- FAB-Tiefe und sichtbare Face-Größe,
- Profilbild gegenüber Initialen sowie Android-Renderpfad,
- deaktivierte oder ladende zentrale Buttons ohne Aktivierung und Haptik.

### Architektur- und Konventionstests

Die bestehenden Konventionstests werden so umgestellt, dass sie die neuen
Zielpfade prüfen. Zusätzlich muss mindestens eine Konvention explizit fehlschlagen,
wenn:

- ein Import aus `src/components/ui/buttons` verbleibt,
- die alte `index.ts` oder ein alter Button-Dateipfad wieder eingeführt wird,
- `StyleSheet` aus `react-native` importiert wird,
- ein zentraler betroffener Button eine geräteunsichere Pressable-Style-
  Funktion verwendet,
- `className` oder `contentContainerClassName` in den Zielpfaden auftaucht.

Dateianzahl allein ist kein ausreichendes Architektur-Gate.

### Regression und Laufzeit

Die fokussierten Jest-Tests, Biome und Typecheck müssen grün sein. Danach folgt
eine iOS- und Android-Sichtprüfung der betroffenen App-Shell- und Header-Pfade.
Bei einer visuellen oder interaktiven Abweichung gilt die Migration als nicht
abgeschlossen, auch wenn der Testbaum grün ist.

## Boundaries

### Always

- Vor jeder Produktionsänderung dieses Spec, `CONSTRAINTS.md` und die Owner-
  Regeln prüfen.
- Erst alle Verbraucher und Konventionstestpfade migrieren, dann den alten
  Ordner entfernen.
- Bestehende Verhaltenstests als Vertrag erhalten und fokussiert ausführen.
- Styles und semantische Tokens ausschließlich über die vereinbarten Owner
  beziehen.
- iOS- und Android-Dateien als zusammengehörigen Renderpfad behandeln.
- Im Beads-Task die fünf Reviewachsen festhalten: Korrektheit, Lesbarkeit,
  Architektur, Sicherheit und Performance.

### Ask first

- Änderung an sichtbaren Button-Maßen, Farben, Haptik, Animation oder
  Accessibility-Verhalten.
- Neue allgemeine Abstraktion, Registry oder Barrel-Datei.
- Neue Dependency, native Änderung, Config-Plugin oder Dev-Client-Rebuild.
- Verschieben von Router- oder Avatar-Verhalten in `ui.tsx`.
- Löschen einer Assertion ohne gleichwertigen beobachtbaren Ersatz.
- Scope-Ausweitung auf alle lokalen Feature-`Pressable`s.

### Never

- Den Ordner löschen, solange `rg` noch produktive Imports oder Konventions-
  referenzen darauf findet.
- Button-Styles an mehreren Stellen parallel definieren.
- `Pressable`-Style-Callbacks verwenden, die auf dem Gerät nicht zuverlässig
  angewendet werden.
- NativeWind-Klassen, neue Hexwerte oder semantische Farb-Aliase einführen.
- Tests lockern, entfernen oder durch Snapshots ersetzen, nur damit die
  Strukturmigration grün erscheint.
- `bun test` oder die vollständige `bun run test`-Suite als Standard für den
  fokussierten inneren Loop verwenden.

## Success Criteria

1. `src/components/ui/buttons/` ist entfernt.
2. `rg -n "components/ui/buttons|src/components/ui/buttons" src test` liefert
   keine produktiven oder aktiven Konventionsreferenzen.
3. Jede bisherige Funktion von `BackButton`, `AutoBackButton`,
   `HeaderIconButton`, `CompactActionButton`, `FloatingActionButton` und
   `ProfileButton` ist an genau einem benannten Owner verfügbar. `MenuButton`
   ist entweder zentral als UI-Semantik erhalten oder durch eine nicht
   duplizierende zentrale API ersetzt.
4. Keine Button-Styleentscheidung wird außerhalb der Owner dupliziert. Die
   Zielkomponenten verwenden Unistyles und die zentralen Style-Rezepte.
5. Die bestehenden Accessibility-, Touch-, Haptik-, Reduced-Motion-,
   Navigation-, Avatar- und Android-Verträge sind durch fokussierte Tests und
   Laufzeitprüfung nachgewiesen.
6. `bun run check`, `bun run typecheck` und die fokussierten Tests sind grün.
7. Die Strukturänderung erhöht die Effective LOC im festen Button-Scope nicht
   und erzeugt keine neue normalisierte Duplikatgruppe.
8. Der Beads-Task enthält die Nachweise und ist erst danach abschließbar.

## Open Questions

- Soll `MenuButton` als benannter semantischer Export in `ui.tsx` bleiben oder
  soll `IconButton` einen zentralen, typisierten Preset-Mechanismus erhalten?
  Empfehlung: kein allgemeiner Preset-Mechanismus; bei unverändertem Verhalten
  einen kleinen benannten `MenuButton`-Export beibehalten.
- Sollen `HeaderIconButton`, `CompactActionButton` und
  `FloatingActionButton` in `src/components/ui/` liegen oder direkt in
  `ui.tsx` ergänzt werden? Empfehlung: `src/components/ui/`, damit `ui.tsx`
  nicht um Router-, Bild- oder App-Shell-Verhalten wächst. Ihre semantischen
  Styles bleiben trotzdem im UI-Owner.
- Soll `BackButton` im Layout-Bereich oder unter
  `src/features/navigation/` liegen? Empfehlung: Layout-Bereich, weil es von
  mehreren Features als gemeinsame Screen-Chrome-Komponente verwendet wird.

Dieses Spec ist nach der Maintainer-Bestätigung der offenen Ownership-
Entscheidungen freigegeben. Erst danach folgen Plan und Tasks für die
Implementierung.
