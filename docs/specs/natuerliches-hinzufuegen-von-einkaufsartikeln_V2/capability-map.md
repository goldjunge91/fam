# Capability Map: natuerliches-hinzufuegen-von-einkaufsartikeln_V2

Status: Freigegeben, Beta-Scope

## Quelle und Geltungsbereich

Diese Map gehört ausschließlich zur V2-Initiative `natuerliches-hinzufuegen-von-einkaufsartikeln_V2`.

- Produktquelle: [natuerliches-hinzufuegen-von-einkaufsartikeln.md](../../ideas/natuerliches-hinzufuegen-von-einkaufsartikeln.md)
- Ausführende Spec: [natuerliches-hinzufuegen-von-einkaufsartikeln_V2.md](./natuerliches-hinzufuegen-von-einkaufsartikeln_V2.md)
- Implementierungsplan: [natuerliches-hinzufuegen-von-einkaufsartikeln_V2_plan.md](../../../tasks/archive/natuerliches-hinzufuegen-von-einkaufsartikeln_V2_plan.md)
- Die Idea-Datei definiert die Produktabsicht. Diese Map definiert die fachlichen Module und ihre Abhängigkeiten.
- Auslieferungsrahmen: getrennte Beta-Oberfläche und getrennte Beta-Daten. Der bestätigte Listen-Output darf ausschließlich über einen bestehenden Adapter in reale Einkaufslisten geschrieben werden.
- Andere gleichnamige Specs, Pläne oder Beads-Epics sind weder Quelle noch Scope dieser Initiative.

## Module

| Modul-ID | Verantwortung | Abhängigkeiten | Zuordnung zur Idea-Datei |
| --- | --- | --- | --- |
| `beta-isolation` | Separater Beta-Einstieg, Feature-Gate, Beta-Speicher-/Telemetry-Namespace und Schutz vor Aktivierung im normalen Einkaufsworkflow | Keine | Auslieferungsrahmen dieser V2, ergänzt zur Idea-Datei |
| `speech-input` | In-App-Sprachaufnahme, native On-Device-Erkennung, Laufzeitfähigkeitsprüfung und klarer Fehler-/Nichtverfügbarkeitszustand ohne manuelle Texteingabe | Keine | „Empfohlene Richtung“, „MVP-Scope“, „Local first“ |
| `item-parser` | Deterministische lokale Zerlegung eines Textes in Artikelname, Menge, Einheit und Marke | Keine | „Was wird erkannt?“, Beispiele `4x Skyr` und `Skyr von JA` |
| `household-routing-learning` | Haushaltsweite Zuordnung, Konfidenz, Lernphase, Nutzerfreigabe sowie Mehrheits- und Konfliktmodus | `item-parser` | „Gelerntes Einkaufsverhalten“, „2-Stufen-Verfahren“, „3 Bestätigungen“ |
| `shopping-list-integration` | Übergabe bestätigter Beta-Ergebnisse an bestehende Einkaufslisten, Zusammenführung, lokale Transaktion und Outbox-Sync | Bestehende Shopping-List-Domäne | Automatische Zuordnung zur richtigen Einkaufsliste, Local-First und Offline-Sync |
| `natural-language-addition-workflow` | Gemeinsamer Beta-Text-/Sprachworkflow: parsen, routen, Vorschau, Rückfragen, bestätigen und mehrere Artikel speichern | `beta-isolation`, `speech-input`, `item-parser`, `household-routing-learning`, `shopping-list-integration` | Primärer Nutzerworkflow, Erfolgskriterien und Rückfrage-Schwelle |
| `privacy-quality-data` | Lokale Filterung, getrennte Beta-Einwilligungen, anonymisierte Qualitäts-/Inhaltsdaten und Widerruf | `beta-isolation`, `natural-language-addition-workflow` | „Local first“, Datenschutzentscheidungen, Telemetrie und Erfolgsmetriken |

## Ziel-Baufolge

1. `beta-isolation`, `speech-input`, `item-parser` und `shopping-list-integration` werden als getrennte Verträge vorbereitet.
2. `household-routing-learning` baut auf dem Parser-Ergebnis und bestehenden Listen-IDs auf, speichert aber ausschließlich im Beta-Namespace.
3. `natural-language-addition-workflow` verbindet die Module zu einem vertikalen Beta-Nutzerfluss.
4. `privacy-quality-data` wird an den Beta-Flow angeschlossen und bleibt bis zur geklärten Produktionsentscheidung optional.

## Modulverträge

```text
speech-input -> natural-language-addition-workflow
  { status, text, locale, onDevice, error }

beta-isolation -> natural-language-addition-workflow
  { enabled, betaSessionId, storageNamespace }

item-parser -> household-routing-learning / workflow
  ParsedShoppingItem[]
  { name, quantity, unit, brand }

household-routing-learning -> workflow
  RoutingDecision[]
  { listId, confidence, bestMatch, needsClarification }

workflow -> shopping-list-integration
  bestätigte Artikel mit Ziel-Listen-ID

workflow -> privacy-quality-data
  nur erlaubte, bereinigte Ereignisfelder
```

## Freigabegate

Die Map und die zugehörige Spec wurden gemeinsam geprüft und für die getrennte Beta sowie deren Implementierungsplanung freigegeben. Der Implementierungsplan und die konkreten Entwicklungstasks sind verknüpft. Für den MVP bleibt die native Erkennung der gewählte Eingangspfad; ein gebündeltes Whisper-Tiny-Modell und spätere alternative Modelle sind ausdrücklich nachgelagerte Arbeit. Die Funktion wird zunächst ausschließlich als getrennte Beta ausgeliefert.
