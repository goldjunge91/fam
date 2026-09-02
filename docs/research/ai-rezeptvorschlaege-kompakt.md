# AI-Rezeptvorschläge: Zustand, Regeln und Structured Outputs

**Status:** bestätigte fachliche Leitplanke für die erste Umsetzung  
**Scope:** Rezeptvorschläge aus dem bereits bekannten Haushaltsbestand  
**Nicht im Scope:** Bild-, Barcode-, OCR-, Sprach- oder sonstige Rohdatenverarbeitung

## Leitprinzip

> Die App und das Backend halten den Zustand. Code und Regeln erledigen die deterministische Arbeit. Das Modell formuliert nur aus einem kleinen, geprüften Kontext.

Das Modell ist kein Inventarsystem, kein Regelwerk und kein autonomer Agent.

## Ziel

Der Nutzer erhält bis zu drei einfache Mahlzeiten, die möglichst viele Lebensmittel mit hoher Nutzungspriorität verbrauchen. Allergien, Personenanzahl, verfügbare Mengen und weitere harte Einschränkungen müssen eingehalten werden.

Der wichtigste Produktwert ist nicht die Modellqualität an sich, sondern weniger Lebensmittelabfall. Nach einem Monat soll der Nutzer konkret merken: **„Ich werfe weniger Lebensmittel weg.“** Rezeptqualität, Antwortgeschwindigkeit und Tokenkosten sind diesem Ergebnis untergeordnet.

Erfolg bedeutet:

- möglichst viele priorisierte Lebensmittel werden sinnvoll eingeplant;
- der Haushalt wirft im Verlauf weniger Lebensmittel weg;
- abgelaufene, nicht verfügbare oder allergene Lebensmittel werden nicht vorgeschlagen;
- die Antwort ist für die App maschinenlesbar und für den Nutzer verständlich;
- es werden keine Bestandsänderungen automatisch ausgeführt.

## Getroffene Entscheidungen

- **Architektur:** Die Rezeptvorschläge erhalten ein eigenes, erlaubtes
  `recipe-suggestions`-Modul. Der konkrete App-/Backend-Pfad wird vor der
  Implementierung freigegeben.
- **Rezeptquelle:** Ein autoritativer Rezeptkatalog wird mit deterministischen
  Zutaten-Templates ergänzt. Aktuelle Alias- und Katalogartefakte sind nur
  Import-/Testinput und keine Laufzeitabhängigkeit der App.
- **Produktmessung:** Explizite Wegwerf-Ereignisse sind die primäre Messung.
  Eine wöchentliche Kurzabfrage dient als grobe Plausibilitätskontrolle.

## Die zwei Nutzungsszenarien

### 1. Nutzer nennt vorhandene Lebensmittel

Der Nutzer sagt beispielsweise:

> „Ich habe noch 3 Tomaten, Mozzarella und Spinat.“

Die Aussage ist nur der Auslöser für den Rezept-Workflow. Die für das Feature relevante Wahrheit kommt bereits aus App und Backend, zum Beispiel:

```tex
Lebensmittel:
- 3 Tomaten, MHD morgen
- Mozzarella, MHD in 2 Tagen
- Sahne, geöffnet
- Reis
- Pasta
- Spinat

Allergien: [geprüfte Nutzerwerte]
Personen: [geprüfter Wert]
```

Das Modell extrahiert aus diesem Satz keine Lebensmittel und keine Mengen. Normalisierung, Bestandsabgleich und Sicherheitsprüfung gehören in Code und Backend.

### 2. „Was sollte ich heute essen?“

Das Backend berechnet die Priorität aus dem vorhandenen Zustand. Mögliche Signale sind:

- `expiry`;
- `opened_at`;
- `quantity`;
- `category`;
- `user_preferences`;
- `previous_waste`.

Die genaue Formel ist eine Backend-Regel und wird versioniert. Das Modell erhält danach nur den relevanten Ausschnitt:

```json
{
  "priority_foods": [
    "Spinat",
    "Mozzarella",
    "Tomaten"
  ]
}
```

Das Modell erhält nicht den vollständigen Haushaltssnapshot, wenn dieser für die konkrete Antwort nicht nötig ist.

## Verantwortungsgrenze

### App und Backend, immer deterministisch

1. Nutzeranfrage einem Rezept-Workflow zuordnen.
2. Autoritativen Bestand lesen.
3. Lebensmittel, Mengen, Einheiten und Zustände normalisieren.
4. MHD, Öffnungsstatus, Verfügbarkeit und Lebensmittelsicherheit prüfen.
5. Allergien als harte Ausschlussregel anwenden.
6. Personenanzahl und verfügbare Mengen berücksichtigen.
7. `priority_score(item)` berechnen und priorisierte Lebensmittel auswählen.
8. Einkaufslistenstatus deterministisch behandeln:
   - Ist die Einkaufsliste leer, wird keine weitere Frage zum Einkaufen gestellt.
   - Enthält sie Artikel, fragt die App, ob der Nutzer heute noch einkaufen wird.
   - Bei Zustimmung dürfen relevante Einkaufslistenartikel als geplante Zutaten in den Rezeptkontext aufgenommen werden.
   - Geplante Einkaufslistenartikel sind noch kein Bestand und werden nicht als bereits vorhanden gebucht.
9. Zuerst passende vorhandene Rezepte aus dem Rezeptbestand suchen.
10. Geeignete Kandidaten auf maximal drei begrenzen.
11. Den minimalen Modellkontext erzeugen.
12. Die Modellantwort gegen Schema und Domänenregeln validieren.
13. Erst nach Nutzerentscheidung eine normale App-Mutation ausführen.

### Modell

Das Modell darf:

- aus dem vorbereiteten Kontext bis zu drei Mahlzeiten auswählen bzw. formulieren;
- bei passenden vorhandenen Rezepten deren Darstellung für den Nutzer formulieren;
- nur dann ein bis drei neue Rezepte formulieren, wenn kein vorhandenes Rezept passt;
- kurze Titel, Zutaten, Mengenhinweise, Schritte und verständliche Hinweise erzeugen.

Das Modell darf nicht:

- den Bestand selbst erfinden, ändern oder löschen;
- Allergien, MHD oder Lebensmittelsicherheit selbst entscheiden;
- nicht freigegebene Lebensmittel als verfügbar behandeln;
- mehr als drei Vorschläge liefern;
- einen Einkauf, eine Bestandsbuchung oder eine andere Mutation ausführen.

## Ablauf

```text
App/Backend
  -> geprüfter Haushaltszustand
  -> deterministische Filter und Priorisierung
  -> Einkaufslistenregel: leer = keine Rückfrage, nicht leer = Einkaufsabsicht klären
  -> Suche vorhandener Rezepte
  -> kompakter JSON-Kontext
  -> ein Modellaufruf mit Structured Outputs
  -> Schema- und Domänenvalidierung
  -> Anzeige als Vorschlag
  -> optionale Nutzerbestätigung über normalen Mutationspfad
```

Wenn passende vorhandene Rezepte gefunden werden, formuliert das Modell nur diese Kandidaten. Wenn kein Kandidat passt, darf es innerhalb der freigegebenen Zutaten und Regeln ein bis drei Fallback-Rezepte formulieren.

## Datenmodell-Leitplanke für den Produktwert

Für die Messung von Lebensmittelabfall braucht ein Wegwerf-Ereignis mindestens
eine eindeutige Bestands- oder Lot-Referenz, Menge, Einheit, Grund, Haushalt,
ausführenden Nutzer und Zeitstempel. `product_id` allein reicht nicht für eine
verlässliche Zuordnung der tatsächlich weggeworfenen Menge.

Wegwerfen wird als typisiertes `waste`-Ereignis im bestehenden oder neu
freigegebenen Inventar-Ledger erfasst. Die möglichen Gründe bleiben
versioniert. Eine wöchentliche Kurzabfrage wird getrennt als grobe
Messbeobachtung gespeichert und nicht als Inventarverbrauch oder Bestandstransaktion
ausgegeben. RLS, Offline-/Outbox-Parität und die deklarative Schemaquelle
bleiben dabei verbindlich.

## Verbindliche Gesprächsregel für die Einkaufsliste

Die Einkaufsliste wird vom Code geprüft und steuert den Dialog:

- **Einkaufsliste leer:** Keine weitere Nachfrage im Rezeptdialog; der Vorschlag wird direkt aus dem geprüften Bestand erzeugt.
- **Einkaufsliste enthält Artikel:** Die App fragt, ob der Nutzer heute noch einkaufen will.
- **Nutzer kauft heute ein:** Relevante Artikel dürfen als geplante Zutaten in die Rezeptauswahl aufgenommen werden.
- **Nutzer kauft heute nicht ein:** Die Rezeptauswahl bleibt auf dem vorhandenen Bestand und bereits erlaubten Zutaten.
- Einkaufslistenartikel bleiben geplante Zutaten und werden nicht als vorhandener Bestand behandelt, bevor sie tatsächlich erfasst wurden.

Diese Regel ist deterministisch. Das Modell entscheidet weder, ob nach dem Einkauf gefragt wird, noch ob ein Einkaufslistenartikel bereits im Haushalt vorhanden ist.

## Structured Outputs sind ein harter Vertrag

Jeder Modellaufruf verwendet **Structured Outputs** mit einem versionierten Schema. Freitext ist nur ein Feld innerhalb dieser strukturierten Antwort, niemals der technische API-Vertrag.

Ein minimales Antwortschema sieht konzeptionell so aus:

```json
{
  "schema_version": 1,
  "meals": [
    {
      "title": "Spinat-Tomaten-Pasta",
      "source": "catalog",
      "recipe_id": "recipe-123",
      "servings": 3,
      "used_items": [
        {
          "inventory_item_id": "inventory-1",
          "quantity": 3,
          "unit": "Stück"
        }
      ],
      "additional_ingredients": [],
      "steps": [
        "..."
      ],
      "notes": []
    }
  ]
}
```

Verbindliche Regeln:

- `meals` enthält 1 bis 3 Einträge, nie mehr;
- `source` ist entweder `catalog` oder `model_generated`;
- `recipe_id` ist bei `model_generated` `null`;
- referenzierte `inventory_item_id` müssen aus dem Modellkontext stammen;
- zusätzliche Zutaten sind nur erlaubt, wenn sie im Kontext ausdrücklich freigegeben sind;
- Allergene und nicht verfügbare Lebensmittel werden vor und nach dem Modellaufruf geprüft;
- schema- oder regelwidrige Antworten werden nicht angezeigt;
- die Antwort wird nicht durch heuristisches Parsen von Modell-Freitext repariert.

## Kompakter Modellkontext

Der Kontext soll nur enthalten, was das Modell für die Formulierung benötigt:

```json
{
  "request": {
    "type": "recipe_suggestion",
    "servings": 3
  },
  "constraints": {
    "allergies": ["..."],
    "preferences": ["..."],
    "allowed_staples": ["..."],
    "forbidden_ingredients": ["..."]
  },
  "priority_foods": [
    {
      "inventory_item_id": "inventory-1",
      "name": "Spinat",
      "available_quantity": 1,
      "unit": "Packung",
      "priority_reason": "MHD in 1 Tag"
    }
  ],
  "planned_shopping_items": [],
  "candidate_recipes": []
}
```

`candidate_recipes` ist gefüllt, wenn der Backend-Rezeptbestand passende Kandidaten liefert. Ist es leer, darf das Modell den begrenzten Fallback nutzen. `allowed_staples` ist leer, sofern keine zusätzlichen Grundzutaten ausdrücklich erlaubt sind.

`planned_shopping_items` enthält nur Einkaufslistenartikel, die nach der Rückfrage für den heutigen Einkauf freigegeben wurden. Diese Artikel dürfen in einem Vorschlag verwendet werden, werden aber klar von vorhandenem Bestand getrennt und nicht automatisch inventarisiert.

## Testbare Akzeptanzkriterien

- Gleicher geprüfter Zustand erzeugt vor dem Modellaufruf denselben Kontext.
- Allergien werden unabhängig vom Modell vor und nach dem Modellaufruf ausgeschlossen.
- Das Modell erhält keine Bild-, Barcode-, OCR- oder sonstigen Rohdaten.
- Das Modell erhält nicht mehr Haushaltsdaten als für die konkrete Anfrage erforderlich.
- Vorhandene passende Rezepte werden vor einem generativen Fallback verwendet.
- Ein Fallback ist nur bei null passenden vorhandenen Rezepten erlaubt.
- Bei leerer Einkaufsliste wird keine Einkaufsfrage gestellt.
- Bei einer nichtleeren Einkaufsliste wird vor der Berücksichtigung ihrer Artikel gefragt, ob heute eingekauft wird.
- Bestätigte Einkaufslistenartikel werden als geplante Zutaten und nicht als vorhandener Bestand behandelt.
- Jede erfolgreiche Modellantwort erfüllt das versionierte Structured-Output-Schema.
- Es werden höchstens drei Mahlzeiten angezeigt.
- Keine Modellantwort führt ohne Nutzerbestätigung zu einer Bestands-, Einkaufs- oder sonstigen Mutation.
- Die deterministische Priorisierung ist als reine Regel testbar, ohne ein Modell aufzurufen.

## Umsetzung im Projekt

Die spätere Implementierung soll die bestehende Feature-First-Struktur verwenden:

- ein vorab freizugebendes `recipe-suggestions`-Modul für Domänenlogik,
  Kontextaufbau und Antwortvalidierung;
- ein vorab freizugebender serverseitiger Gateway-Bereich für den kontrollierten
  Modellaufruf;
- `tools/llm-test-platform/` ausschließlich für Prompt-, Schema-, Safety- und Regressionsevals.

`tools/` ist kein App-Ordner, keine Laufzeitabhängigkeit und kein Teil des App-Backends. Dort liegt nur Code zum Testen, Ausprobieren und Evaluieren von Funktionen und Regeln. Vorhandene App-, Backend- und Datenbankkonventionen bleiben maßgeblich. Eine neue generische Agentenplattform ist nicht Teil dieser Spezifikation.

## Qualitätsgrenzen

### Immer

- Fakten und Regeln in Code oder Backend halten.
- Structured Outputs mit versioniertem Schema verwenden.
- Eingaben und Modellantworten validieren.
- Modellkontext minimal halten.
- Schreibende Aktionen über bestehende, bestätigte Mutationspfade ausführen.

### Vorher klären

- Änderungen am Datenbankschema oder an RLS-Regeln;
- neue Provider, native Abhängigkeiten oder zusätzliche Infrastruktur;
- Erweiterungen über Rezeptvorschläge hinaus;
- Änderungen am Structured-Output-Schema mit Auswirkungen auf App oder Evals.

### Niemals

- Freitext als verlässlichen technischen Vertrag behandeln;
- das Modell zur Quelle des Haushaltszustands machen;
- Lebensmittelsicherheit oder Allergieprüfung an das Modell delegieren;
- Rohdatenverarbeitung für Bild, Barcode oder OCR in diesen Scope hineinziehen;
- autonome Bestands- oder Einkaufsaktionen ausführen.

## Relevante Verifikation

Bei der Implementierung gelten die projektweiten Kommandos, gezielt auf die betroffenen Dateien:

```bash
bun run check
bun run typecheck
bun run test <betroffene-testdatei>
```

`bun run test:db` ist nur erforderlich, wenn die Umsetzung das deklarative Supabase-Schema oder RLS-Regeln verändert.
