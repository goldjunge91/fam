# Inventory Operations Contract

Status: von Marco am 2026-09-08 gemeinsam mit Dateimatrix und Ausführungsplan zur schrittweisen Umsetzung freigegeben.
Letzte Festlegung: 2026-09-08

Dieses Dokument ist die einzige maßgebliche Quelle für fachliche Lifecycle-Zustände
und die technische Ausführung der Inventory-Operationen.

Quellenrang: `CONSTRAINTS.md` setzt die Qualitätsgrenzen; dieser Vertrag setzt
das Zielverhalten; `execution-plan.md` setzt die Reihenfolge. Beads verfolgt
Arbeit und Nachweise. Die früheren Funktionsverträge in `fam-lem.18` und
Folgetickets sind historische Ausgangslage, insbesondere ihre Legacy-Pflicht
und eigenständigen Split-/Open-Ledgerpfade. Sie sind keine parallele normative
Quelle. Implementiert wird nach diesem freigegebenen Zielvertrag.
Dokumentfreigabe und Implementierungsnachweis
sind getrennt; vorhandene grüne Tests belegen nicht automatisch das neue Modell.

## 1. Begriffe

- **Fachliche Aktion:** eine Benutzerabsicht.
- **Operation:** ihre vollständige lokale und serverseitige Ausführung.
- **Operation-ID:** stabiler Idempotenzschlüssel der Aktion.
- **Attempt:** ein Übertragungsversuch derselben Operation.
- **`entity_id`:** technischer Outbox-Anker, nie der Operationsumfang.
- **Ledger-ID:** stabile ID genau einer Ledgerzeile.
- **Lot-ID:** stabile ID eines Bestandsloses, auch als Tombstone.
- **Footprint:** alle gelesenen, veränderten, erzeugten, restaurierten oder
  tombstoned Lose und Ledgerzeilen einer Operation.
- **Struktureffekt:** Losänderung innerhalb einer Operation, keine eigene
  Benutzeraktion und keine Ledgerbewegung.
- **Unbekannter Ausgang:** der Client weiß nicht, ob der Server committed hat.
- **Reconciliation:** bestätigte Serverbasis plus noch nicht enthaltene offene
  Operationen, ohne doppelte Wirkung.
- **Owner:** einziges Produktionsmodul, das eine fachliche Regel entscheidet.
- **Abhängige Operation:** eine nachfolgende Mutation auf einem Los oder dessen
  Ledgerzeilen (z. B. weiterer Verbrauch, Move, Korrektur). Ein Undo
  (`reverse_quantity` oder `merge_undo_open`) wird mit
  `DEPENDENT_MUTATION_EXISTS` blockiert, wenn auf dem betroffenen Los (oder dem
  geöffneten Restlos) seit der Originaloperation eine weitere Transaktion im
  Ledger existiert ODER die Losmenge von der erwarteten Restmenge abweicht
  (`current_quantity != expected_remainder`).
- **Ausführungsnachweis:** ein mit allen Wirkungen atomar gespeicherter
  Datensatz in `inventory_applied_operations` für jede Operation, auch ohne
  Ledger. Er enthält den vollständigen normalisierten Request und das
  ursprüngliche Ergebnis gemäß Abschnitt 2.1. Die bestehende Ledgertabelle
  heißt `public.transactions`; sie wird nicht in `inventory_transactions`
  umbenannt und ist kein zweiter Idempotenz-Owner.
- **Mengenbasis:** Persistenz erfolgt immer ganzzahlig (in Tausendsteln) in der
  Basis-`unit` des Loses (z. B. 300 g oder 1 Stück). Verpackungseinheiten
  (z. B. „0,6 Dose“) sind reine UI-Berechnungsgrößen basierend auf
  `package_size` und werden niemals als Bruchzahl persistiert.
- **Öffnungsanteil P:** die diskrete Packungsmenge $P$, die bei einem
  Teilverbrauch aus einem versiegelten Bestand geöffnet wird. Wird primär aus
  `package_size` bestimmt ($P = \text{package\_size}$). Bei Stückgut gilt
  $P = 1$; bei Losen ohne Packungsgröße (lose Ware) gilt $P = C$ (reiner
  Verbrauch). Der Nutzer wählt $P$ nicht manuell, außer er wählt ausdrücklich
  „1 Packung anbrechen“.
- **CAS-Anker:** Compare-and-Set-Erwartungswert. Für Metadaten-Patches:
  `expected_updated_at` (ISO-Timestamp). Für Mengenänderungen:
  `expected_quantity` (Tausendstel). Stimmt der Serverzustand nicht
  überein $\rightarrow$ `STALE_BASE`.
- **Fehlercodes:** standardisierte maschinenlesbare Codes für Konflikte und
  Validierungsfehler: `STALE_BASE`, `INSUFFICIENT_QUANTITY`,
  `UNDO_WINDOW_EXPIRED`, `DEPENDENT_MUTATION_EXISTS`, `ID_PAYLOAD_MISMATCH`,
  `PAYLOAD_VALIDATION_FAILED`.
- **Uhrabweichung (Clock Drift):** Der Server toleriert
  $created\_at \le now() + 5\text{ Minuten}$. Bei größerer Zukunftsdifferenz
  erzwingt der Server $created\_at = now()$. Für das 24h-Undo-Fenster gilt
  $original.created\_at \le undo.created\_at < original.created\_at + 24\text{h}$.
- **`open_inventory`:** ausdrückliches Öffnen ohne Verbrauch und ohne Ledger.
- **`consume_inventory`:** eigentliche Benutzeroperation für jede Form des Verbrauchs.
- **`opens_remainder`:** Lifecycle- und Struktureffekt, wenn erstmals aus einem versiegelten Los teilweise verbraucht wird.
- **`reverse_consumption`:** reguläres Mengen-Undo einer Verbrauchsbuchung (als Teil von `reverse_quantity`).
- **`merge_undo_open`:** atomare strukturelle Undo-Variante, wenn die rückgängig gemachte Verbrauchsoperation das geöffnete Los erzeugt hatte.
- **`reseal_inventory`:** bewusste Lifecycle-Metadatenoperation ohne Ledger und ohne Merge.
- **`split_open`:** entfällt als eigenständige Mutation vollständig; Teilverbrauch ist ausschließlich `consume_inventory` (mit `opens_remainder`).

## 1.1 Fachliche Lifecycle-Zustände & Übergänge

1. **`versiegelt` (sealed):** Ungeöffnetes Packungs- oder Chargenlos (`opened_at = null`). `expiry_date` ist das versiegelte Mindesthaltbarkeitsdatum (MHD).
2. **`geöffnet` (opened):** Angebrochene Packung (`opened_at != null`). `expiry_date` ist das dynamisch berechnete oder manuell angepasste Verbrauchsdatum nach Öffnung.
3. **`vakuumiert` (vacuum_sealed):** Geöffnetes Los, das durch Vakuumieren verlängert haltbar gemacht wurde (`vacuum_sealed = true`). Modifiziert die Haltbarkeitsberechnung.
4. **`reseal` (wieder-versiegelt):** Manuelle Lifecycle-Aktion für wiederverschließbare Verpackungen. Setzt `opened_at = null` und stellt die versiegelte Haltbarkeitsbasis wieder her. Kein Ledger-Eintrag, kein Los-Merge.

Übergänge:
- `versiegelt` $\rightarrow$ `geöffnet`: via `consume_inventory` (mit `opens_remainder`), bei $C=0$ ausschließlich via `open_inventory` gemäß Abschnitt 5.1.
- `geöffnet` $\rightarrow$ `versiegelt`: nur via explizitem `reseal_inventory` (Metadaten-Patch) ODER via `merge_undo_open` (Undo des ersten Teilverbrauchs).
- `geöffnet` $\rightarrow$ `vakuumiert`: via Metadaten-Patch (`vacuum_sealed = true`, Haltbarkeitsverlängerung).
- `*` $\rightarrow$ `tombstoned`: `quantity = 0, deleted_at = now()` bei Vollverbrauch ($C = \text{source}$), Vollverderb ($W = \text{source}$) oder aufgelöstem Restlos beim Merge-Undo.

### Verlauf und Rezeptbezug

- `consume_inventory` akzeptiert optionale Felder `recipe_id`, `recipe_name`, `meal_plan_entry_id`.
- Rezeptbezüge bleiben typisierte Felder des gespeicherten Requests. Ledger-Notes dürfen eine lesbare Anzeige enthalten, werden aber niemals zur Rekonstruktion von Identität oder Provenienz geparst.
- Das Ledger bleibt auditierbar: Für jede Mahlzeit oder jedes Rezept lässt sich exakt nachvollziehen, welches Los wann verbraucht wurde.

### Fachliche Grenzen & Nicht-Ziele (Non-Goals)

- **Kein automatischer Reseal:** Schlägt ein `merge_undo_open` fehl (z. B. weil das Ursprungslos fehlt), wird das geöffnete Los **nicht** stillschweigend versiegelt, sondern die Operation bricht mit `STALE_BASE` ab.
- **Keine implizite Einheiten-Magie:** Ohne festen Packungssnapshot (`package_size`) wird niemals automatisch zwischen Stück/Packung und Gramm/Milliliter umgerechnet.
- **Kein Undo nach Folgemutation:** Ein Los mit nachfolgendem Verbrauch kann nicht auf den Vor-Verbrauchs-Zustand zurückgesetzt werden, ohne vorher die Folgemutationen zurückzunehmen.

## 2. Globaler Vertrag

Alle kanonischen Payloads tragen `contract_version = 1`.

1. Die Operation-ID entsteht einmal. Retries behalten Operations-, Ledger- und
   Lot-IDs sowie denselben fachlichen Payload.
2. Gleiche ID und gleicher Payload liefern das frühere Ergebnis ohne zweite
   Wirkung. Gleiche ID und anderer Payload ergeben einen Konflikt.
3. Bestand, Ledger, Tombstones und Outbox werden lokal atomar geschrieben.
   Dieselbe vollständige Operation wird serverseitig atomar committed.
4. Timeout oder Antwortverlust bedeutet `unknown`, nicht `failed`. Die
   Operation bleibt mit denselben IDs offen.
5. Eine Operation wird erst entfernt, wenn ihr serverseitiger
   Ausführungsnachweis feststeht. Der sichtbare Entity-Zustand allein genügt
   nicht als Nachweis.
6. Pull, Realtime und Push-Ack verwenden denselben Reconciliation-Owner. Späte
   oder doppelte Antworten erzeugen keine zweite Wirkung.
7. Ledger ist append-only. Undo erzeugt Gegenbuchungen mit `reversal_of`; das
   Original bleibt unverändert; die veraltete Spalte `transactions.undone` entfällt.
8. Neue Ledgerzeilen verwenden nur `in`, `out` oder `waste`. `open` entfällt vollständig.
9. `created_at` wird bei der Benutzerabsicht einmal erfasst. Für das
   24-Stunden-Undo zählt der Zeitpunkt der Undo-Absicht, nicht ein späterer
   Push. Der Server leitet `actor` aus `auth.uid()` ab.
10. Form-, Auth-, Snapshot- und Constraint-Validierung erfolgt an der
    zuständigen Vertrauensgrenze. Fachliche Interpretation erfolgt nur beim
    benannten Owner.

Ergebnisse sind `applied`, `replayed`, `conflict` oder `invalid`. Nach einem
Verbindungsabbruch hält der Client zusätzlich `unknown`. Retry- und
Konfliktklassifikation verwenden maschinenlesbare Codes, keinen Freitext.

### 2.1 Standardisierter Server-Response-Envelope (fam-lem.23)

Jede fachlich entschiedene Mutation antwortet mit `operation_id`,
`contract_version: 1` und einem diskriminierten Ergebnis:

- `applied | replayed`: vollständiger gespeicherter Receipt mit Request,
  `actor_id`, `applied_at`, vollständigem Footprint und ursprünglichen
  Ergebniszeilen (Lose einschließlich Tombstones und Ledger).
- `conflict`: genau ein `OperationErrorCode`, keine Schreibwirkung.
- `invalid`: `PAYLOAD_VALIDATION_FAILED`, keine Schreibwirkung, kein
  automatischer Retry; Payload bleibt zur Diagnose in Quarantäne.

`OperationErrorCode` ist einer der in Abschnitt 1 aufgeführten Fehlercodes.
Auth-/Transportfehler sind keine erfundenen fachlichen Konflikte. `unknown`
ist ausschließlich ein lokaler Zustand ohne sichere Serverantwort.
`applied_at` ist der serverseitig innerhalb der Transaktion erfasste Zeitpunkt,
kein Commit-Ordnungsmarker. Ein Receipt beweist einen Commit erst, wenn er nach
Commit empfangen oder in einem konsistenten Read sichtbar wird.

#### Ein Ausführungsnachweis für alle Operationen

`inventory_applied_operations` besitzt genau diese Verantwortlichkeit:

| Feld | Vertrag |
| --- | --- |
| `operation_id` | global eindeutiger UUID-Primärschlüssel |
| `household_id`, `actor_id` | autorisierter Haushalt und serverseitig ermittelter Akteur |
| `request` | normalisiertes JSONB: Version, Operationsname, alle IDs, CAS-Werte, Zeit der Absicht, Patch, Mengen, Snapshots und optionale Fachfelder |
| `result` | unveränderliches ursprüngliches Ergebnis einschließlich vollständigem Footprint, Los- und Ledgerzeilen |
| `applied_at` | einmaliger Serverzeitpunkt der Erstausführung |

Der Vergleich erfolgt auf dem vollständigen normalisierten JSONB, nicht nur
auf ID, CAS oder einem Teilhash. Objekt-Key-Reihenfolge ist bedeutungslos;
fehlende Patchfelder und explizites `null` bleiben verschieden. Unbekannte
Felder werden abgewiesen. Abgeleitete Serverwerte ändern den gespeicherten
Originalrequest nicht. Attempts und Transportmetadaten gehören nicht hinein.

Serverablauf: Auth prüfen, Operation-ID transaktional serialisieren, Receipt
lesen, erst danach bei Erstausführung alle Lose in stabiler ID-Reihenfolge
sperren und Preconditions prüfen. Gleicher Request samt Akteur/Haushalt liefert
`replayed` mit dem ursprünglichen Ergebnis, auch nach späteren Änderungen.
Andere Absicht unter derselben ID liefert `ID_PAYLOAD_MISMATCH`. Parallele
identische Aufrufe prüfen den Receipt nach dem Warten erneut. Datenwirkung und
Receipt committen gemeinsam; ein Fehler rollt beides zurück. Ein Replay führt
keine heutige CAS- oder Undo-Zeitprüfung erneut aus.

Receipts sind für Mitglieder ihres Haushalts per RLS lesbar; direkte
Client-Schreibrechte sind verboten. Der autorisierte Mutationspfad besitzt
allein das Schreibrecht. Die deklarative Umsetzung muss RLS und Privilegien
mit pgTAP nachweisen. Receipts werden innerhalb eines bestehenden Haushalts
nicht zeitgesteuert gelöscht, da die Offline-Retry-Dauer nicht begrenzt ist.

Ein CAS-Anker ersetzt den Ausführungsnachweis nicht: Ein Patch mit Erwartung
t0 kann zu t1 committen und seine Antwort verlieren. Der Retry mit t0 muss
diesen eigenen Erfolg von einer fremden Änderung unterscheiden können.

#### Konsistente Serverbasis und lokale Übernahme

Der Inventory-Snapshot-Read `read_inventory_sync_snapshot` unter
`supabase/schemas/08_inventory.sql` liefert für einen Haushalt in **einem
SQL-Statement-Snapshot**:

- die angeforderten Lose, einschließlich Tombstones und expliziter Abwesenheit,
- die Ledgerzeilen der betroffenen Lose,
- für jede angefragte lokale Operations-ID den vollständigen Receipt oder
  explizit `absent`, jeweils im selben Snapshot.

Anfrageumfang ist die transitive Vereinigung der Footprints offener und
bestätigter, aber noch nicht übernommener Operationen sowie der zu
aktualisierenden Lose. Unvollständige Antworten werden nicht übernommen.
Zeitlich getrennte Entity-/Receipt-Reads und Realtime-Einzelzeilen ersetzen
diesen Nachweis nicht. Reads gehen an die autoritative Datenbank, ohne Cache
oder verzögerte Read-Replica.

Der Reconciliation-Owner `mirror-write.ts` führt folgenden Ablauf aus:

1. Pro Haushalt höchstens ein Snapshot-Read gleichzeitig. Weitere Pull-,
   Realtime- und Ack-Signale merken einen erneuten Read vor. Ein Account- oder
   Haushaltswechsel verwirft Antworten der vorherigen Sitzung.
2. Push-Receipts markieren den bekannten Erfolg lokal dauerhaft, entfernen
   aber noch keine Outboxwirkung. Historische Ergebniszeilen eines Replays
   werden niemals direkt zur aktuellen Basis. Realtime signalisiert ebenfalls
   nur einen neuen Read für den Inventory-Pfad.
3. Nach dem Read werden innerhalb einer exklusiven lokalen Transaktion die
   aktuelle Outbox und ihr vollständiger Footprint erneut gelesen. Seit der
   Anfrage hinzugekommene Operations-IDs oder Lose erfordern einen neuen Read;
   die bisherige sichtbare Projektion bleibt bis dahin bestehen.
4. Stimmen Request und Receipt überein, ist die Operation in genau dieser
   Serverbasis enthalten und wird nicht replayt. `absent` bedeutet nur
   „in diesem Snapshot nicht enthalten“, niemals endgültig fehlgeschlagen.
   Ist ein inzwischen empfangener Ack neuer als der Snapshot-Nachweis
   (`absent` trotz Ack), wird der Snapshot verworfen und erneut gelesen.
5. Nur nicht enthaltene Operationen werden in lokaler Outboxreihenfolge auf
   die Basis projiziert. Der Lifecycle-Owner entscheidet ihre Auswirkungen anhand des unveränderten
   Requests und seiner stabilen IDs;
   Reconciliation besitzt keine zweite Mengen-/Öffnungsregel. Bei verletzten
   Preconditions bleiben Operation und abhängige Folgeoperationen sichtbar
   als blockiert, ohne ungültige Teilprojektion. Unabhängige Operationen können
   weiter projiziert werden.
6. Basis, sichtbare Projektion, Ledger, Tombstones und Entfernung der im
   Snapshot nachgewiesenen Outboxeinträge werden gemeinsam committed. Eine
   Wiederholung desselben Snapshots erzeugt dieselbe Projektion.

Die bestätigte Basis und ein empfangener Ack müssen lokal persistiert werden;
die sichtbare optimistische Zeile allein ist keine rekonstruierbare Basis.
Die lokale Speicherdefinition gehört zu `src/lib/db/schemas/system.ts`.
Damit werden keine allgemeinen Queue- oder Sync-Plugins eingeführt.

Beispiel: Basis 10, lokaler Verbrauch 2, Antwortverlust. Liefert der Snapshot
8 plus Receipt, bleibt sichtbar 8. Liefert er 10 plus `absent`, wird einmal
auf 8 projiziert. Liefert er nach fremdem Verbrauch 7 plus Receipt, bleibt 7.
Ein späterer Replay-Ack mit ursprünglichem Ergebnis 8 setzt die 7 nicht zurück.

Discard darf eine bereits versendete Operation mit unbekanntem Ausgang nicht
aufgrund von `absent` entfernen: Zuerst denselben Request abschließend klären.
Bestätigte Wirkung bleibt erhalten; fachliches Undo ist eine neue Operation.
Ein Retry-Limit begrenzt automatische Versuche, macht `unknown` aber nicht zu
`conflict`. Unversendete oder definitiv abgelehnte Operationen und ihre
abhängigen Folgeoperationen dürfen atomar verworfen werden; danach wird die
Projektion über denselben Owner neu aufgebaut.

## 3. Mengen-, Snapshot- und Tombstone-Vertrag

- Mengen werden in ganzzahligen Tausendsteln geführt und persistiert:
  `300 g = 300_000`, `1 Stück = 1_000`. Dies gilt für Inventory-Lose,
  Ledgermengen, Operationspayloads, Erwartungswerte und Mengensnapshots.
- Bestehende Feldnamen wie `quantity` bleiben erhalten, tragen im v1-Vertrag
  aber Integer-Tausendstel. SQLite verwendet `integer`, Postgres `bigint`.
  Der bisherige fachliche Maximalwert bleibt `9_999_999.999`, entsprechend
  `9_999_999_999` Integer-Einheiten; Deltas sind entsprechend signiert.
  Das liegt innerhalb sicherer JavaScript-Integer. Grenzprüfung und
  UI-Konversion besitzen ausschließlich `src/lib/inventory-quantity.ts`.
- `package_size` als Konversionssnapshot wird ebenfalls in Tausendsteln
  seiner `package_size_unit` geführt; bei Stückgut ist P folglich `1_000`.
  Formeln und Beispiele in diesem Dokument zeigen zur Lesbarkeit physische
  Mengen. Wire- und Persistenzwerte sind immer skaliert.
- Dies ist ausdrücklich eine Änderung gegenüber SQLite `real` und Postgres
  `numeric(10,3)`. Lokale und serverseitige Schemata, Mirror-Adapter,
  generierte Typen, UI-Konversionsgrenzen und alle Inventory-Schreibquellen
  einschließlich Einkaufslisten-Transfer müssen zusammen umgestellt werden.
  Shopping-, Produktkatalog- und Nutrition-Mengen wechseln nicht implizit
  ihre Einheit; die jeweilige Inventory-Eingangsgrenze konvertiert einmal.
- Bestehende deklarierte Dezimalwerte werden in einer generierten Migration
  genau einmal skaliert; Werte mit Überpräzision werden abgewiesen, nicht
  gerundet. Das ist eine Schemamigration, kein Laufzeit-Legacy-Decoder.
  Alte Outboxpayloads bleiben nicht ausführbar und werden als `invalid`
  isoliert. Der Entwicklungsbestand wird nicht automatisch gelöscht oder
  zurückgesetzt; ein benötigter Reset ist eine separate explizite Aktion.
- Operationsmengen verwenden die `unit` des Loses. `package_size` und
  `package_size_unit` sind der stabile Konversionssnapshot. Ohne eindeutige
  Packungsdaten wird nicht zwischen Einheiten umgerechnet.
- Ein neuer Mengen-Tombstone hat `quantity = 0` und `deleted_at != null`. ID,
  Haushalt, Produkt, Mengenbasis und Reconciliation-Metadaten bleiben erhalten.
- Undo reaktiviert dieselbe Lot-ID. Tombstones mit positiver Menge sind im Zielmodell ungültig; es gibt keinen
  Legacy-Inversionspfad.
- `MergeSnapshotV1` enthält exakt:

```text
household_id, product_id, name, unit, package_size, package_size_unit,
location_id, expiry_date, opened_at, vacuum_sealed, expiry_user_set,
added_by, quantity_before
```

Neue Snapshotfelder erfordern eine neue Contract-Version.

## 4. Operationsregister

| Operation | Stabile IDs | Wirkung und vollständiger Footprint |
| --- | --- | --- |
| `insert_inventory` | `operation_id`, `item_id`, `in_transaction_id` | neues sichtbares Los und genau `IN quantity` |
| `open_inventory` | `operation_id`, `source_item_id`, optional `opened_item_id` | Öffnen ohne Verbrauch, optionaler struktureller Split, kein Ledger; Receipt umfasst alle betroffenen Lose |
| `consume_inventory` | `operation_id`, `out_transaction_id`, `source_item_id`, optional `opened_item_id` | Quelle, genau `OUT C`, optionaler Öffnungsrest (`opens_remainder`) und alle Tombstones |
| `waste_inventory` | `operation_id`, `waste_transaction_id`, `item_id` | Menge reduzieren, genau `WASTE W`, Grund und möglicher Tombstone |
| `move_inventory` | `operation_id`, `out_transaction_id`, `in_transaction_id`, `item_id` | Los, alter/neuer Ort und beide Ledgerbeine |
| `correct_quantity` | `operation_id`, `transaction_id`, `item_id` | Compare-and-Set, tatsächliches `IN`- oder `OUT`-Delta und Tombstone |
| `undo_inventory_operation` | `operation_id`, stabile Gegenledger-IDs, jeweiliges `reversal_of` | vollständiger Footprint des Originals; Modus `reverse_quantity`, `reverse_move` oder `merge_undo_open` |
| `reseal_inventory` | `operation_id`, `item_id` | ausschließlich expliziter Lifecycle-Metadatenpatch, kein Ledger und kein Merge |
| `patch_inventory_metadata` | `operation_id`, `item_id`, CAS-Anker | ausschließlich genannte Patchfelder, keine Menge und kein impliziter Move |

Jede Operation enthält außerdem `household_id`, `created_at`, erwarteten
Ausgangszustand und die für ihre Ledgerzeilen geltenden Produkt-, Mengenbasis-
und Lagerortwerte.

## 5. Verbrauch mit Öffnungsrest (`opens_remainder`)

`consume_inventory` ist eine diskriminierte Union:

```text
sealed_full:
  source_after = source_before - C
  kein geöffnetes Restlos

sealed_partial (opens_remainder):
  0 < C < P <= source_before
  source_after = source_before - P
  opened_remainder R = P - C
  total_after = source_after + R = source_before - C

opened:
  source_after = source_before - C
  kein weiterer Split
```

`sealed_partial` (`opens_remainder`) enthält zusätzlich `opened_item_id`, `P` (die angebrochene Packungsmenge), `R`, `opened_at`, berechnete Haltbarkeitsfelder und `MergeSnapshotV1`. Die neue Restlos-ID ist vor dem ersten Commit stabil.

### Kanonisches Beispiel: Erster Teilverbrauch aus versiegeltem Bestand

```text
Vorher:
Versiegelt: 500 g
Geöffnet:     0 g

Verbraucht:
200 g für Rezept XYZ

Danach:
Versiegelt:   0 g (Tombstone, falls Ursprungslos vollständig geleert; bei N > 1 Packungen verbleibt S0 - P versiegelt)
Geöffnet:   300 g (neues Los mit opened_at und neuem expiry_date)

Ledger:
OUT 200 g, Rezept XYZ (fridge_item_id = geöffnetes Los)
```

Dieselbe Operation bewirkt atomar:

- Die angebrochene Packung $P$ verlässt den versiegelten Bestand.
- Falls das versiegelte Ursprungslos dadurch leer wird ($S_0 = P$), erhält es einen Tombstone; bei $S_0 > P$ verbleibt $S_0 - P$ als versiegeltes Los.
- Ein geöffnetes Los mit der Restmenge $R = P - C$ ($300\text{ g}$) entsteht.
- `opened_at` und das berechnete `expiry_date` werden gesetzt.
- Die Split-Provenienz speichert Ursprungslos, Ursprungsort, ursprüngliche Packungsmenge $P$, geöffnetes Los und Metadaten-Snapshot (`MergeSnapshotV1`).
- Im Ledger wird ausschließlich die wirklich verbrauchte Menge ($200\text{ g}$) als `OUT` gebucht.
- Es gibt keine `open`-Ledgerzeile und keinen künstlichen Vollmengen-Transfer `OUT 500` / `IN 500`.

Ledger-Zuordnung:

- `sealed_full`: `OUT C.fridge_item_id = source_item_id`
- `sealed_partial`: `OUT C.fridge_item_id = opened_item_id`; das Ursprungslos steht im typisierten Footprint
- `opened`: `OUT C.fridge_item_id = source_item_id`

### 5.1 Reines Öffnen ohne Verbrauch (`open_inventory`)

Eine eigenständige Benutzerabsicht erhält eine eigene Operation-ID. Sie ist
kein `consume_inventory(C=0)`, kein Metadatenpatch mit versteckter
Mengenwirkung und erzeugt keine Ledger-ID. Preconditions: Quelle versiegelt,
positive aktuelle Menge, passende Erwartungsmenge und passender Snapshot.

- Bei `source_before = P`: dieselbe Lot-ID behalten, `opened_at` und
  Haltbarkeitsfelder setzen, Menge unverändert.
- Bei `source_before > P`: genau eine Packung P atomar von der Quelle in ein
  neues geöffnetes Los mit stabiler `opened_item_id` verschieben; Summe bleibt
  erhalten. Beide Lose gehören zum Footprint; kein `OUT 0`, `open` oder
  Transfer-Ledgerpaar.
- Bei `P <= 0` oder `P > source_before`: vollständig ablehnen. Ohne eindeutige
  Packungsgröße wird nur das ganze Los geöffnet (`P = source_before`), ohne
  Packungskonversion zu erfinden.

Lifecycle-Plan: `inventory-lifecycle.ts`; lokale Ausführung:
`src/lib/sync/inventory-quantity.ts`; Idempotenz über denselben Receipt wie alle
anderen Operationen. Die bewusste Gegenaktion ist `reseal_inventory` auf dem
geöffneten Los, ohne automatischen Merge. `merge_undo_open` bleibt dem ersten
**Verbrauch** vorbehalten. Allgemeine Metadatenpatches dürfen `opened_at`
nicht ändern und diese Operation dadurch nicht umgehen.

Das Ledger enthält für jeden Verbrauch genau `OUT C`. Es gibt weder eine `open`-Zeile noch einen künstlichen Transfer `OUT P` plus `IN P`. Quelle, Restlos, Ledger, Tombstones und Outbox sind eine atomare Operation.

## 6. Undo-Modi

Undo ist genau erlaubt für:

```text
original.created_at <= undo.created_at < original.created_at + 24 Stunden
```

Alle drei Modi tragen zusätzlich ein optionales `notes`-Feld (String), das
unverändert in die jeweilige Gegenbuchung übernommen wird (z. B.
`[Undone] Gegenbuchung` oder `[Manual correction]` nach Ablauf des
24-Stunden-Fensters). Fehlt `notes`, bleibt das Feld auf der Gegenbuchung
`null`. Der Server interpretiert `notes` nicht fachlich; er persistiert es nur.

### `reverse_quantity`

Eine inverse Ledgerzeile referenziert die Originalzeile. Menge und Tombstone
werden auf demselben Los atomar invertiert. Das Original bleibt unverändert.
Gilt auch für normales `reverse_consumption` ohne Öffnungsrest.

### `reverse_move`

Eine neue Operations-ID gruppiert zwei Gegenbeine. `IN` am alten Ort
referenziert das ursprüngliche Move-`OUT`; `OUT` am neuen Ort referenziert das
ursprüngliche Move-`IN`. Beide Gegenbeine und der Lagerortwechsel committen
gemeinsam oder gar nicht.

### `merge_undo_open` (Undo des ersten Teilverbrauchs)

Dieser Modus gilt ausschließlich, wenn die rückgängig gemachte Verbrauchsoperation das geöffnete Los als `opens_remainder` erzeugt hatte.

```text
Vorher:
Versiegelt:   0 g (bzw. S0 - P)
Geöffnet:   300 g (R)

Undo:
IN 200 g (C, mit reversal_of = ursprüngliche OUT-ID)

Danach:
Versiegelt: 500 g (S0)
Geöffnet:     0 g (Tombstone)
```

Atomare Wirkung:

- Die Gegenbuchung `IN C` referenziert die ursprüngliche `OUT C`-Buchung über `reversal_of`.
- Die noch vorhandene Restmenge $R$ ($300\text{ g}$) plus die Gegenbuchung $C$ ($200\text{ g}$) stellen exakt die Packungsmenge $P$ ($500\text{ g}$) des Ursprungsloses wieder her.
- Das versiegelte Ursprungslos wird reaktiviert (Tombstone entfernt falls $S_0 = P$) bzw. um $P$ erhöht.
- Das geöffnete Restlos wird tombstoned (`quantity = 0, deleted_at = now()`).
- Es gibt keine separaten Transfer-Gegenbuchungen.

Preconditions:
- Das geöffnete Restlos muss noch exakt die unveränderte Restmenge $R$ aufweisen und das Ursprungslos noch exakt $S_0 - P$.
- Beide Lose müssen in Ort, Produkt, Mengenbasis und sämtlichen statischen Snapshotfeldern übereinstimmen.
- Eine spätere abhängige Operation auf einem der beiden Lose blockiert den Merge.
- Es gibt keinen Teilcommit, kein Transferpaar über $P$ und keinen automatischen Reseal-Fallback.

## 7. Weitere Operationsregeln

- `insert_inventory`: positive Menge; Lot und `IN` entstehen gemeinsam.
- `waste_inventory`: `0 < W <= expected_quantity`; Grund ist
  `expired | spoiled | other`; `quantity_after = expected_quantity - W`.
- `move_inventory`: erwartete Menge und alter Ort müssen stimmen; Menge und
  Lot-ID bleiben gleich; beide Ledgerbeine besitzen dieselbe Operations-ID.
  `expected_location_id` und `to_location_id` sind Pflichtfelder (nicht
  `null`): Bestand ohne zugewiesenen Lagerort entfällt als Zielzustand
  (Produktentscheidung 2026-09-08). Bestehende Zeilen mit `location_id = null`
  benötigen vor der v1-Aktivierung eine Datenmigration und eine UI-Pflicht zur
  Lagerortauswahl; das ist eigener Arbeitsumfang, nicht Teil dieses Dokuments.
- `correct_quantity`: `new_quantity >= 0` und ungleich Erwartungsmenge; Ledger
  enthält exakt das tatsächliche Delta mit `[Manual correction]`.
- `reseal_inventory`: jederzeit explizit möglich; setzt `opened_at = null` und
  bestätigte Haltbarkeitsfelder; kein Ledger, Merge oder Verbrauchs-Undo.
- `patch_inventory_metadata`: nichtleerer Whitelist-Patch; fehlendes Feld
  bleibt unverändert, `null` setzt ausdrücklich null. Menge, Tombstone und Ort
  werden nicht aus einem Metadatenpatch abgeleitet.

## 8. Owner und Verbot ähnlicher Funktionen

| Entscheidung | Einziger Owner |
| --- | --- |
| Lifecycle-Plan für Verbrauch, reines Öffnen, Öffnungsrest, Reseal und Undo | `src/features/inventory/inventory-lifecycle.ts` |
| Mengenarithmetik | `src/lib/inventory-quantity.ts` |
| Payloadversion, Normalisierung, IDs und Footprint | `src/features/inventory/inventory-lifecycle.ts` |
| lokaler atomarer Commit des gelieferten Plans | `src/lib/sync/inventory-quantity.ts` |
| Serverlocks, Snapshot, Idempotenz und Commit | `supabase/schemas/08_inventory.sql` |
| Retry, Backoff, Reihenfolge und Push-Abschluss | `src/lib/sync/push.ts` |
| Reconciliation | `src/lib/sync/mirror-write.ts` |
| Konfliktauflösung | `src/lib/sync/resolve-inventory-conflict.ts` |
| React-Orchestrierung | `src/features/inventory/use-inventory-mutations.ts` |

Owner bezeichnet eine Verantwortung, nicht eine Datei pro Benutzeroperation.
Alle lokalen Befehle leben als explizite Funktionen im bestehenden
`src/lib/sync/inventory-quantity.ts`; kein Command-Verzeichnis und kein
zusätzliches Contract-Modul. Der vorhandene Name bleibt zunächst bestehen.
Das ähnlich benannte `src/lib/inventory-quantity.ts` besitzt ausschließlich
Arithmetik und Konversion und ist kein Duplikat des lokalen Schreibpfads.

Abhängigkeitsrichtung: Hooks und Einkaufsabschluss → lokaler Schreibpfad →
reiner Lifecycle-Plan und bestehende Outbox-/Mirror-Schreibprimitive.
Push, Reconciliation und Konflikte lesen Operationstypen und Footprints aus
dem reinen Lifecycle-Modul, niemals aus dem lokalen Schreibpfad. Lifecycle
importiert weder React noch DB, Outbox oder Sync. Der lokale Schreibpfad nutzt
`enqueueMutationsInExclusiveTransaction`; es entsteht kein zweiter
Transaktionsmanager und keine generische ausführbare Operations-Registry.

Eine zweite Funktion ist verboten, wenn sie dieselbe fachliche Entscheidung
erneut validiert, berechnet, klassifiziert, in einen Footprint übersetzt oder
reconciliiert. Adapter dürfen nur typisierte Felder abbilden.

## 9. Ungeshipped State: Keine Legacy-Kompatibilität

Da die App noch nicht in Produktion veröffentlicht ist, gibt es keine
Rückwärtskompatibilitätspflicht für historische Payloads, Freitext-Notes oder
veraltete DB-Spalten:

- **Kein Legacy-Decoder:** Es wird keine Abwärtskompatibilitätsschicht oder
  Dual-Payload-Verarbeitung gebaut.
- **Veraltete Formen entfallen:** `transactions.type = 'open'`,
  `transactions.undone` sowie Freitext-Notes `[Split] origin=...` werden im
  Produktionscode vollständig gelöscht und nicht dekodiert.
- **Strikter v1-Vertrag:** Alle Payloads tragen `contract_version = 1`. Nicht
  konforme Payloads werden sofort als `PAYLOAD_VALIDATION_FAILED` abgewiesen;
  sie werden weder ausgeführt noch still gelöscht. Historische Migrationen
  sind keine Laufzeit-Legacypfade und werden nicht nachträglich editiert.

### 9.1 Kanonische Operationsübersicht (fam-lem.19)

| Kanonischer Name (v1) | Bisherige Mutation | Stabile IDs | CAS-Anker & Fehlercodes | Exakter Produktions-Owner |
| --- | --- | --- | --- | --- |
| `open_inventory` | bisheriges Öffnen / `split_open` ohne Verbrauch | `operation_id`, `source_item_id`, optional `opened_item_id` | `STALE_BASE`, `PAYLOAD_VALIDATION_FAILED` | `src/lib/sync/inventory-quantity.ts` |
| `insert_inventory` | `insert` | `operation_id`, `item_id`, `in_transaction_id` | `PAYLOAD_VALIDATION_FAILED` | `src/lib/sync/inventory-quantity.ts` |
| `consume_inventory` (`sealed_full` / `opened`) | `adjust_quantity` (negativ, Verzehr) | `operation_id`, `out_transaction_id`, `source_item_id` | `STALE_BASE`, `INSUFFICIENT_QUANTITY` | `src/lib/sync/inventory-quantity.ts` |
| `consume_inventory` (`sealed_partial`) | ehem. `split_open` | `operation_id`, `out_transaction_id`, `source_item_id`, `opened_item_id` | `STALE_BASE`, `INSUFFICIENT_QUANTITY` | `src/lib/sync/inventory-quantity.ts` |
| `waste_inventory` | `adjust_quantity` (negativ, Müll) / `delete` | `operation_id`, `waste_transaction_id`, `item_id` | `STALE_BASE`, `INSUFFICIENT_QUANTITY` | `src/lib/sync/inventory-quantity.ts` |
| `correct_quantity` | `adjust_quantity` (Korrektur) | `operation_id`, `transaction_id`, `item_id` | `STALE_BASE` | `src/lib/sync/inventory-quantity.ts` |
| `move_inventory` | `move` | `operation_id`, `out_transaction_id`, `in_transaction_id`, `item_id` | `STALE_BASE` | `src/lib/sync/inventory-quantity.ts` |
| `undo_inventory_operation` (`reverse_quantity`) | `reverse_quantity` / `restore` | `operation_id`, Gegen-Ledger-ID, `reversal_of` | `UNDO_WINDOW_EXPIRED`, `DEPENDENT_MUTATION_EXISTS` | `src/lib/sync/inventory-quantity.ts` |
| `undo_inventory_operation` (`merge_undo_open`) | `merge_undo_open` | `operation_id`, `in_transaction_id`, `reversal_of`, `source_item_id`, `opened_item_id` | `UNDO_WINDOW_EXPIRED`, `DEPENDENT_MUTATION_EXISTS`, `STALE_BASE` | `src/lib/sync/inventory-quantity.ts` |
| `undo_inventory_operation` (`reverse_move`) | `reverse_move` | `operation_id`, 2 Gegen-Ledger-IDs, `reversal_of` | `UNDO_WINDOW_EXPIRED`, `DEPENDENT_MUTATION_EXISTS` | `src/lib/sync/inventory-quantity.ts` |
| `reseal_inventory` | `reseal` | `operation_id`, `item_id` | `STALE_BASE` | `src/lib/sync/inventory-quantity.ts` |
| `patch_inventory_metadata` | `update` / `patch` | `operation_id`, `item_id` | `expected_updated_at`, `STALE_BASE` | `src/lib/sync/inventory-quantity.ts` |

Zielzustand: `split_open` entfällt als eigenständige Mutation. Das Split-Verhalten gehört als Struktureffekt zu `consume_inventory` oder `open_inventory`; der alte Payloadname entfällt.

## 10. Contract-Gate und Test-Zuordnung

| Bereich | Verbindliche Testpunkte | Zuständige fokussierte Testdatei |
| --- | --- | --- |
| Mengenpräzision | `-0.001`, `0`, `0.001`, normaler Wert, `9_999_999.999`, Maximum plus `0.001`, mehr als drei Nachkommastellen | `src/lib/inventory-quantity.test.ts` |
| Reduktion & Zustandsmodell | positives Ergebnis; exakt `0` mit Tombstone; negatives Ergebnis vollständig abgelehnt; alle Lifecycle-Übergänge | `src/features/inventory/inventory-lifecycle.test.ts` |
| Öffnungsanteil P | `P=0`, kleinste Teilmenge, `P<source`, `P=source`, `P>source`; `C=0` (reines Öffnen ohne Ledger), `C<P`, `C=P`, `C>P` | `src/features/inventory/inventory-lifecycle.test.ts` |
| Undo-Zeit & Blockade | unmittelbar davor, exakt bei 24 Stunden, unmittelbar danach; Blockade bei abhängiger Operation | `src/features/inventory/inventory-lifecycle.test.ts` |
| Idempotenz & Server-Commit | erste Ausführung, sequenzieller Retry, paralleler Retry, gleiche ID mit anderem Payload; Response-Envelope | `supabase/tests/27_inventory_quantity_atomic.test.sql` |
| Timeout & Unknown | vor Serverausführung, nach Commit vor Antwort, verspätete Antwort nach Retry | `src/lib/sync/push.test.ts` |
| Reconciliation | konsistenter Snapshot; enthalten/absent; Ack nach Snapshot; veralteter Replay-Ack; neue lokale Operation während Read; Accountwechsel; atomarer Mehrlos-Commit | `src/lib/sync/mirror-write.integration.test.ts` |
| Footprint & Invarianten | vollständig, fehlendes/zusätzliches Lot, Tombstones, Lot-IDs | `src/features/inventory/inventory-lifecycle.test.ts` |
| Receipt | gleiche ID mit anderem Patch trotz gleichem CAS; fehlend versus null; paralleler Retry; späterer Zustand; RLS und verweigerter direkter Write; Fehler rollt Receipt und Wirkung zurück | `supabase/tests/27_inventory_quantity_atomic.test.sql` |
| Reines Öffnen | source=P, source>P, ungültiges P; konstante Gesamtmenge; null Ledgerzeilen; Retry und expliziter Reseal ohne Merge | `src/features/inventory/inventory-lifecycle.test.ts`, `supabase/tests/30_inventory_split_atomic.test.sql` |
| Integer-Persistenz | 300 g als 300000; drei Dezimalstellen; Überpräzision; Maximum; genau eine Skalierung; Transfer aus unverändertem Shopping-Mengenmodell | `src/lib/inventory-quantity.test.ts`, `src/features/inventory/use-inventory-mutations.integration.test.tsx`, `supabase/tests/27_inventory_quantity_atomic.test.sql` |
| Metadaten-Patch | CAS via `expected_updated_at`, Feld fehlt, Feld enthält Wert, Feld enthält ausdrücklich `null` | `src/features/inventory/use-inventory-mutations.integration.test.tsx` |
| Retry-Limit | bei `MAX_ATTEMPTS = 5`: Attempts 4, 5 und 6 mit deterministischem Backoff | `src/lib/sync/push.test.ts` |
| Architektur & Grenzen | genau ein Registereintrag und ein Owner pro Operation; null verbotene Direktimporte | `test/conventions/inventory-operation-ownership.test.ts` |
| Konfliktmatrix | maschinenlesbare Codes (`STALE_BASE`, `INSUFFICIENT_QUANTITY`, etc.) und deterministische Auflösung | `src/lib/sync/resolve-inventory-conflict.test.ts` |

Das Gate beweist zusätzlich lokale und serverseitige Parität für IDs, Menge,
Ledger, Tombstone und vollständigen Footprint. Testbefehle und das
90-Sekunden-Limit stehen ausschließlich in `CONSTRAINTS.md`.

## 11. Status der Vertragsentscheidungen

- `fam-lem.19`: v1-Zielzuordnung in Abschnitt 1 und 9.1; historische Ticketkriterien vor Umsetzung abgleichen.
- `fam-lem.23`: Receipt und konsistente Serverbasis in Abschnitt 2.1; kein Implementierungsnachweis durch dieses Dokument.
- Tests in Abschnitt 10 sind geforderte Nachweise, keine bereits ausgeführten Prüfungen.
- Die Dateimatrix steht in `execution-plan.md`, Abschnitt „Verbindliche Dateimatrix“. Vertrag und Matrix sind gemeinsam freigegeben; technische Abnahmegates und Constraints bleiben verbindlich.

### Entscheidungen vom 2026-09-08 (fam-lem.27-Voranalyse)

Vor dem eigentlichen v1-Cutover wurden drei durch die Pro-Operation-Analyse
aufgedeckte Vertragslücken von Marco entschieden:

1. **Undo-`notes`:** Alle drei Undo-Modi tragen jetzt ein optionales `notes`-
   Feld (Abschnitt 6). Vorher fehlte es im Vertrag, obwohl der bestehende
   Laufzeitpfad es zwingend braucht.
2. **`move_inventory` ohne Lagerort entfällt:** `expected_location_id` und
   `to_location_id` sind Pflichtfelder (Abschnitt 7). Bestand ohne
   zugewiesenen Lagerort ist damit kein gültiger Zielzustand mehr — das ist
   eine Produktentscheidung, keine reine Contract-Präzisierung. Erfordert vor
   der v1-Aktivierung: Datenmigration bestehender `location_id = null`-Zeilen
   und eine UI-Pflicht zur Lagerortauswahl beim Anlegen. Beides ist noch nicht
   umgesetzt und nicht Teil dieses Dokuments.
3. **Reihenfolge:** Der Integer-Tausendstel-Persistenz-Umbau (Abschnitt 3)
   geht dem eigentlichen v1-Cutover der fünf Operationen voraus, nicht
   umgekehrt. Keine Operation wird auf `validateInventoryOperation`
   umgestellt, solange reale Bestandsmengen noch als Dezimalzahl (SQLite
   `real`, Postgres `numeric`) gespeichert werden — die Integer-Prüfungen
   (`isPositiveIntegerThousandths` etc.) würden sonst jede reale Dezimalmenge
   ablehnen.
