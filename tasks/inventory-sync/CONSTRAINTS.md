# Constraints

Status: verbindlich für den Inventory-Sync-Refactor.
Letzte Festlegung: 2026-09-09.

## Harte Grundsätze

- **KISS / DRY / YAGNI:** Jede Änderung wählt den einfachsten bestehenden
  Owner, vermeidet doppelte fachliche Entscheidungen und führt keine
  vorsorgliche Erweiterbarkeit ein. Eine neue Datei, Abstraktion oder
  Indirektion ist nur zulässig, wenn sie für den Contract nachweislich nötig
  ist und im Beads-Ticket begründet wird.
- Der Operationsvertrag wird vor Produktionscode erstellt und freigegeben.
- Jede fachliche Entscheidung besitzt genau einen benannten Produktionscode-Owner.
  Mehrere benannte Verantwortlichkeiten dürfen in einer vorhandenen Datei
  liegen. Eine Operation rechtfertigt keine eigene Datei.
- Fehlende Owner dürfen erstellt werden, wenn die Aufgabe nach dokumentierter
  KISS-/DRY-/YAGNI-Prüfung keinen bestehenden Owner sinnvoll erweitern kann.
  Die neue Datei besitzt genau eine Verantwortung; kein Command-Verzeichnis,
  kein Executor, keine Registry und kein zusätzliches Contract-Modul.
- Reine Strukturänderungen und fachliche Korrekturen werden getrennt geprüft.
  Bei Strukturänderungen bleiben Testerwartungen gleich; eine geänderte
  Erwartung muss eine ausdrücklich benannte fachliche Contract-Regel prüfen.
- Andere Schichten dürfen Werte transportieren und Feldnamen abbilden, aber
  dieselbe fachliche Entscheidung weder erneut interpretieren, berechnen,
  klassifizieren noch reconciliieren. Form-, Auth-, Snapshot- und
  Constraint-Validierung an der jeweils zuständigen Vertrauensgrenze bleibt
  Pflicht, darf aber keine zweite fachliche Regel enthalten.
- Eine zweite ähnliche Funktion ist verboten, auch bei anderem Namen oder leicht anderer Struktur.
- Neue Funktionen verwenden einen bestehenden Owner oder erweitern zuerst den Contract.
- Der erste Teilverbrauch aus versiegeltem Bestand ist eine Verbrauchsoperation
  mit optionalem strukturellem Öffnungsrest. Er ist keine zweite `open`-Operation.
- Neue Schreibpfade erzeugen ausschließlich `in`, `out` oder `waste`. Sie
  erzeugen weder eine `open`-Ledgerzeile noch einen künstlichen Vollmengen-
  Transfer für das Öffnen.
- Undo ist append-only: Die Gegenbuchung referenziert das Original über
  `reversal_of`; `transactions.undone` entfällt aus dem Zielmodell.
- Neue Split-Provenienz ist typisiert und enthält Ursprungslos, Ursprungsort,
  geöffnetes Restlos, Mengen und Merge-Snapshot. Freitext-Notes werden nicht als
  Provenienz gelesen; es gibt keinen Legacy-Eingang.
- Reines Öffnen ohne Verbrauch ist `open_inventory` ohne Ledger; es wird
  nicht als Verbrauch oder allgemeiner Metadatenpatch getarnt.
- Integer-Tausendstel gelten auch für Persistenz und Wire-Payloads. Die
  Umstellung der bisherigen Dezimalspeicherung ist expliziter Arbeitsumfang.
- Ausführungsnachweis und vollständige Serverbasis werden gemäß Contract aus
  einem konsistenten Snapshot übernommen. Antwortverlust bleibt auch nach
  Erreichen des Retry-Limits unbekannt.
- Keine neue allgemeine Sync-, Queue- oder Plugin-Abstraktion.
- Keine manuellen Supabase-Migrationen. Quelle bleibt `supabase/schemas/*.sql`.
- Kein `bun test`, keine vollständige Jest-Suite und kein Starten einer lokalen Supabase-Instanz für diesen Refactor.
- Keine neuen Suppression-Kommentare, keine übersprungenen oder gelöschten Tests und keine unimplementierten Stubs.
- **Ungeshipped / Zero Legacy:** Die App ist nicht veröffentlicht. Es gibt keine Rückwärtskompatibilitätspflicht für historische Payloads, Freitext-Notes oder veraltete DB-Spalten. Es wird kein Legacy-Decoder gebaut. Veralteter Code wird gelöscht, nicht dekodiert.

## Verbindliche Implementierungsregeln

Diese Regeln gelten für jeden bearbeiteten Inventory-Pfad. Sie legitimieren
keinen pauschalen Umbau unberührter Dateien. Owner und Abhängigkeitsrichtung
stehen ausschließlich in `contract.md`, Abschnitt 8.

### I1: Kontext und Umfang vor dem Edit

- Vor jedem Inkrement dieses Dokument, den relevanten Contract-Abschnitt,
  das Beads-Ticket, die Zieldateien, direkten Aufrufer und betroffenen Tests
  lesen. Bestehende Änderungen und Baselinefehler zuerst zuordnen.
- Ein Inkrement hat ein beobachtbares Ergebnis, höchstens drei Abnahmepunkte
  und maximal vier handbearbeitete Produktionsdateien. Tests und Harnesses
  werden separat benannt. Diese Grenze hält den einzelnen Schritt prüfbar;
  größere Aufgaben werden vorher zerlegt.
  Generierte Artefakte werden zusätzlich einzeln genannt.
- Keine neue Produktionsdatei ohne die KISS-/DRY-/YAGNI-Begründung im Ticket,
  keine Dependencies, Frameworks oder allgemeinen Executor-/Registry-/Adapter-
  Schichten. Kein nebenläufiger Umbau derselben Datei. Fachliche Unklarheit
  blockiert den betroffenen Schritt.

### I2: Typen und Eingangsvalidierung

- Operationen bilden eine diskriminierte Union mit Pflichtfeldern je Operation.
  Kein gemeinsamer Payload mit optionalen Feldern für alle Fälle, keine
  Moduswahl über Kombinationen von Boolean-Flags. Dispatch ist exhaustiv;
  unbekannte Operationen erhalten keinen Default-Erfolg.
- `unknown` bleibt an untypisierten Eingängen und wird dort geprüft. Intern
  gelten die kanonischen Typen aus dem Lifecycle; keine parallelen DTO-Kopien
  und kein `Record<string, unknown>` als Ersatz für einen Operationsvertrag.
- Kein neues `any`, `as any`, `as unknown as`, `as never` oder Non-null-Assertion
  zum Umgehen fehlender Beweise. Ein Cast ersetzt keine Laufzeitvalidierung.
  Typinferenz und Narrowing verwenden; keine reinen Casting-Wrapper.
- v1-Payloads strikt validieren. Patches enthalten nur ausdrücklich erlaubte,
  tatsächlich gesetzte Felder. Fehlend und `null` bleiben verschieden;
  kein Spread eines kompletten DB-/UI-Objekts in den Request.

### I3: Reine Planung und atomare Ausführung

- Fachplanung bekommt Zustand, Absicht, benötigte IDs und Zeit als Eingaben.
  Sie verändert keine Eingabe, liest keine globale Uhr, erzeugt keine Zufalls-ID
  und verwendet weder React noch Datenbank, Netzwerk oder Outbox.
  Ergebnis sind typisierte Daten, keine ausführbaren Callbacks.
- IDs und normalisierten Request einmal je Absicht festlegen und persistieren.
  Retry transportiert dieselbe Absicht; nur explizites Reconfirm erzeugt eine neue.
- Lokale Ausführung nutzt `enqueueMutationsInExclusiveTransaction`: benötigten
  Zustand innerhalb der exklusiven Transaktion frisch lesen, Plan berechnen,
  Bestand, Ledger und Outbox vollständig darin schreiben. Kein vorgelesener
  Hook-Zustand als Schreibautorität, keine verschachtelte Transaktion und kein
  Netzwerkaufruf innerhalb der SQLite-Transaktion.
- Benachrichtigung und Query-Invalidierung erst nach erfolgreichem Commit.
  Scheitert ein Teilschritt, bleiben keine Teilbuchung und keine einzelne
  Outbox-Zeile zurück. Reconciliation übernimmt Basis, Receipts und Projektion
  gemäß Contract ebenfalls atomar und prüft den aktuellen Footprint erneut.

### I4: Fehler, Sicherheit und Grenzen

- Technische Fehler, fachlicher Konflikt und unbekannter Serverausgang bleiben
  unterscheidbar. Kein leerer Catch, kein Erfolg nach Fehler, kein stilles
  Ersetzen durch `[]`, `0` oder `null`. Defaults nur, wenn der Contract genau
  diesen fehlenden Wert erlaubt; niemals zum Reparieren ungültiger Eingaben.
- FK-Fehler verändern keine Absicht; Auth/RLS werden nicht durch Clientprüfungen
  ersetzt. Server prüft Haushalt, Actor, Payload und Preconditions selbst.
  SQL-Werte parametrisieren; keine Payloads, Tokens oder privaten Nutzerdaten
  in Logs. Vorhandene Fehlercodes nutzen statt Fehlertext-Heuristiken.
- Mengen nur an benannten Grenzen konvertieren, intern Integer-Tausendstel.
  Keine zweite Rundung, stilles Clamping oder ungeprüfte Number-Konversion.
  Reads und Retries bleiben auf den benötigten Haushalt/Footprint begrenzt;
  keine neue Abfrage pro Listenzeile und keine unbeschränkte Retry-Schleife.

### I5: Lesbarkeit und nachweisbare Vereinfachung

- Explizite fachliche Funktionen im bestehenden Owner, Guard Clauses statt
  tiefer Verschachtelung, keine verschachtelten Ternaries. Namen benennen die
  Wirkung; Kommentare erklären Invarianten oder Gründe, keine Änderungshistorie.
- Ein Helper braucht eine aktuelle Verantwortung oder tatsächliche
  Wiederverwendung. Kein Weiterleitungs-Wrapper nur zum Erhalt alter Imports,
  keine vorsorgliche Erweiterbarkeit und keine zweite ähnliche Berechnung.
- Ein reiner Umzug behält Verhalten und Testerwartungen. Eine fachliche
  Korrektur nennt die betroffene Contract-Regel und erhält einen eigenen
  Nachweis. Ein Umzug allein gilt nicht als abgeschlossene Vereinfachung:
  Beim Abschluss der Zusammenführung müssen doppelte Entscheidungen und ihre
  alten Aufrufpfade entfallen sein. Weniger Dateien allein genügt nicht.

### I6: Tests und Review als Abnahme

- Tests prüfen beobachtbare Wirkung und Fehlerfälle des geänderten Vertrags.
  Den getesteten Owner nicht mocken. Atomarität durch einen Fehler zwischen
  Schreibschritten und Prüfung des verbleibenden DB-Zustands belegen;
  Mock-Aufrufzählungen beweisen keinen Rollback.
- Betroffene Grenzfälle gezielt prüfen: ungültiger Payload, Mengengrenze,
  Retry/Antwortverlust oder Race, soweit der Schritt diese Verantwortung ändert.
  Keine pauschalen Snapshots, gelockerten Assertions oder entfernten Tests.
  Architektur-Gate muss verbotene Imports erkennen, nicht nur Dateien zählen.
- Vor Abschluss den Diff in fünf Achsen prüfen: **Korrektheit** gegen Contract
  und Fehlerfälle, **Lesbarkeit** des Kontrollflusses, **Architektur** gegen
  Owner und Duplikate, **Sicherheit** an Vertrauensgrenzen, **Performance** auf
  Abfrageschleifen und unbeschränkte Arbeit. Je Achse Ergebnis und konkrete
  Fundstelle oder Nachweis kurz im Beads-Ticket festhalten.
- Kritische und erforderliche Reviewkorrekturen blockieren Abschluss;
  optionale Stilhinweise werden als optional bezeichnet. Fehlende Nachweise
  bleiben offen. Kein „grün“ aus ausschließlich selbst bestätigten Assertions.

## Qualitätsgrenzen und Nachweise

| Dimension | Harte Regel | Nachweis | Zeitpunkt |
| --- | --- | --- | --- |
| Contract | Jede Regel ist genau einem Owner zugeordnet | Operationsregister und Contract-Gate | vor jedem Code-Inkrement |
| Architektur | Keine Umgehung des Owners durch Direktimport oder zweite Registrierung | `test/conventions/inventory-operation-ownership.test.ts` | jedes betroffene Inkrement |
| Typen | Keine neuen TypeScript-Fehler; unabhängige Baseline-Fehler bleiben sichtbar | `bun run typecheck` | Ende eines TS-Inkrements |
| Format/Lint | Keine neuen Biome-Fehler in betroffenen Dateien | `bun run check` bzw. fokussierter Biome-Aufruf | Ende eines TS-Inkrements |
| Verhalten | Nur direkt betroffene Tests werden ausgeführt | `bun run test <datei> --runInBand --watchman=false` | nach jedem Inkrement |
| Testkosten | Ein fokussierter Testlauf darf höchstens 90 Sekunden dauern | Laufzeit des fokussierten Testbefehls | nach jedem Inkrement |
| Strukturgröße | Neue oder bearbeitete Produktionsdateien höchstens 400 Effective LOC; bestehende Ausnahmen wachsen nicht | `bun scripts/analyze-inventory-duplicates.ts src/features/inventory --quiet --top=100` | vor und nach jedem Struktur-Inkrement |
| Duplikate | Exakte normalisierte Gruppen dürfen sich nicht erhöhen; semantisch unbegründete Treffer werden entfernt | `bun scripts/analyze-inventory-duplicates.ts src/features/inventory --include-tests --json --quiet --top=100` | vor und nach jedem betroffenen Inkrement |
| Datenbank | Bei Schemaänderung nur deklarative Quelle, generierte Artefakte danach | `bun run db:diff`, Projekt-DB-Gate und `bun run db:types` | nur bei Schemaänderung |

## Messbare Struktur- und Qualitätsratchets

### Fester Messumfang

Der Produktionsumfang für die Größenmessung ist `src/features/inventory/**`.
Die Messung schließt Dateien mit `.test.`, `.integration.test.` und
`.harness.` aus. Tests und Harnesses werden separat mit `--include-tests`
gemessen und unterliegen nicht der 250–400-LOC-Zielgröße.

`effective LOC` bedeutet: die Anzahl physischer Zeilennummern, die mindestens
ein nicht-trivia TypeScript-/TSX-Token enthalten. Leerzeilen und reine
Kommentarzeilen zählen nicht. Ein mehrzeiliges Token zählt jede von ihm
belegte physische Zeile. Generierte Dateien, SQL und externe Abhängigkeiten
liegen außerhalb dieses Messumfangs.

Der Analyzer ist deterministisch: Pfadumfang, Scanner, Mindestgröße,
Token-Normalisierung und Ähnlichkeitsschwelle werden nicht pro Inkrement
verändert. Eine Änderung am Analyzer erfordert eine neue Baseline und eine
Begründung im Beads-Ticket.

### Baseline vom 2026-09-09

Die Baseline wurde mit den oben genannten Befehlen gemessen:

| Umfang | Dateien | Effective LOC | Exakte normalisierte Duplikatgruppen |
| --- | ---: | ---: | ---: |
| Produktionsdateien | 44 | 9.382 | 4 |
| Produktionsdateien, Tests und Harnesses | 65 | 16.106 | 8 |

Diese Werte sind Messgrundlage, kein Zielwert für die Gesamtgröße. Ein
Inkrement darf die passende Baseline nur erhöhen, wenn es eine ausdrücklich
benannte Contract-Regel oder eine nachvollziehbare Testabdeckung ergänzt.

### Verbindliche Ratchets

1. Neue oder neu bearbeitete Produktionsdateien zielen auf 250–400 Effective
   LOC. 250 LOC ist keine Auffüllpflicht; eine kleinere kohärente Datei ist
   zulässig, wenn ihre Verantwortung vollständig und begründet ist. Mehr als
   400 Effective LOC ist für neue Produktionsdateien nicht zulässig.
2. Bestehende Produktionsdateien über 400 Effective LOC erhalten eine
   dokumentierte Ausnahme mit Pfad, Baseline, Owner, Reduktionsziel und
   Ablaufdatum. Die Ausnahme erlaubt kein Wachstum.
3. Eine reine Strukturänderung darf die Gesamtzahl der Effective LOC im
   betroffenen festen Scope nicht erhöhen. Verschobene Zeilen zählen nur dann
   als Reduktion, wenn die alte fachliche Implementierung und ihr alter
   Aufrufpfad entfallen.
4. Exakte normalisierte Duplikatgruppen dürfen sich nicht erhöhen. Die
   Baselines sind vier Gruppen ohne Tests und acht Gruppen einschließlich
   Tests/Harnesses. Jede verbleibende Gruppe wird als fachlich begründet oder
   als abzubauendes Duplikat im Ticket klassifiziert.
5. Eine Metrik rechtfertigt keine eigenständige Produktionsänderung. Jede
   Reduktion muss zugleich eine Contract-Regel, einen Owner-Grenzfall oder
   eine konkrete doppelte Entscheidung vereinfachen.
6. Die bestehenden harten Gates bleiben unabhängig davon aktiv: Typecheck,
   Biome, fokussierte Tests, 90-Sekunden-Limit, Ownership-Gate und die
   fünf Reviewachsen. Ein Messwert ersetzt keinen Verhaltensnachweis.

### Aktuelle Größen-Ausnahmen

| Pfad | Baseline Effective LOC | Owner | Reduktionsziel | Ablauf |
| --- | ---: | --- | --- | --- |
| `src/features/inventory/add-item-screen.tsx` | 426 | Inventory-UI | kein Wachstum; bei fachlicher Berührung doppelte Darstellung entfernen | 2026-10-31 |
| `src/features/inventory/components/inventory-item-actions-sheet.tsx` | 500 | Inventory-UI | kein Wachstum; gemeinsame Ablaufentscheidung mit Group-Sheet prüfen | 2026-10-31 |
| `src/features/inventory/components/inventory-item-group-sheet.tsx` | 789 | Inventory-UI | kein Wachstum; doppelte Ablauf-/Expiry-Entscheidungen entfernen | 2026-10-31 |
| `src/features/inventory/inventory-lifecycle.ts` | 1.602 | Inventory-Lifecycle | kein Wachstum; Legacy-Heuristiken und doppelte Planung entfernen | 2026-10-31 |
| `src/features/inventory/inventory-screen.android.tsx` | 482 | Inventory-UI | kein Wachstum; Plattformduplikate nur bei nachgewiesener Abweichung behalten | 2026-10-31 |
| `src/features/inventory/inventory-screen.tsx` | 561 | Inventory-UI | kein Wachstum; Undo-/Delete-Entscheidungen nicht doppelt halten | 2026-10-31 |
| `src/features/inventory/use-inventory-mutations.ts` | 1.222 | Inventory-Mutations | kein Wachstum; Fachplanung und lokale Ausführung an die benannten Owner abgeben | 2026-10-31 |

Eine abgelaufene Ausnahme blockiert das nächste betroffene Inkrement, bis sie
erneut begründet oder durch eine tatsächliche Reduktion geschlossen wurde.

Das 90-Sekunden-Limit gilt für einen fokussierten Lauf, damit Tests tatsächlich
bei jedem Inkrement ausgeführt werden. Eine längere Prüfung gehört in ein
separates Review- oder CI-Gate und wird nicht als lokale Minimalprüfung getarnt.

Die genannten neuen Contract-/Ownership-Tests sind Implementierungsziele und
noch kein Beleg eines bestehenden Gates. Ihre Existenz und Ausführung müssen
vor dem jeweils davon abhängigen Inkrement nachgewiesen werden.

I1–I6 sind zusätzlich verpflichtende Diff-/Reviewprüfungen, derzeit nicht
vollständig automatisiert. Im Ticket stehen die tatsächlich ausgeführten
Befehle mit Ergebnis, Testlaufzeit und gegebenenfalls Blocker. Ein übersprungener
oder durch Konfiguration ausgeschlossener Pfad ist kein bestandener Check.
`biome.json` erfasst derzeit `src/**` und `scripts/**`, nicht das geplante Gate
unter `test/conventions/**`; dessen Lint-Nachweis muss ausführbar geklärt
werden, bevor es als vollständig geprüft gilt.

Der aktuelle `test:db`-Wrapper verwendet `--local` und alle SQL-Testdateien;
ein angehängter Dateipfad macht ihn nicht zu einem gezielten DB-Testlauf.
Auch `db:types` verwendet derzeit `--local`. Unter dem Verbot lokaler
DB-Nutzung sind diese Aufrufe kein ausführbarer Nachweis. Der zulässige
Generierungs-/Prüfweg muss geklärt werden; bis dahin bleibt die betroffene
DB-Abnahme blockiert. Keine ungeprüften generierten Artefakte als Ersatz.

## Baseline

Bereits vorhandene, unabhängige Fehler dürfen nicht stillschweigend als Folge
des Refactors behoben oder verschärft werden. Sie müssen im Beads-Task und im
Abschlussbericht genannt werden. Der aktuelle Arbeitsstand enthält bekannte
Fehler in Inventory-Mutationstests; diese gehören zum bestehenden
bestehenden Arbeitsstand und sind kein Freibrief für neue Fehler.

## Änderungsregel

Eine Contract-Änderung muss gleichzeitig aktualisieren:

1. den kanonischen Operationsvertrag,
2. das Operationsregister und den benannten Owner,
3. den kurzen Ausführungsplan, falls Reihenfolge oder Dateigrenzen betroffen sind,
4. die fokussierten Nachweise.

Produktionscode darf erst nach diesen Dokumentänderungen beginnen. Eine
Zeilenreduktion allein ist kein Erfolgskriterium. Erfolg bedeutet weniger
fachliche Mehrfachimplementierung bei unverändertem oder ausdrücklich
vertraglich korrigiertem Verhalten.
