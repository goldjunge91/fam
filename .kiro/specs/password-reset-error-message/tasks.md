# Implementation Plan

## Overview

Der Plan prüft den bereits im Arbeitsbaum liegenden Zwei-Dateien-Entwurf, ergänzt nur fehlende Zustands- und Preservation-Nachweise und macht die physische Geräteabnahme zur Voraussetzung für den Abschluss von `fam-fc36`.

## Notes

Der im Codex-Thread festgehaltene Lauf mit 6 von 6 Tests ist ein Vorbefund. Maßgeblich für den Abschluss sind frische, pfadbezogene Prüfergebnisse sowie drei dokumentierte Recovery-Läufe auf dem ursprünglich betroffenen physischen iOS-Gerät.

## Tasks

### Ausführungsgrenzen

- Den vorhandenen Zwei-Dateien-Entwurf zuerst pfadbezogen prüfen und nur nachweislich fehlende Punkte ergänzen. Keine bestehende Änderung duplizieren.
- Keinen Branch wechseln, keinen Rebase, Reset, Checkout oder Stash ausführen und keine fremden Änderungen zurücksetzen. Ein anderer Agent arbeitet parallel auf `codex/ci-40618058807`.
- Die Bugfix-Arbeit auf `src/features/auth/components/recovery-password-form.tsx` und `src/features/auth/screens/password-recovery-screen.test.tsx` begrenzen, solange die Geräteprüfung die Root-Cause-Hypothese bestätigt. Andere bereits geänderte Dateien bleiben unangetastet.
- Der ausgewertete Thread `codex://threads/01a17fad-0e6a-7ba3-a80e-c3a93213b5dd` hält einen zuletzt grünen fokussierten Lauf mit 6 von 6 Tests sowie erfolgreiche Biome- und Diff-Prüfungen fest. Diese Ergebnisse als Vorbefund behandeln und im aktuellen Arbeitsbaum frisch bestätigen.
- Keine Builds starten oder stoppen. Die physische Prüfung verwendet einen vom Nutzer kontrollierten, aktuellen Dev Client.
- `fam-fc36` bleibt bis zum vollständig belegten Abschluss-Checkpoint offen.

- [x] 1. Bug-Condition-Gegenbeleg und vorhandenen Explorationstest prüfen
  - **Property 1: Bug Condition** - Recovery wartet auf den passenden bereiten Account
  - **CRITICAL**: Diese Property muss gegen das frühere Verhalten `F` fehlschlagen. Der gemeinsam genutzte Arbeitsbaum enthält bereits den möglichen Fix `F'`; das alte Verhalten nicht durch Zurücksetzen oder Umschreiben des Arbeitsbaums wiederherstellen.
  - **IMPORTANT**: Vor jeder Teständerung den pfadbezogenen Diff und den vorhandenen Screen-Test prüfen. Eine vorhandene Assertion erweitern, statt einen zweiten Test für denselben Übergang anzulegen.
  - Den fokussierten Test einmal unverändert ausführen und das aktuelle Ergebnis festhalten. Der Thread nennt 6 von 6 grüne Tests als Vorbefund; bei abweichendem Ergebnis zuerst parallele Änderungen und den Arbeitsbaum prüfen, ohne fremde Arbeit zu überschreiben.
  - Den alten Quellstand ausschließlich lesend über den vorhandenen Diff beziehungsweise die Historie untersuchen und den deterministischen Gegenbeleg dokumentieren: `startedSignedOut = true`, `saveResult = { status: 'ok', outcome: 'signed-in' }`, `recoveryUserId = 'recovered-user'` und `NOT R(recovered-user)`; `F` rief dennoch sofort `router.replace('/')` auf.
  - Die vorhandene Gerätebeobachtung und die frühere unmittelbare Router-Erwartung als bereits erfassten roten Gegenbeleg verwenden. Keinen künstlichen roten Lauf im aktuellen Arbeitsbaum erzeugen.
  - Einen deterministisch erzeugten `it.each`-Test ergänzen oder validieren, der die Bug-Condition-Zustände aus `sessionUserId ∈ { null, recovered-user, other-user }`, `accountReady ∈ { false, true }` und `sessionError ∈ { null, Error }` abdeckt, soweit `R(recovered-user)` nicht gilt.
  - Für jede Bug-Condition-Kombination prüfen, dass die Recovery-Erfolgsanzeige sichtbar bleibt und keine automatische Root-Navigation erfolgt. Nach dem Übergang zu exakt `sessionUserId = recovered-user`, `accountReady = true`, `sessionError = null` genau eine Navigation zu `/` erwarten, auch nach einem weiteren Render desselben bereiten Zustands.
  - **HISTORICAL EXPECTED OUTCOME**: Gegen `F` schlägt die Property wegen der Navigation vor `R(u)` fehl. Im aktuellen Arbeitsbaum darf sie bereits bestehen und grün sein; die frühere Fehlerspur muss als Gegenbeleg nachvollziehbar bleiben.
  - Den Task erst abschließen, wenn Testabdeckung und historischer Gegenbeleg eindeutig dem `isBugCondition`-Prädikat aus dem Design zugeordnet sind.
  - _Requirements: 1.1, 1.2, 2.1, 2.2_

- [x] 2. Preservation-Property-Tests vor der abschließenden Implementierungsprüfung vervollständigen
  - **Property 2: Preservation** - Nicht betroffene Recovery- und App-Startpfade
  - **IMPORTANT**: Observation-first vorgehen. Das beobachtete Verhalten der nicht betroffenen Pfade zuerst mit den bestehenden Tests und dem früheren Diff festhalten, danach nur fehlende Assertions oder Matrixzeilen ergänzen.
  - Für alle gültigen Kombinationen außerhalb der Bug_Condition das beobachtbare Verhalten vergleichen: sichtbarer Recovery-Zustand, Anzahl und Ziel der Router-Aufrufe sowie Erreichbarkeit des bestehenden Fehlerpfads.
  - Die Outcome-Matrix ergänzen oder validieren: `existing-session` navigiert nach erfolgreichem Speichern weiterhin unmittelbar und genau einmal zu `/`; `sign-in-required` und nicht sicher übertragbare Sessions navigieren nicht automatisch und zeigen den vorhandenen Anmeldehinweis.
  - Die Fehler- und Eingabefälle ergänzen oder validieren: nicht übereinstimmende Passwörter lösen kein Update aus; ungültige oder abgelaufene Links zeigen den lokalisierten Fehler; Updatefehler bleiben im Recovery-Ablauf sichtbar und Abbruch beziehungsweise Wiederholung bleiben möglich.
  - Prüfen, dass eine fehlende gesicherte Recovery-Nutzer-ID nicht durch irgendeine bereite Session ersetzt wird und keine automatische Navigation auslöst.
  - Die vorhandenen Tests für Recovery-Store, Session-Provider und Root-Navigator als unveränderte Beobachtungsbasis ausführen. Echte Session-Bootstrap-Fehler außerhalb der Recovery-Route müssen weiterhin den wiederholbaren `CrashFallback` zeigen; reguläre Starts ohne Recovery bleiben unverändert.
  - Keine neue Property-Test-Bibliothek einführen. Für die kleine endliche Domäne die bestehende Jest- und RNTL-Struktur mit einer erzeugten `it.each`-Matrix verwenden und die Projektregeln für asynchrones RNTL-Verhalten einhalten.
  - **EXPECTED OUTCOME**: Alle Preservation-Tests bestehen im vorhandenen Arbeitsbaum und belegen, dass nur `startedSignedOut + signed-in` das neue Bereitschafts-Gate verwendet.
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 3. Fix für die vorzeitige Navigation nach erfolgreichem Passwort-Reset abschließen

  - [x] 3.1 Vorhandenen Zwei-Dateien-Entwurf gegen das Design prüfen und nur belegte Lücken schließen
    - Zuerst den aktuellen pfadbezogenen Diff lesen. Wenn der vorhandene Produktionsentwurf alle folgenden Punkte erfüllt, keine weitere Produktionsänderung vornehmen.
    - Die `recoveryUserId` vor `savePassword(...)` lokal sichern, weil der Store sie beim erfolgreichen Abschluss löscht.
    - Nur für `{ status: 'ok', outcome: 'signed-in' }` die gesicherte ID als ausstehende Recovery-Identität halten und die Erfolgsanzeige ohne frühes `router.replace('/')` beibehalten.
    - Automatisch nur dann navigieren, wenn `session.user.id` exakt der gesicherten ID entspricht, `accountReady = true` und `sessionError = null` gilt. Die ausstehende ID vor der Navigation löschen, damit genau ein Router-Aufruf möglich ist.
    - `existing-session` weiterhin sofort navigieren lassen. `sign-in-required`, fehlende Sessions, Validierungs- und Updatefehler sowie der manuelle `Weiter`-Pfad bleiben unverändert.
    - Recovery-Store, Auth-API, Session-Provider, Root-Navigator, App-Entry-Entscheidung, Übersetzungen und `CrashFallback` nicht ändern. Falls die Tests eine größere Produktionsänderung nahelegen, vor einer Scope-Erweiterung die Root-Cause-Hypothese neu prüfen.
    - _Bug_Condition: `isBugCondition(input)` aus dem Design, insbesondere `startedSignedOut + ok/signed-in + recoveryUserId != null + NOT R(recoveryUserId)`_
    - _Expected_Behavior: `expectedBehavior(result)` aus dem Design, mit sichtbarem Recovery-Erfolg bis `R(u)` und genau einer Root-Navigation danach_
    - _Preservation: Preservation Requirements aus dem Design für alle nicht betroffenen Recovery-, Fehler- und App-Startpfade_
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.2 Bug-Condition-Explorationstest nach der Implementierungsprüfung erneut ausführen
    - **Property 1: Expected Behavior** - Recovery wartet auf den passenden bereiten Account
    - **IMPORTANT**: Denselben Test und dieselbe Matrix aus Task 1 erneut ausführen. Keinen zweiten Fix-Test schreiben.
    - Prüfen, dass jeder Zustand mit `NOT R(u)` die Erfolgsanzeige behält und null automatische Root-Navigationen erzeugt.
    - Prüfen, dass der erste Zustand mit `R(u)` genau eine Navigation zu `/` erzeugt und weitere Renders keine zweite Navigation auslösen.
    - **EXPECTED OUTCOME**: Die Property besteht und bestätigt das korrigierte Verhalten für die gesamte Bug_Condition.
    - _Requirements: 2.1, 2.2, 3.3_

  - [x] 3.3 Preservation-Property-Tests nach der Implementierungsprüfung erneut ausführen
    - **Property 2: Preservation** - Nicht betroffene Recovery- und App-Startpfade
    - **IMPORTANT**: Dieselben Tests und Matrixfälle aus Task 2 erneut ausführen. Keine neuen Tests nur für diesen Wiederholungslauf schreiben.
    - Prüfen, dass `existing-session`, `sign-in-required`, Validierung, ungültige Recovery-Daten, Updatefehler, echte appweite Fehler und reguläre Starts ihr festgehaltenes Verhalten behalten.
    - **EXPECTED OUTCOME**: Alle Preservation-Tests bestehen und zeigen keine Regression außerhalb der Bug_Condition.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.4 Gezielte automatisierte Nachweise frisch ausführen
    - `bun run test src/features/auth/screens/password-recovery-screen.test.tsx`
    - `bun run test src/features/auth/recovery-store.test.ts src/features/auth/session-provider.test.tsx src/features/navigation/root-navigator.test.tsx`
    - `bun x biome check src/features/auth/components/recovery-password-form.tsx src/features/auth/screens/password-recovery-screen.test.tsx`
    - `git diff --check -- src/features/auth/components/recovery-password-form.tsx src/features/auth/screens/password-recovery-screen.test.tsx`
    - Exakte Testzahlen und Ergebnisse dokumentieren. Den früheren 6-von-6-Lauf nicht als Ersatz für diese frischen Läufe verwenden.
    - Nur den Bugfix-Diff pfadbezogen beurteilen. Fehler oder Änderungen in parallel bearbeiteten Dateien weder zurücksetzen noch ungefragt reparieren.
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ] 3.5 Passwort-Recovery auf dem betroffenen physischen Gerät mit frischen Links prüfen
    - Einen vom Nutzer kontrollierten, aktuellen Dev Client auf dem physischen Gerät und Betriebssystem des ursprünglichen Befunds verwenden. Im Rahmen dieses Tasks keinen Build starten oder stoppen.
    - Für jeden Lauf vollständig abmelden, einen neu erzeugten und noch nicht verwendeten Recovery-Link öffnen, ein gültiges neues Passwort speichern und die Anzeige vom Speichern bis zur vollständig geladenen angemeldeten Zielansicht ohne Unterbrechung als Video erfassen.
    - Den Ablauf mindestens dreimal mit drei getrennten frischen Recovery-Links wiederholen, weil der ursprüngliche Fehler zeitabhängig war. Recovery-Links, Token und andere Geheimnisse nicht in Logs, Videos oder Bead-Notizen veröffentlichen.
    - Pro Lauf prüfen und dokumentieren: Die Erfolgsanzeige bleibt während des Übergangs sichtbar; kein Frame enthält `Etwas ist schiefgelaufen`; die primäre Session gehört zum wiederhergestellten Nutzer; das reguläre Ziel erscheint und ist bedienbar.
    - Bei einem gleichzeitig geplanten Android-Release denselben kurzen Ablauf zusätzlich auf einem physischen Android-Gerät durchführen. Der verpflichtende Nachweis bleibt das ursprünglich betroffene physische iOS-Gerät.
    - Geräte- und Betriebssystemversion, Dev-Client-Buildkennung, Zeitpunkt, Ergebnis jedes Laufs und Verweise auf die Aufzeichnungen mit `bd update fam-fc36 --append-notes="..."` ergänzen. Niemals vorhandene Bead-Notizen mit `--notes` ersetzen.
    - Wenn der `CrashFallback` weiterhin sichtbar wird, `fam-fc36` offen lassen, die Aufzeichnung und vorhandene Sentry- beziehungsweise `auth.session.account_ready`-Diagnostik sichern und die Root-Cause-Hypothese vor jeder Scope-Erweiterung neu untersuchen.
    - _Requirements: 2.1, 2.2, 3.3, 3.4, 3.5_

- [ ] 4. Checkpoint: Nachweise prüfen und `fam-fc36` nur bei vollständigem Erfolg abschließen
  - Sicherstellen, dass die Property-1-Matrix, die Property-2-Preservation-Fälle, alle gezielten abhängigen Tests, Biome und die pfadbezogene Diff-Prüfung grün sind.
  - Sicherstellen, dass alle drei physischen iOS-Läufe mit frischen Recovery-Links ohne sichtbaren `CrashFallback` abgeschlossen wurden, der richtige Nutzer angemeldet ist und das Ziel bedienbar war.
  - Bestätigen, dass die diesem Bugfix zugeordneten Produktions- und Teständerungen weiterhin auf die Recovery-Form und den fokussierten Screen-Test begrenzt sind. Parallele fremde Änderungen bleiben unangetastet.
  - Testbefehle, exakte Resultate und bereinigte Geräte-Evidenz in `fam-fc36` mit `--append-notes` festhalten.
  - Erst wenn sämtliche vorherigen Punkte belegt sind, `bd close fam-fc36 --reason="Gezielte Tests, Zustandsmatrix und physische Recovery-Abnahme erfolgreich"` ausführen.
  - Falls ein Nachweis fehlt oder fehlschlägt, den Bead im Status `in_progress` belassen, den offenen Punkt mit `--append-notes` dokumentieren und vor weiteren Änderungen Rücksprache halten.
  - Keinen Branchwechsel, Commit, Push oder Eingriff in parallele Arbeit als Teil dieses Checkpoints ausführen.
  - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 3.4, 3.5_
