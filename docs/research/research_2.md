Ja. Ich würde für **fam** nicht mit „wir bauen einen ChatGPT-Clone in die App“ starten, sondern mit einem **kostenkontrollierten Food-Waste-Agenten**, bei dem die AI nur dort eingesetzt wird, wo klassische Logik nicht reicht.

Stand der Recherche: **1. September 2026**. Die Preise unten sind aktuelle API-Listenpreise in USD.

## Was der Agent für fam sinnvollerweise machen sollte

Der Agent könnte z. B. verstehen:

- „Ich habe noch 3 Tomaten, Mozzarella und Spinat.“
- „Was sollte ich heute verbrauchen?“
- „Kann ich die Milch noch trinken?“
- „Ich bin 4 Tage weg – was muss vorher weg?“
- „Mach mir aus diesen Sachen ein Abendessen.“
- Foto vom Kühlschrank / Lebensmittel erkennen.
- Kassenzettel oder Barcode → Lebensmittelbestand ergänzen.
- Verbrauchsmuster erkennen.
- proaktiv sagen: „Die Paprika solltest du heute oder morgen verwenden.“
- Rezeptvorschläge machen, die **vorhandene/ablaufende Lebensmittel priorisieren**.

Aber: Bestand, Mengen, Ablaufdaten, Verbrauch, Haushaltsmitglieder usw. sollten **nicht im LLM-Gedächtnis liegen**.

Die Datenbank ist die Wahrheit:

```text
Supabase / PostgreSQL
        │
        ├── food_items
        ├── quantities
        ├── expiry dates
        ├── purchase dates
        ├── household
        ├── preferences
        └── consumption history
               │
               ▼
        deterministic logic
               │
               ▼
             AI
      verstehen / planen /
      erklären / entscheiden
```

Das spart massiv Tokens und verhindert Halluzinationen.

---

# 1. Die AI-Kosten sind überraschend niedrig

Für so einen Agenten braucht ihr **nicht bei jeder Anfrage ein Frontier-Modell**.

Aktuelle OpenAI-Preise:

| Modell | Input / 1M Tokens | Cached Input | Output / 1M |
|---|---:|---:|---:|
| GPT-5.4 nano | $0.20 | $0.02 | $1.25 |
| GPT-5.4 mini | $0.75 | $0.075 | $4.50 |
| GPT-5.4 | $2.50 | $0.25 | $15.00 |

GPT-5.4 nano ist ausdrücklich für Dinge wie **Klassifikation, Extraktion, Ranking und günstige Sub-Agenten** gedacht. GPT-5.4 mini unterstützt zusätzlich Bildinput, Function Calling, Structured Outputs und Tool-Nutzung. 

Das passt ziemlich genau auf fam.

---

# 2. Beispielrechnung pro aktivem User

Nehmen wir einen bereits relativ aktiven AI-User:

**5 AI-Interaktionen pro Tag**

Durchschnittlich:

- 1.800 Input-Tokens
- 250 Output-Tokens
- 30 Tage

Das ist bereits genug für sinnvolle Antworten mit etwas Kontext.

### Nur GPT-5.4 nano

Eine Anfrage:

```text
1.800 × $0.20 / 1M = $0.00036
250 × $1.25 / 1M   = $0.0003125

≈ $0.00067
```

150 Requests/Monat:

**≈ $0.10 pro aktivem User / Monat**

---

### Nur GPT-5.4 mini

Gleiche Nutzung:

**≈ $0.37 pro aktivem User / Monat**

---

### Nur GPT-5.4

**≈ $1.24 pro aktivem User / Monat**

Und das ist bereits ein ziemlich unnötiger Ansatz für fam.

---

# 3. Was ich für fam machen würde: Model Routing

Nicht:

```text
alles → GPT-5.4
```

sondern:

```text
User
 │
 ▼
Intent / extraction
GPT-5.4 nano
 │
 ├── "Milch als verbraucht markieren"
 ├── Lebensmittel erkennen
 ├── Mengen extrahieren
 ├── Intent bestimmen
 ├── Suchbegriffe erzeugen
 └── Lebensmittel ranken
 │
 ▼
Braucht es wirklich komplexes Reasoning?
       │
    ┌──┴──┐
   nein   ja
    │      │
  nano   mini
           │
           └── eventuell sehr selten GPT-5.4
```

OpenAI empfiehlt inzwischen selbst genau dieses Prinzip: erst einen Qualitäts-Baseline mit einem starken Modell aufbauen und danach einzelne Aufgaben auf kleinere Modelle verschieben, solange die Evals weiterhin passen. 

Anthropic beschreibt Routing ebenfalls als ein grundlegendes Produktionsmuster für Agents. 

---

# 4. Realistischer Hybridpreis

Angenommen:

- 80 % der Calls → GPT-5.4 nano
- 20 % → GPT-5.4 mini

Dann landen wir bei ungefähr:

**$0.155 pro aktivem User / Monat**

für die obige Nutzung.

Mit großzügigen **25 % Reserve** für:

- Retries
- längere Prompts
- gelegentlich größere Antworten
- Tool-Calls
- unerwartete Nutzung

ergibt das ungefähr:

| aktive AI-User | reine geschätzte Modellkosten / Monat inkl. 25 % Reserve |
|---:|---:|
| 1.000 | ~$194 |
| 10.000 | ~$1.937 |
| 100.000 | ~$19.369 |

Das sind **aktive AI-Nutzer mit fünf Agent-Interaktionen jeden einzelnen Tag**, nicht bloß registrierte Accounts.

Das ist wichtig für euren Business Case.

---

# 5. Noch günstiger: Hintergrundjobs

Ein wichtiger Teil von fam braucht gar keine synchrone AI.

Beispiel:

> „Welche Lebensmittel sollte dieser Haushalt morgen priorisieren?“

Das könnt ihr nachts berechnen.

OpenAI Batch API kostet derzeit **50 % weniger als synchrone Requests** und verarbeitet Jobs innerhalb von bis zu 24 Stunden. 

Also beispielsweise:

```text
02:00

alle aktiven Haushalte
       │
       ▼
SQL filter:
Was läuft bald ab?
       │
       ▼
nur relevante Haushalte
       │
       ▼
Batch AI
       │
       ▼
priorisierte Empfehlung
       │
       ▼
DB speichern
       │
       ▼
Push notification später
```

Noch besser:

Die Vorauswahl macht **SQL**, nicht AI.

Statt 100 Lebensmittel an das Modell zu schicken:

```sql
expiry_date < now() + interval '4 days'
```

und vielleicht nur die 5–10 relevanten Items weitergeben.

---

# 6. Sehr wichtig: keinen „autonomen Agenten“ überall bauen

Das wäre für fam wahrscheinlich Overengineering.

OpenAI empfiehlt Agents insbesondere dort, wo klassische Regeln wegen Mehrdeutigkeit oder unstrukturierter Daten nicht ausreichen. Für deterministische Aufgaben sollte normale Software verwendet werden. 

Für fam würde ich ungefähr so trennen:

| Aufgabe | AI? |
|---|---|
| Ablaufdatum vergleichen | ❌ |
| Tage bis Ablauf berechnen | ❌ |
| Bestand aktualisieren | ❌ |
| Push-Zeit bestimmen | meist ❌ |
| Nutzertext verstehen | ✅ |
| Lebensmittel aus Freitext extrahieren | ✅ |
| Foto interpretieren | ✅ |
| Rezept aus Resten entwickeln | ✅ |
| Prioritäten erklären | ✅ |
| Alternativen finden | ✅ |
| „Was kann ich daraus kochen?“ | ✅ |
| Barcode lookup | ❌ |
| Lebensmittel ranken | zunächst Rules, eventuell AI |
| persönliche Empfehlung formulieren | ✅ |

Das ist wahrscheinlich die wichtigste Architekturentscheidung.

---

# 7. Beispiel: „Ich habe noch zwei schrumpelige Paprika und Hackfleisch“

Der User schreibt:

> „Ich hab zwei schrumpelige Paprika, 300g Hack und bisschen Feta, was mach ich damit?“

### Call 1 – nano

Structured Output:

```json
{
  "intent": "meal_suggestion",
  "ingredients": [
    {
      "name": "Paprika",
      "quantity": 2,
      "condition": "use_soon"
    },
    {
      "name": "Hackfleisch",
      "quantity_g": 300
    },
    {
      "name": "Feta",
      "quantity": null
    }
  ]
}
```

Dann eure App:

```text
DB
↓
prüft Bestand
↓
prüft Ablaufdatum
↓
holt User Preferences
↓
holt Allergien
↓
findet zusätzliche passende Zutaten
```

Erst danach bekommt GPT-5.4 mini einen sehr kleinen Kontext:

```text
Ingredients:
- 2 peppers, use soon
- 300g minced beef, expires today
- feta

User preferences:
- max 30 min
- high protein

Available staples:
- rice
- onions
- garlic

Create one meal.
Prioritize ingredients expiring first.
```

Das ist wesentlich besser als:

> Hier sind die letzten 47 Chatnachrichten und der komplette Kühlschrank. Was soll Marco kochen?

---

# 8. Structured Outputs + Tools statt Text parsen

Das wäre bei fam für mich Pflicht.

OpenAI unterstützt Structured Outputs; mit `strict: true` können Function Calls gegen ein definiertes JSON-Schema validiert werden. 

Also nicht:

```text
AI:
"Okay! Ich würde die Milch als verbraucht markieren."
```

und dann versucht eure App den Satz zu verstehen.

Sondern:

```json
{
  "tool": "consume_food",
  "arguments": {
    "food_item_id": "123",
    "amount": 500,
    "unit": "ml"
  }
}
```

Tool:

```ts
consumeFood({
  foodItemId,
  amount,
  unit
})
```

Dann kontrolliert **euer Backend**, ob das überhaupt erlaubt ist.

---

# 9. Agent darf DB nicht frei bedienen

Ganz wichtig.

Nicht:

```text
LLM → SQL
```

und schon gar nicht:

```text
LLM → Supabase Service Role
```

Sondern kleine Tools:

```text
get_inventory()
get_expiring_food()
search_food()
consume_food()
add_food()
update_quantity()
find_recipes()
get_household_preferences()
```

Der Agent bekommt nur die Funktionen, die er benötigt.

OpenAI empfiehlt ebenfalls klar abgegrenzte, dokumentierte Tools und Guardrails für Agent-Systeme. 

---

# 10. Confirmation für Änderungen

Ich würde Actions in drei Klassen einteilen.

### Read

```text
get_inventory
get_expiring_food
get_preferences
```

→ automatisch erlaubt.

### reversible write

```text
mark_food_consumed
change_quantity
```

→ AI darf Vorschlag machen, UI zeigt ihn unmittelbar.

Beispiel:

> ✓ 300 g Hackfleisch als verbraucht markieren

### destructive / uncertain

```text
delete_item
delete_inventory
change_household
```

→ Nutzer bestätigt explizit.

Das verhindert den klassischen:

> Agent hat halluziniert und mir den halben Kühlschrank gelöscht.

---

# 11. Memory nicht als riesigen Chat bauen

Auch hier lässt sich massiv sparen.

Schlecht:

```text
system prompt
+ komplette Chat-History
+ kompletter Kühlschrank
+ alle bisherigen Empfehlungen
+ alle Rezepte
```

bei jedem Request.

Besser:

```text
             USER
               │
        ┌──────┴───────┐
        │              │
 profile memory    current task
        │              │
        └──────┬───────┘
               │
        relevant context
               │
               ▼
              LLM
```

Persistente Fakten:

```json
{
  "diet": "omnivore",
  "householdSize": 2,
  "cookingTimePreference": 30,
  "dislikes": ["olives"],
  "goals": ["reduce_food_waste"]
}
```

liegen in eurer DB.

Nicht in einem Chat Transcript.

---

# 12. Prompt Caching nutzen

Ein Teil des Prompts ist immer gleich:

```text
system instructions
tool definitions
food safety policy
response style
schemas
```

OpenAI Cached Input ist für aktuelle Modelle deutlich günstiger; bei GPT-5.4 mini beispielsweise:

```text
normal input: $0.75 / 1M
cached input: $0.075 / 1M
```

also Faktor **10**. 

Daher:

```text
[stable]
system prompt
tools
policies
schemas

[dynamic]
user
inventory subset
preferences
```

Stabilen Teil vorne halten.

---

# 13. Food Safety braucht besondere Behandlung

Das ist für eure App wichtiger als normale Chat-Sicherheit.

Der Agent sollte **nicht selbst erfinden**, wie lange Lebensmittel sicher sind.

Fragen wie:

> „Kann ich das rohe Hähnchen nach 6 Tagen noch essen?“

sind nicht dasselbe wie:

> „Was kann ich mit den Tomaten kochen?“

Ich würde eine eigene Schicht bauen:

```text
food safety question
       │
       ▼
trusted rules / source
       │
       ▼
structured result
       │
       ▼
LLM formuliert Erklärung
```

Also:

**Facts → Datenquelle**

**Language → LLM**

Nicht:

**Facts → Halluzination des LLM**

Das wird später ein eigener Research-Bereich: EFSA, BZfE, USDA etc.

---

# 14. Bilder

Hier sehe ich großes Potenzial:

```text
📷 Kühlschrank fotografieren
```

AI erkennt:

```text
tomatoes
milk
yogurt
peppers
cheese
```

Aber auch hier:

### Nicht sofort DB beschreiben

Erst:

```text
AI detection
↓
confidence
↓
UI:
"Ich habe erkannt:"
☑ Milch
☑ 3 Tomaten
☑ Paprika
? Gouda
↓
User bestätigt
↓
DB
```

GPT-5.4 mini unterstützt direkt Bildinput. 

Barcode / GTIN würde ich dagegen **nicht mit Vision lösen**, wenn ein Barcode-Scanner + Produktdatenbank verfügbar ist.

KISS.

---

# 15. Vergleich mit anderen Providern

Es lohnt sich, euch nicht technisch an einen einzelnen Anbieter zu ketten.

Aktuell beispielsweise:

### Google Gemini 3.1 Flash Lite

```text
Input:  $0.25 / 1M
Output: $1.50 / 1M
```

Google beschreibt es explizit als Modell für hochvolumige agentische Aufgaben. 

### Google Gemini 2.5 Flash-Lite

Sogar:

```text
Input:  $0.10 / 1M
Output: $0.40 / 1M
``` 


### Claude Sonnet 5

```text
Input:  $2 / 1M
Output: $10 / 1M
``` 


Damit ist klar:

Für einfache Extraktion/Classification existiert inzwischen ein **extrem günstiger Markt**.

Ich würde deshalb eure Domain-Schicht etwa so bauen:

```ts
interface AIProvider {
  extractFood(...)
  classifyIntent(...)
  generateMeal(...)
  runAgent(...)
}
```

statt überall direkt:

```ts
openai.responses.create(...)
```

einzubauen.

Nicht weil ihr ständig Provider wechseln solltet, sondern damit die Business-Logik nicht am Provider hängt.

---

# 16. Embeddings / RAG sind praktisch kostenlos

Falls wir später eigene Knowledge-Daten haben:

- Lagerungshinweise
- Saisoninformationen
- Kochwissen
- Rezeptdatenbank
- Lebensmittelwissen

können Embeddings interessant werden.

`text-embedding-3-small` kostet aktuell:

**$0.02 / 1 Mio. Tokens**. 

Das ist faktisch vernachlässigbar.

Aber auch hier würde ich für MVP sagen:

**YAGNI.**

Postgres Full Text Search / normale Datenbankqueries reichen wahrscheinlich zunächst.

---

# 17. Datenschutz für Deutschland/EU

Hier müsst ihr das von Anfang an sauber planen.

OpenAI gibt für seine API an, dass API-Inhalte standardmäßig nicht einfach zum Trainieren der Modelle verwendet werden; je nach Konfiguration können API-Ein-/Ausgaben allerdings bis zu 30 Tage für Betriebs-/Missbrauchserkennung gespeichert werden. Für berechtigte Kunden gibt es Zero Data Retention. 

Für berechtigte API-Projekte existiert außerdem europäische Datenresidenz/-verarbeitung. 

Für fam würde ich trotzdem konsequent minimieren.

Nicht mitsenden:

```text
Marco Mustermann
Musterstraße 123
marco@example.com
```

wenn die Anfrage lediglich braucht:

```json
{
  "householdSize": 2,
  "inventory": [...]
}
```

Pseudo-/anonyme IDs reichen.

---

# 18. Monitoring muss von Anfang an rein

Pro AI-Request würde ich ungefähr loggen:

```ts
{
  feature: "meal_suggestion",
  model: "gpt-5.4-mini",

  inputTokens: 1823,
  cachedTokens: 1100,
  outputTokens: 241,

  estimatedCostUsd: 0.0018,

  latencyMs: 1240,

  toolCalls: [
    "get_expiring_food"
  ],

  success: true
}
```

Da ihr ohnehin **PostHog + Sentry** nutzt, wäre das sehr gut integrierbar.

Damit könnt ihr später sehen:

```text
AI Cost / MAU
AI Cost / recommendation
AI Cost / saved food item
AI Cost / paying customer

P50 latency
P95 latency

success rate
retry rate
tool error rate
```

Der wirklich interessante KPI wäre irgendwann:

> **AI cost per food item saved**

statt bloß Tokenkosten.

---

# 19. Cost Budgets direkt ins System

Ich würde früh harte Limits setzen.

Beispielsweise:

```text
nano:
max output 300 tokens

mini:
max output 600 tokens

agent:
max 4 tool steps

retry:
max 1

expensive model:
nur bei expliziter escalation
```

Und:

```text
Free:
z. B. 30 anspruchsvolle Agent-Aktionen / Monat

Premium:
höhere Limits
```

Nicht zwingend, weil die AI teuer ist.

Sondern als Schutz vor:

```text
Bots
abuse
infinite agent loops
buggy client retries
```

---

# 20. Meine Architektur für fam

Ich würde aktuell ungefähr das bauen:

```text
                     React Native / Expo
                            │
                            ▼
                    AI endpoint / API
                            │
                     auth + rate limit
                            │
                            ▼
                    Intent Router
                  GPT-5.4 nano
                            │
           ┌────────────────┼─────────────────┐
           │                │                 │
      deterministic      simple AI       complex AI
           │                │                 │
           │              nano              mini
           │                │                 │
           └────────────────┼─────────────────┘
                            │
                         Tools
                            │
       ┌────────────────────┼─────────────────────┐
       │                    │                     │
 inventory DB        recipe/search         safety data
       │                    │                     │
       └────────────────────┼─────────────────────┘
                            │
                      structured output
                            │
                            ▼
                            UI
```

Und **erst wenn Evals zeigen, dass mini an bestimmten Aufgaben scheitert**, würde ich GPT-5.4 einsetzen.

Nicht andersherum.

---

# 21. Was ich für euren MVP konkret einsetzen würde

Meine erste Version wäre wahrscheinlich:

**GPT-5.4 nano**

für:

```text
intent classification
food extraction
normalization
quantity extraction
ranking
simple questions
```

**GPT-5.4 mini**

für:

```text
meal planning
conversation
multimodal fridge/photo understanding
ambiguous user requests
multi-tool decisions
```

**normale Software**

für:

```text
expiration calculations
inventory
notifications
statistics
barcode scanning
business rules
permissions
```

**GPT-5.4**

zunächst:

```text
gar nicht
```

oder nur intern für Evals / schwierige Testfälle.

Das dürfte für euren Use Case ein sehr gutes Preis-/Qualitätsverhältnis ergeben.

---

## Mein vorläufiges Kosten-Fazit

Für **fam** würde ich für die frühe Planung nicht mit `$5–10 AI-Kosten pro User` kalkulieren.

Ich würde eher zunächst mit:

> **ca. $0.10–$0.50 pro AI-aktivem Nutzer und Monat**

planen.

Bei intensiveren Nutzern möglicherweise:

> **$0.50–$1.50**

Die wirklich gefährlichen Kostentreiber sind nicht die Listenpreise, sondern:

1. unnötig große Modelle,
2. komplette Chat-Historien,
3. zu große Datenbank-Kontexte,
4. autonome Agent-Loops,
5. unnötige Vision-Aufrufe,
6. fehlendes Caching,
7. Retries ohne Limits,
8. AI für Aufgaben, die eine SQL-Abfrage erledigen kann.

Wenn wir diese acht Punkte sauber lösen, halte ich AI-Kosten für **gut beherrschbar**.

Der nächste sinnvolle Schritt wäre jetzt, dass wir **den fam AI-Agenten funktional zerlegen** – also vielleicht 15–25 konkrete Use Cases wie „Was läuft ab?“, „Foto Kühlschrank“, „Resterezept“, „Lebensmittel hinzufügen“, „ist das noch essbar?“ – und für **jeden einzelnen Use Case Modell, Tool, Kontext, erwartete Tokens, Kosten und Sicherheitsrisiko** festlegen. Daraus können wir anschließend eine ziemlich belastbare Kostenrechnung für **1k / 10k / 100k MAU** und eine konkrete Supabase/Expo-Architektur ableiten.