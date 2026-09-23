# Qualitätsvertrag

**Status:** Freigegeben
**Letzte Festlegung:** 2026-09-23

Diese Datei definiert die verbindlichen Qualitätsgrenzen für Produktionscode,
Tests, Datenbank, Synchronisation und Dokumentation. Sie ergänzt
[`AGENTS.md`](AGENTS.md), das Arbeitsweise, Tooling und Beitragsprozess
festlegt. [`CONTEXT.md`](CONTEXT.md) besitzt Domänensprache und Datenbesitz;
[ADRs](docs/adr/README.md) besitzen dauerhafte Architekturentscheidungen.
Feature-Verträge und Spezifikationen dürfen diese Grenzen für ihren Scope
präzisieren, aber nicht abschwächen.

Deklarative Schemas, Quellcode und gezielte Tests belegen das aktuell
implementierte Verhalten. Weichen sie von einem freigegebenen Vertrag ab, ist
das eine zu klärende Abweichung und keine stillschweigende Vertragsänderung.

## Harte Grundsätze

- **KISS / DRY / YAGNI:** Jede Änderung verwendet den kleinsten bestehenden
  Owner, der die Verantwortung kohärent tragen kann. Neue Dateien,
  Abstraktionen oder Indirektionen brauchen einen konkreten Bedarf im aktuellen
  Beads-Task oder freigegebenen Plan. Vorsorgliche Erweiterbarkeit genügt nicht.
- Jede fachliche Entscheidung besitzt genau einen benannten
  Produktionscode-Owner. Andere Schichten dürfen Werte transportieren und
  Feldnamen abbilden, aber dieselbe Entscheidung nicht erneut interpretieren,
  berechnen, klassifizieren oder abgleichen.
- Validierung bleibt an jeder zuständigen Vertrauensgrenze Pflicht. Form-,
  Auth-, Netzwerk-, Datenbank- und Snapshot-Grenzen dürfen deshalb ähnliche
  Prüfungen besitzen, solange sie nicht dieselbe fachliche Regel duplizieren.
- Strukturell ähnliche Funktionen sind zulässig, wenn Plattformgrenzen,
  Vertrauensgrenzen oder unterschiedliche Verträge die Trennung erfordern.
  Doppelte fachliche Entscheidungslogik ist nicht zulässig. Begründete
  Duplikation wird im Beads-Task dokumentiert.
- Eine neue Verantwortung erhält nur dann einen neuen Owner, wenn kein
  bestehender Owner sie kohärent übernehmen kann. Eine einzelne Operation
  rechtfertigt für sich kein Command-Verzeichnis, keinen Executor, keine
  Registry und kein zusätzliches Contract-Modul.
- Reine Strukturänderungen und fachliche Verhaltensänderungen werden getrennt
  ausgewiesen. Bei einer Strukturänderung bleiben Verhalten und
  Testerwartungen gleich. Geänderte Erwartungen müssen eine ausdrücklich
  benannte fachliche Regel prüfen.
- Keine neue allgemeine Sync-, Queue-, Command- oder Plugin-Abstraktion ohne
  mindestens zwei aktuelle, belegte Anwendungsfälle und einen benannten Owner.
- Supabase-Migrationen werden niemals manuell verfasst oder editiert. Quelle
  bleibt `supabase/schemas/*.sql`; Migrationen entstehen ausschließlich über
  `bun run db:diff`.

Vor verhaltensänderndem Produktionscode hält der Beads-Task oder die
freigegebene Spezifikation mindestens fest:

1. das gewünschte beobachtbare Verhalten und relevante Fehlerfälle,
2. den Produktionscode-Owner der fachlichen Entscheidung,
3. betroffene Vertrauens-, Datenbank- und Sync-Grenzen,
4. die fokussierten Abnahmenachweise.

Ein zusätzliches Vertragsdokument, Register oder Ausführungsplan ist nur nötig,
wenn Umfang oder Risiko der Änderung es rechtfertigen. Der Nachweis darf im
Beads-Task liegen; Dokumentation ist kein Selbstzweck.

## Floor: immer erzwungen

- Keine neuen Suppression-Kommentare wie `@ts-ignore`, `eslint-disable` oder
  `biome-ignore` und keine abgeschwächten Compiler-, Lint- oder Testregeln.
- Keine übersprungenen, gelöschten oder gelockerten Tests ohne fachliche
  Begründung und Ersatznachweis im Beads-Task.
- Keine unimplementierten Stubs wie `throw new Error("Not implemented")`, leere
  `catch`-Blöcke oder Platzhalter, die Erfolg vortäuschen.
- Keine Secrets oder echten Zugangsdaten in Quelltext, Tests, Logs,
  Fixtures oder Dokumentationsbeispielen.
- Keine Qualitätsgrenze in dieser Datei wird abgesenkt, um eine konkrete
  Änderung grün erscheinen zu lassen. Eine bewusste Vertragsänderung braucht
  eine eigene Begründung und Maintainer-Freigabe.

### I1: Typen und Eingangsvalidierung

- Kein neues `any`, `as any`, `as unknown as`, `as never` oder eine
  Non-null-Assertion zum Umgehen fehlender Beweise.
- Typinferenz, Narrowing und validierte Parser bevorzugen. Ein Cast ersetzt
  keine Laufzeitvalidierung; reine Casting-Wrapper sind nicht zulässig.
- Eingaben aus UI, Netzwerk, Storage, Datenbank und externen Diensten werden an
  ihrer Vertrauensgrenze validiert.

### I2: Ownership und Duplikation

- Fachliche Entscheidungen werden im benannten Owner implementiert und von
  Konsumenten aufgerufen, nicht kopiert.
- Architektur-Gates prüfen verbotene Abhängigkeiten oder Imports. Reines
  Dateizählen beweist keine Ownership.
- Vorhandene normalisierte Duplikate im betroffenen Scope dürfen nicht
  zunehmen. Neue Treffer werden entfernt oder mit konkreter fachlicher oder
  technischer Notwendigkeit dokumentiert.

### I3: Planung und Seiteneffekte

- Reine Domain- und Planungsfunktionen bleiben frei von React, nativen Modulen,
  Datenbank-, Netzwerk-, Sync- und Outbox-Seiteneffekten.
- Orchestrierende Schichten führen den Plan aus; sie erfinden keine zweite
  fachliche Entscheidung.
- Eine Abweichung ist nur zulässig, wenn der Owner-Vertrag ausdrücklich
  Seiteneffekte umfasst und die Grenze gezielt getestet wird.

### I4: Mutationsabsicht, Atomarität und Retry

- Fehlerbehandlung, Retry und Konfliktauflösung dürfen die ursprüngliche
  Mutationsabsicht nicht still verändern. Nicht reparierbare Eingaben schlagen
  sichtbar fehl oder bleiben für einen späteren Retry erhalten.
- Zusammengehörige lokale Writes und Outbox-Einträge sind atomar. Ein Test
  belegt den Zustand nach einem Fehler zwischen den Schreibschritten;
  Mock-Aufrufzählungen beweisen keinen Rollback.
- Reverse Actions erhalten dieselben Invarianten wie die Vorwärtsaktion.

### I5: Datenbank- und Sync-Parität

- Jede neue Supabase-Tabelle aktiviert RLS, besitzt explizite Policies und
  erhält fokussierte pgTAP-Tests.
- Änderungen an synchronisierten Entitäten berücksichtigen deklaratives
  Supabase-Schema, lokalen SQLite-Spiegel, Serialisierung, Outbox, Push, Pull,
  Realtime und Konfliktauflösung, soweit die Entität diese Flächen nutzt.
- Nach Supabase-Schemaänderungen gehören leerer `db:diff`, aktualisierte
  Datenbanktypen und relevante Advisors zur Abnahme.

### I6: Tests und Review als Abnahme

- Tests prüfen beobachtbare Wirkung und Fehlerfälle des geänderten Vertrags.
  Der getestete Owner wird nicht gemockt.
- Betroffene Grenzfälle werden gezielt geprüft, insbesondere ungültige
  Eingaben, Mengen- und Berechtigungsgrenzen, Antwortverlust, Retry und Race,
  soweit die Änderung diese Verantwortung berührt.
- Keine pauschalen Snapshots, gelockerten Assertions oder ausschließlich
  selbst bestätigten Mocks als Verhaltensnachweis.
- Kritische und erforderliche Reviewbefunde blockieren den Abschluss.
  Optionale Stilhinweise bleiben als optional gekennzeichnet.

## Messbare Ratchets

### Datei- und Scope-Größe

- Neue Produktionsdateien dürfen höchstens 400 Effective LOC enthalten.
  Kleinere kohärente Dateien sind ausdrücklich erwünscht; 250 LOC sind keine
  Ziel- oder Auffüllgröße.
- Bereits größere, bearbeitete Produktionsdateien erhalten im Beads-Task eine
  dokumentierte Ausnahme mit Pfad, Baseline, Owner, Reduktionsziel und
  Ablaufdatum. Die Ausnahme erlaubt kein Wachstum gegenüber der Task-Baseline.
- Eine reine Strukturänderung erhöht die gesamten Effective LOC ihres vorab
  benannten Scopes nicht. Verschobene Zeilen zählen nur als Reduktion, wenn die
  alte Implementierung und ihr alter Aufrufpfad entfallen.
- Für TypeScript-/TSX-Scopes misst
  `bun scripts/analyze-inventory-duplicates.ts --json <pfade...>` tokenbasierte
  Effective LOC. Für andere Sprachen werden nichtleere, nicht ausschließlich
  aus Kommentaren bestehende Quellzeilen mit einem im Beads-Task benannten
  reproduzierbaren Verfahren gezählt.

### Duplikation

- Exakte normalisierte Duplikatgruppen dürfen im vorab benannten Scope nicht
  zunehmen. Baseline und Ergebnis werden mit denselben Analyzer-Optionen
  ermittelt und im Beads-Task festgehalten.
- Repositoryweite feste Zahlen werden nur verwendet, wenn ein
  repositoryweiter Scan sie reproduzierbar erzeugt. Historische
  Inventory-Baselines sind kein globaler Grenzwert.
- Eine Metrik rechtfertigt keine eigenständige Produktionsänderung. Jede
  Reduktion muss zugleich einen Owner, eine Vertragsregel oder konkrete
  doppelte Entscheidungslogik vereinfachen.

### Lokales Feedbackbudget

- Der erste fokussierte lokale Prüfzyklus eines Tasks soll höchstens 90 Sekunden
  dauern. Das ist ein Feedbackbudget, kein Korrektheitsersatz.
- Langsamere DB-, Security-, Native- oder Integrationstests werden gezielt
  seriell oder in CI ausgeführt und im Beads-Task benannt. Sie dürfen nicht
  entfallen, nur um das lokale Budget einzuhalten.

## Erforderliche Nachweise

Die Abnahme richtet sich nach der betroffenen Oberfläche:

- TypeScript-/TSX-Änderungen: `bun run check`, `bun run typecheck` und gezielte
  Jest-Tests über `bun run test -- <pfad-oder-muster>`.
- Supabase-Schemaänderungen: deklarativer DB-Workflow aus `AGENTS.md`, gezielte
  pgTAP-Tests, Advisors und aktualisierte Datenbanktypen.
- Native Änderungen: Fingerprint-Status und der in `AGENTS.md` beschriebene
  Build-Lock-Workflow. Ein Rebuild erfolgt nur mit der dort verlangten
  Freigabe.
- Reine Dokumentationsänderungen: Links, Pfade, Status, Quellenhierarchie und
  Widerspruchsfreiheit gezielt prüfen; App-Builds und Verhaltenstests sind ohne
  betroffene Laufzeitfläche nicht erforderlich.

Vor Abschluss wird der Diff in fünf Achsen geprüft:

1. **Korrektheit:** Vertrag, Verhalten und Fehlerfälle stimmen überein.
2. **Lesbarkeit:** Kontrollfluss und Benennungen sind ohne unnötige Indirektion
   verständlich.
3. **Architektur:** Owner, Abhängigkeiten und Duplikation bleiben eindeutig.
4. **Sicherheit:** Authentifizierung, Autorisierung, RLS, Eingaben und Secrets
   sind an den Vertrauensgrenzen abgesichert.
5. **Performance:** Keine neue unbeschränkte Arbeit, Abfrageschleife oder
   vermeidbare Blockierung entsteht.

Ergebnis und konkrete Nachweise werden kurz im Beads-Task dokumentiert. Eine
Zeilenreduktion oder ein grüner Einzelcheck allein ist kein Erfolgskriterium.
Erfolg ist korrektes, belegtes Verhalten mit weniger oder zumindest keiner
neuen fachlichen Mehrfachimplementierung.
