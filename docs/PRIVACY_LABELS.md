# App-Store-Privacy-Labels (#99)

> Referenz zum Ausfüllen von Apple "App Privacy" (App Store Connect) und
> Google "Data Safety" (Play Console). Quelle der Wahrheit ist
> [`docs/DATENSCHUTZ.md`](DATENSCHUTZ.md) — bei Widersprüchen gewinnt dort.

## Datenkategorien

| Datentyp (Apple) / Kategorie (Google) | Erhoben? | Verknüpft mit Identität? | Zweck | Tabelle/Quelle |
|---|---|---|---|---|
| Kontaktdaten → E-Mail-Adresse | Ja | Ja | Kontoverwaltung, Authentifizierung | `auth.users` (Supabase Auth) |
| Gesundheit & Fitness → Ernährung | Ja | Ja | Kern-Feature: Kalorien-/Makro-Tracking | `food_entries` |
| Gesundheit & Fitness → Gewicht/Körpermaße | Ja | Ja | Kern-Feature: Gewichtsverlauf | `weight_entries` |
| Nutzungsdaten → Produktinteraktion | Nein | — | — | — |
| Kennungen → Nutzer-ID | Ja | Ja | Account-System (Supabase Auth `auth.users.id`) | `auth.users` |
| Kaufdaten | Nein | — | Keine In-App-Käufe/Abos im MVP | — |
| Standort | Nein | — | Wird nicht angefragt | — |
| Diagnose → Absturzberichte | Nein* | — | Kein Crash-Reporting-SDK integriert | — |
| Andere Daten → Haushaltsdaten | Ja | Ja (haushaltsweit) | Geteilter Kühlschrank/Einkaufsliste | `households`, `fridge_items`, `shopping_list_items` |
| Andere Daten → Produktdaten | Ja | Nein | Barcode/Name/Nährwerte, teils von Open Food Facts | `products` |

\* Sobald Crash-Reporting (z. B. Sentry) eingeführt wird, muss diese Zeile und
die zugehörige Info.plist/Manifest-Deklaration aktualisiert werden.

**Tracking:** Nein — keine Datenverknüpfung mit Dritten zu Werbezwecken, kein
Tracking über Apps/Websites hinweg (Apple ATT ist nicht relevant, kein
`NSUserTrackingUsageDescription` nötig).

**Datenverkauf:** Nein.

## Zwecke der angefragten Berechtigungen

| Berechtigung | `NS*UsageDescription` (iOS) / Android-Permission | Zweck | Begründung |
|---|---|---|---|
| Kamera | `NSCameraUsageDescription` (`expo-camera`-Plugin in `app.json`: *"Die App $(PRODUCT_NAME) benötigt Kamera-Zugriff, um Barcodes von Lebensmitteln und QR-Codes für den Haushaltsbeitritt zu scannen."*) / `android.permission.CAMERA` | Barcode-Scan (Produktsuche), QR-Code-Scan (Haushaltsbeitritt) | Optional — manuelle Eingabe des Barcodes bzw. Beitritt per Link/Code funktioniert ohne Kamera |
| Benachrichtigungen | `expo-notifications` (keine `NS*UsageDescription` nötig, iOS fragt zur Laufzeit) / `POST_NOTIFICATIONS` (Android 13+) | Lokale Erinnerung, wenn ein Kühlschrank-Artikel bald abläuft | Optional, rein lokal — kein Push-Server, keine externen Push-Tokens |

**Nicht angefragt** (bewusst kein Eintrag nötig): Mikrofon, Standort,
Kontakte, Fotomediathek, Bewegungsdaten, Kalender, Erinnerungen. Die
`expo-camera`-Konfiguration setzt zusätzlich `recordAudioAndroid: false` und
lässt `microphonePermission` bewusst weg — die App fragt kein Mikrofon an.

## Abgleich mit #96 (Datenschutzerklärung)

Diese Tabelle deckt sich mit den Kategorien in
[`docs/DATENSCHUTZ.md`](DATENSCHUTZ.md#welche-daten-verarbeitet-werden).
Ändert sich dort eine Kategorie oder ein Zweck, muss diese Datei — und die
tatsächliche Eingabe in App Store Connect / Play Console — im selben Zug
nachgezogen werden, sonst widersprechen sich Store-Label und Datenschutztext
(Ablehnungsgrund im Review).

## Offene Punkte vor der ersten Store-Einreichung

- [ ] Werte tatsächlich in App Store Connect ("App Privacy" Fragebogen) übertragen
- [ ] Werte tatsächlich in der Play Console ("Data Safety"-Formular) übertragen
- [ ] Sobald ein Crash-/Analytics-SDK dazukommt: diese Datei, `docs/DATENSCHUTZ.md`
      und beide Store-Formulare in einem Zug aktualisieren
