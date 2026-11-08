# KI-Verbrauch im Admin-Webbereich

Der AI-Gateway schreibt pro erfolgreicher Provider-Antwort einen Eintrag in
`public.ai_usage_events`. Erfasst werden anfragender Nutzer, Haushalt,
gegebenenfalls Abo-Inhaber, Provider, Modell, Funktion, Input-/Output-Tokens,
gesamte Tokens und gemeldete Kosten. Prompts und KI-Antworten werden nicht
gespeichert.

Der separate Admin-Webbereich liest diese Daten über seinen Cloudflare Worker:

1. Der Worker prüft bei jeder Admin-Abfrage die verifizierte Anmeldung und
   verlangt `user.app_metadata.platform_role === "supa-admin"`.
2. Erst nach erfolgreicher Prüfung liest der Worker `ai_usage_events` mit dem
   serverseitigen Supabase Secret API Key.
3. Der Schlüssel bleibt als Worker-Secret auf dem Server und wird nie an den
   Browser gesendet. Die Mobile-App enthält keine Verbrauchsanzeige.

`user_metadata` darf nicht für diese Rechteprüfung verwendet werden, weil
Nutzer es selbst ändern können. Die Rolle gehört in `app_metadata` und wird
ausschließlich über Supabase Admin oder einen anderen vertrauenswürdigen
Serverprozess vergeben.

Die Tabelle hat RLS aktiviert. `anon` und `authenticated` besitzen weder
Tabellenrechte noch eine Lese-Policy; `service_role` kann Einträge anlegen und
lesen. Für größere Zeiträume paginiert der Worker seine Abfragen.

OpenRouter-Anfragen fordern Provider-Nutzungsdaten einschließlich der gemeldeten
USD-Kosten an. Groqs Chat-Antwort liefert Tokenzahlen, aber keine Kosten pro
Aufruf; dort bleiben die Kostenspalten leer. Es werden keine Kosten aus einer
Modellpreisliste geschätzt.
