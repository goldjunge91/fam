# PostHog-Löschverifikation

## Zweck und Abgrenzung

Dieser Bericht beschreibt den serverseitigen Abschluss der PostHog-Prüfung in
der Supabase-Account-Löschkette. Er belegt keine Hosted-Löschung und enthält
keine Secrets, Tokens, Projekt-IDs, E-Mail-Adressen, echten Nutzer-UUIDs oder
Response-Bodies.

Die Reihenfolge bleibt:

1. `prepare_account_deletion()` räumt die Supabase-Haushaltsbezüge unter der
   Identität des aufrufenden Nutzers auf.
2. Die Edge Function liest oder schreibt den PostHog-Checkpoint und führt die
   externe Löschverifikation aus.
3. `auth.admin.deleteUser()` läuft nur bei `not_found` oder `verified`.

Ein Fehler oder ein unbekannter Status stoppt die Kette vor dem Auth-Löschen.

## Offizielle Quellen

- Die [PostHog Persons API](https://posthog.com/docs/api/persons) dokumentiert
  die Personenliste, den Bulk-Löschaufruf, die HTTP-202-Annahme und den
  `deletion_status`-Aufruf mit `pending`, `completed` und
  `delete_verified_at`.
- [Controlling data storage](https://posthog.com/docs/privacy/data-storage)
  beschreibt die Event-Löschung als asynchron und trennt die Annahme eines
  Auftrags vom späteren Abschluss.
- Die [PostHog API overview](https://posthog.com/docs/api) unterscheidet
  öffentliche Ingestion-Endpunkte von privaten API-Endpunkten und beschreibt
  die EU-Cloud-Domain für private API-Aufrufe.
- Die [Session recordings API](https://posthog.com/docs/api/session-recordings)
  dokumentiert Recording-Lese- und Löschendpunkte, aber keinen separaten
  Abschlussstatus für die mit einer Personenlöschung angeforderten Recordings.
- [Session Replay: data deletion](https://posthog.com/docs/session-replay/privacy#data-deletion)
  beschreibt die zweistufige Recording-Löschung: Schlüsselzerstörung macht die
  Aufnahme unlesbar; eine spätere Metadatenbereinigung folgt separat.

Die Quelleninhalte wurden für diesen Bericht paraphrasiert.
Content was rephrased for compliance with licensing restrictions.

## Statusvertrag

| Status | Beleg | Bedeutung für die Account-Löschung |
| --- | --- | --- |
| `not_found` | Kein Checkpoint und eine strikt geprüfte, nicht paginierte Personenliste ist leer. | Terminal für die Auth-Löschung, aber kein nachträglicher Beleg für bereits entfernte Event- oder Recording-Kopien. |
| `accepted` | Bulk-Löschung mit HTTP 202 oder bounded Status-Polling mit `pending`. | Nicht terminal. Der Checkpoint bleibt erhalten; der Handler liefert `analytics_delete_pending`. |
| `verified` | Alle gespeicherten Person-IDs sind `completed`, jede hat ein parsebares `delete_verified_at`, und die abschließende Personenliste ist leer. | Terminal für die Auth-Löschung. Dieser Status deckt den dokumentierten Personen-/Event-Abschluss ab. |
| Fehler oder unbekannt | Timeout, Netzwerkfehler, ungültiger Status oder Payload, abgeschnittene Pagination, widersprüchliche Zähler, fehlende Checkpoint-Daten oder verbleibende Person. | Fail-closed. Kein Auth-Löschen. |

Der externe Aufruf verwendet `ids`, `delete_events: true`,
`delete_recordings: true` und `keep_person: false`. Die maximale Personen-ID-
Menge ist begrenzt. Eine vorhandene nächste Seite wird nicht blind verfolgt,
sondern als unvollständige Abdeckung abgelehnt. Request-Timeouts und eine feste
Gesamtfrist begrenzen Polling. Wiederholungen lesen die gespeicherten IDs; neue
IDs werden vereinigt, und ein bereits angenommener Checkpoint löst keinen
zweiten Bulk-Aufruf aus.

Der Personenparser verlangt `next: null`, gültige eindeutige IDs und prüft ein
optionales `count` gegen die Ergebnislänge. Damit akzeptiert er sowohl den
aktuellen cursorbasierten Umschlag ohne `count` als auch ältere gezählte
Antworten. Der Statusparser verlangt weiterhin `next: null`, ein exaktes
`count` und ein gültiges `created_at` je Statusdatensatz. Die Bulk-Zähler müssen
die gesamte angeforderte ID-Menge abdecken. Teilabdeckung,
`deletion_errors` und provider-kontrollierte Felder werden mit stabilen Codes
abgewiesen; Response-Bodies werden nie als interne Fehler oder Log-Codes
weitergereicht.

Der Checkpoint liegt in `public.account_deletion_requests`, ist nur für
`service_role` zugänglich und referenziert `auth.users` mit `on delete cascade`.
Er enthält keine Eventdaten und wird nicht synchronisiert. Checkpoint-Lese-,
Schreib- und Validierungsfehler liefern stabile redigierte Fehlercodes.

## Recording-Grenze

Der Bulk-Aufruf fordert die Recording-Löschung an. Der dokumentierte Personenlöschlauf liefert jedoch keinen unabhängigen
Recording-Abschlussstatus. Die [Session-Replay-Dokumentation](https://posthog.com/docs/session-replay/privacy#data-deletion)
beschreibt eine zweistufige Verarbeitung: Die Verschlüsselungsschlüssel werden
zerstört und machen Aufnahmen unlesbar; Recording-Metadaten werden anschließend
in einer separaten Bereinigung entfernt. Der Vertrag nennt deshalb eine
angeforderte Recording-Löschung, aber keine unabhängig bestätigte Entfernung
jeder Recording-Kopie. Ein Hosted-Nachweis mit Session Replay muss separat und
nur mit synthetischen Daten abgenommen werden. Ein fehlender Recording-Readback
ist `unverifiable`, nicht `complete`.

## Read-only-Hosted-Ausgangslage

Ein read-only `persons-list`-Lookup mit einem deterministischen, redigierten
synthetischen Distinct-ID-Wert und Limit 1 lieferte eine leere Personenliste.
Der Lookup beweist weder eine Löschung noch einen Event- oder Recording-
Abschluss. In der verfügbaren Sitzung gab es keinen direkten MCP-Aufruf für
`deletion_status`. Es wurden keine Lösch-, Deployment- oder Secret-Aktionen
auf Hosted-Systemen ausgeführt.

Die read-only geprüften Einstellungen für EU-Host, IP-Anonymisierung,
Session-Replay und Retention sind von der Löschstatusprüfung getrennt. DPA,
vollständige GeoIP-Transformationen sowie Account-/Organisationslöschung
bleiben offene Hosted-Aspekte.

## Lokale RED/GREEN/Rollback/Re-enable-Nachweise

Die lokalen Tests verwenden ausschließlich deterministische Fakes, redigierte
Identifiers und stabile Fehlercodes.

### Checkpoint-Schema

- **RED:** `supabase test db --local
  supabase/tests/43_account_deletion_requests.test.sql` schlug vor dem Schema
  mit `relation ... does not exist` fehl.
- **GREEN:** Nach Änderung der deklarativen Schemaquellen, `bun run db:diff`,
  `bun run db:reset` und `bun run db:types` liefen 11 pgTAP-Tests grün.
- Der Checkpoint wird durch RLS und Tabellenrechte auf `service_role`
  begrenzt. Der Cascade-Test prüft die Entfernung mit dem Auth-Datensatz.

### PostHog-Adapter

- **RED:** Die neuen Tests meldeten zunächst fehlende Checkpoint-Typen und die
  alte Signatur; damit war die alte `accepted`-Behandlung nicht als
  Verifikation verwendbar.
- **GREEN:** `DENO_DIR="$PWD/.agents/deno-cache" bun run test:functions --
  delete-account/posthog.test.ts` lief mit 21 Tests grün.
- **Rollback:** Das terminale `verified`-Ergebnis wurde vorübergehend auf
  `accepted` zurückgesetzt. Derselbe Lauf ließ drei Verifikationsassertions
  rot werden.
- **Re-enable:** Die minimale Änderung wurde wieder aktiviert; derselbe Lauf
  lief mit 21 Tests grün.
- Zusätzliche RED/GREEN/Rollback/Re-enable-Zyklen prüften widersprüchliche
  Pagination-Zähler, Checkpoint-Zeitstempel sowie Read-/Write-Ausnahmen des
  Checkpoint-Stores. Ohne jeden Guard wurde der jeweilige gezielte Test rot;
  nach dem Re-enable liefen die 21 Tests wieder grün.

Die Tests decken gültige und leere Personenlisten, ungültige IDs, abgeschnittene
Pagination, HTTP-202 mit beiden Löschflags, nicht erlaubte Statusantworten,
`deletion_errors`, Netzwerkfehler, Timeout, `pending`, fehlende oder unbekannte
Statuswerte, mehrere IDs, verbleibende Personen, Checkpoint-Fehler,
Redaction und idempotente Wiederholung ab.

### Edge-Function-Handler

- **RED:** Der angepasste Accepted-Test zeigte, dass der vorhandene Handler mit
  HTTP 200 antwortete und den Auth-Delete ausführte.
- **GREEN:** Nach der Statusverzweigung liefen 14 Handler-Tests grün.
- **Rollback:** Die Pending-Sperre wurde vorübergehend deaktiviert. Derselbe
  Testlauf ließ den Pending-Test rot werden.
- **Re-enable:** Die Sperre wurde wieder aktiviert; 14 Tests liefen grün.

`not_found` und `verified` sind die einzigen terminalen Ergebnisse. `accepted`
erzeugt `analytics_delete_pending` mit HTTP 202 und erreicht `deleteUser`
nicht. Der 2xx-Transportstatus hält den asynchronen Body für Supabase- und
Standard-Fetch-Clients lesbar; allein das Body-Feld bestimmt den Abschluss.

### Mobile Grenze

- **RED:** Der neue Screen-Test zeigte, dass ein altes `success: true` mit
  `analyticsDeletion: accepted` den lokalen Cleanup und die Navigation auslöste.
- **GREEN:** Die Antwort-Allowlist akzeptiert nur `verified` und `not_found`; 8
  gezielte Jest-Tests liefen grün.
- **Rollback:** Die Statusprüfung wurde vorübergehend deaktiviert. Derselbe
  Testlauf wurde im Accepted-Fall rot.
- **Re-enable:** Die Prüfung wurde wieder aktiviert; 8 Tests liefen grün.

## Review-Nachtrag zur strikten Antwortprüfung

Die Review-Korrektur ergänzt drei fail-closed Guards:

- Die Bulk-Zähler `persons_found` und
  `persons_deleted + persons_queued_for_deletion` müssen exakt die angeforderte
  ID-Menge abdecken. Eine Teilantwort bleibt ein stabiler Fehler und kann den
  Auth-Löschschritt nicht erreichen.
- Statusantworten verlangen `count` passend zur Ergebnislänge. Die
  cursorbasierte Personenliste wird ohne `count` akzeptiert und prüft das Feld,
  wenn es vorhanden ist. Doppelte Personen-IDs, fehlendes `created_at`, ein
  fehlendes Status-`count` oder abgeschnittene Pagination werden abgewiesen.
- Externe JSON-Körper werden nicht strukturell als interne Fehler erkannt.
  Ein internes, nicht serialisierbares Fehlermerkmal trennt Provider-Daten von
  stabilen Fehlercodes; deshalb können Provider-Felder nicht in Logs gelangen.

Der fokussierte Adapterlauf umfasst nach diesen Nachträgen 30 Tests. Die
getrennten RED/GREEN/Rollback/Re-enable-Zyklen sind im Implementierungsbericht
unter `.agents/tasks/posthog-deletion-verification-main/implementation-report.md`
dokumentiert. Die Hosted-Abnahme, ein Deployment und jede echte Löschung
bleiben unverändert offen.

## Letzter Review-Nachtrag

Drei weitere blockierende Prüfbefunde wurden geschlossen:

- Statushistorien werden an das Zeitfenster des aktuellen Checkpoints gebunden.
  Genau ein aktueller Eintrag darf `completed` belegen; alte, zukünftige oder
  mehrdeutige Einträge sowie ein `delete_verified_at` vor `created_at` stoppen
  fail-closed.
- Nach einer transportseitig verlorenen HTTP-202-Antwort liest ein Retry zuerst
  `deletion_status`. Ein vorhandener aktueller Status setzt den Checkpoint fort,
  ohne denselben Bulk-Aufruf erneut zu senden. Auch eine saubere Nulltreffer-
  Antwort nach einem Race wird nur über aktuellen Statusnachweis fortgesetzt.
- Der Request-Timeout umfasst jetzt sowohl Header als auch den vollständigen
  JSON-Body für Personenliste, Bulk-Antwort und Status-Readback.

Der erste neue Testlauf hatte 30 grüne und 4 rote Tests. Nach der Reparatur
liefen 34 Tests grün. Die drei einzelnen Rückbauprüfungen machten jeweils die
zugehörige Regression sichtbar: Statusbindung 32 grün/2 rot, Wiederaufnahme
33 grün/1 rot und Body-Timeout 33 grün/1 rot. Nach jedem Wiedereinbau waren alle
34 Tests wieder grün. Ein zusätzlicher Race-Test erhöhte den finalen Adapterlauf
auf 35 grüne Tests.

## Aktuelle read-only Hosted-Evidenz

Vor der Veröffentlichung zeigte Supabase die aktive `delete-account`-Version
35 mit dem alten terminalen `accepted`-Verhalten; die Tabelle
`public.account_deletion_requests` fehlte noch in der gehosteten Datenbank.
Damit waren Migration und Function-Version nachweislich noch nicht
veröffentlicht.

PostHog Cloud EU ist aktiv. Die Projektabfrage zeigte verworfene rohe Client-
IPs, deaktiviertes Session Recording, 30 Tage Recording-Retention,
12 Monate Event-Retention und deaktivierte automatische Exception-Erfassung.
Eine Recording-Abfrage vom Projektbeginn bis heute lieferte null Ergebnisse.
Für dieses Projekt gibt es deshalb keine Recording-Kopie, deren Abschluss
separat nachgewiesen werden müsste. Es gibt genau einen Organisations-Owner,
keine benutzerdefinierten Rollen, keine sichtbaren Integrationen und nur die
aktive GeoIP-Transformation. GeoIP kann den eingehenden IP-Wert vor dessen
Verwerfen zur Ortsanreicherung verwenden; dieser Zustand ist hier ausdrücklich
nur dokumentiert und nicht stillschweigend geändert.

Die PostHog-Rechtsseite verlangt für einen DPA-Abschluss Firmenangaben und die
Signatur des Empfängers per PandaDoc. Dieser rechtliche Schritt ist nicht über
die verfügbare API ausführbar.

## Offene Hosted-Abnahme

Vor dem Deployment braucht es eine separate Freigabe für die neue
Edge-Function-Version. Danach ist ausschließlich ein synthetischer Testaccount
zulässig. Die Abnahme muss HTTP 202, später `deletion_status=completed` mit
`delete_verified_at` und die leere abschließende Personenliste getrennt prüfen.
Falls Session Replay kontrolliert aktiv ist, braucht die Recording-Abnahme
einen eigenen belegbaren Readback. Ein fehlender Readback bleibt
`unverifiable`. Es wurden keine dieser Schritte ausgeführt.
