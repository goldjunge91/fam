# Operationsvertrag: Dev-Terminal-Logging und PostHog-Diagnostik

Status: für diese Umsetzung freigegeben
Beads: `fam-5iu7`, Folgepunkt `fam-hv5o`

## Ziel

Entwicklungslogs sollen im laufenden Metro-Terminal nachvollziehbar und
maschinenlesbar sein. Jede explizite PostHog-Übergabe der App soll dort mit
Operation, Eventname und einer sicheren Darstellung der übergebenen Properties
sichtbar werden. Die App liefert dafür nur die lesbare Lognachricht; `LOG`,
`WARN` oder `ERROR` sowie die graue Darstellung kommen weiterhin von Metro.

Produktions-Builds erzeugen keine app-eigenen Terminalausgaben. Interne Logs
von Metro oder Drittanbieter-SDKs liegen außerhalb dieses Owners und werden
nicht durch diese Änderung gesteuert.

## Owner und Operationsregister

| Operation | Einziger Owner | Ergebnis |
| --- | --- | --- |
| App-eigene Terminalausgabe | `src/lib/debug-log.ts` | Dev-only, lesbare und redigierte Logzeile |
| `PostHog.capture` | `src/lib/telemetry/index.ts` | Eventname und sichere Property-Darstellung im Terminal |
| `PostHog.captureException` | `src/lib/telemetry/index.ts` | Fehler-Event und sichere Properties im Terminal |
| `PostHog.addExceptionStep` | `src/lib/telemetry/index.ts` | Diagnoseschritt und sichere Properties im Terminal |

Feature-Code entscheidet nicht provider-spezifisch über Logging oder Versand.
Die bestehende Telemetrie-Schicht bleibt die einzige Fan-out-Grenze.

## Verbindliches Verhalten

1. Eine App-eigene Terminalzeile darf nur entstehen, wenn `__DEV__` wahr ist.
2. `EXPO_PUBLIC_DEBUG_LOGS=false` darf die Ausgabe zusätzlich stummschalten.
3. Logzeilen enthalten eine verständliche Nachricht und, falls vorhanden, eine
   kompakte JSON-Darstellung der sicheren Zusatzdaten. Level und Darstellung
   werden vom jeweiligen Terminal (z. B. Metro) beigesteuert; die App
   wiederholt diese Metadaten nicht. Die Marker `[PostHog]`, `[RevenueCat]` und
   `[HouseholdSync]` dürfen zur Orientierung farbig markiert werden; die
   Payload bleibt ohne Farbcodes.
4. Die Darstellung redigiert Secrets, Tokens, Zugangsdaten, E-Mail-Adressen,
   User-IDs und Fehlertexte mit möglichem Personenbezug. Stacktraces werden
   nicht ausgegeben.
5. Die Redigierung gilt ausschließlich für die Terminaldarstellung. Das an
   PostHog übergebene Eventobjekt bleibt unverändert.
6. Es werden nur tatsächlich ausgeführte PostHog-Operationen geloggt. Wird ein
   Provider durch die bestehende Policy übersprungen, bleibt das Versandverhalten
   unverändert und es wird kein falsches „gesendet“-Log erzeugt.
7. Interne Datenbank-Cache-Treffer werden nicht als Terminal-Trace ausgegeben;
   die lokale Cache-Logik und ihre Verifikation bleiben unverändert.
8. Bestehende Analytics-, Sentry- und BugBubble-Gates sowie die Payloadwerte
   werden nicht fachlich verändert.

## Ausführungsreihenfolge und Nachweise

1. Logger-Contract und fokussierte Logger-/PostHog-Tests
2. Logger-Owner und Telemetrie-Fan-out implementieren
3. Verbleibende app-eigene direkte `console.*`-Aufrufe auf den Owner umstellen
4. Fokussierte Tests, Typecheck, Biome und statische Prüfung der Console-Grenze

Keine neue Dependency, keine Datenbank-/Sync-Änderung und kein Eingriff in den
laufenden Metro-Prozess.
