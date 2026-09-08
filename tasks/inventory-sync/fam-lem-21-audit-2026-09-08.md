# fam-lem.21-Vertragsaudit: Funde und Entscheidungen (2026-09-08/09)

Dieses Dokument hält den Ablauf, alle Funde und die dazu getroffenen
Entscheidungen der fam-lem.21-Session fest, damit sie nicht nur verstreut in
Beads-Notizen stehen. Referenzen: `contract.md`, `CONSTRAINTS.md`,
`execution-plan.md`. Der zugehörige Implementierungsplan liegt unter
`/Users/marco/.claude/plans/staged-munching-rabin.md` (lokal, nicht im Repo).

## 1. Ausgangslage

Nach Abschluss von fam-lem.30 (Integer-Tausendstel-Persistenz) und fam-lem.27
(lokaler Schreibpfad konsolidiert) war fam-lem.21 die vorgesehene
Abschlussprüfung: "Inventory-v1 abschließend gegen den Vertrag abnehmen".

## 2. Audit-Ergebnis: v1-Canonical-Operation-Cutover ist NICHT aktiv

**Nachgewiesen (grün):**

- Alle 5 Löschkandidaten (`inventory-quantity-correction.ts`,
  `inventory-quantity-reversal.ts`, `inventory-move.ts`,
  `inventory-open-split.ts`, `inventory-open-merge.ts`) sind gelöscht, keine
  verbleibenden Imports (grep-Nachweis).
- Integer-Tausendstel-Persistenz ist über den gesamten fam-lem.30-Baum
  konsistent umgesetzt (lokal `integer`, Supabase `bigint`, alle Konsumenten
  inkl. `meal-planner`/`recipes`/`sync-debug-screen` konvertieren korrekt an
  ihrer jeweiligen Grenze).
- `bun run typecheck`, `bun run check`, `git diff --check` liefen zu diesem
  Zeitpunkt sauber.
- Stabile IDs/`unknown`/Footprint/Konfliktsemantik waren bereits durch
  fam-lem.20/.25/fam-onu/fam-n46 mit eigenen fokussierten Tests belegt.

**Nicht nachgewiesen (kritisch):**

`validateInventoryOperation`/`ALL_CANONICAL_OPERATION_TYPES`
(`src/features/inventory/inventory-lifecycle.ts`) haben **null Aufrufer**
außerhalb der eigenen Testdatei — reiner Typkörper, kein Laufzeitpfad
(fam-lem.19 hatte das explizit so geplant: "noch kein Runtime-Cutover"). Der
Live-Schreibpfad läuft weiterhin über die alten Operationsnamen
(`adjust_quantity`, `split_open`, `merge_undo_open`, `move`,
`correct_quantity`, `reverse_quantity`) über `sync/inventory-quantity.ts`.
`inventory_applied_operations` (Receipt-Tabelle) und
`read_inventory_sync_snapshot` (Snapshot-RPC) aus Contract Abschnitt 2.1
existieren serverseitig **nicht**.

Konkret drei Contract-Abschnitt-9-Verstöße gefunden (Legacy-Formen, die laut
Vertrag "im Produktionscode vollständig gelöscht" sein sollen):

| # | Verstoß | Fundstelle | Contract-Abschnitt |
|---|---|---|---|
| 1 | `transactions.type = 'open'` wird weiterhin geschrieben | `use-inventory-mutations.ts` (`useOpenInventoryItemMutation`, `useUndoOpenTransactionMutation`) | 2.8, 5.1 |
| 2 | `transactions.undone`-Spalte existiert weiterhin, wird bei jedem Insert gesetzt | `sync/inventory-quantity.ts`, `use-inventory-mutations.ts`, Schema (lokal + Supabase) | 2.7 |
| 3 | Freitext-Notes `[Split] origin=<id>` werden als Provenienz-Fallback geparst | `inventory-lifecycle.ts` (`getSplitOriginItemId`) | 9, Verlauf-Regel |

**Entscheidung (Marco, 2026-09-08):** Audit als solches dokumentieren statt
`fam-lem.21` fälschlich als "Vertrag erfüllt" zu schließen. Für die drei
Funde je ein Ticket anlegen, `fam-lem.21` bleibt offen und durch sie
blockiert.

→ Tickets: `fam-lfa` (Legacy-Ledgerform 'open'), `fam-mt6` (`undone`-Spalte),
`fam-8sf` (Freitext-Provenienz).

## 3. Review des Audits selbst (code-review-and-quality)

Auf Wunsch wurde das eigene Audit-Ergebnis noch einmal five-axis-geprüft.
Ergebnis: **Approve mit zwei Nacharbeiten**, keine davon ein Blocker:

1. **Architekturfund:** `fam-lfa` und `fam-8sf` ändern denselben Code
   (Open-/Split-Undo-Pfad) und bedingen sich gegenseitig — der
   Freitext-Fallback existiert nur wegen der zu reversierenden
   `open`-Ledgerzeile. Als getrennte, unverlinkte Tickets angelegt zu haben
   war ein Fehler.
2. **Prozessfund:** Keinem der drei neuen Tickets lag eine "Verify"-Zeile mit
   konkretem fokussiertem Testbefehl bei, wie `execution-plan.md` das für
   jedes Inkrement verlangt.

**Entscheidung:** Beide Punkte im nachfolgenden Plan aufgegriffen statt
separat nachgetragen.

## 4. Plan (plan mode, genehmigt)

Vollständiger Plan unter `/Users/marco/.claude/plans/staged-munching-rabin.md`.
Kernentscheidung: `fam-lfa` und `fam-8sf` als **eine** zusammenhängende
Slice A behandeln (statt getrennt), `fam-mt6` bleibt als Slice B unabhängig.
Wichtige Korrektur gegenüber der ursprünglichen `fam-mt6`-Ticketbeschreibung:
`transactions.undone` ist **kein toter Code**, sondern eine aktiv gelesene,
aber redundante Guard-Variable — jede Leseslelle prüft sie parallel zu einer
äquivalenten `reversal_of`/`has_reversal`-Prüfung. Entfernen erfordert daher
Ersatzabfragen, kein reines Löschen.

Beads-Abbildung nach Freigabe: `fam-lfa.1`–`.4` (A1–A4), `fam-mt6.1`–`.2`
(B1–B2), `fam-8sf` als "gelöst durch fam-lfa.2" geschlossen.

## 5. Umsetzung A1: gestrichen

Beim Start von A1 (geplante neue `useResealInventoryItemMutation`) zeigte
sich: die Fähigkeit existiert **bereits** als generischer Metadaten-Patch
über die bestehende `useUpdateFridgeItemMutation`
(`patch: { opened_at: null, expiry_user_set: true }`), belegt durch den
schon vorhandenen Test *"behandelt manuelles Wieder-Versiegeln ohne
künstliche Mengenbuchung"* (`use-inventory-mutations.test.tsx:757`). Eine
neue dedizierte Mutation wäre eine zweite ähnliche Funktion für dieselbe
fachliche Entscheidung gewesen (CONSTRAINTS-Verstoß).

**Entscheidung (Marco):** `fam-lfa.1` als überflüssig schließen, direkt mit
A2 weitermachen.

## 6. Umsetzung A2: `open_inventory` ledgerfrei machen

### 6a. Scope-Frage: Payload-Umbenennung ja/nein?

`createInventorySplitMutation`s Payload trägt ein Pflichtfeld
`transaction_id`, obwohl `open_inventory` laut Contract Abschnitt 4/9.1 keine
`transaction_id` unter seinen stabilen IDs hat (nur `operation_id`,
`source_item_id`, optional `opened_item_id`) — die Ledgerzeile soll komplett
entfallen, nicht nur leer sein. Eine vollständige Lösung hätte `push.ts`
(Wire-Serialisierung) und den Server-RPC mitgezogen, was über die für A2
vorgesehenen 4 Dateien hinausreicht.

**Entscheidung (Marco):** Nur den lokalen Ledger-Insert stoppen
(`transaction`-Parameter optional machen), Payload-Feldname `transaction_id`
bleibt vorerst bestehen. Der Wire-Vertrag-Umbau wird als eigenes Ticket mit
Spec-Pflicht ausgelagert.

→ Neues Ticket: **`fam-lfa.5`** (Payload/Wire-Vertrag auf `open_inventory`
umbenennen), P2, verbindlich mit Spec-Durchlauf vor Umsetzung.

### 6b. Umsetzung

- `sync/inventory-quantity.ts`: `createInventorySplitMutation`s
  `transaction`-Parameter optional gemacht; Ledger-Insert wird übersprungen,
  wenn keiner übergeben wird.
- `use-inventory-mutations.ts`: `useOpenInventoryItemMutation` übergibt für
  beide Zweige (In-Place, Split) keine Ledger-Transaktion mehr; die dadurch
  toten Helfer `transactionPayloadFromPlan` und die lokale `transaction`-
  Variable entfernt; ungenutztes `actor` in `useOpenInventoryItemMutation`
  entfernt (Biome-Fund).

### 6c. Testbehandlung: nicht löschen, sondern parallel dokumentieren

**Wichtige Korrektur während der Umsetzung (Marco-Anweisung):** Contract und
CONSTRAINTS verlangen "keine gelöschten Tests". Statt betroffene Tests zu
löschen oder ihre Erwartung stillschweigend zu ändern, gilt für diese Session:

- Tests, die eine jetzt bewusst entfallene Legacy-Erwartung prüfen (z. B.
  "es gibt eine `open`-Ledgerzeile"), bleiben **unverändert im Code stehen**
  und laufen bewusst rot.
- Für jede so betroffene Fähigkeit kommt ein **neuer, paralleler Test** dazu,
  der die aktuell korrekte Erwartung prüft.
- Damit geht keine Testabdeckung verloren, und der Diff zeigt ehrlich, was
  sich geändert hat, statt eine alte Erwartung zu überschreiben.

Fünf so behandelte Fälle (Integrationstest):

| Alter Test (bleibt, bewusst rot) | Neuer Test (grün) |
|---|---|
| `open quantity=1 aktualisiert den Bestand in-place und speichert das alte MHD` | `open quantity=1 erzeugt keine Ledgerzeile mehr (fam-lfa.2)` |
| `open quantity>1 splittet, bewahrt die Gesamtmenge...` | `open quantity>1 erzeugt beim Split keine Ledgerzeile mehr (fam-lfa.2)` |
| `Undo einer in-place-Öffnung stellt den Vorzustand her...` | — (Ersatzabdeckung existiert bereits: "Wieder versiegeln"-Test) |
| `führt Split-Undo bei einer zwischenzeitlich geänderten Ursprungszeile...` | — (kein Ersatz möglich vor fam-lfa.6, siehe unten) |
| `führt Split-Merge über den generischen Undo-Hook aus...` | — (kein Ersatz möglich vor fam-lfa.6, siehe unten) |

Gleiches Muster im Unit-Test (`use-inventory-mutations.test.tsx`):
`bucht Öffnen, Wegwerfen und Verschieben jeweils mit Actor` bleibt
unverändert (rot), `bucht beim Öffnen keine Ledgerzeile, bei Wegwerfen und
Verschieben weiterhin mit Actor` deckt denselben Ablauf unter dem neuen
Vertrag ab.

### 6d. Regression gefunden und zurückgenommen: Freitext-Fallback-Entfernung

Der ursprüngliche `fam-lfa.2`-Scope umfasste auch, `getSplitOriginItemId`
den Freitext-Notes-Fallback zu nehmen (fam-8sf). Nach Entfernung schlug
`schließt Split-Undo im Merge-Fallback nachvollziehbar ab...` fehl: der Test
simuliert absichtlich mehrdeutige Altdaten (`open`-Transaktion nur mit
Freitext-Notes, ohne `origin_item_id`), um zu prüfen, dass **kein** Merge
passiert. Ohne jede Provenienzquelle interpretierte der Code das nun
fälschlich als reines In-Place-Öffnen und stellte das geöffnete Los
versehentlich in-place wieder her — eine echte Sicherheitsregression, kein
gewollter Verhaltenswechsel.

**Entscheidung (Marco):** `getSplitOriginItemId`-Änderung zurücknehmen,
Freitext-Fallback bleibt bestehen, bis `fam-lfa.6` eine echte typisierte
Alternative liefert. `fam-8sf` wieder geöffnet (fälschlich als gelöst
markiert gewesen) und hängt jetzt von `fam-lfa.6` ab.

### 6e. Nebenfund: Mock-Leck zwischen Tests

`use-inventory-mutations.test.tsx`s `beforeEach` nutzte
`jest.clearAllMocks()`, das laut Jest-Semantik `mock.calls`/`mock.instances`
zurücksetzt, aber **nicht** eine offene `mockReturnValueOnce`-Warteschlange.
Bricht ein Test vorzeitig ab (z. B. der jetzt bewusst rot stehende
Ledger-Test), bleiben seine unverbrauchten `mockReturnValueOnce`-Werte für
`Crypto.randomUUID` in der Warteschlange und werden vom **nächsten** Test
konsumiert — sichtbar als scheinbar unmotivierte ID-Vertauschungen in zwei
eigentlich unbeteiligten Tests. Behoben durch gezielten
`jest.mocked(Crypto.randomUUID).mockReset()` (nicht global
`resetAllMocks()`, das hätte auch die modulweiten `getDatabase`-Mocks aus
der `jest.mock(...)`-Factory zerstört).

## 7. Neuer Fund während A3-Vorbereitung: fehlende Split-Provenienz-Spalte

`origin_item_id`/`origin_quantity` existieren ausschließlich als Spalten auf
`transactions`, mit Check-Constraint
`origin_item_id is null or type = 'open'` (`supabase/schemas/08_inventory.sql`
Zeile ~121–126) — **explizit an die jetzt entfernte `open`-Ledgerzeile
gekoppelt**. Ohne diese Zeile gibt es aktuell **keinen Ort**, an dem ein neu
gesplittetes, geöffnetes Los seine Herkunft dauerhaft speichert. Das betrifft
ausschließlich den Split-Fall — der In-Place-Fall ("Wieder versiegeln")
funktioniert unverändert über den bestehenden Metadaten-Patch, ganz ohne
Ledger oder Provenienz.

**Entscheidung (Marco):** Nicht sofort mitlösen (wäre Schema-Umbau mitten in
einem als "4 Dateien, lokal" freigegebenen Schritt). Eigenes Ticket mit
Spec-Pflicht.

→ Neues Ticket: **`fam-lfa.6`** (Split-Provenienz-Spalte auf `fridge_items`),
P1, blockiert `fam-lfa.3` (A3, Undo-Pfad) und `fam-8sf`.

## 8. Aktueller Beads-Stand (Stand 2026-09-09)

```
fam-lem.21 (offen, wartet auf fam-lfa + fam-mt6)
├── fam-lfa (Legacy-Ledgerform 'open' entfernen)
│   ├── fam-lfa.1  ✓ geschlossen (überflüssig, existiert schon)
│   ├── fam-lfa.2  ✓ geschlossen (Ledger-Entfernung umgesetzt, Fallback-Teil zurückgenommen)
│   ├── fam-lfa.3  offen, hängt an fam-lfa.6 (nur noch Split-Merge-Fall offen)
│   ├── fam-lfa.4  offen, hängt an fam-lfa.3 (Server-RPCs)
│   ├── fam-lfa.5  offen (Payload/Wire-Vertrag umbenennen, Spec-Pflicht)
│   └── fam-lfa.6  offen (Split-Provenienz-Spalte, Spec-Pflicht) — neuer kritischer Pfad
├── fam-mt6 (undone-Spalte entfernen)
│   ├── fam-mt6.1  offen (Guard-Checks auf Reversal-Existenz umstellen)
│   └── fam-mt6.2  offen, hängt an fam-mt6.1 (Spalte deklarativ entfernen)
└── fam-8sf (Freitext-Split-Provenienz ersetzen) — wieder geöffnet, hängt an fam-lfa.6
```

## 9. Nachweise (Stand nach fam-lfa.2)

- `use-inventory-mutations.integration.test.tsx`: 27/32 grün (5 bewusst rot,
  siehe Tabelle oben)
- `use-inventory-mutations.test.tsx` + `inventory-lifecycle.test.ts`: 82/83
  grün (1 bewusst rot)
- `bunx biome check` (5 betroffene Dateien): sauber
- `bun run typecheck`: 0 Fehler
- `git diff --check`: sauber

## 10. Offene nächste Schritte

1. `fam-lfa.6` (Split-Provenienz-Spalte) — kritischer Pfad, blockiert
   `fam-lfa.3`, `fam-lfa.4`, `fam-8sf`. Verbindlich: Spec-Durchlauf vor Code.
2. `fam-lfa.5` (Payload/Wire-Vertrag umbenennen) — unabhängig startbar,
   ebenfalls Spec-Pflicht.
3. `fam-mt6.1`/`.2` (undone-Spalte) — unabhängig von A, kann parallel laufen.
4. Erst wenn `fam-lfa` und `fam-mt6` vollständig geschlossen sind, ist
   `fam-lem.21` ehrlich abschließbar.
