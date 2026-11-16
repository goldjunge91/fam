# Modelle und Anbieter für Mahlzeitenvorschläge

Stand: 7. November 2026. Forschungsnotiz, keine Anbieterentscheidung.

## Aufgabe, an der wir Modelle messen

Die [fachlich abgestimmte Spezifikation](../specs/food-waste-meal-suggestions/food-waste-meal-suggestions.md) sieht zuerst eine deterministische Suche in geprüften Rezepten vor. Ein Modell wird nur bei unzureichender Abdeckung einmal aufgerufen. Es wählt aus serverseitig angebotenen Zubereitungsmustern und Lebensmittel-Aliassen; das Backend prüft die Antwort und erzeugt Mengen sowie Kochschritte selbst. Keine Modellwahl ersetzt die Prüfung von Allergien, Einheiten, Mengen und Lebensmittelsicherheit.

Die aktuellen Angaben zu Preisen und Verfügbarkeit können sich ändern. Es gibt keine belastbare öffentliche Messung für genau diesen fam-Fallback. Die folgenden Empfehlungen sind deshalb Kandidaten für eine kleine Evaluation, keine Leistungsbehauptungen.

## Vergleichskandidaten

Preise in USD pro 1 Mio. Eingabe- beziehungsweise Ausgabetokens, reguläre Textanfragen. Regionale Aufschläge und weitere Gebühren stehen separat.

| Modell und Zugang | Eingabe / Ausgabe | Relevante Eigenschaft | Einordnung |
| --- | --- | --- | --- |
| **GLM 5.3 Flash (`z-ai/glm-5.3-flash`), OpenRouter** | ab $0,0285 / $0,0923 laut Modellseite | Im aktuellen `ai-gateway` als Standardmodell konfiguriert. OpenRouter meldet Unterstützung für JSON-Schema-Ausgaben, aber Preis und Schemaunterstützung hängen vom tatsächlich gewählten Provider-Endpunkt ab. | Wichtigste Integrations- und Kostenbasis; zuerst mit dem begrenzten fam-Fallback messen. |
| **GPT-6 Luna, OpenAI API** | $0,10 / $0,50 | Structured Outputs; laut Anbieter für eng umrissene, häufige Aufgaben gedacht. EU-Verarbeitung ist für das Modell verfügbar, verlangt passende Kontoeinstellungen und kann 10 % Aufschlag kosten. | Preiswerter direkter Referenzkandidat für Alias- und Musterwahl. |
| **Mistral Small 4 (`mistral-small-2603`), Mistral API** | $0,15 / $0,60 | Eigenes Schemaformat für Structured Outputs. Mistral bietet `api.eu.mistral.ai` für regionale Inferenz; Verfügbarkeit des konkreten Modells dort muss vorab geprüft werden, regionale Inferenz kostet extra. | Besonders interessanter direkter EU-Kandidat. |
| **Qwen3.8 Flash, OpenRouter** | $0,15 / $0,47 | Der Modellzugang meldet JSON-Schema-Ausgaben und ist ebenfalls in der Gateway-Allowlist. Bei OpenRouter hängt Schemaunterstützung vom tatsächlichen Provider-Endpunkt ab. | Weiterer Vergleich über die bestehende Anbindung; Region und Datenhaltung des Endpunkts gesondert prüfen. |
| **Gemini 3.8 Flash, Gemini API** | $0,75 / $3,75 bis 31.12.2026 | Google dokumentiert strukturierte Ausgaben mit einem Teilumfang von JSON Schema. Preise sind befristet; der bezahlte API-Tarif wird laut Preisseite nicht zur Produktverbesserung verwendet. | Vergleichskandidat für Qualität, derzeit teurer als die anderen Kandidaten in dieser Liste. |

Quellen: [aktueller Gateway-Standard](../../supabase/functions/ai-gateway/handler.ts), [OpenRouter GLM 5.3 Flash](https://openrouter.ai/z-ai/glm-5.3-flash), [OpenAI Luna Modellkarte](https://developers.openai.com/api/docs/models/gpt-6-luna), [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [Mistral Small 4 Modellkarte](https://docs.mistral.ai/models/mistral-small-4-0-26-03), [Mistral Structured Outputs](https://docs.mistral.ai/inference/conversations/structured-output), [OpenRouter Qwen3.8 Flash](https://openrouter.ai/qwen/qwen3.8-flash), [Google Gemini Preise](https://ai.google.dev/gemini-api/docs/pricing), [Google Structured Outputs](https://ai.google.dev/gemini-api/docs/structured-output).

## Anbieter und Datenverarbeitung

- **Mistral direkt:** `api.eu.mistral.ai` verarbeitet geeignete Inferenzanfragen in der EU beziehungsweise EFTA. Das ist getrennt von der Datenhaltung des Kontrollbereichs und von Zero Data Retention. Der globale Standard-Endpunkt legt keine bestimmte Verarbeitungsregion fest. Mistral empfiehlt, die Modellverfügbarkeit am regionalen Endpunkt abzufragen. [Regionale Inferenz](https://docs.mistral.ai/inference/regional-inference).
- **OpenAI direkt:** EU-Verarbeitung für Luna ist laut Modellkarte verfügbar. Die Datenregion ist eine Projekt- beziehungsweise Endpoint-Konfiguration mit Zulassungsvoraussetzungen und 10 % Aufschlag für geeignete neuere Modelle; die Projekteinrichtung und Datenkontrollen müssen vor dem Einsatz geklärt werden. [Luna Modellkarte](https://developers.openai.com/api/docs/models/gpt-6-luna), [Datenkontrollen](https://developers.openai.com/api/docs/guides/your-data).
- **OpenRouter:** Der vorhandene Gateway nutzt OpenRouter. Für JSON-Schema-Ausgaben muss der gewählte Provider-Endpunkt diese Funktion unterstützen; `require_parameters: true` verhindert Routing zu Endpunkten, die Request-Parameter ignorieren. Für EU-Routing gibt es `eu.openrouter.ai` im Business-Tarif, mit 8 % Plattformgebühr auf Guthabenkäufe; Anfragen schlagen fehl, wenn kein europäischer Endpunkt für das Modell verfügbar ist. EU bedeutet hier EU/EWR plus UK und Schweiz; Datenhaltung des Providers bleibt zusätzlich zu prüfen. [Provider-Routing und Parameterpflicht](https://openrouter.ai/docs/guides/routing/provider-selection), [EU-Routing](https://openrouter.ai/business/eu), [Datenschutz](https://openrouter.ai/privacy).
- **Google:** Die Gemini-API-Preisseite unterscheidet kostenlose und bezahlte Nutzung hinsichtlich Produktverbesserung. Für eine zugesicherte Region wäre die konkrete Google-Cloud-Bereitstellung samt Modellverfügbarkeit zu prüfen; die allgemeine Gemini-API-Preisseite allein belegt keine regionale Inferenzgarantie. [Gemini-Preise](https://ai.google.dev/gemini-api/docs/pricing), [Google Cloud Data Residency](https://cloud.google.com/terms/data-residency).

## Empfehlung für die Auswahl

1. Einen kleinen, festen Korpus aus normalen Fällen und Grenzfällen aus Abschnitt 10 der Spezifikation bauen. Gemessen werden gültige Schemaantworten, zulässige Aliase und Muster, Ablehnungen durch den Validator, p50/p95-Laufzeit und echte Tokenkosten. Kein Modell darf die deterministische Sicherheitsprüfung ersetzen.
2. **GLM 5.3 Flash auf der bestehenden OpenRouter-Anbindung** zuerst als Integrationsbasis messen. **GPT-6 Luna und Mistral Small 4** als direkte Anbieter dagegenhalten. Qwen3.8 Flash kann als weiterer Kandidat über dieselbe Anbindung geprüft werden. Gemini 3.8 Flash nur aufnehmen, wenn die ersten Kandidaten die fachliche Qualität nicht erreichen oder eine spezifische Stärke im Korpus erkennbar wird.
3. Für einen regional gebundenen Produktionspfad zuerst die Zugangsbedingungen von Mistrals EU-Endpunkt und OpenAIs EU-Projekt prüfen. OpenRouter Business EU bleibt eine Option, wenn der gewünschte Modell- und Provider-Endpunkt dort tatsächlich verfügbar ist. Diese Rangfolge ist eine Schlussfolgerung aus den dokumentierten Regional- und Routinggrenzen, kein gemessener Qualitätsvergleich.
4. Schemaausgaben auch bei `strict` serverseitig gegen den versionierten Antwortvertrag und fachliche Regeln prüfen. OpenAI dokumentiert einen begrenzten JSON-Schema-Umfang; OpenRouter weist ausdrücklich auf Unterschiede zwischen Provider-Endpunkten hin. [OpenAI Schemaeinschränkungen](https://developers.openai.com/api/docs/guides/structured-outputs), [OpenRouter Provider-Routing](https://openrouter.ai/docs/guides/routing/provider-selection).

Der aktuelle [Gateway-Provider-Aufruf](../../supabase/functions/ai-gateway/index.ts) verwendet `json_object` statt `json_schema`. Ein Ergebnis aus dieser Anbindung belegt daher noch keine Schema-Treue für die neue Funktion.
