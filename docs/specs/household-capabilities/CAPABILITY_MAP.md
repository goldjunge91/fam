# Capability Map: Operative Haushaltsfunktionen für Fam

Status: Review erforderlich (Phase 0)
Version: 0.1
Stand: 2026-09-01

## Ziel

Diese Initiative überführt die von Marco ausgewählten Produktideen in das
Fam-Domänenmodell. Sie strebt keine technische oder vollständige
Feature-Parität an, sondern legt die fachlichen Grenzen und Abhängigkeiten der Module fest.

Es die bereits implementierten Funktionen in Fam, haben vorrang vor den neuen Modulen. Die Capability Map ist nur reine hilfestellung um eine idee auszuarbeiten. es gilt für unsere app:
- local-first
- Haushaltsdaten sind privat und werden nicht an Dritte weitergegeben;
- private Tracking-Daten werden weder abgeleitet noch mit Haushaltsdaten
  vermischt;
- automatische Aktionen werden nachvollziehbar und reversibel;
- neue Datenbankzustände beginnen im deklarativen Schema.

## Die Mögliche ideen

Die fünf Pakete beschreiben die ursprünglich vorgeschlagenen, fachlichen
Lieferbündel. Die Capability Map darunter schneidet sie zusammen mit den später
ergänzten Funktionen in technisch unabhängige Spec-Module.

### Paket 1: Inventarereignisse als Grundlage

Bestandsänderungen werden zusätzlich zur Bestandszeile in `transactions`
protokolliert. Transaktionen werden angehängt; beim Undo wird die ursprüngliche
Zeile mit `undone = 1` markiert und eine Gegenbuchung angelegt.

Die Transaktionstypen sind:

```text
in | out | waste
```

Transaktionen speichern folgende Felder:

```text
id, product_id, type, quantity, location, notes, undone, created_at
```

- `out`: Verbrauch oder Entfernung aus dem Bestand.
- `waste`: Wegwerfen; der Grund steht in `notes` als `Buttato|<reason>`.
- Korrekturen erzeugen `in` oder `out` mit `[Manual correction]` in `notes`.
- Verschieben erzeugt `out` am alten und `in` am neuen Lagerort.
- Undo ist innerhalb von 24 Stunden möglich und erzeugt eine Gegenbuchung.
- Die ursprüngliche Transaktion bleibt mit `undone = 1` erhalten.

`product_id` verweist auf das Produkt; eine `inventory_id`, Einheit, Actor- oder
Rezeptreferenz ist in der Transaktionstabelle nicht vorhanden.

### Paket 2: Geöffnete Produkte und Haltbarkeit

Ein Bestandseintrag kann geöffnet werden. Der Öffnungszeitpunkt wird in
`opened_at` gespeichert. Das Ablaufdatum steht in `expiry_date`.

```text
inventory (
  id,
  product_id,
  location,
  quantity,
  expiry_date,
  added_at,
  updated_at,
  expiry_user_set,
  vacuum_sealed,
  opened_at
)
```

| Dokumentaussage | Tatsächlicher Code |
| --- | --- |
| `opened_at` | Nullable `DATETIME`; wird beim Öffnen gesetzt |
| `expiry_date` | `DATE` |
| `user` | Kein Feld; `expiry_user_set` markiert ein gesetztes Ablaufdatum |
| `vacuum_sealed` | Boolean/Integer |
| „versiegelt“ | Ableitung: `opened_at IS NULL` und `vacuum_sealed = 0` |
| „geöffnet“ | `opened_at IS NOT NULL` |
| „vakuumiert“ | `vacuum_sealed = 1` |

Beim Öffnen berechnet der Code eine Haltbarkeit anhand von Produktname,
Kategorie und Lagerort. Das berechnete Datum wird als `expiry_date` gespeichert.
Ist das vorhandene Ablaufdatum früher, bleibt dieses erhalten.

Geöffnete Packungen werden getrennt von versiegeltem Bestand geführt und nicht
mit diesem zusammengeführt. `vacuum_sealed` kennzeichnet vakuumierte Ware.

### Paket 3: Verbrauch statt bloßes Löschen

Bestandsänderungen werden in `transactions` protokolliert.

```text
in | out | waste
```

- `out`: Verbrauch oder Entfernung
- `waste`: Wegwerfen
- `in`: Zugang oder Undo-Wiederherstellung

Teilweiser Verbrauch reduziert die Menge. Vollständiger Verbrauch kann den
Bestand löschen oder auf null setzen.

Beim Wegwerfen wird ein Grund als `Buttato|<reason>` gespeichert:

```text
expired | spoiled | wrong_location | kept_too_long
bought_too_much | forgotten | bad_quality | other
```

Mengen-Korrekturen erzeugen `in` oder `out` mit
`[Manual correction]`.

Verschieben erzeugt:

```text
out am alten Ort
in am neuen Ort
```

Undo ist innerhalb von 24 Stunden möglich. Die Originaltransaktion erhält
`undone = 1`; eine Gegenbuchung mit `[Undone]` wird gespeichert.

### interessante funktion: Vollständige Datenportabilität

Der Code bietet CSV-Export und CSV-Import für den Inventarbestand.
Zusätzlich können lokale Datenbank-Backups erstellt und wiederhergestellt
werden. Ein optionales Google-Drive-Backup ist ebenfalls vorhanden.

Zielmodul: `data-portability`.

## Vollständige Feature-Paritätsprüfung: Übernahmen

| Funktion | Referenzcode | Fam heute |
| --- | --- | --- |
| Produkt als „geöffnet“ markieren | `opened_at` vorhanden | nicht vorhanden |
| Kürzere Haltbarkeit nach dem Öffnen | Ablaufdatum wird berechnet und gespeichert | nicht vorhanden |
| Gründe für Verschwendung | `waste` mit `Buttato | reason`  nicht vorhanden |
| Verbrauchs-/Bestandshistorie | `transactions` vorhanden | nur Einkaufshistorie |
| Aktion rückgängig machen | 24-Stunden-Undo mit Gegenbuchung | kein Transaktions-Undo |
| Produktduplikate erkennen und zusammenführen | `product_merge` und Konsolidierung | nicht vorhanden |
| CSV-Import und -Export des Bestands | vorhanden | kein gleichwertiger Inventar-Workflow |
| Einkaufsvorlagen | CRUD und Anwenden auf Einkauf oder Bestand | nicht vorhanden |
| Verbrauchsbasierte Einkaufsvorschläge | `smart_shopping` vorhanden | nicht vorhanden |
| Bestandsbasierte Rezeptvorschläge | Rezeptgenerierung aus Inventarkontext | nicht vorhanden |
| Von einem einzelnen Produkt zu Rezepten | `recipe_from_ingredient` vorhanden | nicht vorhanden |
| Vorlesen der Kochschritte | Browser-, Kiosk-, Home-Assistant- oder externe TTS-Ausgabe | nicht vorhanden |
| Während des Kochens Bestand abbuchen | Zutaten einzeln über `inventory_use` abbuchbar | nicht vorhanden |
| Rezept teilen | `navigator.share` mit Fallbacks | nicht vorhanden |

## Wertvolle Bausteine für Fam

Diese Bausteine sind im untersuchten Rezeptcode tatsächlich vorhanden:

| Baustein | Belegtes Verhalten |
| --- | --- |
| Strukturierte Rezeptantwort | JSON mit Rezeptfeldern, Zutaten, Schritten, Nährwerten und Lagerhinweisen |
| Bestandskontext | Produktname, Kategorie, Menge, Einheit, Lagerort, Ablaufdatum und Öffnungsstatus werden an die Rezeptlogik übergeben |
| Pantry-Matching | Zutaten werden nach der Generierung gegen vorhandene Produkte und Bestände aufgelöst |
| Einstieg „Damit kochen“ | `recipe_from_ingredient` verlangt die ausgewählte Hauptzutat |
| Rezeptquellen | Mealie kann vor der KI-Generierung durchsucht werden; Gemini/OpenAI-kompatible Anbieter sind konfigurierbar |
| Rezeptarchiv | Generierte und importierte Rezepte werden im lokalen `recipes`-Archiv gespeichert |
| Chat-zu-Rezept | `chat_to_recipe` wandelt eine Chatantwort in ein Rezeptformat um |
| Rezeptverbrauch | Einzelne Zutaten können während des Kochens über `inventory_use` abgebucht werden |

## Capability Map

Die folgenden Einträge bezeichnen belegte Codebereiche, keine bereits
implementierten Fam-Module:

| Bereich | Belegter Code |
| --- | --- |
| Inventar und Transaktionen | `api/database.php`, `api/index.php` |
| Einkaufsvorlagen und Smart Shopping | `templates_*`, `smart_shopping` in `api/index.php` |
| Rezeptgenerierung | `generate_recipe`, `generate_recipe_stream` |
| Rezept aus einer Zutat | `recipe_from_ingredient` |
| Chat-zu-Rezept | `chat_to_recipe` |
| Mealie-Rezeptquelle | `api/lib/mealie.php` |
| Rezeptarchiv | `recipes` in `api/index.php` |
| Teilen | `navigator.share` in `assets/js/app.js` |
| Vorlesen | `speakCookingStep` und TTS-Konfiguration |
| CSV-Portabilität | `exportInventory`, `importInventory` |

Es gibt keine zyklischen Modulabhängigkeiten. Statistik und Vorschläge lesen
aus dem Inventar-Ledger, schreiben aber nicht in dessen Historie.

## Rückverfolgung der ursprünglichen Liste

| Nr. | Festgehaltene Auswahl | Zielmodul | Behandlung |
| ---: | --- | --- | --- |
| 1 | Inventarereignisse mit Undo | `inventory-lifecycle` | Übernommen |
| 2 | Geöffnet-Zustand und Datumsart | `inventory-lifecycle` | Übernommen |
| 3 | Verbraucht, weggeworfen und Korrektur unterscheiden | `inventory-lifecycle` | Übernommen |
| 4 | Vollständiger Datenexport und Bestandsimport | `data-portability` | Übernommen |
| 5 | Mindestbestände und Einkaufsvorlagen | `replenishment-planning` | Übernommen |
| 6 | Verbrauchsbasierte Einkaufsvorschläge | `replenishment-planning` | Übernommen |
| 7 | Produkt-Merge und Duplikaterkennung | `product-provenance` | Übernommen |
| 8 | Rezeptverbrauch mit Bestands-Review | `recipe-stock-review` | Übernommen |
| 9 | Native Rezeptfreigabe und Vorlesen | `recipe-share-speech` | Übernommen |
| 10 | Barcode-Cache und Datenherkunft prüfen | `product-provenance` | Übernommen, Quellenprüfung offen |
| 11 | Einkaufsvorlagen | `replenishment-planning` | Duplikat von Punkt 5, einmal spezifiziert |
| 12 | Verbrauchsbasierte Einkaufsvorschläge | `replenishment-planning` | Duplikat von Punkt 6, einmal spezifiziert |
| 13 | Ausgaben- und Verbrauchsstatistik | `household-insights` | Übernommen |
