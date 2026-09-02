Ja. Für eure App ist ein AI-Agent sehr sinnvoll – aber wirtschaftlich wird er nur, wenn wir ihn als **gezielte Intelligence-Schicht** bauen und nicht als ChatGPT, das bei jeder Kleinigkeit den kompletten Kühlschrank-Kontext neu durchdenkt.

Stand der Preise: **1. September 2026**.

## Kurzfazit

Für euren Use Case würde ich zunächst ungefähr so denken:

> **App/Backend hält den Zustand → Regeln erledigen deterministische Arbeit → günstiges Modell versteht Sprache/Bilder und entscheidet → stärkeres Modell nur bei schwierigen Fällen.**

Damit sind AI-Kosten erstaunlich niedrig. Bei vernünftiger Architektur halte ich für einen normalen aktiven Nutzer grob **$0,02–$0,15 AI-Kosten pro Monat** für realistisch. Heavy User oder ein sehr agentischer Ansatz können eher bei **$0,20–$1+** landen.

Das Entscheidende ist weniger „welcher Anbieter ist 20 % billiger?“, sondern **wie oft ihr überhaupt ein LLM aufruft und wie viel Kontext ihr jedes Mal mitsendet**.

---

# 1. Was euer Agent eigentlich können sollte

Für `fam` würde ich AI vor allem für fünf Aufgaben einsetzen.

### A. Lebensmittel aus natürlicher Sprache erfassen

User:

> „Hab noch 2 Paprika, halbe Packung Feta und bisschen Spinat.“

AI macht daraus beispielsweise:

```json
{
  "items": [
    {
      "name": "Paprika",
      "quantity": 2,
      "unit": "piece"
    },
    {
      "name": "Feta",
      "quantity": 0.5,
      "unit": "package"
    },
    {
      "name": "Spinat",
      "quantity": null,
      "unit": null
    }
  ]
}
```

Sehr günstige AI-Aufgabe.

---

# 2. Foto / Einkauf / Kühlschrank verstehen

Zum Beispiel:

> Foto → „Ich sehe Joghurt, Mozzarella, Tomaten, Milch und Salat.“

Oder:

> Foto eines Mindesthaltbarkeitsdatums → Datum extrahieren.

Oder später:

> Kassenbon → Lebensmittel erkennen → Inventar aktualisieren.

Das ist ein sehr guter Vision-Use-Case.

Moderne günstige Modelle können Text **und Bilder** verarbeiten. OpenAI positioniert beispielsweise GPT-5.6 Luna explizit als Modell für kostenempfindliche High-Volume-Workloads und unterstützt dabei auch Image Input. 

---

# 3. „Was sollte ich heute essen?“

Hier wird es interessant.

Angenommen, der User hat:

```text
Spinat       1 Tag
Mozzarella   2 Tage
Tomaten      3 Tage
Kartoffeln  14 Tage
Reis        lange haltbar
```

Ihr müsst nicht den AI-Agenten bitten:

> „Analysiere alle Lebensmittel und finde heraus, welches zuerst abläuft.“

Das Backend weiß das bereits.

Backend:

```text
priority_score(item)
```

könnte beispielsweise berücksichtigen:

```text
expiry
opened_at
quantity
category
user_preferences
previous_waste
```

Dann bekommt das Modell nur:

```json
{
  "priority_foods": [
    "Spinat",
    "Mozzarella",
    "Tomaten"
  ]
}
```

und die Aufgabe:

> Erzeuge drei einfache Mahlzeiten, die möglichst viele dieser Lebensmittel verbrauchen.

Das spart massiv Tokens.

---

# 4. Conversational Agent

Das ist der sichtbare Teil:

> „Was kann ich heute kochen?“

> „Ich habe keine Lust länger als 20 Minuten zu kochen.“

> „Benutz unbedingt den Spinat.“

> „Kann ich die Suppe einfrieren?“

Hier darf das LLM glänzen.

Aber der Agent sollte auf Tools zugreifen:

```text
get_inventory()

get_expiring_items()

get_user_preferences()

search_recipes()

consume_item()

update_quantity()

add_item()

mark_as_wasted()

get_storage_guidance()
```

statt den gesamten Zustand irgendwo im Prompt zu simulieren.

Function Calling ist genau für diesen Typ Architektur gedacht: Das Modell entscheidet, welches Tool benötigt wird, eure Anwendung führt es aus und gibt das Ergebnis zurück. 

---

# Was kostet das?

Hier werden die Unterschiede interessant.

## Aktuelle Modellpreise

Preis pro **1 Mio. Tokens**:

| Modell | Input | Output |
|---|---:|---:|
| Gemini 2.5 Flash-Lite | $0.10 | $0.40 |
| GPT-5.6 Luna | **$0.20** | **$1.20** |
| Gemini 2.5 Flash | $0.30 | $2.50 |
| GPT-5.4 Mini | $0.75 | $4.50 |
| Claude Haiku 4.5 | $1.00 | $5.00 |
| GPT-5.6 Terra | $2.00 | $12.00 |
| Claude Sonnet 5 | $2.00 | $10.00 |
| GPT-5.6 Sol | $4.00 | $20.00 |

Aktuelle offizielle Preisangaben: OpenAI , Google  und Anthropic .

Interessant dabei:

### GPT-5.6 Luna

```text
Input:         $0.20 / 1M
Cached Input:  $0.02 / 1M
Output:        $1.20 / 1M
```

Das Cached Input ist also **10× günstiger** als normales Input. 

---

# Beispiel für eine typische fam-Anfrage

Nehmen wir relativ großzügig an:

```text
System Prompt       1,500 Tokens
User + Kontext        700 Tokens
--------------------------
Input               2,200 Tokens

Antwort               300 Tokens
```

Dann kostet ein normaler Call ungefähr:

### GPT-5.6 Luna

Input:

```text
2,200 / 1,000,000 × $0.20
= $0.00044
```

Output:

```text
300 / 1,000,000 × $1.20
= $0.00036
```

Gesamt:

> **$0.00080**

Also:

> **0,08 US-Cent pro Anfrage.**

Nicht 8 Cent.

**0,08 Cent.**

---

# 60 AI-Interaktionen pro Monat

Das wären ungefähr zwei Interaktionen pro Tag.

Mit dem gleichen Beispiel:

| Modell | ca. Kosten/User/Monat |
|---|---:|
| Gemini 2.5 Flash-Lite | ~$0.02 |
| GPT-5.6 Luna | ~$0.05 |
| Gemini 2.5 Flash | ~$0.08 |
| Claude Haiku 4.5 | ~$0.22 |
| GPT-5.6 Terra | ~$0.48 |
| GPT-5.6 Sol | ~$0.89 |

Das sind Modellkosten und noch keine anderen Infrastrukturkosten.

Daran sieht man schon:

**Ein günstiges Modell als Default macht einen enormen Unterschied.**

---

# Skalierung

Angenommen:

### 1.000 aktive User

mit 60 Interaktionen/Monat:

```text
60,000 AI Requests
```

GPT-5.6 Luna:

> ungefähr **$48 / Monat**

---

### 10.000 aktive User

```text
600,000 Requests
```

> ungefähr **$480 / Monat**

---

### 100.000 aktive User

```text
6 Mio. Requests
```

> ungefähr **$4.800 / Monat**

Und das ist noch ohne optimiertes Prompt-Caching gerechnet.

Mit einem sehr günstigen Modell wie Gemini Flash-Lite läge unser Modellbeispiel sogar näher an:

> **~$2.040 / Monat bei 100k MAU.**

Das ist der Grund, warum ich momentan **keine Angst vor den eigentlichen Tokenkosten** hätte.

Viel gefährlicher sind Architekturfehler.

---

# Der größte Kostentreiber: Agent-Loops

Ein User fragt:

> „Was kann ich heute kochen?“

Ein schlecht gebauter Agent macht:

```text
LLM
 ↓
DB Tool
 ↓
LLM
 ↓
Recipe Search
 ↓
LLM
 ↓
Inventory Tool
 ↓
LLM
 ↓
Nutrition Tool
 ↓
LLM
 ↓
final answer
```

Aus einer Userinteraktion werden plötzlich:

> **5–8 LLM Calls.**

Das kann eure Kosten fast linear vervielfachen.

Deshalb:

## Lieber

```text
User
 ↓
Backend sammelt benötigten Kontext
 ↓
1 LLM Call
 ↓
optional 1 Tool
 ↓
Antwort
```

und nur bei komplizierten Situationen ein echter Agent-Loop.

---

# Noch gefährlicher: Web Search

Für euren normalen Lebensmittel-Agenten braucht ihr **keine Websuche bei jeder Frage**.

Aktuell liegt OpenAI Web Search beispielsweise bei:

> **$10 pro 1.000 Web-Runs = $0.01 pro Suche**

plus gegebenenfalls die dadurch entstehenden Model-Tokens. 

Vergleich:

```text
normaler Luna Call:
~$0.0008

eine Web Search:
~$0.01 + Tokens
```

Eine Websuche kann damit locker **mehr als 10 normale AI-Interaktionen kosten**.

Deshalb nicht:

> „Such mir jedes Mal Rezepte im Internet.“

Sondern beispielsweise:

```text
eigene Recipe DB
        ↓
normaler DB Search / vector search
        ↓
LLM kombiniert Ergebnisse
```

Websuche nur bei:

> „Such mir ein Originalrezept für X.“

oder speziellen Fragen, bei denen wirklich aktuelle externe Informationen notwendig sind.

---

# RAG / Embeddings sind praktisch kostenlos

Wenn ihr später beispielsweise 50.000 Rezepte oder Lebensmittelinformationen habt, würde ich nicht alles ins Prompt schicken.

Stattdessen:

```text
User Request
     ↓
Embedding/Search
     ↓
Top 5 relevante Rezepte
     ↓
LLM
```

OpenAI `text-embedding-3-small` kostet aktuell:

> **$0.02 pro 1 Mio. Tokens.** 

Das ist praktisch vernachlässigbar.

Bei eurem bestehenden Backend wäre beispielsweise:

```text
Supabase Postgres
+
pgvector
```

eine völlig vernünftige Architektur.

---

# Mein vorgeschlagener Model Router

Ich würde von Anfang an **nicht ein Modell für alles verwenden**.

Sondern ungefähr:

```text
                    ┌─────────────────┐
                    │ User interaction│
                    └────────┬────────┘
                             │
                       Task classifier
                             │
       ┌─────────────────────┼────────────────────┐
       ↓                     ↓                    ↓
 deterministic          cheap model        strong model
    logic                 Luna etc.          Terra/Sol
       │                     │                    │
 expiry sorting         extraction          difficult
 notifications          simple chat         reasoning
 calculations           vision              ambiguous
 inventory              recipes             edge cases
```

Zum Beispiel:

### Tier 0 — keine AI

```text
Ablaufdatum prüfen
Bestand reduzieren
Reminder
Sortieren
Statistiken
Waste Score
Einkaufsliste
```

Kosten:

> **$0**

---

### Tier 1 — Cheap AI

GPT-5.6 Luna / Gemini Flash-Lite.

Für vielleicht **90–95 %** der AI-Aufgaben:

```text
Intent erkennen
Lebensmittel extrahieren
Kühlschrankfoto
Bon analysieren
Recipe matching
kurze Fragen
Mengen interpretieren
strukturierte Daten erzeugen
```

---

### Tier 2 — Smart AI

Terra / Sonnet / gegebenenfalls Sol.

Nur wenn:

```text
uncertain=true

oder

complexity_score > threshold
```

Beispielsweise:

> „Wir sind 5 Personen, davon zwei vegan, eine Person mit Nussallergie, und diese 13 Sachen müssen möglichst bis Donnerstag verbraucht werden. Plane drei Abendessen.“

Jetzt lohnt sich ein stärkeres Modell.

---

# Dadurch kann aus

```text
100 % Terra
```

zum Beispiel:

```text
90 % Luna
9 % Terra
1 % Sol
```

werden.

Und damit fällt eure durchschnittliche AI-Kostenbasis massiv.

---

# Structured Outputs sind für euch extrem wichtig

Ich würde möglichst **nie Freitext parsen**.

Nicht:

```text
AI:
"Du hast wohl ungefähr zwei Tomaten und etwas Käse..."
```

und danach Regex.

Sondern:

```json
{
  "items": [
    {
      "food_id": "tomato",
      "quantity": 2,
      "confidence": 0.94
    }
  ]
}
```

OpenAI unterstützt dafür Structured Outputs und `strict: true`, sodass Tool-Argumente dem definierten JSON-Schema folgen können. 

Google empfiehlt ebenfalls:

- starke Typisierung
- enums
- Validierung
- Fehlerbehandlung

auch wenn die Ausgabe schema-konform ist. 

Das würde ich konsequent umsetzen.

---

# Noch wichtiger: AI darf nicht eure Wahrheit besitzen

Nicht:

```text
Chat History
=
Inventory
```

Sondern:

```text
Supabase
=
Source of Truth
```

Der Agent bekommt beispielsweise:

```typescript
getExpiringFoods({
  userId,
  withinDays: 5
})
```

und erhält:

```json
[
  {
    "id": "123",
    "name": "Spinat",
    "quantity": 200,
    "unit": "g",
    "useBy": "2026-09-02"
  }
]
```

Das LLM **interpretiert Daten**.

Es **besitzt sie nicht**.

---

# Gesprächshistorie ebenfalls nicht endlos mitsenden

Klassischer Kostentrick:

Nach 100 Nachrichten werden ständig

```text
Message 1
Message 2
Message 3
...
Message 100
```

mitgeschickt.

Das wird völlig unnötig teuer.

Stattdessen:

```text
recent messages: 6-10

+

structured memory:
{
  household_size: 2,
  vegetarian: false,
  dislikes: ["olives"],
  cooking_time_preference: 20
}
```

plus aktuelle DB-Daten.

---

# Prompt Caching benutzen

Euer Agent wird vermutlich einen relativ großen statischen Prompt haben:

```text
Role
Safety rules
Tool descriptions
Response format
Food policy
Tone
```

Dieser Teil bleibt ständig gleich.

GPT-5.6 Luna kostet für Cached Input:

```text
normal:
$0.20 / 1M

cached:
$0.02 / 1M
```

also nur noch ein Zehntel. 

Deshalb:

```text
STATIC
system prompt
tool schemas
food rules
───────────────
DYNAMIC
user data
inventory
message
```

Der statische Prefix sollte möglichst identisch bleiben.

---

# Background AI → Batch

Eine interessante Sache für fam:

Ihr könnt nachts beispielsweise rechnen:

> Welche Lebensmittel laufen bei unseren Usern bald ab?

Dafür braucht ihr eigentlich gar keine AI.

Aber vielleicht:

> Generiere personalisierte Vorschläge für morgen.

Das kann Batch Processing sein.

OpenAIs Batch API bietet für unterstützte Modelle **50 % Rabatt** gegenüber synchronen Requests. 

Also:

```text
real-time chat
→ normal API

overnight recommendations
→ Batch
```

---

# Der vielleicht wichtigste Punkt: Food Safety

Euer Ziel ist:

> Lebensmittel nicht verschwenden.

Dadurch wird das Modell zwangsläufig Fragen bekommen wie:

> „Mein Hühnchen ist seit gestern abgelaufen. Kann ich es noch essen?“

Hier darf kein kreativer Agent improvisieren.

Die EU unterscheidet klar zwischen:

### „Mindestens haltbar bis“

betrifft primär **Qualität**.

und

### „Zu verbrauchen bis“

betrifft **Lebensmittelsicherheit**.

Lebensmittel mit einem „use by“/Verbrauchsdatum sollten nach dessen Ablauf nicht gegessen werden; Geruch oder Aussehen sind hierbei kein zuverlässiger Sicherheitsindikator. 

Das würde ich nicht nur prompten.

Sondern in Code modellieren:

```typescript
if (dateType === "USE_BY" && expired) {
  return {
    recommendation: "DISCARD",
    aiOverrideAllowed: false
  };
}
```

Also:

> **Safety Policy > LLM.**

Sehr wichtig für euren Use Case.

---

# Confidence Scores

Bei Vision und Extraktion würde ich außerdem etwas wie Folgendes zurückgeben:

```json
{
  "food": "Mozzarella",
  "quantity": 1,
  "expiry": "2026-09-04",
  "confidence": {
    "food": 0.97,
    "quantity": 0.93,
    "expiry": 0.62
  }
}
```

Bei:

```text
confidence < 0.8
```

kann die UI fragen:

> Ist das Datum 04.09. oder 09.04.?

statt heimlich falsche Daten zu speichern.

---

# Ein weiterer Kostenhebel: kurze Antworten

Output-Tokens sind wesentlich teurer als Input-Tokens.

Bei Luna:

```text
Input:  $0.20
Output: $1.20
```

also Faktor **6**. 

Bei Terra:

```text
Input:  $2
Output: $12
```

ebenfalls Faktor **6**. 

Deshalb nicht standardmäßig:

> „Erkläre ausführlich deine Überlegungen.“

Sondern:

```text
RecipeCard
title
ingredients
3–5 instructions
why_this_recipe
```

Die UI sollte strukturierte Informationen präsentieren, nicht lange AI-Essays.

---

# Was ich für euren MVP bauen würde

Meine erste Architektur wäre deshalb:

```text
Expo App
    │
    │
    ▼
Supabase Edge Function / AI Gateway
    │
    ├──────────────► Supabase
    │                 inventory
    │                 expiry dates
    │                 preferences
    │                 recipes
    │
    ▼
AI Router
    │
    ├── no AI
    │
    ├── GPT-5.6 Luna
    │
    └── GPT-5.6 Terra fallback
```

Und der Agent hätte am Anfang vielleicht nur:

```text
get_inventory
get_expiring_foods
add_food
update_food
consume_food
search_recipes
get_preferences
```

Nicht 50 Tools.

Google empfiehlt selbst, die aktive Toolmenge bei Function Calling überschaubar zu halten und nennt ungefähr **10–20 aktive Tools** als Richtwert. 

Für euren MVP würde ich sogar eher bei **5–8 Tools** bleiben.

---

# Anbieterwahl

Ich würde euch momentan **nicht hart an OpenAI binden**.

Eine kleine interne Abstraktion:

```typescript
interface AIProvider {
  extractFood(...)
  analyzeImage(...)
  generateRecipe(...)
  chat(...)
}
```

Dann könnt ihr benchmarken:

```text
OpenAI Luna
vs
Gemini Flash-Lite
vs
Gemini Flash
```

Google ist bei den reinen Tokenpreisen derzeit extrem aggressiv: Gemini 2.5 Flash-Lite liegt bei $0.10 Input / $0.40 Output pro 1M Tokens. 

OpenAI Luna ist mit $0.20 / $1.20 etwas teurer, bietet dafür aber direkt das aktuelle OpenAI-Agent-/Tooling-Ökosystem und unterstützt Function Calling, Structured Outputs, Vision, Web Search und weitere Tools. 

Ich würde daher **nicht anhand der Preisliste entscheiden**, sondern einen kleinen Eval bauen.

Zum Beispiel 200 reale fam-Testfälle:

```text
50 natural language inventory inputs
50 food photos
30 expiry-date photos
40 recipe requests
20 ambiguous inputs
10 food-safety scenarios
```

Dann messen:

```text
accuracy
structured-output validity
latency
tokens
cost
tool-call accuracy
```

und erst danach das Default-Modell festlegen.

---

# Datenschutz

Da ihr potenziell Kühlschrank-/Wohnungsfotos und Haushaltsinformationen verarbeitet, würde ich außerdem von Tag eins an festlegen:

```text
keine unnötigen Bilder speichern
EXIF entfernen
kein kompletter User-Datensatz in Prompts
minimal necessary context
AI logs pseudonymisieren
separate user ID statt personenbezogener Daten
```

Bei der OpenAI API können Inputs/Outputs grundsätzlich für bis zu 30 Tage zur Servicebereitstellung und Missbrauchserkennung gespeichert werden; für berechtigte Setups gibt es Zero Data Retention. OpenAI gibt außerdem an, Enterprise/API-Kundendaten nicht standardmäßig zum Training der Modelle zu verwenden. 

Das sollte später noch separat gegen eure DSGVO-Architektur geprüft werden.

---

# Meine Zielarchitektur für `fam`

Ich würde also **keinen „allwissenden AI Agent“** bauen.

Sondern:

```text
                    fam intelligence
                          │
          ┌───────────────┼────────────────┐
          │               │                │
     deterministic      cheap AI       smart AI
          │               │                │
      inventory          NLP          difficult plan
      expiry logic       vision       ambiguous cases
      reminders          extraction    fallback
      food safety        matching
      statistics         normal chat
          │               │                │
          └───────────────┼────────────────┘
                          │
                       Supabase
                     source of truth
```

Das passt auch sehr gut zu **KISS/YAGNI**: zunächst keine Multi-Agent-Plattform, kein riesiges RAG-System und kein kompliziertes LangChain-Geflecht. 

---

# Realistische Budgetannahme für euren MVP

Ich würde zunächst intern mit diesen Limits planen:

| Kennzahl | Ziel |
|---|---:|
| normale AI Calls/User/Monat | 30–100 |
| durchschnittlicher Input | <2.500 Tokens |
| durchschnittlicher Output | <300 Tokens |
| Agent Tool Calls | möglichst 0–2 |
| Web Searches | nahezu 0 |
| starkes Modell | <5–10 % |
| AI-Kosten normaler MAU | **< $0.10** |
| Heavy User | **< $0.50** |

Das sind **keine garantierten Preise**, sondern sinnvolle Engineering-Zielwerte auf Basis der heutigen APIs.

Und ich würde direkt eine harte Kennzahl im Backend erfassen:

```text
ai_cost_usd
per request
per feature
per user
per model
```

So könnt ihr später in PostHog beispielsweise sehen:

```text
Recipe suggestion
$0.0007 avg

Image scan
$0.0014 avg

Agent chat
$0.0021 avg

Monthly AI cost / MAU
$0.063
```

Das ist wesentlich wertvoller als am Monatsende nur eine OpenAI-Rechnung zu bekommen.

---

## Was ich als Nächstes machen würde

Bevor wir irgendeine AI implementieren, würde ich die **konkreten AI-Use-Cases von fam zerlegen und eine Kostenmatrix bauen**:

```text
Feature
↓
braucht überhaupt AI?
↓
Text / Vision / Embedding / Agent
↓
welches Modell?
↓
Tokens pro Call
↓
Calls/User
↓
Kosten pro User
↓
Kosten bei
1k / 10k / 100k / 1M MAU
```

Dann können wir beispielsweise entscheiden, ob **Kühlschrank-Foto, Bon-Scan, automatisches MHD, Rezeptgenerator, proaktive „iss mich zuerst“-Vorschläge und der eigentliche Chat-Agent** wirklich in V1 gehören – und ich kann daraus eine konkrete **AI-Architektur + Kostenprognose für fam** machen.