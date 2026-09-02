Ja, die Idee ist gut machbar. Die reinen KI-Kosten werden anfangs wahrscheinlich überschaubar sein. Entscheidend ist, dass der Agent nicht jede Entscheidung selbst „denkt“, sondern nur dort ein LLM nutzt, wo Sprache, Anpassung und Erklärung einen echten Mehrwert bieten.

Stand: 1. September 2026, Preise in USD vor Steuern.

## Grobes Kostenmodell

Annahme: 100 Modellaufrufe pro Haushalt und Monat, je 2.500 Input- und 400 Output-Tokens. Das ist bereits relativ großzügig.

| Modell | Preis Input / Output | Kosten pro 1.000 Haushalte |
|---|---:|---:|
| OpenAI GPT-5.6 Luna | $0,20 / $1,20 je 1 Mio. Tokens | ca. $98 |
| Gemini 3.1 Flash-Lite | $0,25 / $1,50 | ca. $123 |
| Anthropic Claude Haiku 4.5 | $1 / $5 | ca. $450 |
| Anthropic Claude Sonnet 5 | $2 / $10 | ca. $900 |
| OpenAI GPT-5.6 Terra | $2 / $12 | ca. $980 |

Quellen: [OpenAI GPT-5.6 Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna), [Anthropic Pricing](https://platform.claude.com/docs/en/about-claude/pricing?hsLang=en), [Gemini Pricing](https://ai.google.dev/gemini-api/docs/pricing?hl=en).

Bei durchschnittlich 20 statt 100 Modellaufrufen pro Haushalt wird die Tabelle ungefähr durch fünf geteilt. Bei drei Modellaufrufen pro Benutzeraktion wird sie ungefähr verdreifacht.

Für 10.000 Haushalte wären das im oberen Basisszenario ungefähr:

- GPT-5.6 Luna: $980 monatlich
- Gemini Flash-Lite: $1.225 monatlich
- Claude Haiku: $4.500 monatlich

Das sind ausschließlich Modellkosten. Dazu kommen Infrastruktur, Monitoring, Bildverarbeitung, eventuelle Suchdienste und Entwicklung.

## Weitere Kosten

- Supabase Pro kostet aktuell $25 pro Monat. Enthalten sind unter anderem 2 Millionen Edge-Function-Aufrufe, 250 GB Egress und $10 Compute-Credits. Zusätzliche Edge-Aufrufe kosten $2 pro Million. [Supabase Pricing](https://supabase.com/pricing)
- Embeddings sind vergleichsweise billig. OpenAI `text-embedding-3-small` kostet $0,02 pro 1 Mio. Tokens. 5 Mio. Rezept-Tokens würden einmalig ungefähr $0,10 kosten. [Embedding Pricing](https://developers.openai.com/api/docs/models/text-embedding-3-small)
- Bilder werden als visuelle Tokens berechnet. Bei Claude kostet ein 1.000 × 1.000 Pixel Bild mit Haiku ungefähr $1,30 pro 1.000 Bilder. [Claude Vision Pricing](https://platform.claude.com/docs/en/build-with-claude/vision)
- Live-Websuche sollte für diesen Use Case möglichst vermieden werden. Gemini berechnet nach dem kostenlosen Kontingent $14 pro 1.000 Suchanfragen. [Gemini Pricing](https://ai.google.dev/gemini-api/docs/pricing?hl=en)
- Open Food Facts verursacht keine klassische LLM-Rechnung, hat aber strikte Rate-Limits. Es gelten 10 Suchanfragen und 15 Produktabfragen pro Minute und IP. Eine Suche-as-you-type-Funktion wäre deshalb problematisch. [Open Food Facts API](https://openfoodfacts.github.io/openfoodfacts-server/api/)

## Was der Agent übernehmen sollte

Das LLM eignet sich für:

- „Was kann ich heute mit diesen Zutaten kochen?“
- Rezeptvarianten und Zutatenersatz
- natürliche Spracheingaben wie „Wir haben noch viel Paprika“
- verständliche Begründungen für Prioritäten
- Zusammenfassung eines Wochenplans
- Übersetzung und einfache, freundliche Kommunikation

Nicht vom LLM entscheiden lassen sollte man:

- ob ein Lebensmittel noch sicher ist
- Mindesthaltbarkeits- und Verbrauchsdatum-Berechnungen
- Mengen, Einheiten und Portionen
- Allergie- und harte Ernährungsregeln
- Haushaltmitgliedschaft und Zugriff
- direkte Datenbankänderungen

Diese Dinge sollten deterministisch in TypeScript, SQL und den RLS-Policies umgesetzt werden.

## Empfohlene Architektur

```text
Mobile App
   ↓
Supabase Edge Function als AI-Gateway
   ↓
RLS-gefilterte Haushaltsdaten
   ↓
LLM mit strukturierten Antworten und Tools
   ↓
Validierung
   ↓
Entwurf oder bestätigte Mutation
```

Wichtige Regeln:

1. Der API-Schlüssel liegt ausschließlich serverseitig.
2. Das Modell erhält nur einen minimalen Haushaltssnapshot, niemals die komplette Datenbank.
3. Private Trackingdaten werden grundsätzlich nicht an den Haushaltsagenten gesendet.
4. Das Modell darf nur typisierte Tools aufrufen.
5. Schreibaktionen erzeugen zunächst einen Entwurf und benötigen eine explizite Bestätigung.
6. Jede Mutation braucht Idempotency-Key, RLS-Prüfung und Auditierbarkeit.
7. Die lokale App kann Ablaufwarnungen offline anzeigen. KI-Rezeptvorschläge funktionieren online und können zwischengespeichert werden.

OpenAI empfiehlt für solche Workflows die Responses API, Function Calling, Structured Outputs, bewusst gesetzte Reasoning-Stufen und Prompt-Caching. [OpenAI Model Guidance](https://developers.openai.com/api/docs/guides/latest-model)

## Besonders wichtig: Lebensmittelsicherheit

Der Agent darf nicht pauschal sagen: „Das kannst du noch essen.“

Die Europäische Kommission unterscheidet klar:

- „Zu verbrauchen bis“ betrifft die Sicherheit.
- „Mindestens haltbar bis“ betrifft primär die Qualität.
- Lagerung, Öffnung und Kühlkette müssen berücksichtigt werden.

Bei Verbrauchsdatum, unbekannter Lagerung, rohem Fleisch, Fisch oder Säuglingsnahrung sollte der Agent konservativ reagieren. [EU-Kommission zu Datumskennzeichnung](https://food.ec.europa.eu/food-safety/food-waste/eu-actions-against-food-waste/date-marking-and-food-waste-prevention_en)

## Datenschutz und Sicherheit

OpenAI verwendet API-Daten standardmäßig nicht zum Training, hält Abuse-Monitoring-Daten aber standardmäßig bis zu 30 Tage vor. Google kennzeichnet die kostenpflichtige Gemini-Stufe als nicht zur Produktverbesserung verwendet, während die kostenlose Stufe dafür verwendet werden kann. Anthropic bietet Zero-Data-Retention für bestimmte API-Nutzungen auf Anfrage. Deshalb sollten wir keine kostenlosen KI-API-Stufen mit echten Haushaltsdaten verwenden.

Quellen: [OpenAI Data Controls](https://developers.openai.com/api/docs/guides/your-data), [Anthropic Data Retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention).

Für die App sollten wir außerdem Datenminimierung, Zweckbindung und begrenzte Speicherdauer dokumentieren. Eine Datenschutz-Folgenabschätzung sollte geprüft werden. [DSGVO Artikel 5](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679), [EDPB DPIA](https://www.edpb.europa.eu/topics/accountability-and-compliance-tools/data-protection-impact-assessment_en).

## Meine Empfehlung für den MVP

Ich würde mit vier begrenzten Funktionen starten:

1. „Bald verbrauchen“ auf Basis deterministischer Regeln.
2. „Koche etwas daraus“ mit Rezeptsuche und LLM-Erklärung.
3. Wöchentlicher Essensplan als bestätigter Entwurf.
4. Foto-/Barcode-Erkennung nur als optionaler Fallback.

Als erste Modellkandidaten würde ich GPT-5.6 Luna und Gemini Flash-Lite gegeneinander testen. Die Auswahl sollte nicht nur nach Preis erfolgen, sondern anhand eines Testsets mit echten Haushaltsfällen:

- korrekte Lebensmittelklassifikation
- keine gefährlichen Haltbarkeitsempfehlungen
- korrekte Mengen und Einheiten
- Allergie- und Präferenztreue
- geringe Tokenanzahl
- niedrige Latenz
- gültige strukturierte Tool-Aufrufe

Die Wirkung sollte nicht nur über KI-Qualität gemessen werden, sondern über weniger weggeworfene Lebensmittel, weniger vergessene Bestände und akzeptierte Vorschläge. Die EU-Food-Waste-Forschung empfiehlt ebenfalls Kombinationen aus Information, praktischen Tools, Coaching und messbarer Wirkung. [ECFWF Best-Practice-Zusammenfassung](https://food.ec.europa.eu/document/download/49d1a606-e384-40fb-a153-9f77bb7b1484_en?filename=fw_eu-platform_20230216_sub-cfwp_sum.pdf)

Mein vorläufiges Fazit: Für den Anfang sollten wir mit etwa $20 bis $150 KI-Kosten pro 1.000 aktive Haushalte und Monat rechnen, abhängig von Nutzung und Modell. Die größere Investition liegt in Datenmodell, Sicherheitslogik, Evaluation und guter Produktintegration, nicht in den einzelnen API-Aufrufen.