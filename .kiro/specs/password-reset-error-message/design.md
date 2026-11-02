# Password Reset Error Message Bugfix Design

## Overview

Der Defekt betrifft ausschließlich den Übergang nach einem erfolgreichen Passwort-Reset, der aus einem abgemeldeten Zustand begonnen wurde. Die isolierte Recovery-Session wird erfolgreich in den primären Supabase-Client übertragen, aber die bisherige Implementierung navigiert unmittelbar danach zur Root-Route. Der `SessionProvider` kann zu diesem Zeitpunkt den lokalen Account-Bootstrap noch verarbeiten. Dadurch verlässt die App die geschützte Recovery-Route zu früh und kann kurz den gemeinsam verwendeten `CrashFallback` anzeigen, bevor der angemeldete Zustand bereit ist.

Die minimale Lösung verschiebt nur die automatische Navigation für das Recovery-Ergebnis `signed-in`. Die Recovery-Erfolgsanzeige bleibt sichtbar, bis der `SessionProvider` dieselbe Nutzer-ID mit `accountReady = true` und ohne Session-Fehler veröffentlicht. Erst dann ersetzt die App die Recovery-Route durch `/`. Die Pfade `existing-session`, `sign-in-required`, Validierungsfehler, Updatefehler und reguläre App-Starts bleiben unverändert.

Im aktuellen Arbeitsbaum liegt bereits ein auf zwei Dateien begrenzter Entwurf dieses Ansatzes vor:

- `src/features/auth/components/recovery-password-form.tsx`
- `src/features/auth/screens/password-recovery-screen.test.tsx`

Der im referenzierten Codex-Thread ausgeführte fokussierte Test bestand zuletzt mit 6 von 6 Tests. Dort bestanden außerdem die Biome-Prüfung der zwei betroffenen Dateien und `git diff --check`. Diese Nachweise belegen die verzögerte Router-Auslösung im Komponententest, aber noch nicht das Ausbleiben jedes sichtbaren Fehlerbildschirm-Frames auf einem realen Gerät. Die Geräte-End-to-End-Verifikation und der formale Abschluss von `fam-fc36` bleiben deshalb offen.

## Glossary

- **Bug_Condition (C)**: Ein erfolgreich übertragener Passwort-Reset aus abgemeldetem Zustand, bei dem der zugehörige lokale Account noch nicht vollständig bereit ist.
- **Property (P)**: Die Recovery-Erfolgsanzeige bleibt bis zur passenden Account-Bereitschaft sichtbar; danach erfolgt genau eine Navigation in die angemeldete App, ohne zwischenzeitlichen `CrashFallback`.
- **Preservation**: Alle Eingaben und Zustandsübergänge außerhalb der Bug_Condition behalten ihr bisheriges beobachtbares Verhalten.
- **F**: Das bisherige Verhalten von `RecoveryPasswordForm.submit`, das nach jedem erfolgreichen Ergebnis außer `sign-in-required` sofort `router.replace('/')` ausführt.
- **F'**: Das korrigierte Verhalten, das nur `signed-in` bis zur passenden Account-Bereitschaft zurückhält.
- **RecoveryPasswordForm**: Die Komponente in `src/features/auth/components/recovery-password-form.tsx`, die das neue Passwort speichert, den Erfolg anzeigt und die Abschlussnavigation auslöst.
- **PasswordRecoveryStore**: Der Zustand in `src/features/auth/recovery-store.ts`, der Recovery-Phase, isolierten Client, `recoveryUserId` und Ergebnis `signed-in | existing-session | sign-in-required` verwaltet.
- **recoveryUserId**: Die bei erfolgreicher Code- oder Link-Prüfung erfasste ID des Kontos, dessen Passwort geändert wird. Der Store setzt dieses Feld beim Abschluss von `savePassword` wieder auf `null`.
- **pendingSessionUserId**: Lokaler, nur für den Übergang benötigter Snapshot der `recoveryUserId`, mit dem die später veröffentlichte primäre Session identitätsgenau geprüft wird.
- **SessionProvider**: Der Provider in `src/features/auth/session-provider.tsx`, der Supabase-Auth-Ereignisse mit lokaler Account-Aktivierung, verschlüsseltem Speicher, Query-Persistenz und Sync-Bereitschaft verbindet.
- **accountReady**: `true` bedeutet laut Provider-Vertrag, dass der lokale Account-Bootstrap vollständig abgeschlossen ist. Eine vorhandene Supabase-Session allein reicht dafür nicht aus.
- **R(u)**: Bereitschaftsprädikat für Nutzer `u`: `session.user.id = u`, `accountReady = true` und `sessionError = null`.
- **CrashFallback**: Der appweite Fehlerbildschirm aus `src/features/app-shell/crash-fallback.tsx`. Er wird sowohl von der Sentry-Fehlergrenze als auch von expliziten Session- und App-Startfehlerpfaden verwendet.

## Bug Details

### Bug Condition

Sei `X` die Menge aller Abschlussübergänge eines Passwort-Resets und `u` die während der erfolgreichen Recovery-Prüfung erfasste `recoveryUserId`.

`R(x, u) := x.sessionUserId = u AND x.accountReady = true AND x.sessionError = null`

`C := { x ∈ X | x.startedSignedOut AND x.saveResult = (ok, signed-in) AND u ≠ null AND NOT R(x, u) }`

Für Eingaben aus `C` fordert `F` die Root-Navigation an, obwohl der lokal nutzbare Account-Zustand noch nicht bereit ist. Damit wird die Recovery-Route verlassen, deren Root-Guard Lade- und Session-Fehler bewusst nicht als appweiten Fehlerbildschirm rendert.

**Formal Specification:**

```text
FUNCTION isBugCondition(input)
  INPUT: input of type RecoveryCompletionTransition
  OUTPUT: boolean

  RETURN input.startedSignedOut = true
         AND input.saveResult.status = "ok"
         AND input.saveResult.outcome = "signed-in"
         AND input.recoveryUserId IS NOT null
         AND NOT (
           input.sessionUserId = input.recoveryUserId
           AND input.accountReady = true
           AND input.sessionError IS null
         )
END FUNCTION
```

### Examples

- **Beobachteter Gerätefall**: Ein abgemeldeter Nutzer öffnet einen gültigen Recovery-Link, speichert ein gültiges neues Passwort und wird anschließend angemeldet. Erwartet ist ein durchgängiger Erfolg. Tatsächlich erschien vor der angemeldeten App kurz `Etwas ist schiefgelaufen`.
- **Noch unveröffentlichte primäre Session**: `savePassword` liefert `{ status: 'ok', outcome: 'signed-in' }`, während der Provider noch `session = null`, `accountReady = true`, `error = null` aus dem zuvor abgeschlossenen abgemeldeten Bootstrap hält. Erwartet ist, auf der Erfolgsanzeige zu bleiben. `F` navigiert sofort zu `/`.
- **Laufender lokaler Account-Bootstrap**: Die primäre Session gehört bereits zu `recovered-user`, aber `accountReady = false`, weil Account-Speicher oder Query-Persistenz noch vorbereitet werden. Erwartet ist weiteres Warten auf der Recovery-Erfolgsanzeige. `F` behandelt die vorhandene Session bereits als vollständigen Abschluss.
- **Identitätskante**: Während des Abschlusses veröffentlicht der Provider vorübergehend eine andere Nutzer-ID. Erwartet ist keine automatische Navigation für den Recovery-Abschluss. Eine Prüfung nur auf irgendeine Session könnte die falsche Account-Bereitschaft akzeptieren.
- **Nicht fehlerhafter Vergleichsfall**: `savePassword` liefert `existing-session`, weil bereits eine primäre Session bestand. Dieser Fall gehört nicht zu `C`; die bisherige unmittelbare Navigation bleibt erhalten.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**

- Nicht übereinstimmende oder anderweitig ungültige Passwörter bleiben in der Formularvalidierung und lösen kein Passwort-Update aus.
- Ungültige, abgelaufene oder unvollständige Recovery-Links und Codes zeigen weiterhin die vorhandenen lokalisierten Fehler und erzeugen keinen erfolgreichen Übergang.
- Fehler von `updatePasswordWithRecoveryClient` bleiben als Fehler im Recovery-Formular sichtbar; Abbruch und erneuter Versuch bleiben möglich.
- `sign-in-required` und `transfer-uncertain` führen weiterhin in den vorhandenen Zustand `sign-in-required`, ohne automatische Navigation in eine vermeintlich angemeldete App.
- `existing-session` schützt weiterhin die bereits aktive primäre Session und navigiert nach erfolgreicher Passwortänderung wie bisher unmittelbar zu `/`.
- Der manuelle `Weiter`-Pfad der Erfolgsanzeige bleibt erhalten. Ein echter, dauerhafter Provider-Fehler wird nicht gelöscht oder als bereit ausgegeben.
- Echte Session-Bootstrap-, Profil- oder Haushaltsfehler außerhalb der Recovery-Routen zeigen weiterhin den `CrashFallback` mit Wiederholungsaktion.
- Reguläre Anmeldung, Abmeldung, App-Start, Onboarding und nicht mit Recovery verbundene Navigation bleiben unverändert.
- `PasswordRecoveryStore`, `transferPasswordRecoverySession`, `SessionProvider`, `RootNavigator`, App-Entry-Entscheidung und globale Fehlergrenze behalten ihre bestehenden Verantwortungen.

**Scope:**

Alle Eingaben, für die `isBugCondition` `false` liefert, bleiben von diesem Fix unbeeinflusst. Dazu gehören:

- Recovery aus einer bereits angemeldeten primären Session
- ungültige Formulareingaben, Links oder Codes
- fehlgeschlagene Passwort-Updates und nicht sicher übertragbare Sessions
- echte, nicht vorübergehende App-Startfehler außerhalb eines übertragenen Recovery-Abschlusses
- normale Anmelde- und Startabläufe ohne Passwort-Reset

## Hypothesized Root Cause

Die Arbeitshypothese wird durch den aktuellen Produktionscode, den vorherigen Diff und den fokussierten Test stark gestützt. Die genaue sichtbare Renderquelle auf dem Gerät bleibt bis zur End-to-End-Verifikation offen, weil mehrere Pfade denselben `CrashFallback` verwenden.

1. **Erfolgreicher Session-Transfer ist nicht gleich lokaler Account-Bereitschaft**: `transferPasswordRecoverySession` in `src/features/auth/api.ts` wartet auf `primary.auth.setSession` und prüft die übertragene Nutzer-ID. Der zugehörige `onAuthStateChange`-Übergang im `SessionProvider` verarbeitet danach jedoch asynchron lokale Account-Zuordnung, verschlüsselten Speicher, gemerkte Nutzer-ID, Query-Persistenz und Sync-Freigabe. Erst am Ende veröffentlicht er `accountReady = true`.

2. **Die bisherige Navigation überholt diesen asynchronen Übergang**: `RecoveryPasswordForm.submit` navigiert in `F` für `signed-in` und `existing-session` unmittelbar nach dem Store-Ergebnis zu `/`. Der Rückgabewert `signed-in` beweist die Übertragung in den primären Auth-Client, aber nicht, dass React bereits den dazugehörigen bereiten Provider-Zustand gerendert hat.

3. **Das Verlassen der Recovery-Route öffnet das Fehlerfenster**: `RootNavigator` lässt `/password-recovery`, `/forgot-password` und `/reset-password` auch während Session-Laden oder Session-Fehlern erreichbar. Nach dem vorzeitigen `router.replace('/')` gelten dagegen wieder der Session-Fehlerpfad des `RootNavigator` und die Profil-/Haushaltsentscheidung in `src/app/(app)/_layout.tsx`. Beide können denselben `CrashFallback` anzeigen.

4. **Die Recovery-Identität wird beim Store-Abschluss gelöscht**: `savePassword` setzt `recoveryUserId` vor seiner Rückgabe auf `null`. Eine spätere Bereitschaftsprüfung muss deshalb die ID vor dem `await savePassword(...)` lokal sichern. Eine Prüfung nur auf `session !== null` wäre außerdem bei konkurrierender Anmeldung eines anderen Kontos falsch.

5. **Weniger wahrscheinliche Alternativen bleiben überprüfbar**: Der Screenshot allein unterscheidet nicht zwischen einer Sentry-Fehlergrenze, einem Session-Bootstrap-Fehler und einem Profil- oder Haushaltsfehler. Der enge zeitliche Zusammenhang mit `router.replace('/')`, die Trennung von `setSession` und `accountReady` sowie der bestehende Test sprechen für die Übergabereihenfolge. Falls der Gerätefehler trotz Bereitschafts-Gate weiter auftritt, muss anhand vorhandener Sentry- und `auth.session.account_ready`-Diagnostik neu lokalisiert werden, statt den `CrashFallback` zu verstecken.

## Correctness Properties

Property 1: Bug Condition - Recovery wartet auf den passenden bereiten Account

_For any_ erfolgreichen Passwort-Reset aus abgemeldetem Zustand, für den `isBugCondition` `true` liefert, SHALL die korrigierte Funktion die Recovery-Erfolgsanzeige beibehalten und keine automatische Root-Navigation auslösen, solange `R(recoveryUserId)` nicht gilt. Sobald der `SessionProvider` dieselbe Nutzer-ID mit `accountReady = true` und ohne Fehler veröffentlicht, SHALL sie genau einmal zu `/` navigieren, ohne zuvor automatisch den appweiten `CrashFallback` anzuzeigen. Falls stattdessen ein dauerhafter Session-Fehler eintritt, SHALL der Fehler erhalten bleiben und der bestehende sichere manuelle Fehler- oder Wiederholungspfad erreichbar bleiben.

**Validates: Requirements 2.1, 2.2, 3.3**

```text
FUNCTION expectedBehavior(result)
  INPUT: result of type RecoveryCompletionTrace
  OUTPUT: boolean

  RETURN result.successVisibleWhileTransitionPending = true
         AND result.automaticRootNavigationsBeforeReady = 0
         AND result.automaticCrashFallbackFramesBeforeReady = 0
         AND (
           (
             result.readyStateReached = true
             AND result.firstReadyState.sessionUserId = result.recoveryUserId
             AND result.firstReadyState.accountReady = true
             AND result.firstReadyState.sessionError IS null
             AND result.automaticRootNavigationsAfterFirstReady = 1
             AND result.finalRoute = "/"
             AND result.finalSessionUserId = result.recoveryUserId
           )
           OR (
             result.terminalSessionFailure = true
             AND result.sessionErrorPreserved = true
             AND result.safeExitOrRetryAvailable = true
             AND result.automaticRootNavigations = 0
           )
         )
END FUNCTION
```

Property 2: Preservation - Nicht betroffene Recovery- und App-Startpfade

_For any_ Eingabe, für die `isBugCondition` `false` liefert, SHALL `F'` dasselbe beobachtbare Recovery-, Fehler- und Routingverhalten wie `F` erzeugen. Dies bewahrt Formularvalidierung, ungültige Recovery-Daten, Update- und Transferfehler, `existing-session`, echte appweite Fehler sowie reguläre Anmelde- und Startabläufe.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `src/features/auth/components/recovery-password-form.tsx`

**Function**: `RecoveryPasswordForm`, insbesondere `submit` und ein lokaler Bereitschaftseffekt

**Specific Changes**:

1. **Recovery-Identität vor dem Store-Abschluss sichern**: `recoveryUserId` vor `await savePassword(...)` in einer lokalen Konstante erfassen, weil der Store sie bei erfolgreichem Abschluss löscht.

2. **Nur den neuen Login-Übergang verzögern**: Bei `{ status: 'ok', outcome: 'signed-in' }` die gesicherte ID als `pendingSessionUserId` setzen und auf der bereits vom Store aktivierten Phase `updated` bleiben. In diesem Zweig noch kein `router.replace('/')` ausführen.

3. **Bereitschaft identitätsgenau prüfen**: Über `useSession()` auf `session`, `accountReady` und `error` reagieren. Automatische Navigation ist ausschließlich erlaubt, wenn eine ausstehende ID existiert, `session.user.id` genau dieser ID entspricht, `accountReady` wahr ist und kein Session-Fehler vorliegt.

4. **Navigation genau einmal auslösen**: Vor `router.replace('/')` die ausstehende ID löschen. Damit kann ein weiterer Render mit demselben Provider-Zustand keine zweite automatische Navigation auslösen.

5. **Bestehende Outcome-Zweige bewahren**: `existing-session` navigiert weiterhin sofort. `sign-in-required`, `missing-session`, Validierungs- und Updatefehler behalten ihre vorhandenen UI- und Store-Pfade. Eine fehlende `recoveryUserId` darf nicht durch die Annahme irgendeiner Session ersetzt werden; sie führt zu keiner automatischen Navigation.

6. **Keine angrenzenden Verantwortungen ändern**: Keine Änderung an Recovery-Store, Auth-API, Session-Provider, Root-Navigator, App-Entry-Entscheidung, Übersetzungen oder `CrashFallback`. Der Fix koordiniert nur den bereits vorhandenen Erfolgszustand mit dem bereits vorhandenen Bereitschaftssignal.

**State Transitions**:

| Ausgang | Ereignis | Zwischenzustand | Nächster Schritt |
|---|---|---|---|
| `verified`, primäre Session beim Start `null` | Passwort gespeichert, Transfer `transferred` | Store `updated/signed-in`, lokale `pendingSessionUserId = u` | Recovery-Erfolg anzeigen und auf `R(u)` warten |
| `pendingSessionUserId = u`, Session fehlt oder Account nicht bereit | Provider-Render | unverändert | keine automatische Navigation |
| `pendingSessionUserId = u`, Session gehört zu anderem Nutzer | Provider-Render | unverändert | keine automatische Navigation |
| `pendingSessionUserId = u`, Provider-Fehler vorhanden | Provider-Render | unverändert | keine automatische Navigation und Fehler nicht löschen |
| `pendingSessionUserId = u`, `R(u)` gilt | Provider-Render | Pending-ID löschen | genau einmal `router.replace('/')` |
| `verified`, Ergebnis `existing-session` | Passwort gespeichert | Store `updated/existing-session` | bisherige unmittelbare Root-Navigation |
| `verified`, Ergebnis `sign-in-required` | Passwort gespeichert | Store `sign-in-required` | vorhandenen Anmeldehinweis anzeigen |
| `verified`, Updatefehler | Speichern schlägt fehl | Store bleibt bedienbar | vorhandenen Recovery-Fehler anzeigen |

**File**: `src/features/auth/screens/password-recovery-screen.test.tsx`

**Function**: fokussierte Tests des erfolgreichen Passwort-Speicherns

**Specific Changes**:

1. Den `SessionProvider`-Rückgabewert kontrollierbar mocken.
2. Nach erfolgreichem `signed-in`-Ergebnis zuerst belegen, dass die Erfolgsphase sichtbar bleibt und `router.replace` noch nicht aufgerufen wurde.
3. Nicht bereite, fehlerhafte und identitätsfremde Provider-Zustände ohne Navigation prüfen.
4. Danach denselben Nutzer mit `accountReady = true` und `error = null` veröffentlichen und genau eine Navigation zu `/` erwarten.
5. Die vorhandenen Fälle für Validierung, Linkprüfung, Updatefehler und Abbruch unverändert weiterlaufen lassen.

Der vorhandene Arbeitsbaum-Entwurf setzt die Kernpunkte 1 bis 4 bereits um und hat den bisherigen 6-von-6-Testlauf bestanden. Die breitere Zustandsmatrix und Geräteprüfung sind Verifikationspunkte, keine Begründung für zusätzliche Produktionsabstraktionen.

## Testing Strategy

### Validation Approach

Die Verifikation folgt zwei Phasen: Zuerst wird der Gegenbeleg des alten Verhaltens festgehalten, danach werden Fix Checking und Preservation Checking getrennt ausgeführt. Da der aktuelle gemeinsam genutzte Arbeitsbaum den Entwurf bereits enthält, wird er nicht zurückgesetzt oder zum Erzeugen eines roten Tests verändert. Der beobachtete Gerätefehler, der vorherige Quellstand im Git-Diff und die alte unmittelbare Router-Erwartung bilden den vorhandenen Gegenbeleg.

### Exploratory Bug Condition Checking

**Goal**: Belegen, dass die Navigation in `F` vor dem vollständigen lokalen Account-Bootstrap möglich ist, und die sichtbare Fehlerquelle auf dem echten Gerät bestätigen oder die Root-Cause-Hypothese verwerfen.

**Test Plan**:

- Den alten Quellstand ausschließlich über Diff oder Historie untersuchen, nicht durch Zurücksetzen des aktuellen Arbeitsbaums.
- Im fokussierten Screen-Test nach einem `signed-in`-Ergebnis den Provider zunächst ohne passende bereite Session lassen. Unter `F` erfolgt bereits `router.replace('/')`; dies ist der deterministische Gegenbeleg für die Reihenfolge.
- Auf einem physischen Gerät den ursprünglichen Ablauf mit einem frisch erzeugten, nur einmal nutzbaren Recovery-Link wiederholen und die Anzeige vom Speichern bis zur vollständig geladenen App als Video erfassen.

**Test Cases**:

1. **Abgemeldeter Code-Ablauf**: Gültiger Code, gültiges neues Passwort, Transfer `transferred`, Provider noch ohne passende Session. `F` navigiert zu früh.
2. **Abgemeldeter Link-Ablauf**: Gültiger `token_hash`, gültiges neues Passwort, gleiche verzögerte Provider-Veröffentlichung. `F` navigiert zu früh.
3. **Account-Bootstrap läuft**: Passende Session-ID, aber `accountReady = false`. `F` wartet nicht auf den vollständigen lokalen Zustand.
4. **Identitätskante**: Bereite Session mit anderer Nutzer-ID. Eine allgemeine Session-Prüfung wäre ein falscher Abschluss.

**Expected Counterexamples**:

- `router.replace('/')` wird direkt nach `savePassword` aufgerufen, bevor `R(u)` gilt.
- Auf dem betroffenen Gerät erscheint zwischen Recovery-Erfolg und App-Ziel mindestens ein Frame mit dem Text des `CrashFallback`.
- Falls der Fehler trotz nachgewiesenem `R(u)` auftritt, ist die Reihenfolge-Hypothese unvollständig; dann sind Sentry-Ereignis, Session-Diagnostik und App-Entry-Fehlerzustand getrennt auszuwerten.

### Fix Checking

**Goal**: Für alle Eingaben der Bug_Condition prüfen, dass `F'` bis zur passenden Bereitschaft im Recovery-Erfolg bleibt und danach genau einmal navigiert.

**Pseudocode:**

```text
FOR ALL input WHERE isBugCondition(input) DO
  trace := executeRecoveryCompletionWithControlledSessionStates(input)
  ASSERT expectedBehavior(trace)
END FOR
```

### Preservation Checking

**Goal**: Für alle Eingaben außerhalb der Bug_Condition prüfen, dass `F'` das bisherige beobachtbare Verhalten von `F` beibehält.

**Pseudocode:**

```text
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT observableBehavior(F(input)) = observableBehavior(F'(input))
END FOR
```

**Testing Approach**:

Die Zustandsdomäne des neuen Gates ist klein und endlich. Sie wird ohne neue Testabhängigkeit als deterministisch erzeugtes kartesisches Produkt geprüft. Bestehende Recovery-Store-, Session-Provider- und Root-Navigator-Tests bleiben für ihre jeweiligen Verantwortungen maßgeblich.

**Test Plan**:

- `sessionUserId ∈ {null, recovered-user, other-user}`
- `accountReady ∈ {false, true}`
- `sessionError ∈ {null, Error}`
- `outcome ∈ {signed-in, existing-session, sign-in-required}`
- Automatische Navigation genau dann erwarten, wenn ein `signed-in`-Abschluss aussteht und `R(recovered-user)` gilt.
- Für alle anderen Kombinationen keine neue automatische Navigation und keine Änderung der vorhandenen sichtbaren Recovery-Zustände erwarten.

**Test Cases**:

1. **Formularerhaltung**: Ungleiche Passwörter zeigen weiter die Validierung und rufen kein Update auf.
2. **Recovery-Fehlererhaltung**: Updatefehler, ungültige Links und fehlende Recovery-Sessions bleiben im vorhandenen Fehlerpfad.
3. **Outcome-Erhaltung**: `existing-session` navigiert weiterhin sofort; `sign-in-required` navigiert nicht automatisch.
4. **Globaler Fehlerpfad**: Ein echter Session-Bootstrap-Fehler außerhalb einer Recovery-Route zeigt weiter `CrashFallback` und verhindert DB-/OFF-Start.
5. **Normaler Start**: Reguläre angemeldete und abgemeldete Root-Navigation bleibt unverändert.

### Unit Tests

- `src/features/auth/screens/password-recovery-screen.test.tsx`: Erfolg bleibt nach `signed-in` ohne passende Session sichtbar; keine frühe Router-Auslösung; Navigation nach passender Bereitschaft genau einmal.
- Dieselbe Datei: `accountReady = false`, falsche Nutzer-ID und `sessionError != null` blockieren automatische Navigation.
- `src/features/auth/recovery-store.test.ts`: Outcomes `signed-in`, `existing-session`, `sign-in-required` und das Löschen der isolierten Recovery-Session bleiben unverändert.
- `src/features/auth/session-provider.test.tsx`: `accountReady` bleibt das Signal nach vollständig abgeschlossenem lokalen Bootstrap.
- `src/features/navigation/root-navigator.test.tsx`: Echte Session-Bootstrap-Fehler außerhalb der Recovery-Route zeigen weiterhin den wiederholbaren Fehlerbildschirm.

Gezielte Befehle nach einer Implementierung:

```text
bun run test src/features/auth/screens/password-recovery-screen.test.tsx
bun run test src/features/auth/recovery-store.test.ts src/features/auth/session-provider.test.tsx src/features/navigation/root-navigator.test.tsx
bun x biome check src/features/auth/components/recovery-password-form.tsx src/features/auth/screens/password-recovery-screen.test.tsx
git diff --check
```

### Property-Based Tests

- Das endliche Produkt aus Session-ID, `accountReady` und Session-Fehler deterministisch erzeugen. Für jede Kombination gilt: Vor `R(u)` keine automatische Navigation, bei `R(u)` genau eine automatische Navigation.
- Outcome und Startzustand kombinieren. Nur `startedSignedOut + signed-in` verwendet das neue Gate; `existing-session`, `sign-in-required` und Fehlerfälle behalten ihre bisherigen Ergebnisse.
- Für alle Nicht-Bug-Kombinationen die beobachtbare Ausgabe vergleichen: sichtbarer Recovery-Zustand, Anzahl und Ziel der Router-Aufrufe sowie Erreichbarkeit des bestehenden Fehlerpfads.
- Keine zusätzliche Property-Test-Bibliothek einführen. Eine erzeugte `it.each`-Matrix im bestehenden Jest-Test reicht für diese kleine endliche Domäne und hält den Fix minimal.

### Integration Tests

- Den bestehenden `PasswordRecoveryScreen` mit echtem Recovery-Store und kontrolliertem Session-Provider-Zustand durch den vollständigen Code- oder Link-Ablauf führen. Nach dem Speichern muss die Erfolgsansicht stehen bleiben, bis die passende Session bereit ist.
- Den Root-Navigator separat weiter gegen echte Fehlerzustände prüfen, damit der Fix nicht den globalen Fehlerbildschirm abschaltet oder Fehler löscht.
- **Verbindlicher Geräte-End-to-End-Nachweis**: Auf dem physischen Gerät und Betriebssystem des ursprünglichen Befunds mit einem aktuellen Dev Client starten, vollständig abmelden, einen frischen Recovery-Link öffnen, ein gültiges neues Passwort speichern und die Anzeige bis zum regulären angemeldeten Ziel aufzeichnen. Es darf kein Frame mit `Etwas ist schiefgelaufen` erscheinen, die richtige Nutzer-ID muss angemeldet sein und die Zielansicht muss bedienbar sein.
- Den Geräteablauf mindestens dreimal mit frischen Links wiederholen, weil die ursprüngliche Erscheinung zeitabhängig war. Für einen gleichzeitigen Android-Release denselben kurzen Ablauf auf einem physischen Android-Gerät wiederholen; der Produktionscode ist plattformgeteilt, der ursprüngliche Nachweis stammt jedoch vom betroffenen iOS-Ablauf.
- Keine Builds im Rahmen der Design-Phase starten. Der Nachweis verwendet einen vom Nutzer kontrollierten, aktuellen Dev-Client-Build.

**Formal Completion:**

- Der fokussierte Test und die abhängigen Auth-/Navigator-Tests sind grün.
- Die Zustandsmatrix deckt Bereitschaft, Fehler und Nutzer-ID-Abweichung ab.
- Der physische Geräteablauf ist mit frischem Link erfolgreich und ohne sichtbaren `CrashFallback` dokumentiert.
- Der Implementierungsdiff bleibt auf die Recovery-Form und den gezielten Test begrenzt, sofern die Geräteprüfung die Hypothese bestätigt.
- Erst danach wird `fam-fc36` mit Test- und Geräte-Evidenz formal abgeschlossen. Wenn der Fehler auf dem Gerät bestehen bleibt, wird die Root-Cause-Hypothese zurückgewiesen und vor jeder Erweiterung des Fixes erneut untersucht.
