Ja. Für euren Food-Waste-Agenten würde ich die Kosten nicht als „wir brauchen einen ChatGPT-ähnlichen Agenten pro User“ betrachten, sondern als mehrere klar getrennte AI-Jobs. Genau dadurch kann das sehr günstig werden.

Stand **1. September 2026** ist mein erster Schluss: **Die reinen LLM-Kosten sind wahrscheinlich nicht euer Hauptproblem.** Mit vernünftigem Model-Routing kann ein aktiver Nutzer im Bereich von **wenigen Cent bis deutlich unter 1 € AI-Kosten pro Monat** liegen.

## Was eure AI wahrscheinlich tun muss

Für eure App sehe ich grob diese Fälle:

1. **Lebensmittel verstehen**
   - „Ich habe noch 2 Paprika, Feta und Reis.“
   - Produktname normalisieren
   - Kategorie bestimmen
   - Mengen/Einheiten erkennen

2. **Fotos verstehen**
   - Kühlschrank fotografieren
   - Lebensmittel auf einem Foto erkennen
   - Kassenbon / Verpackung / MHD lesen

3. **Bestand intelligent bewerten**
   - Was sollte zuerst verbraucht werden?
   - Was läuft vermutlich bald ab?
   - Was kann eingefroren werden?
   - Was kann zusammen verwendet werden?

4. **Rezepte / Vorschläge**
   - „Was kann ich mit meinen Sachen kochen?“
   - Präferenzen + Vorrat + Ablaufdatum berücksichtigen

5. **Agent-Aktionen**
   - Bestand ändern
   - Produkt als verbraucht markieren
   - Einkaufsliste ergänzen
   - Erinnerung anlegen
   - Rezept speichern

6. eventuell später:
   - Voice
   - Web-Recherche
   - personalisierte Ernährungs-/Haushaltsplanung

Und **nicht jeder dieser Schritte braucht dasselbe Modell**.

---

# 1. Aktuelle OpenAI-Kosten

Die aktuelle GPT-5.6-Familie kostet pro 1 Mio. Tokens:

| Modell | Input | Cached Input | Output | Rolle |
|---|---:|---:|---:|---|
| **GPT-5.6 Luna** | $0,20 | $0,02 | $1,20 | sehr günstig / Masse |
| **GPT-5.6 Terra** | $2,00 | $0,20 | $12,00 | komplexere Aufgaben |
| **GPT-5.6 Sol** | $4,00 | $0,40 | $20,00 | schwierigste Fälle |

Alle drei unterstützen auch **Bildinput, Structured Outputs und Function Calling**. 

Für euren Fall ist insbesondere **Luna interessant**. OpenAI positioniert es ausdrücklich für kostenkritische High-Volume-Anwendungen. 

---

# 2. Was kostet eine typische Nachricht wirklich?

Nehmen wir einen relativ großzügigen Agent-Turn:

**Input**
- System Prompt
- User-Frage
- relevanter Lebensmittelbestand
- User-Präferenzen
- Tool-Beschreibungen

≈ **2.000 Tokens**

**Antwort**
≈ **300 Tokens**

Dann kostet ein Request ungefähr:

### Luna

```text
2.000 × $0,20 / 1.000.000 = $0,00040
300 × $1,20 / 1.000.000   = $0,00036

Gesamt = $0,00076
```

Also:

**0,076 Cent pro Anfrage.**

Nicht 7,6 Cent.

**0,076 Cent.**

---

## 100 AI-Interaktionen pro Monat

Mit exakt diesem Beispiel:

| Modell | Kosten/User/Monat |
|---|---:|
| Luna | **$0,076** |
| Terra | **$0,76** |
| Sol | **$1,40** |

Bei 300 Interaktionen:

| Modell | Kosten/User/Monat |
|---|---:|
| Luna | **$0,23** |
| Terra | **$2,28** |
| Sol | **$4,20** |

Deshalb wäre es wirtschaftlich ziemlich unsinnig, jeden simplen Vorgang über Terra oder Sol laufen zu lassen.

---

# 3. Das Modell-Routing, das ich für fam bauen würde

Statt:

```text
User
 ↓
GPT-5.6 Sol
 ↓
alles
```

würde ich bauen:

```text
                    ┌─ normale App-Logik
                    │
User → Agent Router ┼─ GPT-5.6 Luna     ~85 %
                    │
                    ├─ GPT-5.6 Terra    ~14 %
                    │
                    └─ GPT-5.6 Sol       ~1 %
```

Beispielsweise:

### Luna

Für ungefähr 80–90 %:

- Produktnamen normalisieren
- Zutaten extrahieren
- MHD aus Text interpretieren
- Intent erkennen
- Tool auswählen
- einfache Rezeptideen
- Bestand zusammenfassen
- Einkaufsvorschläge
- Klassifikation
- JSON erzeugen

### Terra

Nur wenn wirklich Denken erforderlich ist:

> „Wir sind vier Personen. Diese 18 Sachen müssen teilweise in den nächsten drei Tagen weg. Plane drei Abendessen und zwei Mittagessen mit möglichst wenigen zusätzlichen Einkäufen.“

Das ist eine wesentlich komplexere Optimierungsaufgabe.

### Sol

Nur bei wirklich schwierigen Fällen oder als Fallback.

Bei einem angenommenen Mix von:

```text
85 % Luna
14 % Terra
 1 % Sol
```

und unseren 2.000 Input / 300 Output Tokens lägen **300 AI-Interaktionen ungefähr bei $0,56 pro User/Monat**.

Das ist schon eine ziemlich intensive Nutzung.

---

# 4. Und ich würde sogar noch weniger AI verwenden

Der wichtigste Architekturpunkt:

> **Das LLM sollte nicht eure Business Logic sein.**

Wenn die App weiß:

```ts
{
  product: "Milch",
  expiresAt: "2026-09-03",
  quantity: 1
}
```

soll kein LLM jeden Morgen entscheiden:

> „Ist der 03.09. näher als der 08.09.?“

Das macht Code.

```ts
daysUntilExpiration(product.expiresAt)
```

Kosten:

```text
$0
```

Genauso:

- Datumsberechnung
- Sortierung
- Mengenaddition
- Bestandsverwaltung
- Reminder Scheduling
- Kategorien
- Filter
- Einkaufslisten
- bekannte Haltbarkeitsregeln

sollten möglichst deterministisch sein.

---

# 5. Der Agent bekommt nur relevante Daten

Ein häufiger und teurer Fehler wäre:

```text
SYSTEM:
Du bist fam ...

USER PROFILE:
...

ALLE 487 Lebensmittel:
...

ALLE früheren Unterhaltungen:
...

ALLE Rezepte:
...

USER:
Was kann ich heute kochen?
```

Das skaliert schlecht.

Besser:

```text
User:
Was kann ich heute kochen?
```

Server stellt vorher fest:

```text
Lebensmittel:
- Brokkoli, MHD morgen
- Feta, MHD +2 Tage
- Sahne, geöffnet
- Reis
- Pasta
- Tomaten
```

LLM bekommt nur diese 6 relevanten Dinge.

Also:

```text
DB
 ↓
deterministische Filter
 ↓
kleiner relevanter Context
 ↓
LLM
```

Nicht:

```text
gesamte DB
 ↓
LLM
```

---

# 6. Noch besser: Tools statt Daten in den Prompt kippen

Der Agent sollte beispielsweise Tools bekommen wie:

```ts
getExpiringFoods({
  withinDays: 5
})

searchInventory({
  categories: ["vegetable", "dairy"]
})

markFoodConsumed({
  foodId: "..."
})

addShoppingItem({
  product: "..."
})

createExpiryReminder({
  foodId: "..."
})
```

OpenAI unterstützt dafür typed Function Calls und Structured Outputs. 

Dann kann der Agent sagen:

```text
Ich brauche erstmal Lebensmittel,
die in den nächsten drei Tagen ablaufen.
```

und ruft:

```text
getExpiringFoods({ withinDays: 3 })
```

auf.

Das ist deutlich besser als dem Agenten permanent den kompletten Haushalt zu schicken.

---

# 7. Structured Outputs sind für eure App extrem wichtig

Nicht:

```text
AI:
Du hast vermutlich noch zwei Tomaten.
Ich würde...
```

und dann versucht eure React-Native-App, den Text zu verstehen.

Sondern z. B.:

```json
{
  "message": "Die Tomaten und der Feta sollten zuerst weg.",
  "suggestions": [
    {
      "type": "recipe",
      "recipeId": "..."
    }
  ],
  "priorityFoodIds": [
    "...",
    "..."
  ]
}
```

OpenAI empfiehlt bei unterstützten Modellen `json_schema` Structured Outputs gegenüber altem JSON Mode. 

Das bringt:

- weniger Fehler
- kürzere Outputs
- weniger Tokens
- bessere Tests
- weniger Parsing
- stabilere App

---

# 8. Prompt Caching

Das wird für euren Agent ebenfalls interessant.

Der Teil:

```text
Du bist der fam Food Assistant.

Regeln:
...
Tools:
...
Antwortstil:
...
Safety:
...
```

ändert sich selten.

GPT-5.6 cached wiederverwendeten Input. Für Luna beispielsweise:

```text
normal input: $0,20 / M
cached:       $0,02 / M
```

also **90 % günstiger** für Cache-Hits. 

GPT-5.6 unterstützt außerdem explizite Cache-Breakpoints. 

Deshalb sollte der Prompt ungefähr aufgebaut sein als:

```text
[statischer System Prompt]
[statische Tool definitions]
------------------------------
[dynamische Userdaten]
[dynamische Nachricht]
```

Nicht ständig andersherum.

---

# 9. Bilder werden ein interessanter Kostenpunkt

Und das ist für fam wahrscheinlich wichtiger als bei einem normalen Chatbot.

Die aktuellen GPT-Modelle unterstützen Bildinput. 

Beispielsweise:

> User fotografiert seinen Kühlschrank.

Dann kann das Modell erkennen:

```text
Tomaten
Milch
Mozzarella
Paprika
Butter
...
```

Aber hier würde ich **nicht jedes Foto mit maximaler Auflösung senden**.

OpenAI weist explizit darauf hin, dass bei GPT-5.6 große Bilder mit `original`/`auto` mehr Input-Tokens und höhere Latenz erzeugen können. 

Für:

### Barcode

keine AI.

```text
Camera
 ↓
Barcode scanner
 ↓
Produktdatenbank
```

### QR / EAN

keine AI.

### klarer gedruckter Kassenbon

erst OCR / spezialisierte Erkennung prüfen.

### Kühlschrankfoto

Vision-Modell.

### unbekanntes loses Lebensmittel

Vision-Modell.

Das ist genau die Art von Routing, die Geld und Fehler spart.

---

# 10. Embeddings sind praktisch kostenlos

Falls ihr später semantische Rezeptsuche macht:

> „Zeig mir etwas Asiatisches, das zu meinen Sachen passt.“

könnt ihr Rezepte embedden.

Aktuell:

```text
text-embedding-3-small:
$0,02 / 1 Mio Tokens
``` 


Angenommen eure gesamte Rezeptdatenbank enthält:

```text
10 Millionen Tokens
```

Dann einmaliges Embedding:

```text
$0,20
```

Natürlich kommen noch Vector-DB/Storage-Kosten hinzu, aber die Embedding-Inferenz selbst ist lächerlich günstig.

---

# 11. Ich würde nicht bei jeder Frage Web Search verwenden

Beispiel:

> „Wie lange hält eine ungeöffnete Packung Reis?“

Dafür braucht ihr nicht jedes Mal Google/OpenAI Web Search.

Besser wäre eine eigene strukturierte Knowledge Base:

```text
food_defaults

food_type
typical_fridge_lifetime
typical_freezer_lifetime
storage_recommendations
safety_notes
```

Der Agent bekommt das über eure DB.

Web Search nur beispielsweise für:

> „Gibt es gerade einen Rückruf für Produkt XYZ?“

oder aktuelle externe Informationen.

Tool-Aufrufe können zusätzlich zu Tokens separat bepreist werden. OpenAI weist bei Web Search explizit auf zusätzliche Tool-Call-Gebühren hin. 

---

# 12. Gemini ist preislich ebenfalls interessant

Google hat ebenfalls sehr aggressive Preise, gerade für Flash-Modelle.

Die aktuelle Gemini-Preisliste enthält beispielsweise sehr günstige High-Volume-Modelle bis in den Bereich von:

```text
$0,05 / M Input
$0,20 / M Output
```

je nach Modell/Processing-Modus. 

Daher würde ich eure Architektur **provider-agnostisch** halten.

Nicht überall:

```ts
openai.responses.create(...)
```

sondern:

```ts
ai.extractFood(...)
ai.planMeals(...)
ai.classifyIntent(...)
ai.analyzeImage(...)
```

und darunter:

```text
OpenAIProvider
GeminiProvider
AnthropicProvider
```

Nicht weil ihr von Tag 1 drei Provider braucht — YAGNI — sondern damit eure Domain nicht komplett an einen API-Response-Typ gekoppelt wird.

---

# 13. Auch Claude ist ein möglicher Benchmark

Claude Sonnet 5 liegt aktuell bei:

```text
$2 / M Input
$10 / M Output
``` 


Damit liegt es preislich ungefähr in der Terra-Klasse.

Ich würde aber **nicht anhand von Tokenpreisen entscheiden**.

Ein Modell, das 30 % teurer ist, aber:

- weniger Tool-Loops braucht
- weniger Halluzinationen produziert
- kürzere Antworten erzeugt
- bessere Vision-Erkennung hat

kann am Ende günstiger sein.

Deshalb braucht ihr Evals.

---

# 14. Eure wichtigste Metrik sollte nicht `$ / 1M Token` sein

Sondern:

> **Cost per successful task**

Beispiel:

Modell A:

```text
$0.002 / Versuch
70 % Erfolg
```

Modell B:

```text
$0.003 / Versuch
98 % Erfolg
```

B ist wahrscheinlich das billigere Produkt.

Für fam würde ich ein Eval-Set mit etwa 100–300 echten Situationen aufbauen:

```text
"Ich hab drei braune Bananen"
"Was muss heute weg?"
"Füge die Milch hinzu"
"Hab den Joghurt gegessen"
"Koche für vier Personen"
"Hier ist mein Kühlschrankfoto"
"Was kann ich einfrieren?"
"Ich habe keine Eier"
"Das MHD war gestern, kann ich das noch essen?"
...
```

Dann misst ihr pro Modell:

```text
accuracy
tool_call_accuracy
structured-output-validity
latency
tokens
cost
user-quality
```

Und erst **danach** entscheidet ihr Luna vs Gemini Flash vs Terra etc.

---

# 15. Besonders wichtig: Lebensmittel-Sicherheit

Bei euch kommt noch etwas hinzu, was bei einem gewöhnlichen Rezeptbot nicht existiert.

Der Agent darf nicht selbstbewusst sagen:

> „Das Hähnchen kannst du noch drei Tage essen.“

wenn er es nicht sicher wissen kann.

Ich würde eine klare Grenze bauen:

```text
AI = Erklärung / Empfehlung
Rules + authoritative data = Safety
```

Also beispielsweise:

```text
food safety rules
        ↓
 deterministic engine
        ↓
       agent
        ↓
 user-friendly explanation
```

Bei Unsicherheit:

> „Das lässt sich anhand des Fotos/MHD allein nicht sicher beurteilen.“

statt eine Haltbarkeit zu erfinden.

Das ist neben Kosten wahrscheinlich einer der wichtigsten Designpunkte des gesamten Features.

---

# 16. Batch Processing

Für Dinge, die nicht live passieren müssen, könnt ihr ebenfalls sparen.

OpenAIs Batch API bietet für unterstützte Modelle **50 % Rabatt gegenüber synchroner Verarbeitung** und verarbeitet Jobs innerhalb von bis zu 24 Stunden. 

Geeignet wären beispielsweise nachts:

```text
Inventar analysieren
↓
"Welche Dinge werden morgen kritisch?"
↓
Suggestion vorbereiten
↓
Push Notification
```

oder:

```text
neue Rezepte klassifizieren
Embeddings
Tags generieren
Daten bereinigen
```

Nicht für den Live-Chat.

---

# 17. Was bei 10.000 Usern passieren könnte

Nehmen wir zunächst:

```text
10.000 MAU
30 % davon sind regelmäßig aktiv
= 3.000 aktive Nutzer
```

und jeder aktive Nutzer erzeugt:

```text
100 Agent-Interaktionen / Monat
```

Das sind:

```text
300.000 AI Turns
```

Bei unserem angenommenen Routing:

```text
85 % Luna
14 % Terra
1 % Sol
```

und ungefähr 2k Input + 300 Output:

```text
≈ $555 / Monat
```

für die LLM-Turns.

Bei nur Luna wären es ungefähr:

```text
≈ $228 / Monat
```

Und bei 10.000 Usern mit jeweils nur ~30 AI-Turns läge man entsprechend weit darunter.

Das sind natürlich Modellrechnungen — Vision, Search, Voice und Infrastruktur kommen gegebenenfalls dazu.

---

# 18. Wo ich tatsächlich Budget einplanen würde

Ich würde eure AI-Cost-Struktur ungefähr so betrachten:

```text
AI COST
│
├── LLM text inference
│
├── Vision
│
├── Embeddings
│
├── External AI/Search APIs
│
├── optional Voice
│
└── Agent retries / tool loops

INFRA COST
│
├── Supabase/Postgres
├── Vector storage
├── Image storage
├── Edge Functions
├── bandwidth
├── notifications
└── analytics/logging
```

Interessanterweise können bei einem guten Design irgendwann

```text
Image storage
Database
Egress
Logging
```

größere Kostenfaktoren sein als Luna-Tokens.

---

# Meine Architektur-Empfehlung für fam

Ich würde Phase 1 sehr simpel halten:

```text
                         ┌──────────────────┐
                         │ React Native App │
                         └────────┬─────────┘
                                  │
                         POST /ai/assistant
                                  │
                                  ▼
                        ┌───────────────────┐
                        │ Agent Controller  │
                        └─────────┬─────────┘
                                  │
               ┌──────────────────┼──────────────────┐
               │                  │                  │
               ▼                  ▼                  ▼
          Inventory          Food Rules          Recipe DB
          Tools              Engine              / Search
               │                  │                  │
               └──────────────────┼──────────────────┘
                                  │
                                  ▼
                         Context Builder
                                  │
                                  ▼
                         GPT-5.6 Luna
                                  │
                      difficult? │
                         ┌────────┴────────┐
                         ▼                 ▼
                       done             Terra
                                          │
                                    rare fallback
                                          ▼
                                         Sol
```

Dazu:

```text
Structured Outputs
Prompt caching
short contexts
server-side API keys
usage tracking per user
hard monthly limits
evals
model routing
```

Das dürfte euch einen sehr günstigen und gleichzeitig ziemlich leistungsfähigen Agenten geben.

## Größenordnung, mit der ich zunächst kalkulieren würde

Für eure Finanzplanung würde ich nicht mit `$5 AI/User` rechnen.

Ich würde zunächst ungefähr ansetzen:

**leichter Nutzer:** `$0,02–0,10 / Monat`

**normal aktiver Nutzer:** `$0,10–0,50 / Monat`

**sehr aktiver Agent-Nutzer:** `$0,50–2 / Monat`

inklusive sinnvoller Nutzung stärkerer Modelle, aber **noch ohne ungewöhnlich intensive Vision-, Voice- oder Web-Search-Nutzung**.

Das ist meiner Ansicht nach die sinnvollere Größenordnung, die wir jetzt durch echte Usage-Simulationen validieren sollten.

Der nächste sinnvolle Schritt wäre, dass wir konkret **eure geplanten AI-Funktionen für fam inventarisieren** und daraus ein Kostenmodell bauen, etwa:

```text
10k / 100k / 1M Nutzer

→ Chat
→ Kühlschrankfoto
→ Bon-Scan
→ Rezeptgenerierung
→ Ablaufwarnungen
→ Agent Tool Calls
→ tägliche/monatliche Nutzung

= AI-Kosten/User
= AI-Kosten/MAU
= Break-even für Free/Premium
```

Dann können wir ziemlich genau sehen, ob z. B. **unbegrenzter AI-Agent im Free-Tier** wirtschaftlich machbar ist oder welche Limits Sinn ergeben.