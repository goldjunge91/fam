# Profil — Mockup v2

Vollständiges Mockup-Set für `src/features/profile/`, im fam-Verlauf-Look (Violett → Magenta → Gold auf dunklem Grund, dazu Hellmodus über den Umschalter oben).

- Datei: [`profile-mockup.html`](./profile-mockup.html)

## Prinzip

Das Mockup bildet **strikt und ausschließlich** die im Code definierten Screens, Sheets, Modals und Komponenten aus `src/features/profile/` ab:

| Bereich | Daten & Kennzahlen im Mockup |
|---|---|
| **Nutzeridentität** | Max Mustermann (`max.mustermann@example.de`), Avatar mit Initialen `MM` |
| **Ernährungsregeln** | Allergien (Glutenhaltiges Getreide, Erdnüsse), Unverträglichkeiten (Laktose), Mag ich nicht (Koriander, Rosenkohl) |
| **Tracking-Methode** | CICO (Klassisch), GLP-1 & Medikation, Intervallfasten, Low-Carb, Keto, Kraftsport, Blutzucker & CGM, Volumetrics |
| **Ziele & Makros** | 2.150 kcal Tagesziel · 145g Protein · 210g Carbs · 65g Fett |
| **Biometrie** | 182 cm · 78,4 kg · Männlich · 34 J. (18.04.1992) · Mäßig aktiv · BMR 1.765 kcal · TDEE 2.427 kcal |
| **Rhythmus** | Tagesstart 04:00 Uhr mit Stepper (-1h/+1h) und Schicht-Presets (00:00, 04:00, 06:00, 14:00, 22:00) |

---

## Abdeckung (14 Mockup-Slots in 4 Gruppen)

| # | Mockup | Quelle im Code |
|---|---|---|
| **Gruppe 1** | **Profil-Hub** | |
| 1 | Profil-Hub (`/profile`) | `src/features/profile/profile-hub-screen.tsx` (`ProfileHubScreen`) |
| 2 | Profil-Hub, leer / neu | ebd., Guard ohne gesetzten Namen („Ohne Namen“), Initialen `ON` |
| **Gruppe 2** | **Profil & Account bearbeiten** | |
| 3 | Profil & Account (`/profile/edit`) | `src/features/profile/edit-profile-screen.tsx` (`EditProfileScreen`) |
| 4 | Profil & Account, Fehlerzustand | ebd., Feld-Fehlermeldung & `formError` Banner |
| 5 | Profil & Account mit Biometrie | `src/features/profile/edit-profile-screen.android.tsx` (`BiometricsSummary`) |
| **Gruppe 3** | **Sheets & Modals zu Profil & Account** | |
| 6 | Passwort ändern | `src/features/profile/sheets/password-change-sheet.tsx` (`PasswordChangeSheet`) |
| 7 | Passwort ändern, Fehler | ebd., Validierungsfehler & Fehlermeldungen |
| 8 | Allergien auswählen | `src/features/profile/sheets/food-rule-selection-sheet.tsx` (Presets & Checkboxen) |
| 9 | Unverträglichkeiten auswählen | ebd., Presets: Laktose, Fruktose, Sorbit, Zöliakie |
| 10 | Mag ich nicht ergänzen | ebd., Freitext-Eingabe, Button & Liste mit Text-Link „Entfernen“ |
| **Gruppe 4** | **Mein Tracking** | |
| 11 | Mein Tracking (`/profile/tracking`) | `src/features/profile/tracking-screen.tsx` (`TrackingScreen`) |
| 12 | Mein Tracking, leer | ebd., Initialzustand („Nicht festgelegt“, „–“, „Kein Log“) |
| 13 | Tagesstart festlegen Modal | ebd., `TimePicker` Modal (HH:MM Eingabe) |
| 14 | Biometrie bearbeiten Modal | ebd., Modal mit Größe, Geschlecht, Geburtsdatum, Aktivitätslevel |

---

## Interaktionsmerkmale

- **Theme-Umschalter:** Umschalten zwischen Dunkelmodus und Hellmodus.
- **Formular-Details:** Sichbare Passwort-Maskierung mit Auge-Icon (`eye` / `eye.slash`), segmentierte Stepper, Schicht-Chips, Dropdown-Menüs und Checkbox-Markierungen.
- **Scroll-Container:** Jeder Smartphone-Frame (292 × 616 px) verfügt über einen unabhängigen, scrollbaren Inhaltsbereich.
