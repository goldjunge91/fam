# Bugfix Requirements Document

## Introduction

Beim Zurücksetzen des Passworts aus einem abgemeldeten Zustand erscheint nach dem erfolgreichen Speichern des neuen Passworts kurz der appweite Fehlerbildschirm. Dadurch wirkt ein erfolgreicher Vorgang fehlgeschlagen und die Rückmeldung über den tatsächlichen Abschluss wird unterbrochen. Der Bugfix soll den erfolgreichen Übergang in den angemeldeten Zustand ohne diese irreführende Fehlermeldung sicherstellen.

## Bug Analysis

### Current Behavior (Defect)

Der Fehler tritt im Übergang vom erfolgreichen Passwort-Reset zur regulären angemeldeten App auf.

1.1 WHEN ein abgemeldeter Nutzer einen gültigen Passwort-Recovery-Link öffnet, ein gültiges neues Passwort samt übereinstimmender Bestätigung speichert und der Passwort-Reset erfolgreich abgeschlossen wird THEN zeigt das System kurz den appweiten Fehlerbildschirm mit „Etwas ist schiefgelaufen“ und „Die App ist auf einen unerwarteten Fehler gestossen. Der Fehler wurde erfasst.“

1.2 WHEN das System nach einem erfolgreichen Passwort-Reset den Nutzer in den regulären angemeldeten Zustand überführt THEN verlässt es die Erfolgsanzeige, bevor der angemeldete Zustand vollständig bereit ist, und unterbricht den erfolgreichen Ablauf durch die vorübergehende Fehlermeldung.

### Expected Behavior (Correct)

Ein erfolgreich abgeschlossener Passwort-Reset muss durchgehend als Erfolg erkennbar bleiben.

2.1 WHEN ein abgemeldeter Nutzer einen gültigen Passwort-Recovery-Link öffnet, ein gültiges neues Passwort samt übereinstimmender Bestätigung speichert und der Passwort-Reset erfolgreich abgeschlossen wird THEN SHALL das System den Vorgang ohne Anzeige des appweiten Fehlerbildschirms abschließen.

2.2 WHEN das System nach einem erfolgreichen Passwort-Reset den Nutzer in den regulären angemeldeten Zustand überführt THEN SHALL das System die Erfolgsanzeige beibehalten, bis der angemeldete Zustand vollständig bereit ist, und anschließend das reguläre angemeldete Ziel anzeigen.

### Unchanged Behavior (Regression Prevention)

Fehlerhafte Eingaben, ungültige Recovery-Daten und echte Laufzeitfehler müssen weiterhin korrekt behandelt werden.

3.1 WHEN das neue Passwort und die Passwortbestätigung nicht übereinstimmen oder die Eingaben ungültig sind THEN SHALL CONTINUE TO das System die passende Validierung anzeigen und den Passwort-Reset nicht als erfolgreich abschließen.

3.2 WHEN ein Passwort-Recovery-Link oder Recovery-Code ungültig oder abgelaufen ist THEN SHALL CONTINUE TO das System den passenden lokalisierten Fehler anzeigen und keinen erfolgreichen Übergang in den angemeldeten Zustand auslösen.

3.3 WHEN das Aktualisieren des Passworts oder die anschließende Wiederherstellung der Sitzung tatsächlich fehlschlägt THEN SHALL CONTINUE TO das System den Fehler im Recovery-Ablauf anzeigen und eine sichere Beendigung oder Wiederholung des Ablaufs ermöglichen.

3.4 WHEN außerhalb eines erfolgreich abgeschlossenen Passwort-Resets ein echter unerwarteter App-Fehler auftritt THEN SHALL CONTINUE TO das System den appweiten Fehlerbildschirm anzeigen.

3.5 WHEN ein Nutzer den regulären Anmeldeablauf verwendet oder die App ohne Passwort-Reset öffnet THEN SHALL CONTINUE TO das System den bestehenden Anmelde- und Startablauf unverändert ausführen.
