# Constraints: Haushalts-Einkaufsgedächtnis / receipt-authority

**Status:** Freigegeben  
**Gültig für:** `fam-qesi.2.1` bis `fam-qesi.2.6`  
**Letzte Festlegung:** 2026-09-21  
**Erbt:** [/CONSTRAINTS.md](/Users/marco/Github.tmp/family_app/fam/CONSTRAINTS.md)  
**Plan:** [tasks/plan.md](/Users/marco/Github.tmp/family_app/fam/tasks/plan.md)

Dieses Dokument ist der feature-lokale Qualitätsvertrag für
`receipt-authority`. Der Root-Vertrag bleibt der unveränderliche Floor. Diese
Datei verschärft ihn für dieses Feature, ersetzt ihn nicht und darf keine
seiner Regeln lockern.

Der Produktionscode dieser Capability liegt unter
`src/features/ocr/authority/`. Der gemeinsame Parent `src/features/ocr/`
ändert nichts an der fachlichen Trennung zu `capture/` und `processing/`.

## Geltungsbereich und fachliche Fixpunkte

Der Vertrag gilt ausschließlich für den freigegebenen
`receipt-authority`-Plan. UI, Kamera/Galerie, OCR/Parsing, Learning,
Auswertungen und Budgetlogik bleiben außerhalb des Scopes.

Die folgenden Entscheidungen sind fest und dürfen in Implementierungs-Beads
nicht neu interpretiert werden:

- Alle Mitglieder des Haushalts dürfen strukturierte Belege und Receipt-Bilder
  lesen, korrigieren, soft-deleten, wiederherstellen und Bilder entfernen.
- Ein Receipt darf mehrere Bilder besitzen.
- Geld ist ausschließlich EUR und wird als Integer in Cent gespeichert.
- Die Löschung eines Bildes löscht niemals strukturierte Receipt- oder
  Item-Daten.
- Rabatt-, Coupon-, Pfand- und Treuekartenzeilen werden nicht als eigene Items
  modelliert.
- `receipt_assets` ist ausschließlich ein serverseitiger Storage-Index. Es
  gibt dafür keine SQLite-Entity, keinen Realtime-/Sync-Eintrag, keinen
  Outbox-Payload und keine lokalen Bildbytes.
- Kaufdatum, Gesamtsumme und bestätigte Artikelpreise bleiben als
  strukturierte Receipt-/Item-Daten gespeichert, auch wenn Bilder entfernt
  werden. Rohes OCR-Volltextmaterial wird nicht dauerhaft gespeichert.
- Keine Receipt-Operation verändert Inventory, Fridge oder Shopping List oder
  erzeugt dafür eine Outbox-Operation.

## Ausgewählte blockierende Qualitätsdimensionen

Marco hat für dieses Feature externe Security-Scans sowie
Architecture/Ownership-Grenzen ausgewählt. Beide Dimensionen sind
blockierend. Ein Bead darf nicht geschlossen werden, wenn sein relevanter
Gate rot ist.

### Security: externer Scan

Der vorhandene Scanner ist Gitleaks (`8.30.1`). Der Standardlauf lautet:

```bash
gitleaks detect --source . --redact --no-banner --no-color
```

Regeln:

- Jeder neu eingeführte Secret-Fund blockiert den Bead und wird behoben, nicht
  mit einer Ignore-Regel verdeckt.
- Der erste relevante Lauf misst die Baseline. Bereits vorhandene Befunde
  dürfen nur mit Pfad, Regel-ID, Bead und Begründung als Bestand dokumentiert
  werden. Neue oder veränderte Befunde gegenüber dieser Baseline blockieren.
- Gitleaks-Ausgaben dürfen keine Secret-Werte enthalten. `--redact` ist daher
  verpflichtend.
- Für datenbankbezogene Beads bleibt zusätzlich der vorhandene
  Supabase-Security-Advisor ein blockierender Bestandteil der DB-Verifikation:
  `bun run db:advisors`.
- `osv-scanner`, Semgrep und ein externer Dependency-Cruiser sind aktuell
  nicht im Workspace installiert. Sie werden nicht still hinzugefügt und
  sind kein behaupteter Gate-Bestandteil dieses Plans. Ein späteres Hinzufügen
  braucht einen eigenen Bead und eine aktualisierte Baseline.

Der Grund für die Null-Toleranz bei neuen Security-Befunden ist die
Haushalts- und Privatdaten-Isolation: Ein potenzielles Secret oder eine
Umgehung der Datenbankgrenze ist kein akzeptabler Qualitätsrückstand.

### Architecture/Ownership: getrennte Zuständigkeiten

Die Architekturgrenze wird durch die exklusiven Dateibesitzrechte im Plan und
einen fokussierten Convention-Test verifiziert:

```bash
bun run test test/conventions/receipt-authority-ownership.test.ts
```

Der Test wird in `fam-qesi.2.1` als Datei des Domain-Beads angelegt und muss
mindestens sicherstellen, dass die Receipt-Domain keine React-, React-Native-,
Expo-, SQLite-, Drizzle-, Supabase-, Storage- oder Sync-Imports besitzt. Die
weiteren Plan-Gates prüfen, dass `receipt_assets` nicht in lokalen oder
generischen Sync-Registries landet.

Zusätzliche Ownership-Regeln:

- Jeder Bead ändert nur seine im Plan genannte, disjunkte Dateimenge.
- Eine fremde Task-Datei wird nicht als Reparaturweg geändert. Schnittstellen
  werden über den Spec-Vertrag und benannte Exporte abgestimmt.
- Die reine Domain besitzt Fachinvarianten und Statuslogik. Infrastruktur,
  React Query, Zustand, SQLite, Supabase und Storage gehören anderen Ownern.
- Es werden keine neuen generischen Sync-, Queue-, Plugin- oder
  Abstraktionsschichten für Receipts eingeführt.
- Ein Ownership-Verstoß blockiert den Bead, auch wenn die Funktionstests grün
  sind.

Die Null-Toleranz für neue Ownership-Verstöße hält die Multi-Agent-Aufteilung
mechanisch überprüfbar und verhindert, dass parallel bearbeitete Beads
implizite gemeinsame Owner erzeugen.

## Baseline-, Ratchet- und Zeitregeln

Es werden keine künstlichen Coverage-, Performance- oder Accessibility-Ziele
für dieses Feature erfunden. Gemessen und gehalten werden nur die von Marco
gewählten Dimensionen:

| Dimension | Baseline | Ziel | Nachweis | Zeitpunkt |
| --- | --- | --- | --- | --- |
| Security | Erster Gitleaks-Lauf vor dem ersten Implementierungs-Bead; DB-Bead zusätzlich mit aktuellem Advisor-Ergebnis | Keine neuen Befunde gegenüber der dokumentierten Baseline | Gitleaks-Ausgabe und Bead-Notiz; `bun run db:advisors` für DB-Beads | Vor Bead-Abschluss und in CI |
| Architecture/Ownership | Aktueller Plan mit disjunkten Dateisets und noch ohne Receipt-Produktionscode; Domain-Gate wird mit `fam-qesi.2.1` aktiv | Keine neue Boundary- oder Ownership-Verletzung | Convention-Test, Plan-Dateisets und Review der geänderten Pfade | Jeder Implementierungs-Bead |
| Lokaler Task-Check | Dauer des ersten fokussierten Checks je Bead | Höchstens 90 Sekunden lokal; langsamere Security-/DB-Checks laufen in CI | gemessene Dauer in der Bead-Notiz | Jeder Bead |

Die 90 Sekunden erhalten schnelle Rückkopplung für unabhängige Agenten. Ein
langsamer Check wird nicht durch schwächere Tests künstlich beschleunigt,
sondern als CI-Gate geführt oder in kleinere fokussierte Checks geteilt.

## Source-driven Development

Vor framework- oder library-spezifischem Produktionscode muss der jeweilige
Agent die exakte installierte Version prüfen und eine offizielle, dazu passende
Dokumentationsquelle lesen. Die Quelle und die daraus abgeleitete
Entscheidung werden in der Bead-Notiz festgehalten. Blogposts,
Stack-Overflow-Antworten und ungeprüfte Modell-Erinnerungen sind keine
Implementierungsgrundlage.

Für dieses Projekt gelten insbesondere:

- Expo: [SDK 57 Dokumentation](https://docs.expo.dev/versions/v57.0.0/)
- Supabase: [offizielle Dokumentation](https://supabase.com/docs)
- Drizzle: [offizielle Dokumentation](https://orm.drizzle.team/docs/overview)
- TanStack Query: [offizielle React-Dokumentation](https://tanstack.com/query/latest/docs/framework/react/overview)
- React Native Testing Library: [offizielle Dokumentation](https://callstack.github.io/react-native-testing-library/)

Die Versionen werden nicht aus diesen allgemeinen Einstiegsseiten abgeleitet,
sondern aus `package.json` und dem Lockfile. Für API- oder Test-Code wird vor
der Änderung die konkrete Versionsseite bzw. der aktuelle offizielle
Referenzabschnitt ergänzt. Bei einem Konflikt zwischen Dokumentation und
bestehendem Projektmuster wird der Konflikt im Bead festgehalten und die
projektweite Regel nicht stillschweigend umgangen.

Aktueller Versionssnapshot für die spätere Verifikation: Expo `~57.0.19`,
React Native `0.86.3`, React `19.2.3`, Supabase JS `^2.112.3`, TanStack Query
`^5.102.3`, Drizzle ORM `^1.0.0-rc.4`, Jest `~29.7.0`, React Native Testing
Library `^14.0.1` und Unistyles `3.3.0`. Vor dem ersten Code-Change wird der
Snapshot erneut gegen den Workspace geprüft.

## Gate-Lifecycle

### Vor Beginn eines Beads

1. Root-`CONSTRAINTS.md`, diese Datei, die Spec, den Plan und den eigenen
   Context-Pack lesen.
2. Exakte Dateibesitzmenge und Abhängigkeiten aus dem Plan bestätigen.
3. Relevante installierte Versionen prüfen und bei framework-spezifischer
   Arbeit die passende offizielle Quelle lesen.
4. Bei `fam-qesi.2.1` den Gitleaks-Baseline-Lauf und den
   `receipt-authority-ownership`-Convention-Test als geplante Gates
   verankern.

### Während der Arbeit

- Bei einem Security- oder Ownership-Fehler stoppen, den zuständigen Bead
  bestimmen und keine fremde Datei als Umgehung ändern.
- Keine Abhängigkeit, Ignore-Regel, Suppression oder neue globale
  Abstraktion hinzufügen, um ein Gate grün erscheinen zu lassen.
- Fachliche Entscheidungen nur aus Spec/Plan ableiten; ungelöste Konflikte
  im Bead notieren statt lokal neu zu erfinden.

### Vor dem Schließen

1. Den fokussierten Test-/Check-Satz aus dem Plan ausführen und die Dauer
   messen.
2. Gitleaks mit Redaction ausführen; bei DB-Beads zusätzlich
   `bun run db:advisors`.
3. Architecture/Ownership-Test und geänderte Pfade prüfen.
4. `git diff --check`, relevante Bead-Abhängigkeiten und `git status --short`
   prüfen.
5. Ergebnisse, Quellen, Baseline und eventuelle vorbestehende Befunde in der
   Bead-Notiz dokumentieren.

## Ausnahmeverfahren

Dieser Vertrag enthält keine vorab genehmigten Ausnahmen. Eine notwendige
Ausnahme braucht vor dem Abschluss des betroffenen Beads eine dokumentierte
Maintainer-Entscheidung mit Begründung, betroffenen Dateien, Ersatz-Gate und
Ablaufdatum. Eine Ausnahme darf weder die RLS-Datentrennung noch die
`receipt_assets`-Server-only-Regel aufweichen.
