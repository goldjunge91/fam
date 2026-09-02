# fam: AI-Kosten, Anbieterwahl und Best Practices

Stand: 1. September 2026

## Kurzfazit

Für fam reicht ein kontrollierter serverseitiger Assistent. Das LLM interpretiert Text/Bilder und schlägt Aktionen vor; Inventar, Datumslogik, Berechtigungen, Erinnerungen und Schreibvorgänge bleiben deterministische Backend-Funktionen.

Meine MVP-Empfehlung: OpenAI `gpt-5.6-luna` als Standardmodell und `gpt-5.6-terra` nur als Fallback für schwierige Fälle. Luna kostet aktuell 0,20 USD/1M Input- und 1,20 USD/1M Output-Token im Standardpfad. Google `gemini-3.1-flash-lite` ist eine sehr günstige Alternative (0,25/1,50 USD); Anthropic Claude Haiku 4.5 (1/5 USD) bzw. Sonnet 5 (2/10 USD) sind technisch stark, aber deutlich teurer. Preise: [OpenAI](https://developers.openai.com/api/docs/pricing), [Anthropic](https://platform.claude.com/docs/en/about-claude/pricing), [Google](https://ai.google.dev/gemini-api/docs/pricing).

## Kosten je aktivem Nutzer und Monat

Annahmen: 1.200 Input-/350 Output-Token je Textturn, durchschnittlich 1.500 Input-/450 Output-Token je Bildturn, kompakter Inventar-Snapshot statt vollständiger Historie und 30% Aufschlag für Tool-/Folgerunden.

| Nutzung | OpenAI Luna | Gemini 3.1 Flash-Lite | Claude Haiku 4.5 | Claude Sonnet 5 |
|---|---:|---:|---:|---:|
| Leicht: 8 Textturns, 1 Foto | 0,008 USD | 0,010 USD | 0,036 USD | 0,071 USD |
| Normal: 32 Textturns, 4 Fotos | 0,032 USD | 0,040 USD | 0,142 USD | 0,284 USD |
| Intensiv: 120 Textturns, 12 Fotos | 0,116 USD | 0,145 USD | 0,519 USD | 1,037 USD |

Das sind reine Modellkosten ohne Hosting, Speicher, Push, Monitoring, Support, VAT oder Mengenrabatte. Bei 10.000 normalen aktiven Nutzern wären das grob 318 USD OpenAI, 398 USD Google oder 1.422 USD Anthropic pro Monat. Eine Planungsreserve von 30% ergibt für OpenAI rund 413 USD.

## Was gebaut werden sollte

- Ein LLM-Aufruf plus höchstens eine Tool-Runde pro Turn.
- Tools: Inventar lesen, Rezepte suchen, Änderung vorschlagen, Änderung bestätigen, Erinnerung planen, kuratierte Lebensmittelsicherheitsregel lesen.
- Structured Outputs für UI-Antworten und `strict`-/Schema-validierte Tool-Eingaben.
- Fotos zunächst klein/niedrig detailliert analysieren; bei niedriger Sicherheit gezielt ein Etikettfoto nachfordern.
- Barcode-Scan, Datumsvalidierung und Vorratslogik deterministisch halten.
- Alle schreibenden Aktionen bestätigen lassen; keine autonomen Lösch-, Wegwerf-, Einkaufs- oder Nachrichtenaktionen.
- Nutzerlimits, Outputlimits, Idempotency, Autorisierung und Kosten-Circuit-Breaker einbauen.

Vision ist tokenbasiert: [OpenAI Vision](https://developers.openai.com/api/docs/guides/images-vision), [Gemini Vision](https://ai.google.dev/gemini-api/docs/image-understanding), [Claude Vision](https://platform.claude.com/docs/en/build-with-claude/vision). Structured Outputs und Tool-Calling: [OpenAI](https://developers.openai.com/api/docs/guides/structured-outputs), [Anthropic](https://platform.claude.com/docs/en/build-with-claude/structured-outputs), [Google](https://ai.google.dev/gemini-api/docs/structured-output).

## Caching und Batching

Prompt Caching lohnt sich für stabile Systemprompts, Tool-Schemas und wiederholte Präfixe. Es lohnt sich nicht automatisch für kleine einmalige Prompts. Bei 60% Cache-Hit-Rate sinkt die normale OpenAI-Luna-Schätzung ungefähr von 0,032 auf 0,026 USD je Nutzer; Outputtokens bleiben voll kostenpflichtig. [OpenAI Caching](https://developers.openai.com/api/docs/guides/prompt-caching), [Anthropic Caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching), [Google Caching](https://ai.google.dev/gemini-api/docs/generate-content/caching).

Batch senkt bei allen drei Anbietern die Tokenpreise um 50%, ist aber nur für nicht-interaktive Aufgaben geeignet: Nachtzusammenfassungen, vorbereitete Rezeptvorschläge, Backfills und Evals. [OpenAI Batch](https://developers.openai.com/api/docs/guides/batch), [Anthropic Batch](https://platform.claude.com/docs/en/build-with-claude/batch-processing), [Google Batch/Optimization](https://ai.google.dev/gemini-api/docs/optimization).

## Datenschutz und Sicherheit

Die App sollte pseudonyme IDs, strukturierte Vorratsdaten, kurze Bildretention, EXIF-Entfernung, Verschlüsselung und einen klaren Lösch-/Exportpfad verwenden. Die DSGVO verlangt unter anderem Zweckbindung, Datenminimierung, Speicherbegrenzung, Vertraulichkeit, Privacy by Design, geeignete Prozessoren und abgesicherte Drittlandtransfers: [EUR-Lex DSGVO](https://eur-lex.europa.eu/legal-content/EN/TXT/?qid=1603056878020&uri=CELEX:32016R0679).

- OpenAI: API-Daten standardmäßig nicht für Training; Abuse-Monitoring-Logs standardmäßig bis zu 30 Tage. EU-Speicherung/-Verarbeitung für unterstützte Modelle und Endpunkte ist verfügbar, aber mit Zulassungs-/ZDR-Anforderungen: [Data Controls](https://developers.openai.com/api/docs/guides/your-data).
- Anthropic: ZDR ist für geeignete API-Funktionen verfügbar; Batch ist nicht ZDR-eligible. Retention und Geografie hängen vom Feature und Vertrag ab: [Retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention), [Data Residency](https://platform.claude.com/docs/en/manage-claude/data-residency).
- Google: Paid Services nutzen Prompts und Antworten laut Dokumentation nicht zur Produktverbesserung, können sie aber begrenzt für Abuse Detection loggen. Für strengere Cloud-Governance ist Vertex AI zu prüfen: [Gemini ZDR](https://ai.google.dev/gemini-api/docs/zdr), [Logs](https://ai.google.dev/gemini-api/docs/logs-policy), [Vertex AI](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/vertex-ai-zero-data-retention).

Prompt Injection und externe Toolinhalte müssen als untrusted behandelt werden. OpenAI, Anthropic und Google empfehlen Begrenzungen, adversariales Testen, Post-Processing und menschliche Kontrolle: [OpenAI Safety](https://developers.openai.com/api/docs/guides/safety-best-practices), [Anthropic Mitigation](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/mitigate-jailbreaks), [Google Safety](https://ai.google.dev/gemini-api/docs/safety-guidance).

## Nicht ins MVP

Multi-Agent-Orchestrierung, Browser-/Computer-Use, freie Websuche pro Frage, Fine-Tuning, vollständiges Langzeitgedächtnis, Sprach-/Videoagenten und autonome Wegwerf-/Einkaufsaktionen.

## Entscheidung

Mit OpenAI Luna + Terra-Fallback starten, wenn die vertraglichen EU-/ZDR-Anforderungen passen. Google Gemini ist die beste Gegenprobe bei bestehendem Google-Cloud-Stack oder sehr hohem Multimodalvolumen. Anthropic ist sinnvoll, wenn tool-zentrierte Dialogqualität und Retention-/ZDR-Kontrollen den höheren Tokenpreis rechtfertigen.
