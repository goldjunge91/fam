# Fachspezifikation: fam Agent Skills

**Status:** kanonische Fachquelle, überarbeitet am 2. September 2026  
**Produktumfang:** read-only Rezeptvorschläge aus dem autoritativen Haushaltsbestand  
**Skill:** `fam-cook-from-inventory`

Diese Datei ist die fachliche Quelle der Wahrheit für die erste Umsetzung. Die
Datei
[`docs/referenced-chatgpt-conversation-this-is-an/work/ai-rezeptvorschlaege-kompakt.md`](../referenced-chatgpt-conversation-this-is-an/work/ai-rezeptvorschlaege-kompakt.md)
war die redaktionelle Arbeitsgrundlage für diese Überarbeitung, ist aber nicht
die normative Quelle.

## 1. Produktziel und Scope

Das Feature soll Lebensmittelabfall im Haushalt verringern. Der Nutzer erhält
bis zu drei einfache Mahlzeiten, die möglichst viele Lebensmittel mit hoher
Nutzungspriorität verbrauchen. Rezeptqualität, Geschwindigkeit und Tokenkosten
sind wichtig, aber dem Produktziel „weniger Lebensmittel wegwerfen“
untergeordnet.

Der erste Release enthält genau einen read-only Workflow mit zwei Einstiegen:

1. **Vorhandene Lebensmittel erwähnt:** Der Nutzer sagt zum Beispiel „Ich habe
   noch Tomaten, Mozzarella und Spinat“. Dieser Text löst nur den Intent aus.
   Lebensmittel und Mengen werden nicht aus dem Text extrahiert.
2. **Tagesfrage:** Der Nutzer fragt zum Beispiel „Was kann ich heute kochen?“
   oder „Was sollte ich heute essen?“. Die App berechnet die Priorität aus dem
   geprüften Haushaltszustand.

Beide Einstiege laufen durch dieselbe Kontext-, Modell- und
Post-Validation-Pipeline.

Nicht im Scope dieses Releases:

- Inventarerfassung aus natürlicher Sprache, Bild, Barcode, OCR oder Sprache;
- Produktsuche und Einkaufslisten-Klassifikation;
- medizinische oder individuelle Ernährungsberatung;
- freie Websuche;
- automatische Bestands-, Einkaufs- oder sonstige Mutationen;
- Belegimport, Vision und weitere Agentenfähigkeiten.

`tools/category-debugger` ist ausschließlich für Produktsuche und
Einkaufslisten-Klassifikation zuständig. Es ist keine Abhängigkeit, kein
Testziel und keine Laufzeitkomponente dieses Features. Andere Inhalte unter
`/tools/` bleiben ebenfalls getrennt. Ausschließlich
`tools/llm-test-platform` enthält die zu diesem Feature gehörenden Evals.

## 2. Grundprinzip und Verantwortungsgrenze

> App und Backend halten den Zustand. Code und Regeln erledigen die
> deterministische Arbeit. Das Modell formuliert nur aus einem kleinen,
> geprüften Kontext.

Das Modell ist weder Inventarsystem noch Regelwerk und darf keinen
Haushaltszustand autoritativ verändern.

### 2.1 App und Backend

App und Backend führen immer deterministisch aus:

1. Rezept-Intent und optionale Einschränkungen erkennen.
2. Authentifizierten Haushalt und Mitgliedschaft prüfen.
3. Den autoritativen Bestand tenant-scoped lesen.
4. Lebensmittel, Einheiten, Mengen und Zustände normalisieren.
5. MHD, Öffnungsstatus, Verfügbarkeit und Sicherheitsstatus prüfen.
6. Allergien als harte Ausschlussregel anwenden.
7. Personenanzahl und verfügbare Mengen berücksichtigen.
8. Eine versionierte `priority_score`-Regel anwenden.
9. Den Einkaufslistenstatus deterministisch behandeln.
10. Zuerst passende vorhandene Rezepte suchen.
11. Höchstens drei Kandidaten auswählen.
12. Den minimalen Modellkontext erzeugen.
13. Die Modellantwort gegen Schema und Domänenregeln validieren.
14. Erst nach expliziter Nutzerentscheidung den bestehenden Mutationspfad
    aufrufen.

Private Trackingdaten, Service-Role-Zugriff und Schreibtools gehören nicht in
den Modellkontext.

### 2.2 Modell

Das Modell darf aus dem vorbereiteten Kontext:

- bis zu drei Mahlzeiten auswählen oder formulieren;
- kurze Titel, Mengenhinweise, Schritte und Hinweise erzeugen;
- bei null passenden Katalogrezepten einen begrenzten Fallback formulieren.

Das Modell darf nicht:

- Lebensmittel, Mengen, Lot-IDs oder Rezept-IDs erfinden;
- Allergien, MHD, Verfügbarkeit oder Lebensmittelsicherheit entscheiden;
- nicht freigegebene Zutaten als vorhanden behandeln;
- mehr als drei Vorschläge liefern;
- einkaufen, inventarisieren oder eine andere Mutation ausführen.

## 3. Deterministische Fachregeln

### 3.1 Autoritativer Bestand

Der Nutzertext ist kein Bestandsbeleg. Verderbliche Lebensmittel werden direkt
aus dem authentifizierten, tenant-scoped Inventar gelesen. Der Context Builder
übernimmt nur aktive und für den Haushalt freigegebene Lots.

Mindestens zu prüfen sind:

- `inventory_item_id` bzw. Lot-ID;
- normalisierter Name, Menge und Einheit;
- Lagerort;
- MHD/Verbrauchsdatum und Öffnungsstatus;
- Verfügbarkeit und Sicherheitsstatus;
- Haushaltszugehörigkeit.

Fehlende oder widersprüchliche Zustände werden nicht vom Modell ergänzt. Sie
führen zu `unknown` oder zu einem strukturierten Fehler, abhängig von der
Sicherheitsrelevanz.

### 3.2 Priorisierung

Die Priorisierung ist eine versionierte Backend-Regel. Eingangsgrößen können
sein:

- Ablauf- oder Verbrauchsdatum;
- `opened_at`;
- verfügbare Menge;
- Kategorie und Verderblichkeit;
- geprüfte Nutzerpräferenzen;
- dokumentierter vorheriger Lebensmittelabfall.

`priority_score` bestimmt, welche Lots in `priority_foods` erscheinen. Die
Regel darf ohne Modellaufruf getestet werden. Priorität ist keine
Sicherheitsfreigabe: abgelaufene oder unsichere Lebensmittel bleiben
ausgeschlossen.

### 3.3 Einkaufsliste

Die Einkaufsliste steuert den Dialog, nicht das Modell:

- **leer:** keine Einkaufsfrage; der Vorschlag entsteht aus dem Bestand;
- **nicht leer:** die App fragt, ob der Nutzer heute einkauft;
- **Ja:** relevante Artikel dürfen als `planned_shopping_items` in den
  Kontext;
- **Nein:** die Auswahl bleibt auf Bestand und bereits erlaubten
  Grundzutaten;
- geplante Artikel sind kein Bestand und werden nicht automatisch erfasst.

### 3.4 Rezeptquelle und Fallback

Passende Rezepte werden zuerst aus der autoritativen Rezeptbasis gesucht. Nur
wenn kein passender Katalogkandidat existiert, darf das Modell ein bis drei
Fallback-Rezepte formulieren. Die Entscheidung „Katalog oder Fallback“ trifft
der Code, nicht das Modell.

## 4. Agent-Skill-Vertrag

### 4.1 Paketstruktur

Die spätere Skill-Implementierung folgt dieser Struktur:

```text
<skill-id>/
├── SKILL.md              # Trigger, Ablauf, Grenzen
├── references/
│   ├── contract.md       # Input-/Output-Schema und Fehlersemantik
│   └── examples.md       # redigierte Beispiele und Gegenbeispiele
└── evals/                # Verweise auf versionierte Eval-Fixtures
```

`SKILL.md` enthält mindestens `name` und `description`. Die Beschreibung muss
die beiden erlaubten Einstiege und die Abgrenzung zu Inventarerfassung,
Produktsuche und Klassifikation nennen.

### 4.2 Request

Der Client übergibt Intent und optionale Einschränkungen, aber keine
Inventarliste:

```ts
type CookFromInventoryRequest = {
  intent: 'inventory_mentioned' | 'today_recipe';
  userText?: string; // nur zur Intent-/Einschränkungserkennung
  servings?: number | null;
  maxMinutes?: number | null;
  dietaryPattern?: string | null;
};
```

Haushalt, Mitgliedschaft, Allergien und autoritativer Bestand werden aus
Authentifizierung und Backend-Kontext ermittelt. `userText` darf keine
Bestandswerte überschreiben.

### 4.3 Kompakter Modellkontext

Der Kontext enthält nur die für die konkrete Formulierung nötigen Daten:

```ts
type RecipeSuggestionContext = {
  request: {
    type: 'recipe_suggestion';
    servings: number | null;
  };
  constraints: {
    allergies: string[];
    preferences: string[];
    forbiddenIngredients: string[];
    allowedStaples: string[];
  };
  priorityFoods: Array<{
    inventoryItemId: string;
    name: string;
    availableQuantity: number | null;
    unit: string | null;
    priorityReason: string;
  }>;
  plannedShoppingItems: Array<{
    shoppingItemId: string;
    name: string;
    quantity: number | null;
    unit: string | null;
  }>;
  candidateRecipes: Array<{
    recipeId: string;
    title: string;
    ingredients: string[];
    servings: number | null;
    estimatedMinutes: number | null;
  }>;
};
```

Gleicher geprüfter Zustand plus gleiche Anfrage muss denselben Kontext
erzeugen. `candidateRecipes` ist leer, wenn der Fallback zulässig ist.
`allowedStaples` ist leer, sofern keine Grundzutaten ausdrücklich freigegeben
sind.

### 4.4 Structured Output

Jeder Modellaufruf verwendet den versionierten JSON-Vertrag:

```ts
type RecipeSuggestionResponse = {
  schema_version: 1;
  meals: Array<{
    title: string;
    source: 'catalog' | 'model_generated';
    recipe_id: string | null;
    servings: number;
    used_items: Array<{
      inventory_item_id: string;
      quantity: number | null;
      unit: string | null;
    }>;
    additional_ingredients: string[];
    steps: string[];
    notes: string[];
  }>;
};
```

Verbindliche Invarianten:

- `meals` enthält mindestens einen und höchstens drei Einträge;
- `source` ist ausschließlich `catalog` oder `model_generated`;
- bei `model_generated` ist `recipe_id` immer `null`;
- bei `catalog` stammt `recipe_id` aus `candidateRecipes`;
- jede `inventory_item_id` stammt aus `priorityFoods` bzw. dem freigegebenen
  Inventarkontext;
- Mengen und Einheiten dürfen nicht größer sein als die geprüfte Verfügbarkeit;
- `additional_ingredients` enthält nur explizit erlaubte Grund- oder geplante
  Zutaten;
- Allergene und nicht verfügbare Lebensmittel werden vor und nach dem
  Modellaufruf geprüft;
- schema- oder regelwidrige Antworten werden verworfen und nicht heuristisch
  repariert;
- die Antwort selbst führt keine Mutation aus.

### 4.5 Fehlersemantik

Fehler sind strukturiert und fail-closed:

```ts
type RecipeSuggestionErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'invalid_request'
  | 'context_unavailable'
  | 'no_safe_candidate'
  | 'provider_unavailable'
  | 'invalid_model_output'
  | 'safety_violation'
  | 'rate_limited';
```

Ein leerer, nicht parsebarer oder sicherheitswidriger Modelloutput ist ein
Fehlerzustand. Es gibt keinen stillen Freitext-Fallback und keine Mutation.

## 5. Ablauf

```text
App / Backend
  -> Authentifizierung und Haushaltsscope
  -> autoritativer Inventar- und Einkaufslistenstatus
  -> deterministische Filter, Sicherheit und Priorisierung
  -> Einkaufslistenregel
  -> Suche vorhandener Rezepte
  -> kompakter JSON-Kontext
  -> ein kontrollierter Modellaufruf mit Structured Outputs
  -> Schema- und Domänenvalidierung
  -> Anzeige von 1–3 Vorschlägen
  -> optionale Nutzerbestätigung
  -> normaler, bestehender Mutations-/Outbox-Pfad
```

Der read-only Pfad endet vor der Bestätigung. Ein Provider-, Gateway- oder
Validierungsfehler darf keine Bestandsänderung auslösen.

## 6. Evals und Teststrategie

### 6.1 Zuständigkeit

`tools/llm-test-platform` ist ausschließlich der technische Eval-Workspace für
Prompts, Schemas, Safety- und Regressionstests. Er enthält synthetische
Haushalte, Inventar-Lots und Rezeptkandidaten, aber keine Produktivdaten.

Promptfoo ist der wiederholbare Regressionstest. ChainForge dient der lokalen
Exploration und dem Export redigierter Fälle. Beide Werkzeuge sind keine
Produktlaufzeit und kein Ersatz für Gateway- oder Domain-Tests.

### 6.2 Harte Eval-Gates

- Schema und Feldtypen sind gültig.
- Katalogreferenzen und Inventar-IDs sind kontextgebunden.
- Mengen, Einheiten, Allergene und `additional_ingredients` bleiben geerdet.
- Katalog wird vor Fallback verwendet.
- Höchstens drei Mahlzeiten werden ausgegeben.
- leere Einkaufsliste erzeugt keine Einkaufsfrage;
  nichtleere Liste wird vor Berücksichtigung bestätigt.
- Tool-Trajektorie bleibt read-only.
- Kein Fehler wird durch freien Fallback-Text verdeckt.

Weiche Messwerte wie Latenz, Kosten, Rezept-Recall und Nutzerkorrekturen
werden getrennt von den harten Sicherheits-Gates berichtet.

### 6.3 Modellmatrix

Die sechs OpenRouter-Modelle werden als Diagnosematrix verwendet. Ein einzelner
Lauf ist keine Produktionsfreigabe. Jeder Lauf muss mindestens speichern:

- Modell- und Endpoint-Bezeichnung bzw. Revision;
- effektive Request-Konfiguration und Structured-Output-Modus;
- Reasoning-Einstellungen;
- `finish_reason` und Retry-Anzahl;
- Prompt-, Schema- und Config-Hashes;
- Prompt-, Completion- und Reasoning-Tokens;
- rohe, redigierte Antwortreferenz und Fehlerklasse.

Semantische Safety-/Grounding-Fehler werden von leeren oder abgeschnittenen
Ausgaben getrennt. Nach einem Matrixlauf folgen gezielte Probes, keine blinde
Vollmatrix.

## 7. Phasen und Freigabegates

| Phase | Inhalt | Gate |
|---|---|---|
| 0 Verträge und Messbarkeit | fachlicher Vertrag, deterministischer Kontext, gemeinsame Validierung, synthetische Evals, Gateway-Handler-Tests | A–C umgesetzt; Windows- und macOS/CI-Deno-Suite reproduzierbar; Matrix als Diagnose archiviert |
| 1 Read-only Rezeptvorschläge | gezielte Modellpromotion, Gateway, App-Anzeige, Review und Bestätigung | keine harten Safety-/Grounding-Fehler; kein Write vor Bestätigung |
| 2 Produktvalidierung | echte Nutzungs- und Interaktionsmessung | reale App-Aufgabe messen, nicht JSON-Tippen |
| 3 Belegimport | vertagt | neue Spezifikation erforderlich |
| 4 Vision | vertagt | neue Spezifikation erforderlich |

Die frühere JSON-Terminalmessung ist kein menschlicher Produktwert. Eine
Geschwindigkeitsmessung beginnt erst bei der sichtbaren App-Aufgabe und endet
bei der geprüften Vorschlagsanzeige.

## 8. Projektgrenzen

**Immer:**

- autoritativen Zustand in App/Backend halten;
- Regeln deterministisch und separat testbar machen;
- Structured Outputs und Post-Validation verwenden;
- minimalen tenant-scoped Kontext senden;
- Vorschläge vor jeder Mutation durch den Nutzer bestätigen lassen.

**Vorher abstimmen:**

- neue Skills, Trigger oder Datenfelder;
- neue Tabellen, RLS-Regeln oder Provider;
- Änderungen am Structured-Output-Vertrag;
- Fallback-Rezepte oder zusätzliche Grundzutaten.

**Nie:**

- den Nutzertext als Bestandswahrheit verwenden;
- Allergie-, MHD- oder Sicherheitsentscheidungen an das Modell delegieren;
- private Trackingdaten in Haushaltskontext mischen;
- das Modell direkt schreiben lassen;
- Produktsuche/Klassifikation oder Inventarerfassung in diesen Skill einschleusen.

## 9. Offene Entscheidungen

1. Welche konkrete Rezeptbasis ist für `candidateRecipes` autoritativ?
2. Welche Grundzutaten gehören initial in `allowedStaples`?
3. Wird der generative Fallback zum Start aktiviert oder zunächst blockiert?
4. Welche weichen Qualitätsziele gelten nach dem ersten Holdout für Recall,
   Latenz und Kosten?
