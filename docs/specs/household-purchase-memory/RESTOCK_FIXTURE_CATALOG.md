# Restock Fixture Catalog

**Status:** Entwurf, wertgenauer Portierungsvertrag
**Bezug:** [`CAPABILITY_MAP-restock.md`](./CAPABILITY_MAP-restock.md)
**Bead:** `fam-2cib`
**Quelle:** lokale Referenz unter `/Volumes/Programme/ocr-reference`

Dieses Dokument hält die Datenwerte und erwarteten Ergebnisse der relevanten
Referenztests fest. Spätere TypeScript-/Jest-Fixtures müssen diese Fälle mit
denselben Werten und Erwartungen abbilden. Eine Abweichung ist nur zulässig,
wenn sie in der jeweiligen Spec begründet und ausdrücklich entschieden wird.

Es wird kein Dart-Testcode portiert. Dieses Dokument portiert die fachlichen
Testvektoren, Eingabewerte und beobachtbaren Ergebnisse.

## Referenz-zu-Haushaltsapp-Mapping

| Referenz | Haushaltsapp-Fixture |
| --- | --- |
| `groupId` | `householdId` |
| `canonicalItemId` | bestätigte `productId` oder explizit bestätigte Produktidentität |
| `purchaseHistoryTable` | normalisierte Beobachtung aus `shopping_history`, später optional Receipt-Observation |
| `purchasedAt` | `completed_at` der Shopping-Historie oder Kaufdatum des bestätigten Receipts |
| `currentItemNames` | aktive Einkaufslisten-Artikel des Haushalts |
| `itemCooccurrenceTable` | Fixture-only-Kontextsignal, keine implizite neue Produktions-Tabelle |
| Referenz-`RestockReason` `due` | Prognosestatus „wahrscheinlich fällig“ |
| Referenz-`RestockReason` `usual` | Prognosestatus „wiederkehrender Haushaltsartikel“ |
| Referenz-`RestockReason` `goesWith` | kompatibler Referenzfall „passt dazu“, für den ersten UI-Slice noch nicht freigegeben |

Die Zeitsemantik des jeweiligen Referenztests bleibt erhalten. Fixture A nutzt
explizite UTC-Werte (`DateTime.utc`). Die Referenztests für B, C und D erzeugen
lokale Dart-`DateTime`-Werte und verwenden für Wochentage die lokale Zeit. Der
Port legt diese Fälle in einer festen `Europe/Berlin`-Testzeitzone an, damit
kein Testhost die Ergebnisse verändert. B und D verwenden im August bzw. Juni
`+02:00`; C verwendet im Januar `+01:00`. Das ist der vorläufige Fixture-
Baseline-Wert und bleibt bis zur Beantwortung von Map-Frage 5 eine explizite
Portierungsentscheidung, keine implizite Produktzeitzone. Date-only-Werte
dürfen nicht von der lokalen Zeitzone des Testhosts abhängen.

Die IDs `g1`, `g2`, `g-one`, `group-1` und ähnliche Werte sind synthetische
Fixture-Labels zur Rückverfolgbarkeit. Sie sind keine Produktions- oder
Benutzer-IDs.

## Normalisierte Beobachtung und Quellenautorität

Vor dem Forecast werden Referenzzeilen in ein quellenneutrales Beobachtungs-
format übersetzt. Jede Zeile enthält mindestens:

| Feld | Vertrag |
| --- | --- |
| `sourceKind` | z. B. `shoppingHistory` oder `receipt` |
| `sourceRecordId` | stabile ID des Quellrecords, niemals nur der Anzeigename |
| `householdId` | Haushalt aus der autoritativen Zuordnung |
| `productId` | bestätigte Identität oder `null`; `null` wird vom Identity-Forecast ausgeschlossen |
| `identityStatus` | `confirmed` oder ein explizit dokumentierter Mapping-Status |
| `itemName` | Anzeige-/Fallbackname, nicht der Identitätsschlüssel |
| `quantity`, `unit` | Menge und Einheit, sofern die Quelle sie liefert |
| `storeId` | Markt/Quelle, sofern vorhanden |
| `purchasedOn` | bestätigtes lokales Kalenderdatum, für alle Quellen Pflicht |
| `purchasedAt` | bestätigter Zeitpunkt, wenn die Quelle eine Uhrzeit liefert; bei date-only-Receipts `null` |

Receipt-Observations dürfen nur aus einem nicht gelöschten Receipt mit
`processing_status = confirmed` und einem nicht gelöschten Item mit
`review_status = confirmed` stammen. Parent-Join, Haushaltszugehörigkeit und
`purchase_date` sind Pflicht. `shopping_history` liefert `purchasedAt` aus
`completed_at` und `purchasedOn` aus dieser Zeit in der festgelegten
Fixture-/Haushaltszone. Ein Receipt liefert `purchasedOn` aus `purchase_date`, aber
keinen erfundenen Mitternachtszeitpunkt. Ein fehlendes Receipt-Datum ist daher
nicht prognosefähig. `shopping_history` bleibt bis zur Sync-Entscheidung eine
separat verfügbare Quelle. Ohne explizite Quellverknüpfung wird nicht
automatisch dedupliziert oder quellenübergreifend gezählt.

Die Zeit- und Wochentagsberechnung verwendet ausschließlich diese explizit
festgelegte Haushaltszone. Jest-Fixtures dürfen weder die Host-Zeitzone noch
unqualifizierte lokale `Date`-Getter als versteckte Eingabe verwenden.

## Referenzparameter

Diese Werte stammen aus `HouseholdPriorDefaults` und sind die Baseline für die
Portierung. Sie sind noch kein stillschweigend freigegebener Produktvertrag.

| Parameter | Referenzwert |
| --- | ---: |
| `lexPrefixWeight` | `1.8` |
| `lexSimWeight` | `1.6` |
| `lexSemanticWeight` | `0.9` |
| `familiarityWeight` | `1.5` |
| `dueWeightedWeight` | `1.5` |
| `cooccurrenceWeight` | `1.2` |
| `dayOfWeekWeight` | `0.5` |
| `bias` | `-2.2` |
| `decayDays` | `60` |
| `shrinkageK` | `3` |
| `fallbackCadenceDays` | `14` |
| `cacheTtl` | `300` Sekunden |
| `restockFloor` | `0.15` |

Der Referenz-Read-Window beträgt `decayDays * 4 = 240` Tage. Die Query-
Standardwerte sind `recentLimit = 5000` und `cadencePerItemLimit = 10`.

## Fixture A: Historienabfrage

Quelle: `frontend/test/storage/household_prior_queries_test.dart`.

### A1. Zeitanker und Kaufzeilen

Der Test verwendet `anchor = 2026-08-12T00:00:00Z` und
`since = anchor - 240 Tage = 2025-12-15T00:00:00Z`.

| ID | Haushalt | Produktidentität | Zeitpunkt | Erwartete Rolle |
| --- | --- | --- | --- | --- |
| `recent-0` | `g1` | `milk` | `2026-08-12T00:00:00Z` | jüngste gültige Zeile |
| `recent-1` | `g1` | `milk` | `2026-08-11T00:00:00Z` | gültige Zeile |
| `recent-2` | `g1` | `milk` | `2026-08-10T00:00:00Z` | gültige Zeile |
| `recent-3` | `g1` | `milk` | `2026-08-09T00:00:00Z` | wegen `recentLimit = 3` nicht im Ergebnis |
| `old-0` | `g1` | `quarterly` | `2025-11-15T00:00:00Z` | älterer Kadenz-Tail, Position 1 |
| `old-1` | `g1` | `quarterly` | `2025-10-16T00:00:00Z` | älterer Kadenz-Tail, Position 2 |
| `old-2` | `g1` | `quarterly` | `2025-09-16T00:00:00Z` | wegen `cadencePerItemLimit = 2` ausgeschlossen |
| `old-3` | `g1` | `quarterly` | `2025-08-17T00:00:00Z` | wegen `cadencePerItemLimit = 2` ausgeschlossen |
| `other-group` | `g2` | `milk` | `2026-08-12T00:00:00Z` | ausgeschlossen, fremder Haushalt |
| `null-canonical` | `g1` | `null` | `2026-08-12T00:00:00Z` | ausgeschlossen, keine Identität |

Query-Aufruf:

```text
householdId: g1
since: 2025-12-15T00:00:00Z
recentLimit: 3
cadencePerItemLimit: 2
```

Erwartete Ergebnismenge:

```text
{recent-0, recent-1, recent-2, old-0, old-1}
```

Erwartete Reihenfolge nach `purchasedAt` absteigend:

```text
[recent-0, recent-1, recent-2, old-0, old-1]
```

### A2. Lifetime-Zählung

Kaufzeilen im Haushalt `g1`: `a1:a`, `a2:a`, `b1:b`, `null:null`.
Zusätzlich existiert `foreign:a` im Haushalt `g2`.

Erwartung:

```text
{a: 2, b: 1}
```

Die Null-Identität und der fremde Haushalt erscheinen nicht im Ergebnis.

### A3. Co-Occurrence-Reihenfolge

| Haushalt | Paar | Count | `lastSeenAt` |
| --- | --- | ---: | --- |
| `g1` | `z:x` | `4` | `2026-08-12T00:00:00Z` |
| `g1` | `a:b` | `4` | `2026-08-12T00:00:00Z` |
| `g1` | `c:d` | `4` | `2026-08-11T00:00:00Z` |
| `g1` | `top:pair` | `5` | `2026-08-07T00:00:00Z` |
| `g2` | `foreign:pair` | `99` | `2026-08-12T00:00:00Z` |

Aufruf: `householdId = g1`, `limit = 3`.

Erwartete Reihenfolge:

```text
[top:pair, a:b, z:x]
```

Gleiche Counts werden durch `lastSeenAt` und anschließend deterministisch durch
die gespeicherte `itemAId`-/`itemBId`-Reihenfolge stabilisiert. Der Referenz-
Query sortiert `count DESC`, `lastSeenAt DESC`, `itemAId ASC`, `itemBId ASC`
und kanonisiert die beiden Endpunkte nicht. `c:d` und der fremde Haushalt
erscheinen nicht. Die symmetrische Paar-Kanonisierung ist ein separater
Prior-Lookup-Vertrag aus B5.

### A4. Listen-Typ-Lookup

Dies ist ein reference-only Storage-Helper. Die aktuelle Haushaltsapp hat
keinen freigegebenen Produktionsvertrag, der einen Listen-Typ-Lookup als Teil
des Forecasts voraussetzt. Der Fall wird nur übernommen, wenn später ein
entsprechender Read-Model-Adapter spezifiziert wird.

| Listen-ID | gespeicherter Typ | Erwartung |
| --- | --- | --- |
| `shopping-list` | `shopping` | `shopping` |
| `missing` | nicht vorhanden | `null` |

## Fixture B: Prior-Berechnung

Quelle: `frontend/test/services/household_prior_service_test.dart`.

Der zweite Testanker lautet als lokale Berliner Testzeit
`now = 2026-08-12T12:00:00+02:00`.

### B1. Familiarity und Altersgrenze

| Produkt | Kaufzeitpunkt | Erwartung |
| --- | --- | --- |
| `now` | `now` | `familiarity = 0.5` |
| `sixty-days` | `now - 60 Tage` | `familiarity = 1 / (1 + 2.718281828459045) = 0.2689414214…` |
| `future` | `now + 2 Tage` | `familiarity = 0.5`, zukünftiges Alter wird auf null begrenzt |
| `missing` | keine Zeile | `familiarity = 0` |

### B2. Cadence-Shrinkage

| Haushalt | Produkt | Kaufzeitpunkte | Erwartetes `estimatedIntervalDays` |
| --- | --- | --- | ---: |
| `g-one` | `one` | ein Kauf bei `now` | `14` |
| `g-two` | `two` | `now - 28 Tage`, `now` | `20` |
| `g-ten` | `ten` | zehn Käufe bei `now - 252`, `-224`, `-196`, `-168`, `-140`, `-112`, `-84`, `-56`, `-28`, `0` Tagen | `25` |

Zusätzliche Referenzzeilen, die den Haushaltskontext vervollständigen und
absichtlich den Haushaltsmedian bestimmen:

| Haushalt | Produkt | Kaufzeitpunkte | Zweck |
| --- | --- | --- | --- |
| `g-two` | `weekly` | `now - 7 Tage`, `now` | eigener Gap `7`; beeinflusst den Haushaltsmedian, nicht die `two`-Gaps |
| `g-ten` | `weekly` | `now - 7 Tage`, `now` | eigener Gap `7`; beeinflusst den Haushaltsmedian, nicht die `ten`-Gaps |

Diese Zeilen gehören zu anderen Produktidentitäten. Sie dürfen nicht in die
produktbezogenen Gap-Listen von `two` oder `ten` einfließen, müssen aber in die
jeweilige Haushaltsmedian-Berechnung einfließen. Das ist der Grund, warum die
Referenz trotz eines produktbezogenen Gaps von `28` Tagen auf `20` bzw. `25`
Tage shrinkt:

```text
g-two: householdMedian = median(28, 7) = 17.5
       estimated = (1 * 28 + 3 * 17.5) / 4 = 20.125 -> round = 20

g-ten: householdMedian = median(28, 7) = 17.5
       estimated = (9 * 28 + 3 * 17.5) / 12 = 25.375 -> round = 25
```

### B3. Doppelte Gaps und alter Einmalkauf

Für `quarterly` werden bei `old = now - 500 Tage` diese vier Zeilen angelegt:

```text
old
old                 // identischer Zeitpunkt, Gap 0
old + 90 Tage
old + 180 Tage
```

Erwartung:

```text
estimatedIntervalDays = 90
familiarity = 0
```

Das Ignorieren des identischen Zeitpunkts gilt hier für den Prior-Cadence-
Vertrag: Nichtpositive Gaps werden vor der Medianbildung verworfen. Es ist
nicht automatisch eine Regel für den separaten reinen Helper in Fixture C.

Für `abandoned` existiert nur ein Kauf bei `now - 400 Tage`. Erwartung:

```text
top(context).contains('abandoned') = false
```

### B4. Wochentags-Affinität

- `milk` wird einmal bei `now - 7 Tage` gekauft.
- `noise` wird 20-mal bei `now - 1`, `now - 2`, ..., `now - 20 Tagen`
  gekauft.

Erwartung für `featuresFor('milk', context).dayOfWeek`:

```text
0.375
```

Die `noise`-Historie darf die Wochentags-Affinität von `milk` nicht verändern.

### B5. Co-Occurrence-Features

- `candidate` wird viermal bei `now` gekauft.
- `context` wird zweimal bei `now` gekauft.
- Die gespeicherte Zeile lautet `itemAId = context`, `itemBId = candidate` und
  hat `count = 2`. Für den symmetrischen Lookup wird das Paar lexikografisch
  zur Schlüsselrepräsentation `candidate:context` normalisiert.

Erwartungen für `candidate`:

| `listContextIds` | Erwartung `cooccurrence` |
| --- | --- |
| `['context', 'context']` | größer als `0` |
| `[]` | `0` |
| `['missing-marginal']` | `0` |

### B6. Scorer-Reihenfolge

Mit den Referenzparametern muss gelten:

```text
score(
  lexSim = 0.70,
  familiarity = 0.95,
  dueWeighted = 0.70,
  cooccurrence = 0.80,
  dayOfWeek = 0.50
)
>
score(lexPrefix = 1.0, lexSim = 0.75, prior = zero)
```

Bei identischem Prior gilt außerdem:

```text
score(lexPrefix = 1.0, lexSim = 0.70)
>
score(lexPrefix = 0.0, lexSim = 0.70)
```

### B7. Cache und Fehler-Recovery

Für `g1` werden zwei parallele `baseContext`-Aufrufe während eines blockierten
Loads gestartet.

Erwartungen:

1. Während des parallelen Loads findet genau ein History-Read statt.
2. Beide Aufrufe liefern dieselbe Context-Identität.
3. Ein weiterer Aufruf für `g1` vor Ablauf von `300` Sekunden verwendet denselben
   Cache-Eintrag. Genau `300` Sekunden gelten als abgelaufen, weil die
   Referenzgrenze strikt `< 300` ist.
4. `g2` besitzt einen getrennten Context und löst den zweiten History-Read aus.
5. Nach `now + 301 Sekunden` wird `g1` neu geladen; die History-Read-Anzahl ist
   dann `3`.
6. In einem frischen Testfall wird ein synthetischer History-Read-Fehler
   erzeugt. Der fehlerhafte Cache-Eintrag wird entfernt. Der nächste Aufruf
   darf erneut laden und beendet sich erfolgreich; die Read-Anzahl beträgt in
   diesem isolierten Testfall danach `2`.

## Fixture C: Reine Restock-Helfer

Quelle: `frontend/test/services/restock_service_test.dart`.

Dieser reine `RestockService.medianInterval`-Helper ist nicht derselbe
Medianvertrag wie die Prior-Cadence aus B3. Die Prior-Cadence verwirft
Nichtpositive Gaps vor der Medianbildung. Der reine Helper prüft in der
Referenz nur `timestamps.length < 3`, bildet danach die benachbarten Gaps und
sortiert diese; die Referenztests enthalten für diesen Helper keinen
Null-Gap-Fall. Die beiden TypeScript-Funktionen müssen deshalb getrennt
benannt und getestet werden.

Der Median-Helper erhält chronologisch sortierte Zeitpunkte in fester
`Europe/Berlin`-Testzeit. Die Referenz sortiert die Eingabezeitpunkte nicht
vorher, sondern bildet daraus Gaps und sortiert nur die Gap-Dauern. Die
Eingaben dieses Katalogs sind wie im Referenztest chronologisch, sodass keine
zusätzliche Sortierung oder Negativfall-Entscheidung versteckt wird.

| Exakte Eingabezeitpunkte | Erwartung |
| --- | --- |
| `[]` | `null` |
| `[2024-01-01T00:00:00+01:00]` | `null` |
| `[2024-01-01T00:00:00+01:00, 2024-01-08T00:00:00+01:00]` | `null`, Historie unzureichend |
| `[2024-01-01T00:00:00+01:00, 2024-01-08T00:00:00+01:00, 2024-01-15T00:00:00+01:00, 2024-01-22T00:00:00+01:00]` | `7 Tage` |
| `[2024-01-01T00:00:00+01:00, 2024-01-03T00:00:00+01:00, 2024-01-11T00:00:00+01:00, 2024-01-25T00:00:00+01:00]` | `8 Tage` |
| `[2024-01-01T00:00:00+01:00, 2024-01-02T00:00:00+01:00, 2024-01-05T00:00:00+01:00, 2024-01-10T00:00:00+01:00, 2024-01-17T00:00:00+01:00, 2024-04-26T00:00:00+01:00]` | `5 Tage` |

In kompakter Form erhält der Median-Helper damit diese Ergebnisse:

| Eingabe | Erwartung |
| --- | --- |
| `[]` | `null` |
| `[2024-01-01]` | `null` |
| `[2024-01-01, 2024-01-08]` | `null`, Historie unzureichend |
| vier Zeitpunkte ab `2024-01-01` mit Abstand `7` Tagen | `7 Tage` |
| Gaps `2, 8, 14` Tage | `8 Tage` |
| Gaps `1, 3, 5, 7, 100` Tage | `5 Tage` |

Die Daten müssen als Zeitpunkte und nicht als vorab berechnete Intervalle
portiert werden, damit die Gap-Bildung selbst getestet bleibt. Die zweite
Zeile verwendet absichtlich zwei Zeitpunkte mit sieben Tagen Abstand, weil
genau zwei Zeitpunkte laut Referenz noch kein Median-Ergebnis liefern.

## Fixture D: Restock-Service und Rangfolge

Der Testanker lautet als lokale Berliner Testzeit
`currentNow = 2024-06-10T00:00:00+02:00`.

`seedPurchases(itemId, lastPurchase, count, gapDays)` erzeugt für
`i = 0 .. count - 1` den Zeitpunkt:

```text
lastPurchase - ((count - 1 - i) * gapDays)
```

### D1. Status und Cadence

Jede Zeile ist ein isolierter `setUp`-Fall mit einem frischen In-Memory-
Haushalt. Die mehrfach verwendete Produkt-ID `milk` bedeutet keine
Zusammenführung zwischen diesen Fällen.

| Produkt | Letzter Kauf | Anzahl | Gap | Erwartung |
| --- | --- | ---: | ---: | --- |
| `milk` | `currentNow - 9 Tage` | `4` | `7` | erscheint in den Ergebnissen |
| `milk` | `currentNow - 3 Tage` | `4` | `7` | erscheint, `reason = usual` |
| `milk` | `currentNow - 20 Tage` | `2` | `7` | erscheint, `intervalDays = 7` |
| `milk` | `currentNow - 2 Tage` | `1` | `7` | erscheint, `intervalDays = 14`, `daysSince = 2` |
| `milk` | `currentNow - 400 Tage` | `1` | `7` | ausgeschlossen |

### D2. Aktive Einkaufsliste

Dies ist der genaue Referenzfall für die damalige Name-only-Filterung, nicht
die aktuelle Haushaltsapp-Identitätsregel. Er bleibt als Kompatibilitätsfall
markiert, damit die Abweichung später bewusst entschieden wird.

Für `milk` wird ein kanonischer Katalogeintrag angelegt:

```text
id = milk
groupId = g1
nameEn = Milk
nameDe = Milch
category = dairy
defaultUnit = l
```

`groupId`, die mehrsprachigen Namen, `category` und `defaultUnit` bilden hier
die Referenz-Fixture-Projektion. Sie sind keine zusätzliche aktuelle
Forecast-Identität und ersetzen nicht die bestätigte Haushaltsapp-`product_id`.

Mit `currentItemNames = {'milk'}` wird `milk` in der Referenz ausgeschlossen,
weil der aufgelöste Anzeigename `Milk` normalisiert mit `milk` übereinstimmt.
Für die aktuelle App gilt dagegen: Bei einem aktiven Listeneintrag mit
nichtleerer bestätigter `product_id` erfolgt die Unterdrückung nur über
dieselbe Produkt-ID. Derselbe Name mit anderer Produktidentität wird nicht
unterdrückt; derselbe Product-Key mit abweichendem Anzeigenamen wird
unterdrückt. Bei einem aktiven Listeneintrag ohne `product_id` darf ein exakt
normalisierter Anzeigename ausschließlich als UI-Duplikatsschutz unterdrücken.
Er darf niemals Historien, Katalogkandidaten oder Produktidentitäten
zusammenführen. Fuzzy-Namensähnlichkeit bleibt ausgeschlossen.

Die optionale `product_id` der aktuellen `shopping_list_items`-Struktur ist
der Grund für diese zweistufige Regel. D2 bleibt als Referenzfall mit
`currentItemNames` erhalten; die Produktions-Fixture muss beide Fälle separat
prüfen.

### D3. Überfälligkeit

- `milk`: vier Käufe im Abstand von sieben Tagen, letzter Kauf vor 20 Tagen,
  also `13` Tage über der erwarteten Kadenz.
- `eggs`: vier Käufe im Abstand von sieben Tagen, letzter Kauf vor 9 Tagen,
  also `2` Tage über der erwarteten Kadenz.

Erwartete Mindestassertionen:

```text
results.length >= 2
results.first.canonicalItemId = milk
```

Die Referenz behauptet keine feste zweite Position für `eggs`; die spätere
Jest-Fixture darf diese Reihenfolge daher nicht stärker festschreiben.

### D4. Co-Occurrence als `goesWith`

`candidate` und `context` werden jeweils einmal bei `currentNow - 1 Tag`
gekauft. Zusätzlich werden 30 `noise`-Käufe bei
`currentNow - 300`, `-301`, ..., `-329 Tagen` angelegt. Das Paar
`candidate:context` hat `count = 1` und `lastSeenAt = currentNow`.

Mit `listContextIds = ['context']` gilt:

```text
candidate.reason = goesWith
```

Dieser Fall bleibt als quarantinierter Referenz-Kompatibilitätsfall im
Katalog. Er ist keine Produktions-Goldassertion für den ersten MVP, weil
`goesWith` beziehungsweise „passt dazu“ in der Capability Map zunächst
ausgeschlossen ist.

### D5. Limit und Tie-Breaker

`c`, `a` und `b` werden jeweils einmal bei `currentNow - 2 Tagen` gekauft.
Mit `limit = 2` gilt:

```text
[a, b]
```

Die gleiche Rangstufe wird lexikografisch über die kanonische ID stabilisiert.

## Fixture E: Suggestion-Engine

Quelle: `frontend/test/services/household_suggestion_engine_test.dart`.

Basis-Katalogeintrag:

```text
canonicalItemId = milk
name = Milk
category = dairy
unit = l
```

### E1. Gleiche kanonische Identität aus zwei Quellen

`milk` wird einmal aus `bundled` und einmal aus `catalog` geliefert.

Erwartung:

```text
suggestions.length = 1
suggestions[0].canonicalItemId = milk
suggestions[0].sources = {bundled, catalog}
```

### E2. Legacy-Produkt: Referenz-Kompatibilitätsfall

Die Referenz führt das Legacy-Produkt über den Namen mit `milk` zusammen.
Das Ergebnis wird vollständig festgehalten, ist aber kein aktueller
Haushaltsapp-Goldwert, weil ein Name allein keine Produktidentität autorisiert.

Zusätzlich zum Katalogeintrag existiert:

```text
productId = product-1
groupId = group-1
name = Milk
unit = l
createdAt = 2026-01-01T00:00:00Z
updatedAt = 2026-01-01T00:00:00Z
```

Beobachtetes Referenzergebnis:

```text
suggestions.length = 1
suggestions[0].canonicalItemId = milk
suggestions[0].sources contains product
```

Aktuelle Haushaltsapp-Adaption:

- Ohne explizite Zuordnung zwischen `product-1` und `milk` gibt es keinen
  Merge. `product-1` bleibt als eigener, durch seine stabile Produkt-ID
  identifizierter Kandidat erhalten; `milk` bleibt ein separater Kandidat.
- Mit einer explizit gespeicherten Zuordnung darf das beobachtete
  Referenzergebnis als Merge-Goldwert verwendet werden.
- Ein Quellkandidat ohne stabile bestätigte Produktidentität darf nicht in den
  Identity-Forecast gelangen. Ob er außerhalb des Identity-Forecasts als
  ungebundener Textvorschlag angezeigt wird, ist ein separater UI-Vertrag und
  kein E2-Forecast-Goldwert.

`groupId`, `nameEn`, `nameDe`, `category`, `defaultUnit` und `unit` sind in
diesem E2-Fall eine Referenz-/Fixture-Projektion. Sie begründen keine
abweichende aktuelle Datenbankschema- oder Identitätsregel.

### E3. Restock vor leerem Composer

Bei Query `''` werden ein gebundeltes `milk` und folgende Restock-Zeile
gesetzt:

```text
canonicalItemId = eggs
name = Eggs
intervalDays = 7
daysSince = 9
```

Erwartung:

```text
suggestions[0].canonicalItemId = eggs
suggestions[0].sources contains restock
```

### E4. Bestehende Katalogreihenfolge bleibt erhalten

Mit Query `mil` werden diese zwei bereits gerankten Katalogwerte gesetzt:

```text
familiar = {
  canonicalItemId: familiar,
  name: Weekly staple,
  category: pantry,
  unit: '',
}

prefix = {
  canonicalItemId: prefix,
  name: Milk substitute,
  category: dairy,
  unit: '',
}
```

Erwartete Reihenfolge:

```text
[familiar, prefix]
```

Die Suggestion-Engine darf die bestehende Katalogreihenfolge nicht nachträglich
durch eine eigene Prefix-Sortierung ersetzen.

## Portierungs- und Assertion-Regeln

1. Werte mit `toSet()`-Erwartung werden als ungeordnete Mengen geprüft.
2. Alle im Referenztest ausdrücklich geordneten Listen bleiben geordnet und
   erhalten ihren Tie-Breaker.
3. Gleitkommawerte werden mit der Referenzpräzision portiert. Die expliziten
   Toleranzen aus den Tests sind `1e-9` für `familiarity` und `dayOfWeek`.
4. Intervalle, Counts, Limits, Read-Anzahlen und Statuswerte werden exakt
   geprüft.
5. Ein Adapter darf Referenznamen wie `groupId` in `householdId` übersetzen,
   aber keine erwarteten Werte stillschweigend runden, normalisieren oder
   zusammenführen. Referenz-Kompatibilitätsfälle mit Name-only-Merge,
   `goesWith` oder Listen-Typ-Lookup bleiben ausdrücklich markiert und werden
   nicht ohne Produktentscheidung zu Produktions-Goldwerten.
6. Änderungen an einem Goldwert müssen gleichzeitig die Quelle, den Grund,
   die betroffene Capability-Spec und den Bead-Nachweis aktualisieren.
7. Die Referenz-Fixtures werden in späteren Tests von der produktiven
   Forecast-Domain verarbeitet. Die Domain wird nicht durch einen Mock ersetzt.

## Daten, die nicht portiert werden

- private OCR-Fotos und private Handschrift-Crops;
- echte Account-, Haushalts-, Listen- oder Nutzer-IDs aus der Referenz. Die
  synthetischen Labels `g1`, `g2`, `group-1` und `shopping-list` bleiben als
  nachvollziehbare Fixture-Werte erhalten und dürfen nicht als echte
  Produktions-IDs verwendet werden;
- der vollständige 3.239-Einträge-Katalog ohne separate Lizenzprüfung;
- Flutter-, Dart-, Drift- und Go-Test-Harnesses;
- Referenz-SQL- oder Sync-Strukturen als Produktionsarchitektur.

Wenn ein großer Katalog für einen späteren Identitäts-Benchmark benötigt wird,
wird ein kleiner, selbst erzeugter, lizenzklarer Auszug mit denselben
semantischen Fällen angelegt.
