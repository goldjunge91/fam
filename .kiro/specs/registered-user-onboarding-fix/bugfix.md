# Bugfix Requirements Document

## Introduction

Beim erfolgreichen Anmelden eines bereits bestehenden Accounts wird der Nutzer derzeit unter bestimmten Startbedingungen wie nach einer neuen Registrierung in die persönlichen Onboarding-Schritte geführt. Dadurch werden Profil-, Haushalts-, Modul- und Berechtigungsschritte erneut angeboten, obwohl keine neue Registrierung stattgefunden hat.

Für dieses Dokument ist eine neue Registrierung die erfolgreiche Erstellung eines Accounts, dessen erstmalige Einrichtung noch offen ist. Eine Anmeldung authentifiziert dagegen einen Account, der bereits vor dem Anmeldeversuch bestand und nicht nachweislich auf seine erstmalige Einrichtung wartet. Das verwendete Anmeldeverfahren, eine neue App-Installation, ein anderes Gerät, ein fehlender lokaler Onboarding-Hinweis oder ein fehlender kontoabhängiger Abschlusswert dürfen eine Anmeldung nicht in eine neue Registrierung umdeuten.

Der anonyme Willkommen- und Account-Einstieg darf vor der Authentifizierung weiterhin zur Registrierung oder Anmeldung führen. Mit Onboarding sind im Folgenden die persönlichen Einrichtungsschritte gemeint, die nach erfolgreicher Authentifizierung nur für eine neue Registrierung fortgesetzt werden dürfen.

## Bug Analysis

### Current Behavior (Defect)

Der Fehler entsteht, weil eine erfolgreiche Anmeldung und eine erfolgreiche Registrierung in Teilen des Einstiegs denselben Onboarding-Fortsetzungspfad verwenden und fehlende Abschlussinformationen als Beleg für eine neue Registrierung behandelt werden können.

1.1 WHEN ein bereits registrierter Nutzer sich im anonymen Willkommen- und Account-Einstieg erfolgreich mit einem bestehenden Account anmeldet THEN setzt das System das Onboarding mit den Profil-, Haushalts-, Modul- und Berechtigungsschritten fort, als wäre der Account gerade neu registriert worden.

1.2 WHEN eine erfolgreiche Anmeldung einen bestehenden Account ohne lokalen Onboarding-Hinweis oder ohne kontoabhängigen Onboarding-Abschlusswert lädt und kein verlässlicher Nachweis einer neuen, noch offenen Registrierung vorliegt THEN kann das System den Nutzer allein wegen der fehlenden Abschlussinformation in das Onboarding umleiten.

### Expected Behavior (Correct)

Eine erfolgreiche Anmeldung und eine erfolgreiche Registrierung müssen unterschiedliche Folgezustände haben.

2.1 WHEN ein bereits registrierter Nutzer sich im anonymen Willkommen- und Account-Einstieg erfolgreich mit einem bestehenden Account anmeldet THEN SHALL das System die persönlichen Onboarding-Schritte verlassen und den regulären angemeldeten App-Einstieg verwenden, unabhängig davon, ob die Anmeldung mit E-Mail und Passwort oder über einen unterstützten Identitätsanbieter erfolgt.

2.2 WHEN eine erfolgreiche Anmeldung einen bestehenden Account ohne lokalen Onboarding-Hinweis oder ohne kontoabhängigen Onboarding-Abschlusswert lädt und kein verlässlicher Nachweis einer neuen, noch offenen Registrierung vorliegt THEN SHALL das System den Account als bereits registriert behandeln, den vollständigen Auth-, Profil-, Haushalts- und lokalen Startzustand abwarten und anschließend nach den regulären Startregeln statt in das Onboarding navigieren.

### Unchanged Behavior (Regression Prevention)

Die Korrektur darf weder die erstmalige Einrichtung neuer Accounts noch die Sicherheits-, Fehler- und Zustandsgrenzen des App-Starts abschwächen.

3.1 WHEN ein Nutzer einen neuen Account erfolgreich registriert und dessen erstmalige Einrichtung noch offen ist THEN SHALL CONTINUE TO das System nach einer sofort verfügbaren Sitzung oder nach erfolgreicher E-Mail-Bestätigung die persönlichen Onboarding-Schritte anzeigen.

3.2 WHEN die erstmalige Einrichtung eines neu registrierten Accounts noch nicht abgeschlossen ist und die Auth-Sitzung erneuert oder die App erneut geöffnet wird THEN SHALL CONTINUE TO das System das offene Onboarding fortsetzen, bis es erfolgreich abgeschlossen wurde.

3.3 WHEN ein neu registrierter Nutzer das Onboarding erfolgreich abschließt THEN SHALL CONTINUE TO das System die gewählten Profil- und Moduleinstellungen sowie die Haushaltsentscheidung speichern, den kontoabhängigen Abschluss festhalten und den lokalen Onboarding-Hinweis für spätere anonyme App-Starts setzen.

3.4 WHEN noch keine Auth-Sitzung besteht und auf dem Gerät kein lokaler Onboarding-Hinweis vorhanden ist THEN SHALL CONTINUE TO das System den anonymen Willkommen- und Account-Einstieg anzeigen, ohne daraus bereits eine neue Registrierung abzuleiten.

3.5 WHEN noch keine Auth-Sitzung besteht und der lokale Onboarding-Hinweis vorhanden ist THEN SHALL CONTINUE TO das System den regulären Anmeldeeinstieg anzeigen.

3.6 WHEN eine Anmeldung, Registrierung, E-Mail-Bestätigung oder Anbieter-Authentifizierung fehlschlägt oder abgebrochen wird THEN SHALL CONTINUE TO das System den passenden sicheren Fehler- oder Abbruchzustand anzeigen und weder den regulären App-Einstieg noch weitere Onboarding-Schritte als erfolgreich freigeben.

3.7 WHEN ein bereits registrierter Nutzer erfolgreich angemeldet wird THEN SHALL CONTINUE TO das System vorhandene Profilwerte, Moduleinstellungen, Haushaltsmitgliedschaften und synchronisierte oder lokale Accountdaten unverändert zu erhalten.

3.8 WHEN nach einer erfolgreichen Anmeldung der lokale Account-Bootstrap, das Profil oder der Haushaltszustand noch lädt THEN SHALL CONTINUE TO das System den bestehenden Ladezustand beizubehalten und den regulären App-Inhalt erst nach vollständiger Bereitschaft freizugeben.

3.9 WHEN beim Laden des Profils oder eines nicht lokal verfügbaren Haushaltszustands ein echter Fehler auftritt THEN SHALL CONTINUE TO das System den bestehenden sicheren Fehlerzustand mit Wiederholungsmöglichkeit anzeigen, während ein bereits lokal verfügbarer Haushalt weiterhin den vorgesehenen Offline-Start erlaubt.

3.10 WHEN ein angemeldeter, bereits registrierter Account keinem Haushalt angehört THEN SHALL CONTINUE TO das System den bestehenden Ablauf zum Erstellen eines Haushalts verwenden, statt die persönlichen Onboarding-Schritte als Ersatz anzuzeigen.

3.11 WHEN ein anderer Account angemeldet wird oder ein Accountwechsel stattfindet THEN SHALL CONTINUE TO das System lokale Daten, Caches und Speicher dem richtigen Account zuzuordnen und Daten des vorherigen Accounts vor dem Freigeben des neuen Accountzustands zu isolieren.
