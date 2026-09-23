# Implementierungsplan: Nächste technische Bereinigungs- und Absicherungsaufgaben

> Neuabgrenzung auf Marcos Auftrag vom 2026-09-23: Die folgenden Abschnitte
> bleiben als Planungshistorie erhalten. Verbindlicher aktiver Scope,
> Abschlusskriterien und Reihenfolge stehen in den aktualisierten Beads unter
> `fam-ymz7`; widersprechende historische Status- und Gate-Aussagen unten
> sind keine aktuelle Abnahme. Geschlossene Planungsaufgaben belegen keine
> Implementierung. Es werden keine weiteren Aufgaben zur bloßen Synchronisation
> dieses Dokuments angelegt.
>
> Künftige Restore-/Receipt-/CAS-Testpfade unten sind erst bei einer konkret
> beschlossenen Umsetzung deren Abnahmen zuzuordnen. Sie sind keine bereits
> vorhandenen oder bestandenen Tests. Die Qualitätsgrenzen aus CONSTRAINTS.md
> und die bestehenden FlashList-Geräte-/Performance-Anforderungen gelten weiter.

## Status und Arbeitsweise

Dieser Plan ersetzt den vorherigen Audit-Ansatz für dieses Vorhaben. Der
`codebase-audit`-Skill und sein erzeugter Report sind kein Nachweis und werden
nicht als Quelle verwendet.

Der bestehende Receipt-OCR-Plan bleibt unabhängig unter
[`eceipt-OCR-plan.md`](Receipt-OCR-plan.md). Die Aufgaben dieses Plans werden
über Beads verfolgt; es wird kein `tasks/todo.md` angelegt.

**Beads-Initiative:** `fam-ymz7`

**Task-System:** Beads. Die folgenden IDs bilden die geordnete Arbeitsliste;
Akzeptanzkriterien, Verifikation und Abhängigkeiten stehen in den jeweiligen
Beads.

Beads sind die einzige Live-Statusquelle. Dieser Plan dupliziert keine
aktuellen Bead-Statusangaben, sondern bewahrt IDs, Reihenfolge, Abhängigkeiten,
Working-Tree-Scope und historische Nachweise.

Die sechs Stages beschreiben den Arbeitsablauf, nicht automatisch den Abschluss
der gesamten Initiative. Stage 1 bis 4 liefern Befunde und umsetzbare Planung.
Stage 5 bleibt offen, bis alle in diesem Audit belegten Folgeprobleme behoben
und jeweils verifiziert sind. Erst danach wird Stage 6 als abschließende
Gesamtprüfung ausgeführt und geschlossen. Der aktuelle Arbeitsstand liegt
deshalb in der Stage-5-Implementierungsaufgabe `fam-ymz7.18`, während Stage 5
und die finale Stage 6 wieder offen sind.

## Aktueller Stage-1-Nachweis

Der folgende Scope-Nachweis wurde am 2026-09-23 mit
`git status --short --branch` erfasst. Aktuelle Bead-Status werden
ausschließlich über Beads gelesen:

```text
## main...origin/main [ahead 27]
 M .github/workflows/ci.yml
 M .github/workflows/update_dump.yml
 M eas.json
 M src/features/shopping-list/ARCHITECTURE.md
 M tasks/plan.md
 M tasks/spec-test-quality-gates.md
 M tools/category-debugger/package.json
 M tools/llm-test-platform/package.json
?? .beads.gate.lock
?? tasks/eceipt-OCR-plan.md
```

Der aktuelle tracked Scope umfasst acht Dateien. Die beiden untracked Pfade
sind im Diff-Stat nicht enthalten:
`.beads.gate.lock` ist ein 0-Byte-Beads-Laufzeitartefakt und
`tasks/eceipt-OCR-plan.md` bleibt der separat erhaltene Receipt-OCR-Plan.

`tools/category-debugger/package.json` und
`tools/llm-test-platform/package.json` gehören zum bestehenden Scope des
abgeschlossenen Folgebeads `fam-ymz7.9`; diese Plan-Korrektur ändert oder
setzt sie nicht zurück.

`tasks/spec-test-quality-gates.md` ist durch die abgeschlossene Stage 2 bereits
geändert. Die eine Änderung korrigiert den CI-Pin von Bun `1.3.1` auf
`1.3.14`; der Dokumentstatus bleibt „Freigegeben durch Marco, 2026-09-20“.
Der separate Receipt-OCR-Plan trägt weiterhin den Status „In Arbeit“, die
Initiative `fam-qesi`, die Plan-Revision `fam-5ilb`, die Struktur-Migration
`fam-rfyo` und den offenen Native-Fix `fam-n6on`. Diese Datei und die
Toolchain-Konfiguration werden durch `fam-ymz7.8` nicht verändert.

Die geordnete Bead-Folge und ihre Abhängigkeiten sind:

| Bead | Abhängigkeit bzw. Folge |
| --- | --- |
| `fam-ymz7` | Initiative |
| `fam-ymz7.4` | keine; blockiert `.1` und `.6` |
| `fam-ymz7.6` | hängt von `.4` ab; blockiert `.5`, `.8` und `.9` |
| `fam-ymz7.8` | hängt von `.6` ab; Stage-1-Baseline-Nachweis |
| `fam-ymz7.9` | zeitlicher Folgebead; hängt von `.6` ab; `.13` hängt von `.9` ab; historischer Review-Nachweis: `APPROVED` |
| `fam-ymz7.13` | diese Plan-Korrektur; hängt von `.9` ab |
| `fam-ymz7.1` | hängt von `.4` ab; blockiert `.2` und `.5` |
| `fam-ymz7.10` | abgeschlossene, reviewte Stage-3-Planung für die checkedItems/transfers-Bijektion; hängt von `.1` ab; keine Restore-/Sync-/Reverse-Abhängigkeit |
| `fam-ymz7.18` | Stage-5-Implementierung des Bijektionsguards; hängt von `.10` ab; blockiert den Abschluss von Stage 5 bis Code und fokussierte Tests reviewt sind |
| `fam-ymz7.11` | Stage-3-Planungsfolge zur `SectionList`-/`FlashList`-Vertragsprüfung; hängt von `.1` ab; die freigegebene Umsetzung ist Stage-5-Ausgangsvoraussetzung; bleibt von `.10` getrennt |
| `fam-ymz7.2` | hängt von `.1` ab; blockiert `.15`, `.16`, `.17` und `.5` |
| `fam-ymz7.15` | Stage-4-Korrektur; hängt von `.2` ab; blockiert `.5` |
| `fam-ymz7.16` | P1-Sync-Folgebead zu `mirror-write.ts`; hängt von `.2` ab; muss vor dem Abschluss von Stage 5 umgesetzt und verifiziert sein |
| `fam-ymz7.17` | P1-Sync-Folgebead zu `pull.ts`; hängt von `.2` ab; muss vor dem Abschluss von Stage 5 umgesetzt und verifiziert sein |
| `fam-ymz7.5` | Stage-5-Implementierungsgate; hängt von `.6`, `.1`, `.2`, `.15` sowie allen belegten Folgeumsetzungen ab; bleibt bis zu deren Verifikation offen; blockiert `.3` |
| `fam-ymz7.3` | hängt von `.5` ab |

Die Stage-4-Korrekturfolge lautet damit `fam-ymz7.2` → `fam-ymz7.15` →
`fam-ymz7.5`, zusätzlich zu den bestehenden Stage-2- und Stage-3-
Voraussetzungen von `.5`. Die Sync-Korrekturen `fam-ymz7.16` und
`fam-ymz7.17` hängen jeweils von `.2` ab und sind Stage-5-
Ausgangsvoraussetzungen, bleiben aber als eigene reviewbare Beads getrennt.
`fam-ya7p` sowie `fam-ya7p.1` und `fam-ya7p.2` bilden weiterhin den
getrennten Auth-/Secure-Storage-Strang.

Der Stage-5-Abschluss setzt die Umsetzung und Verifikation aller im Audit
übernommenen, belegten Risiken voraus: `fam-ymz7.18`, `fam-ymz7.11`,
`fam-ymz7.16`, `fam-ymz7.17`, `fam-ie54`, `fam-gng6` und `fam-jlkw`.
Die Planungsbeads sind dabei keine stillschweigende Implementierung; nach ihrer
Freigabe wird für jede noch fehlende Umsetzung ein eigener Worker-/Review-
Zyklus geführt. Der unabhängige Auth-Strang bleibt außerhalb dieses Gates,
sofern sein Bead nicht als Befund dieses Audits geführt wird.

Die frühere Toolchain-Korrekturfolge `fam-ymz7.6` → `fam-ymz7.8` sowie
`fam-ymz7.6` → `fam-ymz7.9` → `fam-ymz7.13` bleibt davon unberührt. `.9` ist
der zeitliche Folgebead zu `.8`; der historische Review-Nachweis `APPROVED`
bleibt erhalten, aber `.9` hängt nicht von `.8` ab.

Diese Korrektur dokumentiert nur den bestehenden Scope und die Bead-Struktur.
Sie ändert keinen Produktionscode, keine Toolchain-Konfiguration und keine
fremde Working-Tree-Datei.

## Ziel

Die technische Bereinigung soll den aktuellen Zustand der Bun-Toolchain, des
Shopping-List-Kernpfads und der Auth-/Sync-Grenzen gegen die verbindlichen
Projektverträge prüfen. Kleine, eindeutig belegte Abweichungen werden danach
gezielt korrigiert. Größere fachliche oder architektonische Risiken bleiben
separate Folgeaufgaben.

Der Nachweis entsteht aus drei getrennten Ebenen:

1. **Normativer Vertrag:** `AGENTS.md`, `CONSTRAINTS.md`, `CONTEXT.md` und
   relevante ADRs.
2. **Ist-Verhalten:** Produktionscode, deklarative Supabase-Schemas und lokale
   SQLite-Schemas.
3. **Beobachtbares Verhalten:** fokussierte Jest-/pgTAP-Tests und passende
   Toolchain-Prüfungen.

Eine Differenz zwischen diesen Ebenen wird beschrieben und nicht stillschweigend
zum neuen Vertrag erklärt.

## Ausgangslage

Der Working Tree enthält vor Beginn dieser Korrektur bereits
folgende Änderungen:

- `.github/workflows/ci.yml`
- `.github/workflows/update_dump.yml`
- `eas.json`
- `src/features/shopping-list/ARCHITECTURE.md`
- `tasks/plan.md`
- `tasks/spec-test-quality-gates.md`
- `tools/category-debugger/package.json`
- `tools/llm-test-platform/package.json`
- `.beads.gate.lock` als Beads-Laufzeitartefakt
- `tasks/eceipt-OCR-plan.md` als untracked, separat erhaltener Receipt-OCR-Plan

Diese Dateien werden als bestehender Arbeitsstand behandelt. Sie werden weder
zurückgesetzt noch automatisch als Ergebnis dieser Neuplanung verbucht. Stage 1
prüft ihren Scope erneut; Stage 2, Stage 3 und die spätere Review entscheiden,
ob ihre Inhalte den Verträgen und dem tatsächlichen Verhalten entsprechen.

Bereits bekannte, getrennte Beads werden nicht dupliziert:

- `fam-2oau`: lokale Bun-CLI weicht von 1.3.14 ab.
- `fam-ie54`: Atomarität des Shopping-Run-Abschlusses.
- `fam-gng6`: SQLite-Lesefehler dürfen nicht als leerer Zustand erscheinen.
- `fam-jlkw`: append-only-RLS für `shopping_history`.
- `fam-ya7p`: separate Auth-Bootstrap-/Secure-Storage-Spezifikation.
- `fam-7cwn`: historische, bereits geschlossene Ausführung des vorherigen
  Ansatzes; nicht die Evidenzquelle dieses Plans.

## Architektur- und Prozessentscheidungen

- Die kanonische Bun-Version für Repository-Ausführungsumgebungen ist `1.3.14`.
  Eine globale lokale Bun-Installation wird nicht still verändert.
- `src/app/` bleibt Routing-Owner. Shopping-List-Fachlogik bleibt unter
  `src/features/shopping-list/`; lokale Daten, Outbox und Sync bleiben in ihren
  bestehenden Infrastruktur-Ownern.
- Backend-Schemaänderungen beginnen ausschließlich in
  `supabase/schemas/*.sql`. Es werden keine Migrationen von Hand geschrieben.
- Eine synchronisierte Shopping-List-Entität wird über lokalen SQLite-Spiegel,
  Outbox, Push, Pull, Realtime und Konfliktauflösung verfolgt, soweit ihr
  Vertrag diese Oberfläche verwendet.
- Accountwechsel werden als Lebenszyklusgrenze betrachtet: Session, Query-Cache,
  verschlüsselte Account-Speicherung, SQLite-Owner und Sync-Stopper müssen
  nachvollziehbar denselben Accountkontext besitzen.
- Neue Risiken werden nur mit konkreter Datei-/Test-Evidenz und einer klaren
  Korrekturgrenze als Beads angelegt.
- Vor Abschluss erfolgt eine Review nach Correctness, Readability, Architecture,
  Security und Performance mit `agent-skills:code-review-and-quality`.

## Task-Liste und Abhängigkeiten

### Stage 1: Arbeitsstand sichern

#### `fam-ymz7.4` — Arbeitsstand und Beads-Abgrenzung prüfen

Read-only-Bestandsaufnahme des aktuellen Git- und Beads-Zustands. Der relevante
Diff wird den bereits vorhandenen Änderungen zugeordnet, ohne fremde Dateien
anzupassen. Die vorhandenen Folge-Beads und ihre Abhängigkeiten werden
aufgenommen.

**Abhängigkeiten:** keine.

**Voraussichtliche Quellen:** Git-Status/-Diff, `bd show`, `bd list`,
`AGENTS.md`, `CONSTRAINTS.md`, `CONTEXT.md`.

### Stage 2: Bun-Toolchain vereinheitlichen

#### `fam-ymz7.6` — Bun-Toolchain auf 1.3.14 prüfen und verbleibende Drifts beheben

Alle aktiven Bun-Ausführungswege werden in `package.json`,
`.github/actions/setup-bun-env/action.yaml`, `.github/workflows/*.yml`,
`eas.json` und relevanter Entwicklerdokumentation abgeglichen. Veraltete oder
redundante Pins werden nur entfernt, wenn der Owner und die erwartete
Ausführung eindeutig sind. Die lokale CLI-Abweichung bleibt mit `fam-2oau`
getrennt.

**Abhängigkeit:** `fam-ymz7.4`.

**Voraussichtliche Quellen:** `package.json`, `bun.lock`, `eas.json`,
`.github/actions/setup-bun-env/action.yaml`, alle aktiven Bun-Workflows.

### Checkpoint A: Toolchain und Arbeitsstand

Nach Stage 1 und Stage 2 müssen Working-Tree-Scope, kanonische Bun-Quelle,
redundante Pins und die lokale CLI-Abweichung getrennt dokumentiert sein. Es
werden zu diesem Checkpoint keine fachlichen Shopping-List-Annahmen aus
früheren Reports übernommen.

### Stage 3: Einkaufslisten-Kernflow prüfen

#### `fam-ymz7.1` — Shopping-List-Kernpfad und Vertragslücken belegen

Der vertikale Laufzeitpfad wird aus aktuellen Ownern nachvollzogen:

```text
Route
  -> ShoppingListScreen
  -> Query-/Mutations-Hooks
  -> lokaler SQLite-Spiegel
  -> atomare Mirror-/Outbox-Transaktion
  -> Push
  -> Pull und Realtime
  -> Supabase-Schema und RLS
```

Der Abschluss eines Shopping Runs wird separat bewertet, weil er neben
Shopping-List-Zeilen auch Inventory, Transactions und lokale Historie berührt.
Atomarität, Reverse Actions, Offline-Parität, Fehlerbehandlung und
Synchronisationsgrenzen werden jeweils mit Code- oder Testbeleg bewertet.

**Abhängigkeit:** `fam-ymz7.4`.

**Voraussichtliche Quellen:**

- `src/app/(app)/shopping-list.tsx`
- `src/features/shopping-list/screens/shopping-list-screen.tsx`
- `src/features/shopping-list/hooks/`
- `src/features/shopping-list/preferences/save-shopping-item.ts`
- `src/lib/db/schemas/shopping.ts`, `src/lib/db/outbox.ts`,
  `src/lib/db/entities.ts`
- `src/lib/sync/{mirror-write,push,pull,realtime,sync-runner}.ts`
- `supabase/schemas/08_inventory.sql` und zugehörige pgTAP-Tests
- fokussierte Shopping-List-, SQLite-, Outbox- und Sync-Tests

#### `fam-ymz7.10` — checkedItems/transfers-Bijektion planen

Der Stage-3-Nachweis belegt, dass `use-complete-shopping-run.ts` Transfers
optional zuordnet und dadurch `checkedItems` ohne Transfer akzeptiert. Der
kleine Planungsbead definiert ausschließlich den reinen Validatorvertrag und
die Write-Grenze; Restore, Reverse, Receipt, Pull, Realtime, Outbox-Retention,
CAS, RLS und Forward-Atomarität sind ausdrücklich ausgeschlossen.

Die freigegebene Umsetzung liegt in `fam-ymz7.18`. `fam-ie54` konsumiert den
Validator später für den Forward-Run, ist aber keine Dependency dieses kleinen
Validators und wird nicht dupliziert.

**Abhängigkeit:** `fam-ymz7.1`.

#### `fam-ymz7.11` — Shopping-List-SectionList gegen FlashList-Vertrag prüfen

Der Stage-3-Review belegt eine produktive `SectionList` in
`src/features/shopping-list/screens/shopping-list-screen.tsx`, obwohl der
Projektvertrag `FlashList` als alleinige virtualisierte Listenlösung nennt.
Dieser Planungsbead gleicht die konkrete Section-/Scroll-Struktur mit dem
Vertrag ab und legt danach als separaten Umsetzungsschritt entweder eine
begründete Migration oder eine explizite Ausnahme mit Performance-Nachweis
fest.

Keine blinde UI-Migration und keine vorweggenommene Änderung an der
bestehenden UI: `.11` bleibt die eigenständige Listen-/Performance-Planung;
ihre spätere Umsetzung bleibt aber eine eigene Stage-5-Ausgangsvoraussetzung
und wird nicht mit `fam-ymz7.10` oder `fam-ymz7.18` vermischt.

**Abhängigkeit:** `fam-ymz7.1`.

### Stage 4: Kritische Sync- und Auth-Grenzen prüfen

#### `fam-ymz7.2` — Auth- und Sync-Ownership-Grenzen evidenzbasiert prüfen

Accountwechsel und Sync-Lebenszyklus werden als zusammenhängende Ownership-
grenze geprüft. Die Reihenfolge von Session-Änderung, Query-Cache, verschlüsseltem
Account-Storage, SQLite-Owner-Wechsel und Sync-Stopper wird gegen Tests und
Produktionscode gehalten. Push, Pull, Realtime und Konfliktlogik werden auf
eindeutige Owner und konkurrierende Seiteneffekte geprüft.

Nur Risiken mit beobachtbarem Verhalten werden als neue Beads angelegt. Die
separate Auth-Spezifikation `fam-ya7p` wird nicht stillschweigend umgesetzt.

Die Stage-4-Reviewkorrektur dokumentiert zwei konkrete P1-Sync-Risiken:

- `src/lib/sync/pull.ts`: Der Cursor-Fortschritt ist an eine Entity statt an
  den Household-Scope gebunden. Beim Beitritt oder Wechsel eines Haushalts
  können ältere gültige Remote-Zeilen mit einem zu weit fortgeschrittenen
  Cursor übersprungen werden. Die separate Korrektur ist in `fam-ymz7.17`
  verknüpft.
- `src/lib/sync/mirror-write.ts`: Eine eingehende Realtime-Zeile wird bei
  einer cleanen lokalen Mirror-Zeile ohne expliziten Aktualitätsvergleich
  übernommen. Ein verspätetes Remote-Event kann dadurch einen neueren lokalen
  Stand überschreiben. Die separate Korrektur ist in `fam-ymz7.16` verknüpft.

Beide P1-Risiken bleiben eigenständige Sync-Folgearbeiten und werden nicht in
die Stage-4-Dokumentationskorrektur eingeschoben. Sie gehören aber zum
Stage-5-Abschlussgate. `fam-ya7p`, `fam-ya7p.1` und `fam-ya7p.2` bleiben der
getrennte Auth-/Secure-Storage-Strang.

**Abhängigkeit:** `fam-ymz7.1`.

**Voraussichtliche Quellen:**

- `src/features/auth/session-provider.tsx`, `src/features/auth/sign-out.ts`
- `src/lib/data/query-client.ts`
- `src/lib/storage/account-storage.ts` und SecureStore-Schicht
- `src/lib/db/{client,ownership,database-encryption}.ts`
- `src/lib/sync/{account-sync-gate,household-bootstrap-sync,sync-runner,
  push,pull,realtime}.ts`
- Auth-, Account-Isolation-, Ownership-, Sync-State- und Realtime-Tests

#### `fam-ymz7.15` — Stage-4-Reviewbefunde dokumentieren und verknüpfen

Dieser Korrekturbead aktualisiert ausschließlich diesen Plan und die Notes von
`fam-ymz7.2` und `fam-ymz7.15`. Er hält die beiden konkreten P1-Risiken mit
ihren Produktionspfaden fest und verknüpft `fam-ymz7.16` für verspätete
Realtime-Zeilen in `src/lib/sync/mirror-write.ts` sowie `fam-ymz7.17` für den
Household-Pull-Cursor in `src/lib/sync/pull.ts`.

Stage 5 wartet auf diese Nachweiskorrektur und die bestehenden Stage-2- und
Stage-3-Voraussetzungen. Die Folge-Fixes `.16` und `.17` bleiben eigenständige
reviewbare Beads, sind aber zusätzlich zum Stage-5-Abschluss erforderlich;
Beads bleiben die einzige Live-Statusquelle.
Die Korrektur verändert weder Produktionscode, Sync-Logik, Schema/Migrationen
noch fremde Working-Tree-Dateien.

### Checkpoint B: Vertrag und Evidenz

Nach Stage 3 und Stage 4 müssen für jede behauptete Abweichung folgende Felder
vorliegen: betroffener Owner, verbindliche Vertragsstelle, beobachtbares
Ist-Verhalten, reproduzierbarer Test oder lokaler Nachweis, Risiko und kleinste
Korrekturgrenze. Unbelegte Vermutungen werden aus der Aufgabenliste entfernt.

### Stage 5: Priorisierte Korrekturen umsetzen

#### `fam-ymz7.5` — Kleine belegte Toolchain- oder Vertragsabweichungen umsetzen

Erst nach der Prüfung von Stage 2 bis 4 und nach menschlicher Bestätigung der
Planrichtung werden die belegten Korrekturen umgesetzt. Kleine Toolchain-
Korrekturen können direkt erfolgen; größere fachliche oder architektonische
Änderungen erhalten eigene Beads und eine separate Planung. Jede
Verhaltensänderung erhält einen fokussierten Test oder aktualisiert eine
bestehende, beobachtbare Abnahme.

**Abhängigkeiten:** `fam-ymz7.6`, `fam-ymz7.1`, `fam-ymz7.2`, `fam-ymz7.15`.

Stage 5 bleibt bis zur Umsetzung und Verifikation aller übernommenen
Folgebeads offen. Dazu gehören mindestens `.18`, `.11`, `.16`, `.17`,
`fam-ie54`, `fam-gng6` und `fam-jlkw`; die konkreten Abhängigkeiten stehen
zusätzlich im Beads-Graphen. Separate Beads verhindern dabei nur einen
vermischten Diff, nicht die Stage-5-Abschlussbedingung.

**Mögliche Dateiscope:** Nur aus den evidenzbasierten Befunden, insbesondere
Toolchain-Konfiguration, Shopping-List-Owner, lokaler DB-/Outbox-Grenze,
Auth-Lifecycle oder Sync-Owner. Keine pauschale Ausweitung auf die gesamte
Codebase.

### Stage 6: Verifikation und Review

Stage 6 ist die abschließende Gesamtprüfung. Sie darf erst geschlossen werden,
wenn Stage 5 geschlossen ist und alle übernommenen Folgebeads ihre eigenen
Reviews und Verifikationsgates bestanden haben. Die bisherige Stage-6-Prüfung
bleibt als Baseline-Nachweis erhalten und ersetzt diese Abschlussprüfung nicht.

#### `fam-ymz7.3` — Multi-Achsen-Review und gezielte Verifikation abschließen

Die tatsächlich geänderten Dateien werden entlang der fünf Review-Achsen
geprüft:

- **Correctness:** Vertrag, Fehlerpfade, Atomarität, Retry und Race-Verhalten.
- **Readability:** klare Owner, Benennungen und kein unnötiger Kontrollfluss.
- **Architecture:** Abhängigkeitsrichtung, keine neuen Duplikate oder
  fachliche Logik in Shared-/Infrastruktur-Ownern.
- **Security:** Session-/Account-Isolation, Eingangsvalidierung, RLS und keine
  Secrets oder unsicheren SQL-Pfade.
- **Performance:** keine unbeschränkten Abfragen, N+1-Muster oder unnötige
  Cache-/Sync-Arbeit.

**Abhängigkeit:** `fam-ymz7.5`.

**Gezielte Gates:**

- `bun run check` für den betroffenen Scope beziehungsweise den nach
  Projektkonvention erforderlichen Quellbestand.
- `bun run typecheck`.
- `bun run test -- src/features/shopping-list/domain/shopping-run-contract.test.ts src/features/shopping-list/domain/shopping-list-restore.test.ts src/lib/sync/pull.shopping-run.test.ts src/lib/sync/realtime.shopping-run.test.ts --runInBand --watchman=false`; niemals `bun test`.
- Für Änderungen am lokalen SQLite-Contract zuerst exakt `bun run db:local:generate`.
  Erwartet werden die von Drizzle Kit erzeugten Artefakte unter
  `drizzle/local/<timestamp>_<name>/migration.sql`,
  `drizzle/local/<timestamp>_<name>/snapshot.json` sowie die aktualisierte
  `drizzle/local/migrations.js`; diese Dateien werden nicht von Hand editiert.
- Der verpflichtende Integration-Preflight gehört der konkreten bestehenden
  Funktion `resolveSupabaseEnv` in `test/setup-integration.js` (bei einer
  späteren Extraktion bleibt `test/integration-preflight.js` ihr benannter
  Owner). Sie muss fail-closed vor dem Jest-Start eine lokale URL verlangen,
  deren Host exakt `127.0.0.1` oder `localhost` ist und deren Port erreichbar
  ist. Fehlende lokale URL, fehlender oder nicht erreichbarer Port, linked-
  oder Remote-URL sowie jeder Host außerhalb dieser beiden Werte beenden den
  Lauf sofort mit einem klaren Fehler. `.env.development` und
  Prozessvariablen dürfen niemals als Remote-/linked-Fallback dienen; eine aus
  ihnen gelesene URL ist höchstens ein Kandidat und wird denselben lokalen
  Prüfungen unterworfen. Der Reject-Test ist
  `test/integration-preflight.test.js` und deckt missing-local, Remote-URL,
  fremden Host, fehlenden Port und nicht erreichbaren lokalen Port ab; ein
  erreichbarer `http://127.0.0.1:<port>`- oder `http://localhost:<port>`-Fall
  ist der Positivtest.
- Stage 6 führt zuerst exakt `node --test test/integration-preflight.test.js`
  aus. Erst bei bestandenem Reject-/Positiv-Preflight läuft der exakte lokale
  Integration-Gate-Aufruf
  `bun run test:integration -- src/lib/db/outbox.integration.test.ts src/lib/db/shopping-list-restore.integration.test.ts src/lib/db/shopping-run-lost-response.integration.test.ts`.
  Der Standard-Jest-Lauf ignoriert `*.integration.test.ts` und
  `*.integration.test.tsx` ausdrücklich; diese Dateien werden nur über
  `jest.integration.config.js` und den expliziten `test:integration`-Aufruf
  ausgeführt. Falls die Pfade noch nicht existieren, sind sie als geplante
  zukünftige Gates zu dokumentieren, nicht als aktuell grüne Tests.
- Diese fokussierte Shopping-Run-Jest-Abnahme muss Strict-Unit-Vektoren für jeden
  Alias, trim/lowercase, missing/empty/
  unknown mit P0005, nur g<->kg und ml<->l mit Faktor 1000 sowie
  `recipe_names` null/undefined -> `[]`, Unicode-Codepoint-Sortierung und
  erhaltene Duplikate abdecken.
- Das geprüfte `package.json`-Script `test:db` hängt immer
  `supabase/tests/*.test.sql` an und kann deshalb keine einzelne Datei
  fokussieren; `bun run test:db -- supabase/tests/10_shopping_runs.test.sql`
  ist ausdrücklich kein gültiger Gate-Aufruf. Nach
  `bash scripts/check-clean-db.sh --check-only` ist der fokussierte lokale
  pgTAP-Gate daher exakt
  `supabase test db --local supabase/tests/10_shopping_runs.test.sql`.
  Alternativ darf vor der Umsetzung ein kleines fokussierbares
  `test:db:focused`-Script ergänzt werden, aber niemals ein irreführender
  Glob-Aufruf. Der DB-Preflight muss localhost/127.0.0.1 belegen und Remote-
  oder linked-Ziele ausschließen.
- Bei Supabase-Schemaänderungen: deklarativer DB-Workflow, relevante pgTAP-
  Tests, Advisors, `bun run db:types` und leerer `db:diff`; außerdem
  `bun run db:local:generate` für den lokalen Drizzle-Spiegel. Die
  Projektion, RPC-/CAS-/Provenienztests, Restore-Receipt-/Lost-Ack-Tests,
  RLS-/Privilege-Tests und die exakten Rollenprüfungen sind geplante/future
  Nachweise, falls die benannten Dateien noch fehlen.
- `git diff --check` und abschließende `git status --short --branch`.

Ein bekannter projektweiter TypeScript-Baselinefehler wird von neu eingeführten
Fehlern getrennt ausgewiesen. Ein grüner Einzeltest allein gilt nicht als
Abnahme.

### Checkpoint C: Abschluss

Der Abschlussbericht enthält den tatsächlichen Diff-Scope, Reviewbefunde nach
Schweregrad, ausgeführte Gates, Beads-Status, verbleibende Risiken und eine
klare Übergabe. Beads werden erst geschlossen, wenn ihre Akzeptanzkriterien und
Nachweise tatsächlich erfüllt sind.

## Risiken und Gegenmaßnahmen

| Risiko | Auswirkung | Gegenmaßnahme |
| --- | --- | --- |
| Ein bestehender Diff wird fälschlich als neue Änderung behandelt | fremde Arbeit könnte überschrieben oder falsch bewertet werden | Stage 1 als Baseline; keine Wiederherstellung oder pauschale Bereinigung |
| Lokale Bun-Version weicht vom Repository-Pin ab | lokale Ergebnisse sind nicht reproduzierbar | Repository-Pin und lokale CLI getrennt prüfen; `fam-2oau` für die lokale Entscheidung |
| Shopping-Run verteilt zusammengehörige Writes auf mehrere Transaktionen | Teilzustände bei Fehlern oder Retry | bestehende `fam-ie54`-Evidenz prüfen; Korrektur separat und atomar planen |
| SQLite-Lesefehler werden als leerer Zustand dargestellt | Datenverlust wird dem Nutzer als gültiger Zustand gezeigt | `fam-gng6` nur nach aktuellem Reproduktionsbeleg weiterführen |
| Serverhistorie erlaubt Update/Delete trotz Append-only-Vertrag | Historie kann fachlich verändert werden | `fam-jlkw` gegen aktuelles Schema und pgTAP prüfen |
| Auth-/Sync-Prüfung vermischt Spezifikation mit Ist-Verhalten | unbelegte Architekturänderungen | `fam-ya7p` getrennt halten und nur belegte Risiken anlegen |
| Verspätete Realtime-Zeile überschreibt in `src/lib/sync/mirror-write.ts` einen neueren lokalen Stand | lokaler Mirror-Zustand kann zurückspringen | `fam-ymz7.16` separat mit Aktualitäts-/Realtime-Tests korrigieren |
| Entity-Cursor in `src/lib/sync/pull.ts` überspringt beim Household-Wechsel ältere Remote-Zeilen | gültiger Household-Bestand fehlt nach Pull oder Bootstrap | `fam-ymz7.17` separat mit Scope-/Cursor-Tests korrigieren |
| Review beschränkt sich auf grüne Tests | Sicherheits- oder Architekturregressionen bleiben unentdeckt | verpflichtende Fünf-Achsen-Review vor Abschluss |

## Offene Entscheidungen

- Für die lokale Erzwingung oder Prüfung von Bun `1.3.14` muss vor der
  Umsetzung von `fam-2oau` der im Projekt gewünschte Version-Manager bzw.
  Setup-Weg festgelegt werden. Eine globale Installation wird nicht durch
  diesen Plan verändert.
- Ob eine im aktuellen Working Tree bereits vorhandene Konfigurations- oder
  Dokumentationsänderung behalten wird, entscheidet Stage 2/3 anhand der
  Vertrags- und Review-Evidenz; der Plan behandelt sie bis dahin als Bestand,
  nicht als automatisch freigegebenes Ergebnis.
