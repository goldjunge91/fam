# Capability Map: Operative Haushaltsfunktionen für Fam

Status: Review erforderlich (Phase 0)
Version: 0.1
Stand: 2026-09-01

## Ziel

Diese Initiative überführt die von Marco ausgewählten Produktideen in das
Fam-Domänenmodell. Sie strebt keine technische oder vollständige
Feature-Parität mit einer Referenzanwendung an. Fremde Monolith-,
Single-Tenant- und Kiosk-/Waagenarchitekturen sind keine Vorlage.

Die ausgewählten Ideen werden Fam-konform spezifiziert:

- local-first mit SQLite und Outbox;
- Haushaltsdaten bleiben per Supabase RLS auf den Haushalt begrenzt;
- private Tracking-Daten werden weder abgeleitet noch mit Haushaltsdaten
  vermischt;
- automatische Aktionen werden nachvollziehbar und reversibel;
- neue Datenbankzustände beginnen im deklarativen Schema.

Diese Map ist die Freigabestufe vor den einzelnen Modul-Specs. Sie legt stabile
Modul-IDs, Grenzen, Abhängigkeiten und Reihenfolge fest, implementiert aber noch
nichts.

## Die fünf Umsetzungspakete

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

Zielmodul: `inventory-lifecycle`.

### Paket 2: Geöffnete Produkte und Haltbarkeit

Ein Bestandseintrag kann geöffnet werden; das Ablaufdatum wird gespeichert.

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
| Dokumentaussage | Tatsächlicher Code |
|---|---|
| `opened_at` | Ja, nullable `DATETIME`; wird beim Öffnen gesetzt |
| `expiry_date` | Ja, `DATE` |
| `user` | Nicht als Quelle; nur `expiry_user_set = 1` |
| `vacuum_sealed` | Ja, Boolean/Integer |
| „versiegelt“ | Indirekt: `opened_at IS NULL` und `vacuum_sealed = 0` |
| „geöffnet“ | `opened_at IS NOT NULL` |
| „vakuumiert“ | `vacuum_sealed = 1` |
```

Wie das Öffnen tatsächlich funktionieren sollte:
Beim Öffnen berechnen wir eine Haltbarkeit in Tagen:

```text
estimateOpenedExpiryDays(product, location)
```

Diese Berechnung verwendet Produktname, Kategorie und Lagerort. Danach wird:
1. opened_at = CURRENT_TIMESTAMP gesetzt.
2. Eine neue geöffnete Inventarzeile angelegt oder die bestehende geändert.
3. Das Ergebnis als konkretes expiry_date gespeichert.
4. Das ursprüngliche Ablaufdatum beibehalten, falls es früher liegt.
5. Geöffnete Packungen nicht mit versiegeltem Bestand zusammengeführt.
Eine verkürzte Haltbarkeit nach dem Öffnen ist ein prüfbarer Vorschlag, keine
stille automatische Änderung. Vakuumieren bleibt außerhalb des ersten Scopes.
Zielmodul: `inventory-lifecycle`.

### Paket 3: Verbrauch statt bloßes Löschen

Die Bestandsoberfläche unterscheidet fachlich:

- vollständig oder teilweise verbraucht;
- weggeworfen, optional mit kurzem Grund;
- an einen anderen Lagerort verschoben;
- Bestand korrigiert.

Wegwerfgründe bleiben bewusst knapp, etwa `verdorben`, `abgelaufen`,
`vergessen`, `zu_viel_gekauft` oder `schlechte_qualitaet`. Jede Aktion zeigt
eine Undo-Möglichkeit. Ein generisches Entfernen darf diese Unterschiede nicht
unsichtbar machen.

das orginial wird in `transactions` protokolliert. wir müssen ein platz finden.

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


Zielmodul: `inventory-lifecycle`.

### Paket 5: Vollständige Datenportabilität

Fam bietet einen vollständigen persönlichen Export und einen getrennten,
berechtigungsgeprüften Haushalts-Export. CSV dient dem lesbaren Austausch von
Bestand und Einkauf. Versioniertes JSON ermöglicht eine spätere, validierte
Wiederherstellung. Der Bestandsimport zeigt vor dem Schreiben eine Vorschau,
erkennt Duplikate und ist wiederholbar, ohne Einträge zu vervielfachen.

Zielmodul: `data-portability`.

## Vollständige Feature-Paritätsprüfung: Übernahmen

Die ursprüngliche Vergleichstabelle enthielt auch bereits vorhandene,
zurückgestellte und ausdrücklich abgelehnte Funktionen. Hier stehen nur die
Zeilen, in denen die Entscheidung eine positive Übernahme war. Eine Übernahme
bezieht sich auf das fachliche Verhalten, nicht auf fremden Quellcode oder eine
fremde Architektur.

| Funktion | Fam heute | Entscheidung |
|---|---|---|
| Produkt als „geöffnet“ markieren | Fehlt | Übernehmen |
| Kürzere Haltbarkeit nach dem Öffnen | Fehlt | Übernehmen, aber nur als Vorschlag |
| Gründe für Verschwendung | Fehlen | Übernehmen |
| Verbrauchs-/Bestandshistorie | Nur lokale Nutzungshistorie und Einkaufshistorie | Als echte Haushalts-Historie übernehmen |
| Aktion rückgängig machen | Soft-Delete/Restore teilweise vorhanden | Vollständiges Undo übernehmen |
| Produktduplikate erkennen und zusammenführen | Fehlt | Übernehmen |
| Produktnamen gegen externe Updates sperren | Teilweise durch lokale Produktspiegelung | Explizites `name_source`/Nutzer-Override übernehmen |
| CSV-Import und -Export des Bestands | Haushaltsbestand fehlt im aktuellen Export | Übernehmen |
| Einkaufsvorlagen | Fehlen | EverShelf vorhanden; übernehmen |
| Verbrauchsbasierte Einkaufsvorschläge | Häufige Produkte vorhanden, keine echte Prognose | Übernehmen |
| Bestandsbasierte Rezeptvorschläge | Fehlen | Übernehmen |
| Von einem einzelnen Produkt zu Rezepten | Fehlt | Übernehmen |
| Vorlesen der Kochschritte | Fehlt | Übernehmen, gute Accessibility-Funktion |
| Während des Kochens Bestand abbuchen | Fehlt | Übernehmen, aber nur mit Abschluss-Review |
| Rezept teilen | Nicht als zentraler Workflow sichtbar | Native Share-Funktion übernehmen |

## Wertvolle Bausteine für Fam

Aus der untersuchten Rezeptimplementierung übernehmen wir die folgenden
Muster. Wir übernehmen fachliches Verhalten und Qualitätsregeln, nicht die
konkreten Prompttexte oder die bestehende Serverstruktur.

| Baustein | Fam-Ziel | Zuordnung |
|---|---|---|
| Stabiler strukturierter Rezeptvertrag | Jede Generierung liefert validierbares JSON mit `title`, `ingredients`, `steps`, `nutrition` und `storage`; ungültige Antworten werden abgewiesen | `cooking-suggestions` |
| Deterministischer Bestandskontext | Vor dem Modell werden verfügbare Lose nach Menge, Einheit, Lagerort, Geöffnet-Zustand und Datum aufbereitet; die Priorisierung entsteht nicht im freien Text | `inventory-lifecycle`, `cooking-suggestions` |
| Harte Pantry-Grenzen | Nur vorhandene Zutaten dürfen im Rezept landen; Einheiten und Mengen müssen zum Bestand passen; Wasser, Salz, Pfeffer und Öl sind explizit definierte Ausnahmen | `cooking-suggestions` |
| Serverseitiges Pantry-Matching und Post-Validation | Jede Rezeptzutat wird nach der Modellantwort gegen Product und Inventory aufgelöst; fehlende oder erfundene Zutaten werden entfernt oder als fehlend ausgewiesen, nie stillschweigend als vorhanden markiert | `product-provenance`, `recipe-stock-review` |
| Einstieg „Damit kochen“ | Ein einzelner Bestandseintrag kann die Rezeptsuche mit einer verpflichtenden Hauptzutat starten; vorhandene Fam-Mengen bleiben die Quelle | `cooking-suggestions` |
| Rezeptquelle mit Priorität und Fallback | Eigene Rezeptbasis oder ein angeschlossener Rezeptdienst wird zuerst durchsucht; KI-Generierung ist nur der Fallback, wenn kein passender Treffer existiert | `cooking-suggestions`, `mealie-evaluation` |
| Lokaler Rezept-Cache | Externe Rezepttreffer werden für Offline-Lesen und weniger Netzwerkanfragen lokal zwischengespeichert; Cache-Daten bleiben von der kanonischen Fam-Rezeptidentität getrennt | `mealie-evaluation` |
| Chat-zu-Rezept-Konvertierung als späterer Adapter | Freie Chatantworten können später in dasselbe strukturierte Rezeptformat überführt und danach normal validiert werden | `cooking-suggestions` |

### Verbindliche Ableitung für den Kochvorschlags-Flow

```text
Bestandslose deterministisch priorisieren
  → harte Filter anwenden
  → eigene Rezeptbasis oder angeschlossene Quelle durchsuchen
  → Top-K Treffer bestimmen
  → KI rankt oder formuliert 1–3 Vorschläge
  → Rezeptvertrag und Bestandsbezug nachprüfen
  → verwendete Lose, fehlende Zutaten und Begründung anzeigen
```

Die Optionen „schnell“, „zuerst aufbrauchen“ und „ohne Einkauf“ werden als
strukturierte UI-Parameter übergeben. Sie sind keine frei formulierbaren
Prompt-Anweisungen. Ein überschrittenes Verbrauchsdatum schließt ein Los aus;
ein überschrittenes Mindesthaltbarkeitsdatum darf nicht automatisch als
verzehrbar angenommen werden.

## Capability Map

| Modul-ID | Verantwortung | Abhängig von | Auswahlpunkte |
|---|---|---|---|
| `inventory-lifecycle` | Append-only Inventarereignisse mit Undo, Geöffnet-Zustand, Datumsart sowie getrennte Vorgänge für Verbrauch, Wegwerfen und Korrektur | bestehender Bestand und Sync | 1, 2, 3 |
| `product-provenance` | Produkt-Merge, Duplikaterkennung, Barcode-Cache sowie sichtbare und prüfbare Datenherkunft | bestehender Product Catalog | 7, 10 |
| `cooking-suggestions` | Deterministische bestandsbasierte Rezeptvorschläge für „Was kann ich heute kochen?“ und den Einstieg „Damit kochen“ von einem Bestandseintrag | bestehender Bestand, Product Catalog und Rezeptdomäne | positive Feature-Paritätsprüfung |
`inventory-lifecycle`, `product-provenance`, bestehende Einkaufsliste | 5, 6, 11, 12 |
| `recipe-stock-review` | Vor dem Kochen berechneten Rezeptverbrauch gegen konkrete Bestände prüfen, anpassen, bestätigen und rückgängig machen | `inventory-lifecycle`, `product-provenance`, bestehende Rezeptdomäne | 8 |
| `recipe-share-speech` | Rezepte über das native Share Sheet freigeben und Zubereitungsschritte vorlesen | bestehende Rezeptdomäne | 9 |
| `mealie-evaluation` | Mealie-Schnittstellen, Lizenz, Datenmodell und Integrationsvarianten prüfen; erst danach Import, Export oder Synchronisation festlegen | bestehende Rezeptdomäne | 13 |
| `household-insights` | Nachvollziehbare Ausgaben- und Verbrauchsstatistik ausschließlich aus Haushaltsereignissen und Einkaufshistorie | `inventory-lifecycle`, bestehende Einkaufshistorie | 14 |
| `data-portability` | Vollständiger, versionierter Haushaltsdatenexport und sicherer Bestandsimport mit Vorschau, Validierung und Duplikatschutz | `inventory-lifecycle`, `product-provenance`, `replenishment-planning` | 4 |

## Abhängigkeitsrichtung

```text
product-provenance ──┐
                    ├─→ replenishment-planning ──┐
inventory-lifecycle ┼─→ recipe-stock-review       │
                    └─→ household-insights         ├─→ data-portability
product-provenance ──────────────────────┘

cooking-suggestions   → unabhängig auf bestehendem Bestand und Rezepten
recipe-share-speech   → unabhängig auf bestehender Rezeptdomäne
mealie-evaluation     → unabhängige Prüfung vor einer Integrationsentscheidung
```

Es gibt keine zyklischen Modulabhängigkeiten. Statistik und Vorschläge lesen
aus dem Inventar-Ledger, schreiben aber nicht in dessen Historie. Ein
Mealie-Adapter wird erst als neues Modul geplant, falls die Evaluation eine
Integration empfiehlt.

## Empfohlene Spec- und Build-Reihenfolge

1. `cooking-suggestions`: den derzeit priorisierten Ablauf „Was kann ich heute
   kochen?“ zunächst mit bestehendem Bestand, festen Filtern und der eigenen
   Rezeptbasis spezifizieren und liefern.
2. `product-provenance`: Herkunft und Identität von Produktdaten klären, bevor
   weitere Funktionen darauf aufbauen.
3. `inventory-lifecycle`: gemeinsames Ereignismodell für alle späteren
   Bestandsauswertungen und reversiblen Bestandsänderungen festlegen.
4. `mealie-evaluation`: parallel als reine Recherche- und Entscheidungs-Spec
   bearbeiten.
5. `replenishment-planning`, `recipe-stock-review` und `household-insights`:
   nach den Grundlagen unabhängig voneinander spezifizieren und liefern.
6. `recipe-share-speech`: unabhängig, aber nicht vor den heute wichtigeren
   Bestands- und Kochabläufen priorisieren.
7. `data-portability`: nach Festlegung der neuen persistenten Entitäten
   spezifizieren, damit Export und Import nicht sofort nachgebessert werden
   müssen.

Diese Reihenfolge ist eine technische Abhängigkeitsreihenfolge, keine Zusage,
dass alle Module vor ersten Kunden umgesetzt werden. Jedes Modul bleibt einzeln
lieferbar und kann bis zu seinem tatsächlichen Bedarf im Backlog bleiben.

## Rückverfolgung der ursprünglichen Liste

| Nr. | Festgehaltene Auswahl | Zielmodul | Behandlung |
|---:|---|---|---|
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
| 13 | Mealie-Integration prüfen | `mealie-evaluation` | Evaluation, noch keine Integrationszusage |
| 14 | Ausgaben- und Verbrauchsstatistik | `household-insights` | Übernommen |

## Vorgesehene Spec-Dateien nach Freigabe

```text
docs/specs/household-capabilities/
├── CAPABILITY_MAP.md
├── SPEC-inventory-lifecycle.md
├── SPEC-product-provenance.md
├── SPEC-cooking-suggestions.md
├── SPEC-replenishment-planning.md
├── SPEC-recipe-stock-review.md
├── SPEC-recipe-share-speech.md
├── SPEC-mealie-evaluation.md
├── SPEC-household-insights.md
└── SPEC-data-portability.md
```

Jede Modul-Spec erhält Ziel, Nutzerabläufe, fachliches Datenmodell,
Schnittstellen, Offline-/Sync-Verhalten, RLS-Grenzen, Fehler- und Undo-Fälle,
Tests, Nicht-Ziele und messbare Akzeptanzkriterien.

## Reviewfragen für die Freigabe

1. Sind die neun Modulgrenzen richtig, insbesondere die Zusammenfassung der
   Punkte 1 bis 3 und 5/6/11/12?
2. Soll `product-provenance` vor `inventory-lifecycle` spezifiziert werden, oder
   ist das Inventar-Ledger für euch die erste Umsetzung?
3. Ist `mealie-evaluation` bewusst nur eine Prüfung, bis Nutzen, Lizenz,
   Datenmodell und Sync-Risiken belegt sind?
4. Sollen alle neun Module als Roadmap-Scope gelten, obwohl vor ersten Kunden
   weiterhin nur der Kochvorschlags-Flow unmittelbare Produktpriorität hat?
