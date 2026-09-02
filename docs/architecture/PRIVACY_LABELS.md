# App-Store-Privacy-Labels (#99)

> Referenz zum Ausfüllen von Apple "App Privacy" (App Store Connect) und
> Google "Data Safety" (Play Console). Quelle der Wahrheit ist
> [`docs/architecture/DATENSCHUTZ.md`](DATENSCHUTZ.md) — bei Widersprüchen gewinnt dort.

## Datenkategorien

| Datentyp (Apple) / Kategorie (Google) | Erhoben? | Verknüpft mit Identität? | Zweck | Tabelle/Quelle |
|---|---|---|---|---|
| Kontaktdaten → E-Mail-Adresse | Ja | Ja | Kontoverwaltung, Authentifizierung | `auth.users` (Supabase Auth) |
| Gesundheit & Fitness → Ernährung | Ja | Ja | Kern-Feature: Kalorien-/Makro-Tracking | `food_entries` |
| Gesundheit & Fitness → Gewicht/Körpermaße | Ja | Ja | Kern-Feature: Gewichtsverlauf | `weight_entries` |
| Nutzungsdaten → Produktinteraktion | Ja | Je nach Anbieter/Feature | Produktverbesserung, Feature-Flags, Fehleranalyse | PostHog, Aptabase |
| Kennungen → Nutzer-ID | Ja | Ja | Account-System, Premium-Status und Nutzungsanalyse | Supabase Auth, PostHog, RevenueCat |
| Kaufdaten | Ja | Ja | Premium-Funktionen, Abrechnung und Restore | RevenueCat / App Store |
| Standort | Ja | Ja | Prospekte und Märkte in der Nähe | `expo-location` |
| Diagnose → Absturzberichte | Ja | Je nach SDK-Konfiguration | Stabilitäts- und Fehleranalyse | Sentry, Aptabase, PostHog |
| Werbedaten → Geräte-/Werbekennung | Ja, abhängig von Consent | Je nach Consent | Werbung in der kostenlosen Version | Google AdMob / UMP / iOS ATT |
| Andere Daten → Haushaltsdaten | Ja | Ja (haushaltsweit) | Geteilter Kühlschrank/Einkaufsliste | `households`, `fridge_items`, `shopping_list_items` |
| Andere Daten → Produktdaten | Ja | Nein | Barcode/Name/Nährwerte, teils von Open Food Facts | `products` |

**Tracking:** Ja, abhängig von der Einwilligung — Google AdMob kann Daten für
personalisierte Werbung und Tracking über Apps/Websites hinweg verarbeiten.
Auf iOS wird dafür App Tracking Transparency zusammen mit dem Google-UMP-
Consent verwendet. Bei Ablehnung bleiben nicht personalisierte oder
eingeschränkte Werbeformen möglich.

**Datenverkauf:** Nein.

## Zwecke der angefragten Berechtigungen

| Berechtigung | `NS*UsageDescription` (iOS) / Android-Permission | Zweck | Begründung |
|---|---|---|---|
| Kamera | `NSCameraUsageDescription` (`expo-camera`-Plugin in `app.json`: *"Die App $(PRODUCT_NAME) benötigt Kamera-Zugriff, um Barcodes von Lebensmitteln und QR-Codes für den Haushaltsbeitritt zu scannen."*) / `android.permission.CAMERA` | Barcode-Scan (Produktsuche), QR-Code-Scan (Haushaltsbeitritt) | Optional — manuelle Eingabe des Barcodes bzw. Beitritt per Link/Code funktioniert ohne Kamera |
| Benachrichtigungen | `expo-notifications` (keine `NS*UsageDescription` nötig, iOS fragt zur Laufzeit) / `POST_NOTIFICATIONS` (Android 13+) | Lokale Erinnerung, wenn ein Kühlschrank-Artikel bald abläuft | Optional, rein lokal — kein Push-Server, keine externen Push-Tokens |

**Nicht angefragt** (bewusst kein Eintrag nötig): Kontakte, Bewegungsdaten,
Kalender und Erinnerungen. Kamera, Mikrofon-Konfiguration, Standort und
Fotomediathek sind in `app.json` für die jeweils beschriebenen Funktionen
vorhanden und müssen im Store-Formular entsprechend berücksichtigt werden.

## Abgleich mit #96 (Datenschutzerklärung)

Diese Tabelle deckt sich mit den Kategorien in
[`docs/architecture/DATENSCHUTZ.md`](DATENSCHUTZ.md#welche-daten-verarbeitet-werden).
Ändert sich dort eine Kategorie oder ein Zweck, muss diese Datei — und die
tatsächliche Eingabe in App Store Connect / Play Console — im selben Zug
nachgezogen werden, sonst widersprechen sich Store-Label und Datenschutztext
(Ablehnungsgrund im Review).

## Offene Punkte vor der ersten Store-Einreichung

- [ ] Consent-Nachrichten und Anbieter im Google-AdMob-Dashboard konfigurieren
- [ ] Werte tatsächlich in App Store Connect ("App Privacy" Fragebogen) übertragen
- [ ] Werte tatsächlich in der Play Console ("Data Safety"-Formular) übertragen
