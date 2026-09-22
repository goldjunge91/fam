# Capability Map: Haushaltsbezogene Nachkauf-Prognosen

**Status:** Entwurf, wartet auf Freigabe durch Marco
**Version:** 0.1
**Quelle:** [`ocr-handwriting-reference-review-2026-09-22.md`](../../research/ocr-handwriting-reference-review-2026-09-22.md)
**Bead:** `fam-2cib`

Diese Map erweitert nicht die bestehende Receipt-Capability-Map in
[`CAPABILITY_MAP.md`](./CAPABILITY_MAP.md). Sie beschreibt die nachgelagerte,
haushaltsbezogene Prognose- und Vorschlagslogik. Vor einer Freigabe dieser Map
werden keine Modul-Specs und keine Produktionsänderungen begonnen.

## Ziel der Initiative

Haushaltsmitglieder sollen auf der bestehenden gemeinsamen Einkaufs- und
Bestandshistorie vorsichtige, erklärbare Hinweise erhalten:

- welcher bekannte Artikel wahrscheinlich wieder fällig wird;
- wann der nächste Kauf ungefähr zu erwarten ist;
- wie belastbar der Hinweis ist und worauf er beruht;
- warum ein Artikel vorgeschlagen, unterdrückt oder als „erst verwenden“
  eingeordnet wird.

Die Funktion ist ein Assistenzsignal, keine Behauptung über den tatsächlichen
Bestand. Ein Forecast darf nie stillschweigend einen Artikel auf die
Einkaufsliste setzen, Bestand ändern oder private Tracking-Daten verwenden.

## Annahmen für die Freigabeprüfung

1. Die Referenz-Fixtures sind quellenagnostische Domain-Eingaben. Für die
   Produktion ist die Datenverfügbarkeit ein eigenes Gate: `shopping_history`
   ist aktuell append-only und wird nicht in den lokalen Haushalts-Spiegel
   synchronisiert. Bestätigte Receipt-Daten sind synchronisiert, aber optional
   und nicht jeder Einkauf besitzt einen Receipt.
2. `product_id` oder eine ausdrücklich bestätigte Zuordnung ist die einzige
   verlässliche gemeinsame Produktidentität. Ein ähnlicher Name allein führt
   nicht zu einem automatischen Merge.
3. Die Prognose ist zunächst deterministische lokale Domain-Logik. Kein
   Cloud-Modell, keine externe KI und keine neue native Abhängigkeit.
4. Der Forecast wird lokal aus den tatsächlich im SQLite-Spiegel vorhandenen
   Beobachtungen berechnet. Eine vollständige haushaltsweite Offline-Prognose
   darf erst behauptet werden, wenn `shopping_history` entweder in den
   bestehenden Sync-Vertrag aufgenommen oder als Quelle ausdrücklich aus dem
   ersten Slice ausgeschlossen wurde. Eine serverseitige Prognose-Tabelle ist
   nicht vorausgesetzt.
5. Inventory darf als read-only Kontext für „ausreichend vorhanden“ und
   „erst verwenden“ dienen. Forecasting und Vorschläge schreiben dort nicht.
6. „Wieder kaufen“ und „bald fällig“ gehören in den ersten Slice. Ein
   „passt dazu“- oder Cross-Sell-Signal bleibt zunächst außerhalb des
   MVP-Vertrags, bis dafür ein eigener Nutzen und Qualitätsnachweis besteht.

## Übernahme der Referenz-Testdaten

Die fachlich relevanten Testfälle der Referenz werden so weit wie möglich als
TypeScript-/Jest-Fixtures und erwartete Ergebnisse übernommen. Die Referenz
bleibt dabei eine Quelle für Testabdeckung und Grenzfälle, nicht eine zweite
Produkt-Spezifikation und nicht eine Quelle für kopierten Dart-Testcode.

Der vollständige, wertgenaue Portierungsvertrag steht in
[`RESTOCK_FIXTURE_CATALOG.md`](./RESTOCK_FIXTURE_CATALOG.md). Dieses Dokument
ist die einzige Stelle, an der die übernommenen Referenzwerte und ihre
Erwartungen gepflegt werden.

Primäre Referenzdateien:

- `frontend/test/services/household_prior_service_test.dart`;
- `frontend/test/services/restock_service_test.dart`;
- `frontend/test/services/household_suggestion_engine_test.dart`;
- `frontend/test/storage/household_prior_queries_test.dart`.

Mindestens diese synthetischen Szenarien sollen in die späteren Specs und
Fixtures eingehen:

- unzureichende Historie, ein, zwei und viele Käufe sowie Shrinkage auf eine
  Haushaltskadenz;
- Median statt Mittelwert, unregelmäßige Abstände und die im Prior-Service
  verworfenen Null-/Negativ-Abstände;
- quartalsweise Käufe, veraltete Einmalkäufe und zeitlicher Verfall;
- Wochentags-Affinität ausschließlich aus der Artikelhistorie;
- Co-Occurrence mit kanonischen Paaren, fehlenden Marginalien, Begrenzung und
  deterministischer Reihenfolge;
- Haushalts-Isolation, Zusammenführung der aktuellen und älteren
  Historien-Query-Zweige und begrenzter älterer Kadenz-Tail;
- bereits aktive Einkaufslisten-Artikel, Überfälligkeit, Limit und stabile
  Tie-Breaker;
- Zusammenführung von Katalog-, Alias- und Nachkauf-Ergebnissen über eine
  kanonische Identität.

Die konkreten Datumswerte und synthetischen IDs dürfen übernommen werden, wenn
sie in die aktuellen Haushalts- und Produkt-IDs übersetzt werden. Die
Erwartungen werden als fachliche Goldfälle dokumentiert und bei abweichendem
Datenmodell im Spec begründet angepasst. Die Referenzwerte gelten nicht
automatisch als korrekte Produktentscheidung.

Der vollständige Referenzkatalog und private OCR-Fotos gehören nicht in den
normalen App-Testlauf. Ein großer Katalog wird nur nach Lizenzprüfung oder als
kleiner, selbst erzeugter Auszug verwendet. Private Bilder bleiben ein
separater, lokaler Benchmark und werden nicht in Repository, App-Bundle,
Supabase oder Jest-Fixtures kopiert.

## Capability Map

| Modul-ID | Verantwortung | Abhängigkeiten |
| --- | --- | --- |
| `purchase-memory` | Bestätigte Haushalts-Kaufbeobachtungen quellenneutral normalisieren, Quellenverfügbarkeit und Produktidentität transparent halten und doppelte Evidenz kontrolliert behandeln. | Sync-/Read-Model-Gate für `shopping_history` oder Receipt-Authority, Product-/Store-Grundlagen |
| `restock-forecast` | Aus normalisierten Beobachtungen eine deterministische Kaufspanne, Fälligkeit, Konfidenz und Erklärung ableiten. Die Funktion ist pure Domain-Logik ohne React, SQLite, Supabase oder Sync-Imports. | `purchase-memory` |
| `restock-suggestions` | Forecasts mit aktuellem Einkaufszettel, Inventory und Produktkatalog zusammenführen, Duplikate vermeiden, „wieder kaufen“ und „bald fällig“ ranken und eine explizit bestätigte Übernahme in die Einkaufsliste anbieten. | `purchase-memory`, `restock-forecast`, bestehende Shopping-/Inventory-Read- und Mutation-Owner |
| `memory-feedback` | Explizite Haushaltsentscheidungen wie übernehmen, später erinnern, nicht mehr kaufen und eine bestätigte Produktzuordnung reversibel speichern und künftig erklärbar berücksichtigen. | `restock-suggestions`, bestehende Haushalts-RLS-, Local-Mirror- und Outbox-Verträge |

## Build-Reihenfolge

```text
purchase-memory
    |
    v
restock-forecast
    |
    v
restock-suggestions
    |
    v
memory-feedback
```

`purchase-memory` definiert die Eingangs- und Identitätsgrenze. `restock-forecast`
bleibt dadurch testbar, ohne Datenbank oder UI zu kennen. `restock-suggestions`
ist die erste Consumer-Schicht. `memory-feedback` wird nicht als verstecktes
Training in einen Zyklus zurückgeführt, sondern erst nach einer expliziten
Bestätigung als zusätzlicher Haushaltskontext berücksichtigt.

## Boundary-Verträge

1. Nur bestätigte Haushaltsdaten dürfen in den Prognoseinput gelangen.
   Receipt-Observations sind nur zulässig, wenn der Parent-Receipt nicht
   gelöscht ist, `processing_status = 'confirmed'` besitzt, das Item nicht
   gelöscht ist und `review_status = 'confirmed'` besitzt. Kaufdatum,
   Haushaltszugehörigkeit und Parent-Join müssen vorhanden sein. Receipt-Drafts,
   OCR-Rohtext und private Kalorien-, Gewichts- oder Gesundheitsdaten sind
   ausgeschlossen.
2. `purchase-memory` liefert je Beobachtung mindestens `sourceKind`,
   `sourceRecordId`, Haushalt, ein bestätigtes Kaufdatum, Anzeigenamen und
   Identitätsstatus. `productId` ist für den Identity-Forecast bestätigt oder
   `null`. Menge, Einheit und Markt/Store werden als optionale, nullable
   Quellenfelder übernommen, wenn die Quelle sie liefert. Es erfindet keine
   Identität aus Namensähnlichkeit.
3. Ohne explizite Quellverknüpfung werden Shopping-History- und Receipt-
   Beobachtungen nicht stillschweigend zu einer gemeinsamen Kadenz gemischt.
   Source-Precedence und Cross-Source-Deduplizierung sind ein eigener Vertrag.
4. `restock-forecast` liefert eine Einschätzung mit Evidenzanzahl, letztem
   Kauf, typischem Abstand, erwarteter Zeitspanne, Status und verständlicher
   Begründung. Co-Occurrence darf im ersten MVP höchstens bereits bekannte,
   zulässige Kandidaten umsortieren. Sie erzeugt keinen neuen Cross-Sell-
   Kandidaten und keinen `goesWith`-Status. Der Forecast liefert kein
   autoritatives „leer“.
5. `restock-suggestions` unterdrückt aktive Duplikate auf der Einkaufsliste
   über dieselbe bestätigte `product_id`. Für einen ungebundenen Freitext-
   Eintrag ist zusätzlich nur ein exakt normalisierter Anzeigename als UI-
   Duplikatsschutz zulässig. Das ist keine Identitätszusammenführung und
   keine fuzzy Namenssuche. Das Wiederherstellen eines abgehakten Eintrags
   und das Hinzufügen eines neuen Eintrags bleiben getrennte, reversible
   Aktionen.
6. Inventory kann eine Prognose als „erst verwenden“ oder „bereits vorhanden“
   einordnen. Keine Forecast- oder Suggestion-Operation verändert
   `fridge_items`, Transaktionen oder Lagerorte automatisch.
7. Eine Übernahme in die Einkaufsliste benötigt eine sichtbare
   Nutzerbestätigung und läuft über den bestehenden Shopping-List-Owner mit
   seiner Outbox- und RLS-Grenze.
8. Feedback ist haushaltsbezogen und darf keine individuelle private
   Verhaltensakte über ein Haushaltsmitglied erzeugen. Jede spätere
   Persistenz braucht explizite RLS-, SQLite-, Sync- und Reverse-State-Verträge.
9. Eine spätere Receipt-Verknüpfung darf Receipt-Daten nicht nachträglich
   umschreiben und erzeugt keine implizite Bestandswirkung.

## Vorgesehene erste Produktbegriffe

Die genaue Copy gehört in die Modul-Specs und später in den UI-Owner. Inhaltlich
soll die App zwischen diesen Zuständen unterscheiden:

- **Noch keine belastbare Historie:** zu wenig Beobachtungen, kein Vorschlag;
- **Bald fällig:** der erwartete Kaufzeitpunkt nähert sich;
- **Wahrscheinlich fällig:** der typische Abstand ist überschritten;
- **Bereits vorhanden:** Inventory liefert ausreichend Bestand;
- **Erst verwenden:** Bestand oder nahes Ablaufdatum spricht gegen einen
  Nachkauf;
- **Nicht mehr vorschlagen:** explizites, reversibles Haushaltsfeedback.

## Nicht Bestandteil dieser Map

- automatische Käufe, Bestellungen oder Benachrichtigungen ohne Bestätigung;
- automatische Änderungen an Inventory, Fridge oder Receipt-Authority;
- private Nutrition-, Gewicht-, Medikamenten-, Fasten-, Vital- oder Workoutdaten;
- ein generatives oder serverseitiges Prognosemodell;
- automatische Namenszusammenführung ohne bestätigte Produktidentität;
- „passt dazu“, Cross-Sell und Preisoptimierung im ersten Slice;
- neue generische Sync-, Queue- oder ML-Infrastruktur;
- UI-Mockups oder Komponentenimplementierung vor einer freigegebenen Spec.

## Offene Freigabefragen

1. Soll `shopping_history` in den bestehenden lokalen Sync-Vertrag aufgenommen
   werden, oder soll der erste produktive Slice ausschließlich aus bestätigten
   Receipt-Items arbeiten und damit bewusst unvollständig bleiben?
2. Soll `memory-feedback` bereits im ersten Release synchronisiert und für den
   ganzen Haushalt sichtbar sein, oder zunächst nur als spätere Capability
   geplant werden?
3. Ist die vorgeschlagene read-only Inventory-Berücksichtigung im ersten
   Slice gewünscht, insbesondere die Unterscheidung zwischen „bald kaufen“
   und „erst verwenden“?
4. Welcher explizite Vertrag verbindet einen Shopping-History-Eintrag mit
   einem Receipt-Item, damit derselbe Kauf nicht doppelt in einer Kadenz zählt?

5. Welche konkrete lokale Kalenderzone besitzt der Forecast zur Auswertung
   von Kalenderdaten und Wochentagen? Der Jest-Adapter muss diese Zone explizit
   setzen und darf keine Host-Zeitzone über native Date-Getter übernehmen.

## Freigabe-Gate

Die Map ist freigegeben, wenn Modulgrenzen, Abhängigkeitsrichtung,
Build-Reihenfolge und die fünf offenen Fragen bestätigt oder geändert wurden.
Danach entstehen je Modul eigene Specs mit Objective, Commands,
Project Structure, Code Style, Testing Strategy, Boundaries, Success Criteria
und Open Questions. Erst nach deren Freigabe beginnt eine Implementierung.
