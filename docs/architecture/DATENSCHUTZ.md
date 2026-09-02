# Datenschutzerklärung

> Stand: 2026-09-01. Diese Erklärung beschreibt, was in der App tatsächlich
> passiert — nicht mehr und nicht weniger. Sie ist die Quelle für die
> App-Store-Privacy-Labels ([#99](https://github.com/goldjunge91/fam/issues/99))
> und ersetzt die frühere, technisch nicht haltbare Zusage einer
> Ende-zu-Ende-Verschlüsselung (siehe `docs/VISION.md`, Korrekturtabelle).

## Verantwortlicher

Der Betreiber der App (siehe App-Store-Eintrag / Impressum).

## Wie deine Daten geschützt werden

Es gibt **keine Ende-zu-Ende-Verschlüsselung**. Der Server (Supabase/Postgres)
muss Daten lesen können, um sie nach Haushalt zu filtern, Kalorien- und
Gewichtsauswertungen zu berechnen und Änderungen in Echtzeit an andere Geräte
zu verteilen — das ist mit echter E2EE nicht vereinbar. Stattdessen:

- **Transportverschlüsselung (TLS)** für jede Verbindung zwischen App und
  Server.
- **Verschlüsselung at rest** auf Datenbankebene (Supabase/Postgres-Standard).
- **Zugriffstrennung über Row Level Security (RLS):** Jede Tabelle mit
  persönlichen Gesundheitsdaten (Kalorien-Tagebuch, Gewicht, Ziele, Profil)
  ist serverseitig so eingeschränkt, dass nur der jeweilige Account selbst
  darauf zugreifen kann — auch ein Administrator des gemeinsamen Haushalts
  sieht diese Daten nicht.
- **Zugriffstokens** liegen auf dem Gerät ausschließlich im
  Keychain (iOS) bzw. Keystore (Android) über `expo-secure-store`, nicht im
  Klartext-Storage.

## Welche Daten verarbeitet werden

| Kategorie | Beispiele | Zweck | Geteilt mit Haushalt? |
|---|---|---|---|
| Konto | E-Mail-Adresse, Passwort-Hash (verwaltet von Supabase Auth) | Anmeldung, Kontosicherheit | Nein |
| Profil | Anzeigename, Avatar, Geburtsdatum, biologisches Geschlecht (nur für die Kalorienformel), Größe, Aktivitätslevel | Grundumsatz-/Kalorienberechnung, Personalisierung | Nein |
| Gesundheits-/Ernährungsdaten | Ernährungstagebuch-Einträge, Gewichtsverlauf, Kalorien-/Makroziele | Kern-Feature Kalorien- und Gewichts-Tracking | Nein — technisch über RLS getrennt |
| Kinderprofile | Name, Geburtsdatum eines Kindes, angelegt und verwaltet durch ein Elternteil | Mahlzeiten einem Kind zuordnen können | Innerhalb des Haushalts sichtbar (kein eigener Account, keine Anmeldedaten) |
| Haushaltsdaten | Haushaltsname, Mitgliederliste, Rollen (Admin/Mitglied) | Gemeinsame Verwaltung von Kühlschrank und Einkaufsliste | Ja — mit allen Mitgliedern des jeweiligen Haushalts |
| Kühlschrank-/Einkaufslisten-Daten | Produktname, Menge, Mindesthaltbarkeitsdatum, Lagerort | Gemeinsamer Bestand, Ablauf-Erinnerungen | Ja — mit dem Haushalt |
| Produktdaten | Barcode, Name, Nährwerte pro 100 g | Produktsuche und -anzeige | Nein (öffentliche Produktdatenbank, siehe unten) |
| Geräte-/Diagnosedaten | Push-Token für lokale Erinnerungen, Sync-Zeitstempel | Ablauf-Benachrichtigungen, Offline-Synchronisation | Nein |
| Nutzungs-/Diagnosedaten | App-/Produktinteraktionen, technische Geräte- und Build-Informationen, Fehler- und Absturzberichte | Produktverbesserung, Feature-Flags, Fehlerdiagnose und Stabilität | Nein — an Drittanbieter-SDKs übermittelt |
| Werbe- und Kaufdaten | Werbe-/Gerätekennungen nach Einwilligung, Impressionen, Kauf- und Abo-Status | Werbung in der kostenlosen Version, Premium-Funktionen und Abrechnung | Nein |

## Drittdienste

- **Open Food Facts** (openfoodfacts.org): Bei der Produktsuche und beim
  Barcode-Scan wird der gescannte Barcode bzw. Suchbegriff an die öffentliche
  Open-Food-Facts-API gesendet, um Produktname und Nährwerte zu laden. Es
  werden dabei keine Konto- oder Gesundheitsdaten an Open Food Facts
  übertragen — nur der Barcode/Suchbegriff selbst. Die Nutzungsbedingungen von
  Open Food Facts gelten für diese Anfragen.
- **Supabase** (supabase.com): Hostet Datenbank, Authentifizierung und
  Realtime-Synchronisation. Alle unter „Welche Daten verarbeitet werden"
  genannten Kategorien liegen dort.
- **Google AdMob** (Google): Liefert Werbung in der kostenlosen Version.
  Google kann abhängig von Region, Consent und iOS-ATT-Auswahl personalisierte,
  nicht personalisierte oder eingeschränkte Werbung ausliefern. Die App holt
  den Google-UMP-Consent vor der AdMob-Initialisierung ein und fragt auf iOS
  die App-Tracking-Erlaubnis ab, bevor personalisierte Werbung möglich ist.
- **RevenueCat** (revenuecat.com): Verarbeitet den Kauf- und Abo-Status für
  Premium-Funktionen. Ad-Impression-Umsätze können zur Abo- und
  Monetarisierungsanalyse an RevenueCat übermittelt werden.
- **Sentry** (sentry.io): Empfängt Fehler-, Absturz- und technische
  Diagnosedaten zur Stabilitätsanalyse.
- **PostHog** (posthog.com) und **Aptabase** (aptabase.com): Empfangen
  Nutzungs- und Produktinteraktionen sowie technische Ereignisse für
  Produktverbesserung, Feature-Flags und Fehleranalyse.

Es findet kein Verkauf von Daten statt. Die Entscheidung über personalisierte
Werbung wird durch Google UMP und auf iOS zusätzlich durch ATT gesteuert.

## Berechtigungen auf dem Gerät

| Berechtigung | Wofür | Optional? |
|---|---|---|
| Kamera | Barcode-Scan für Produkte, QR-Code-Scan für Haushaltsbeitritt | Ja — manuelle Eingabe geht immer |
| Benachrichtigungen | Lokale Erinnerung, wenn ein Kühlschrank-Artikel bald abläuft | Ja |
| Standort | Prospekte und Märkte in der Nähe | Ja |
| Fotomediathek | Rezept-Titelbild auswählen | Ja |
| App-Tracking (iOS) | Personalisierte Werbung in der kostenlosen Version | Ja — ATT- und UMP-Auswahl |

Mikrofon und Kontakte werden nicht als eigenständige Funktionen genutzt.

## Deine Rechte (DSGVO)

- **Auskunft/Export:** Vollständiger Export aller eigenen Daten als JSON über
  Einstellungen → Export (siehe [#97](https://github.com/goldjunge91/fam/issues/97)).
- **Löschung:** Account- und Datenlöschung über Einstellungen → Konto löschen
  (siehe [#98](https://github.com/goldjunge91/fam/issues/98)). Geteilte
  Haushaltsdaten (z. B. Kühlschrank-Bestand) bleiben für verbleibende
  Haushaltsmitglieder bestehen; ausschließlich private Daten des gelöschten
  Accounts werden entfernt.
- **Berichtigung:** Profil- und Tagebuchdaten sind in der App direkt editierbar.

## Kontakt

Fragen zum Datenschutz über den im App-Store-Eintrag hinterlegten Kontaktweg.
