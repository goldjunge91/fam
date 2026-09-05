# Produktmessung: weniger Lebensmittelabfall

Status: Messdefinition für die erste Produktvalidierung

Bezug: `fam-o57` · Capability `food-waste-meal-suggestions`

## Ziel

Nach einem funktionierenden Rezeptvorschlagsfluss soll geprüft werden, ob
Haushalte nach 30 Tagen weniger priorisierte Lebensmittel wegwerfen. Ein
Vorschlagsaufruf, das Öffnen eines Rezepts oder das Speichern eines Rezepts
zählt nicht als gerettetes Lebensmittel.

## Primärmetrik

Die primäre Metrik ist die bestätigte Rettungsquote für priorisierte Mengen:

```text
bestätigt verbrauchte priorisierte Menge
------------------------------------------------
bestätigt verbrauchte priorisierte Menge
+ bestätigt als waste verbuchte priorisierte Menge
```

Es zählen ausschließlich Mengen aus den bestätigten Bestands-Reviews und den
normalen `out`- bzw. `waste`-Transaktionen. Unbekannte Mengen werden weder im
Zähler noch im Nenner geschätzt. Einheiten werden nur mit einer autoritativen
Umrechnung innerhalb derselben Dimension zusammengeführt, zum Beispiel `1 kg`
und `1000 g`. Stück, Packungen und Portionen bleiben ohne hinterlegtes Gewicht
getrennt.

Die Auswertung erfolgt auf Haushaltsebene und anschließend aggregiert über die
Kohorte. Ein Haushalt gehört zur Expositionskohorte, wenn im Messzeitraum
mindestens ein gültiger Vorschlag angezeigt wurde. Für einen Vorher-Nachher-
Vergleich werden die 30 Tage vor dem ersten gültigen Vorschlag als Baseline
und die folgenden 30 Tage als Beobachtungsfenster verwendet. Haushalte ohne
beide erforderlichen Fenster werden nicht als Erfolg oder Misserfolg gewertet.

## Grobe Plausibilitätskontrolle

Als sekundäre Plausibilitätskontrolle wird der Anteil priorisierter Lots
gemessen, deren bestätigte Menge im Beobachtungsfenster sinkt, ohne dass ein
`waste`-Ereignis für den Lot gemeldet wird:

```text
priorisierte Lots mit bestätigtem Verbrauch ohne waste
-------------------------------------------------------
priorisierte Lots mit bekanntem Verbrauchs- oder waste-Ausgang
```

Diese Kennzahl ist nur ein Nutzungssignal. Ein sinkender Bestand beweist nicht,
dass ein Lebensmittel gegessen wurde. Die Primärmetrik bleibt deshalb die
Mengenquote aus bestätigtem Verbrauch und bestätigtem Waste.

## Ereignisse

Die App darf nur technische Aggregationen senden. Rohes Inventar, Namen,
MHDs, Allergien, Rezepttexte, Lot-IDs und Haushalts-IDs gehören nicht in die
Produkttelemetrie.

| Ereignis | Zeitpunkt | Zweck |
|---|---|---|
| `meal_suggestion.request.completed` | Ergebnis liegt vor | Funnel und Katalog-/Fallback-Anteil |
| `meal_suggestion.view.completed` | Vorschläge sichtbar | Anzeige-Funnel |
| `meal_suggestion.cook_review.completed` | Review bestätigt oder abgeschlossen | bestätigte Verbrauchsmengen zählen |
| `meal_suggestion.save.completed` | Rezept ausdrücklich gespeichert | Speichern getrennt von Verbrauch messen |
| `inventory_item.consume.completed` | bestehende bestätigte `out`-Transaktion | positiver Outcome |
| `inventory_item.waste.completed` | bestätigte `waste`-Transaktion | negativer Outcome |

`meal_suggestion.cook_review.completed` enthält nur Zählwerte. Die belastbare
Menge wird aus der nachfolgenden autoritativen Bestands-Transaktion bezogen,
nicht aus einem Modelloutput oder einem Klick.

## Getrennte Betriebsmetriken

Providerkosten, Prompt-/Completion-/Reasoning-Tokens, Latenz, Retries und
Rate-Limits werden separat als technische Betriebsdaten ausgewertet. Sie dürfen
die Produktmetrik nicht verbessern, indem ein fehlgeschlagener Vorschlag als
gerettetes Lebensmittel gezählt wird.

## Abnahmekriterien

- Primärmetrik ist über zwei vollständige 30-Tage-Fenster berechenbar.
- Nur bestätigte Verbrauchs- und Waste-Ausgänge beeinflussen das Ergebnis.
- Unbekannte Mengen und inkompatible Einheiten werden ausgeschlossen, nicht
  geschätzt.
- Die Plausibilitätskontrolle bleibt als sekundäre Kennzahl gekennzeichnet.
- Kein Telemetrieereignis enthält Rohkontext oder Identifikatoren aus dem
  Modellkontext.
- Die Messung ist an eine reale Vorschlags- und Bestands-Review-Aufgabe
  gebunden, nicht an JSON-Eingabe oder einen technischen Timer.
