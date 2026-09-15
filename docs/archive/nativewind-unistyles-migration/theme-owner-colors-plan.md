# Umsetzungsplan: Theme-Owner-Farben, Audit-Punkt 4

Status: Umsetzung abgeschlossen · technische und iOS-Abnahme erfolgt
Beads: `fam-2y6c` mit den Kind-Tasks `fam-2y6c.1` bis `fam-2y6c.5`

## Kontextbasis

Der Plan basiert auf `CONSTRAINTS.md`, den aktiven Verträgen
`docs/design-system/contracts/01-theme-and-colors.md` und
`docs/design-system/contracts/05-unistyles-and-stylesheet.md`, den drei
Theme-Ownern sowie den aktuellen `speedDial`-, Store- und Placement-Consumern.
Der bestehende abgeschlossene Gesamtplan unter `./implementation-plan.md` wird nicht
überschrieben.

## Ausgangslage

- `src/constants/feature-registry.ts` trägt in `SpeedDialConfig.backgroundColor`
  vier freie Hexwerte. `src/features/navigation/speed-dial-menu.tsx` verwendet
  diese Werte direkt als sichtbare Chip-Fläche. Das ist eine UI-Semantik und
  umgeht damit `src/components/theme/index.ts` und die aktive Palette.
- `src/components/theme/index.ts` ist der Owner für Tokens und Light-/Dark-
  Paletten. `ThemeProvider.tsx` liefert die aktive Palette; `ui.tsx` besitzt
  gemeinsame semantische Rezepte. Es gibt keine vierte globale Farbquelle.
- `src/features/shopping-list/domain-logik/store-presets.ts` besitzt
  Marken-/Presetfarben und neue auswählbare Marktfarben. Gespeicherte
  `store.color`-Werte gehören zu Haushalt-/Nutzerdaten und werden von mehreren
  Markt-Consumern als Streifen, Punkte oder Auswahlfarben dargestellt.
- `src/features/shopping-list/classification/placement-taxonomy.ts` besitzt die
  Farben der kanonischen Placement-Zonen. Diese Werte sind Teil der
  Klassifikations-/Anzeigeidentität und werden über
  `shopping-categories.ts` an Kategorie-Markierungen weitergereicht.

## Ziel

Die SpeedDial-Konfiguration transportiert nur noch einen typisierten semantischen
Theme-Key. Der SpeedDial-Consumer löst ihn aus der aktiven Light-/Dark-Palette
auf. Store- und Kategoriepaletten bleiben an ihren fachlichen Ownern und werden
als zulässige Domain-Farbwerte dokumentiert und gegen eine globale
Theme-Migration abgesichert.

## Architekturentscheidungen

1. `src/components/theme/index.ts` erhält eine kleine, typisierte Zuordnung für
   die vier bestehenden SpeedDial-Funktionsflächen. Die Light-Hues werden
   zunächst erhalten; Dark-Werte werden als Palette-Werte geprüft und nicht in
   der Feature-Registry erfunden.
2. `feature-registry.ts` speichert statt `backgroundColor` einen typisierten
   Theme-Key. Der Import aus der Theme-Quelle bleibt type-only, damit keine
   Laufzeitabhängigkeit oder neue Auflösungslogik entsteht.
3. `speed-dial-menu.tsx` verwendet die aktive Palette aus `useTheme()` für die
   Chip-Fläche. Navigation, Reihenfolge, Feature-Gates, Labels, Schatten und
   Layout bleiben unverändert.
4. `store-presets.ts` und `placement-taxonomy.ts` bleiben die einzigen Owner
   ihrer Domainpaletten. Ihre Werte werden nicht in `theme/index.ts` dupliziert
   und nicht in semantische App-Flächen oder informative Texte umgedeutet.
5. Die Änderung ist kein visuelles Redesign. Neue Dark-Pendants brauchen einen
   Kontrast-/Gerätenachweis; eine wesentliche sichtbare Abweichung würde vor der
   Implementierung eine Mockauswahl nach dem UI-Arbeitsvertrag auslösen.

## Abhängigkeiten

```text
fam-2y6c.1 Contract-/Owner-Gate
        ├── fam-2y6c.2 Theme-Tokens
        │       └── fam-2y6c.3 Registry-/Consumer-Migration
        │                       ┐
        └── fam-2y6c.4 Domain-Klassifikation ─┴─ fam-2y6c.5 Abnahme
```

`fam-2y6c.2` und `.4` sind nach dem Contract-Gate unabhängig. Der Consumer
wartet auf die typisierten Tokens; die Abschlussabnahme wartet auf beide
Grenzen.

## Task List

### Phase 1: Contract und Owner-Gate

#### Task `fam-2y6c.1`: Contract- und Owner-Gate für Theme-Farben

**Beschreibung:** Die aktiven Verträge benennen die Grenze zwischen UI-Semantik,
Theme-Owner und fachlichen Domainpaletten, bevor Produktionscode geändert wird.

**Abnahmekriterien:**

- [x] `01-theme-and-colors.md` und `05-unistyles-and-stylesheet.md` benennen
  SpeedDial als Theme-Fall sowie Store-/Placement-Farben als Domainfälle.
- [x] Für die Domainfälle sind Pfad, Owner, erlaubte UI-Verwendung und
  Nicht-Migrationsregel dokumentiert.
- [x] Der geplante statische Scan prüft die Grenze, statt nur die Dateianzahl
  oder Hexwerte pauschal zu zählen.

**Verifikation:** Dokumentenreview und Architektur-Gate-Entwurf.

**Abhängigkeiten:** Keine.

**Voraussichtliche Dateien:**

- `docs/design-system/contracts/01-theme-and-colors.md`
- `docs/design-system/contracts/05-unistyles-and-stylesheet.md`
- `test/conventions/theme-owner-colors.test.ts`

**Umfang:** M, 3 Dateien.

### Phase 2: Theme-Fundament

#### Task `fam-2y6c.2`: Semantische SpeedDial-Tokens in der Theme-Quelle

**Beschreibung:** Die vier bestehenden Aktionsflächen werden als typisierte
Light-/Dark-Rollen in `index.ts` modelliert. Die Theme-Quelle bleibt die einzige
Stelle mit der UI-Farbentscheidung.

**Abnahmekriterien:**

- [x] Jeder verwendete SpeedDial-Key ist in beiden aktiven Paletten vorhanden.
- [x] Die Theme-API verwendet Funktions-/Semantiknamen statt Farbnummern oder
  freie Hexwerte im Feature-Code.
- [x] Kontrast und sichtbare Differenzierung der SpeedDial-Flächen sind in
  fokussierten Theme-Tests abgedeckt.

**Verifikation:** `bun run test` für Theme-/Kontrasttests.

**Abhängigkeiten:** `fam-2y6c.1`.

**Voraussichtliche Dateien:**

- `src/components/theme/index.ts`
- `src/components/theme/index.test.ts`

**Umfang:** S, 2 Dateien.

### Phase 3: Registry und UI-Consumer

#### Task `fam-2y6c.3`: Feature-Registry und SpeedDial auf Theme-Keys umstellen

**Beschreibung:** Die Registry transportiert nur den typisierten Key; der
SpeedDial-Consumer löst ihn aus der aktiven Palette auf und behält alle
fachlichen Navigationsdaten unverändert.

**Abnahmekriterien:**

- [x] `feature-registry.ts` enthält keine freien SpeedDial-Hexwerte mehr.
- [x] Light und Dark verwenden die aktive Palette, ohne zweite Theme-Auflösung.
- [x] Titel, Reihenfolge, Feature-Gates und Zielrouten der vier Aktionen bleiben
  unverändert.

**Verifikation:** Registry-/SpeedDial-Tests mit Light-/Dark-Prüfung und
`test/conventions/theme-owner-colors.test.ts`.

**Abhängigkeiten:** `fam-2y6c.2`.

**Voraussichtliche Dateien:**

- `src/constants/feature-registry.ts`
- `src/features/navigation/speed-dial-menu.tsx`
- `src/features/navigation/speed-dial-menu.test.tsx`
- `src/constants/feature-registry.test.ts`

**Umfang:** M, 4 Dateien.

### Phase 4: Domain-Paletten

#### Task `fam-2y6c.4`: Domain-Paletten klassifizieren und absichern

**Beschreibung:** Die vorhandenen Markt- und Kategoriepaletten werden als
fachliche Quellen kenntlich gemacht. Die UI darf ihre Werte weiterhin als
Markierung transportieren, aber sie werden nicht in globale Theme-Tokens
kopiert.

**Abnahmekriterien:**

- [x] `store-presets.ts` ist als Owner für Preset-/Auswahlfarben und
  `store.color` als gespeicherten Domainwert dokumentiert.
- [x] `placement-taxonomy.ts` ist als Owner für Kategorie-/Placement-Farben
  dokumentiert; `colorForCategory()` bleibt ein Domainadapter.
- [x] Markierungen verwenden Domainfarben nur an den definierten Punkten;
  Fallbacks bleiben aus der aktiven Palette.

**Verifikation:** Bestehende fokussierte Store-/Kategorie-Tests plus statischer
Allowlist-Scan; keine DB- oder Sync-Änderung.

**Abhängigkeiten:** `fam-2y6c.1`.

**Voraussichtliche Dateien:**

- `src/features/shopping-list/domain-logik/store-presets.ts`
- `src/features/shopping-list/classification/placement-taxonomy.ts`
- `src/features/shopping-list/domain-logik/shopping-categories.test.ts`
- `docs/design-system/contracts/05-unistyles-and-stylesheet.md`

**Umfang:** M, 4 Dateien.

### Checkpoint: Semantik und Domain-Grenzen

- [x] Keine SpeedDial-UI-Farbe kommt mehr aus `feature-registry.ts`.
- [x] Store-/Kategoriepaletten sind klassifiziert, nicht dupliziert.
- [x] Fokussierte Tests und der Ownership-Scan sind grün.

### Phase 5: Qualitäts- und Geräteabnahme

#### Task `fam-2y6c.5`: Theme-Owner-Farben vollständig abnehmen

**Beschreibung:** Der abgeschlossene Slice wird gegen Codequalität, aktive
Theme-Auflösung und native Darstellung geprüft.

**Abnahmekriterien:**

- [x] Fokussierte Tests, Biome, Typecheck und Native-Build-Lock sind grün.
- [x] iOS zeigt den geöffneten SpeedDial in Light und Dark mit allen sichtbaren
  Aktionen und korrekten Zielen.
- [x] Fehlende Android-Nachweise oder ein nicht verfügbarer Dev-Client werden
  ausdrücklich als offen dokumentiert.

**Verifikation:**

```bash
bun run test src/components/theme/index.test.ts src/constants/feature-registry.test.ts src/features/navigation/speed-dial-menu.test.tsx test/conventions/theme-owner-colors.test.ts --runInBand --watchman=false
bun run check
bun run typecheck
bun run native:status -- --diff
```

Zusätzlich iOS-Light-/Dark-Stichprobe mit geöffnetem SpeedDial. Kein vollständiger
Testlauf und kein nativer Rebuild ohne Fingerprint-Drift.

**Abhängigkeiten:** `fam-2y6c.3` und `fam-2y6c.4`.

**Voraussichtliche Dateien:** Nachweise und gegebenenfalls Beads-Notizen.

**Umfang:** S, Verifikation.

## Risiken und Gegenmaßnahmen

| Risiko | Auswirkung | Gegenmaßnahme |
| --- | --- | --- |
| Dark-Pendant verändert die aktuelle visuelle Hierarchie | Mittel | Light-Hues erhalten, Dark-Palette mit Kontrasttest und iOS-Stichprobe prüfen |
| Registry und Theme-Quelle koppeln sich zur Laufzeit | Mittel | type-only Key-Import, Auflösung ausschließlich im Consumer über `useTheme()` |
| DB-Marktfarben werden versehentlich normalisiert | Hoch | Domain-Owner und Allowlist dokumentieren; keine Migration und kein Theme-Kopieren |
| Kategorie-Farben werden als globale Semantik missverstanden | Mittel | Placement-Taxonomie als fachliche Klassifikation markieren; UI-Nutzung auf Indikatoren begrenzen |
| Statischer Scan verbietet legitime Domainfarben | Mittel | Pfadbezogene Prüfung statt globalem Hexverbot |

## Offene Entscheidung

Die vier SpeedDial-Rollen verwenden in Light und Dark bewusst die bestehenden
Light-Flächen. Damit bleibt die bisherige Darstellung unverändert und es wird
keine ungeprüfte visuelle Neugestaltung eingeführt. Die iOS-Stichprobe zeigt die
Flächen in beiden Modi lesbar und differenziert. Eine spätere echte Dark-Paarung
bleibt ein separater visueller Änderungs-Slice mit Mock-/Gerätenachweis.

Der Android-Nachweis wurde in dieser Abnahme nicht durchgeführt, weil kein
Android-Dev-Client verfügbar war.

## Abschluss-Gate

Der Plan gilt als umgesetzt, wenn alle fünf Beads-Tasks nach ihren Nachweisen
geschlossen sind, der SpeedDial keine freie UI-Farbe aus der Registry bezieht,
die Domainpaletten an ihren fachlichen Ownern verbleiben und die fehlenden
Plattformnachweise transparent vermerkt sind.
