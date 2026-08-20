# Walkthrough: UI-Abschnittskommentare für alle Screen-Dateien

In allen Feature-Screen-Dateien der App wurden klare, prägnante JSX/TSX-Abschnittskommentare hinzugefügt, die beschreiben, was die jeweiligen UI-Blöcke anzeigen.

---

## 📂 Aktualisierte Screen-Dateien

### 1. Authentifizierung (`src/features/auth/`)
- [forgot-password-screen.tsx](file:///Users/marco/Github.tmp/family_app/fam/src/features/auth/forgot-password-screen.tsx): Bestätigungskarte, E-Mail-Eingabe, Sende-Button, Zurück-Aktion.
- [reset-password-screen.tsx](file:///Users/marco/Github.tmp/family_app/fam/src/features/auth/reset-password-screen.tsx): Passwort- und Bestätigungsfeld, Fehleranzeige, Absende-Button.
- [sign-in-screen.tsx](file:///Users/marco/Github.tmp/family_app/fam/src/features/auth/sign-in-screen.tsx): E-Mail/Passwort-Felder, OAuth-Buttons (Apple/Google), Registrierungs-Link.
- [sign-up-screen.tsx](file:///Users/marco/Github.tmp/family_app/fam/src/features/auth/sign-up-screen.tsx): E-Mail-Verifizierungsbanner, Registrierungsformular, OAuth-Buttons, Datenschutzhinweis.

### 2. Kalorien-Tracking & Dashboard (`src/features/calorie-tracking/` & `src/features/dashboard/`)
- [diary-screen.tsx](file:///Users/marco/Github.tmp/family_app/fam/src/features/calorie-tracking/diary-screen.tsx): Profil-Chips, Datumsnavigation, Kalorienring/Stats, Makro-Balken, GLP-1/Fasten-Karten, Mahlzeiten-Abschnitte.
- [add-food-entry-screen.tsx](file:///Users/marco/Github.tmp/family_app/fam/src/features/calorie-tracking/add-food-entry-screen.tsx): Kindprofil-Selector, Produkt-Hero/Nutri-Score, Makro-Werte, Mengen-Stepper, Einheiten-Chips, Aktionsbuttons.
- [food-search-screen.tsx](file:///Users/marco/Github.tmp/family_app/fam/src/features/calorie-tracking/food-search-screen.tsx): Suchleiste & Barcode-Scanner-Button, Filter-Chips, Ergebnisliste / Historie, Schnelleintrag, Barcode-Modal.
- [goal-setup-screen.tsx](file:///Users/marco/Github.tmp/family_app/fam/src/features/calorie-tracking/goal-setup-screen.tsx): Profil-Hinweis, Zielart-Segmentierung, Raten-Input, Makro-Presets & Slider, Live-Kalorienziel-Vorschau.
- [dashboard-screen.tsx](file:///Users/marco/Github.tmp/family_app/fam/src/features/dashboard/dashboard-screen.tsx): Dashboard-Kartenliste mit Pull-to-Refresh & Reordering, Karten-Galerie Bottom-Sheet.

### 3. Haushalt (`src/features/household/`)
- [child-profiles-screen.tsx](file:///Users/marco/Github.tmp/family_app/fam/src/features/household/child-profiles-screen.tsx): Aufklappbares Erstellformular, Geschlechtsauswahl, Profilliste, Bearbeitungskarte.
- [create-household-screen.tsx](file:///Users/marco/Github.tmp/family_app/fam/src/features/household/create-household-screen.tsx): Haushaltsname-Eingabe, Erstellen-Button, Beitritts-Shortcut.
- [join-household-screen.tsx](file:///Users/marco/Github.tmp/family_app/fam/src/features/household/join-household-screen.tsx): Einladungscode-Eingabe, Fehleranzeige, Beitreten-Button.
- [members-screen.tsx](file:///Users/marco/Github.tmp/family_app/fam/src/features/household/members-screen.tsx): Haushalts-Switcher, Admin-Shortcuts, Mitgliederliste, Verlassen/Löschen-Aktionen, Einladungsmodal.

### 4. Vorrat & Einkaufsliste (`src/features/inventory/` & `src/features/shopping-list/`)
- [inventory-screen.tsx](file:///Users/marco/Github.tmp/family_app/fam/src/features/inventory/inventory-screen.tsx): Vorratsübersichtskarte, Lagerort-Tabs & Suche, Sortierung, virtualisierte Artikelliste, Aktionsblätter & Produktdetail-Modal.
- [add-item-screen.tsx](file:///Users/marco/Github.tmp/family_app/fam/src/features/inventory/add-item-screen.tsx): Produktsuche & Barcode-Scan, Filter-Chips, Schnellzugriff häufiger Produkte, Mengen-/Lagerort-Auswahl, Details-Toggle.
- [add-product-screen.tsx](file:///Users/marco/Github.tmp/family_app/fam/src/features/inventory/add-product-screen.tsx): Produktname/Marke, Nährwerte pro 100g, Portionsgröße.
- [storage-locations-screen.tsx](file:///Users/marco/Github.tmp/family_app/fam/src/features/inventory/storage-locations-screen.tsx): Formular für neue Lagerorte, Liste bestehender Lagerorte mit Umbenennen/Löschen.
- [shopping-list-screen.tsx](file:///Users/marco/Github.tmp/family_app/fam/src/features/shopping-list/shopping-list-screen.tsx): Markt-Kacheln, Gesamtpreis-Schätzung, kategorisierte Artikelliste des aktiven Markts, Sortierungs- und Bearbeitungs-Sheets.
- [stores-screen.tsx](file:///Users/marco/Github.tmp/family_app/fam/src/features/shopping-list/stores-screen.tsx): Markt-Erstellungsformular mit Presets & Farbpalette, Marktliste mit Inline-Editor.

### 5. Essensplaner & Rezepte (`src/features/meal-planner/` & `src/features/recipes/`)
- [meal-planner-screen.tsx](file:///Users/marco/Github.tmp/family_app/fam/src/features/meal-planner/meal-planner-screen.tsx): Ansichtsmodus-Tabs, Zeitraumnavigation, Vorwochen-Aktionen, Wochenraster (WeekGrid), Rezept-Picker & Portionsmodals.
- [missing-ingredients-screen.tsx](file:///Users/marco/Github.tmp/family_app/fam/src/features/meal-planner/missing-ingredients-screen.tsx): Premium-Paywall-Hinweis, Zutatenliste mit Vorratsabgleich, Übertrags-Button für Einkaufsliste.
- [recipes-screen.tsx](file:///Users/marco/Github.tmp/family_app/fam/src/features/recipes/recipes-screen.tsx): Filtersuche & Filter-Modal, Tab-Leiste (Entdecken vs. Favoriten), Kategorien- & Kalorienkarussells, Mahlzeiten-Reihen, Haushaltsrezepte.
- [recipe-detail-screen.tsx](file:///Users/marco/Github.tmp/family_app/fam/src/features/recipes/recipe-detail-screen.tsx): Hero-Artwork, Fakten-Header, Details- vs. Bewertungs-Tabs, Zutaten mit Portionsstepper, Nährwerttabelle, Zubereitungsschritte, Floating Kochmodus-Button, Verwalten-Modal.
- [recipe-create-screen.tsx](file:///Users/marco/Github.tmp/family_app/fam/src/features/recipes/recipe-create-screen.tsx): 4-stufiger Wizard-Balken, Schritt 1 (Basisdaten), Schritt 2 (Zutaten & Gruppen), Schritt 3 (Zubereitungsschritte mit Bildern), Schritt 4 (Vorschau & Speichern).
- [cooking-mode-screen.tsx](file:///Users/marco/Github.tmp/family_app/fam/src/features/recipes/cooking-mode-screen.tsx): Basis-Kochansicht (Free), Schritt-für-Schritt-Ablauf mit Timer & Artwork, Fertigstellungs-Screen mit Wiege-/Tagebuch-Shortcuts.
- [recipe-log-screen.tsx](file:///Users/marco/Github.tmp/family_app/fam/src/features/recipes/recipe-log-screen.tsx): Mahlzeiten-Filter, Gramm-Eingabefelder für Komponenten, Live-Nährwertvorschau, Übernahme ins Tagebuch.
- [recipe-template-detail-screen.tsx](file:///Users/marco/Github.tmp/family_app/fam/src/features/recipes/templates/recipe-template-detail-screen.tsx): Vorlagen-Artwork mit Badge, Metadaten-Pills, Zutaten mit Portionsrechner, Zubereitungsschritte, Übernahme-Button.

### 6. Profil, Onboarding & Premium (`src/features/onboarding/`, `src/features/profile/`, `src/features/premium/`)
- [onboarding-flow.tsx](file:///Users/marco/Github.tmp/family_app/fam/src/features/onboarding/onboarding-flow.tsx): Navigationsleiste mit Fortschrittsbalken, Schritte 1–7 (Willkommen, Account, Profil, Haushalt, Module, Berechtigungen, Abschluss).
- [profile-hub-screen.tsx](file:///Users/marco/Github.tmp/family_app/fam/src/features/profile/profile-hub-screen.tsx): Avatar-Header mit Initialen, Navigations-Kacheln (Account-Daten, Tracking, Familie).
- [edit-profile-screen.tsx](file:///Users/marco/Github.tmp/family_app/fam/src/features/profile/edit-profile-screen.tsx): Profilbild-Upload & -Löschung, Name & E-Mail, Passwortänderung.
- [tracking-screen.tsx](file:///Users/marco/Github.tmp/family_app/fam/src/features/profile/tracking-screen.tsx): Tracking-Methoden (CICO, GLP-1, Fasten, Keto, etc.), Tagesziel- & Makro-Kacheln, Vitalwerte (Größe, Gewicht, BMR & TDEE), Tagesstart-Uhrzeit, Biometrie-Modal.
- [premium-screen.tsx](file:///Users/marco/Github.tmp/family_app/fam/src/features/premium/premium-screen.tsx): Kronen-Hero-Banner, Feature-Vorteile, aktiver Abo-Status / Paywall-Kauf & Wiederherstellen-Buttons.

### 7. Einstellungen & Dev-Tools (`src/features/settings/`)
- [settings-screen.tsx](file:///Users/marco/Github.tmp/family_app/fam/src/features/settings/settings-screen.tsx): Schnellzugriff-Header (Profil & Premium), Menügruppen (Tracking, Haushalt, App, Daten, Entwickler), Abmelden-Aktion, Version.
- [notifications-screen.tsx](file:///Users/marco/Github.tmp/family_app/fam/src/features/settings/notifications-screen.tsx): Ablauf-Warnungen, Schwellenwerte & Uhrzeiten.
- [privacy-screen.tsx](file:///Users/marco/Github.tmp/family_app/fam/src/features/settings/privacy-screen.tsx): Datenschutz-Abschnitte (Verschlüsselung, Daten, Drittanbieter, Rechte).
- [module-settings-screen.tsx](file:///Users/marco/Github.tmp/family_app/fam/src/features/settings/module-settings-screen.tsx): Toggles für App-Module (Vorrat, Einkauf, Tagebuch, Rezepte, Meal-Planner).
- [meal-planner-settings-screen.tsx](file:///Users/marco/Github.tmp/family_app/fam/src/features/settings/meal-planner-settings-screen.tsx): Umrechnungsfaktor für Portionen pro Person.
- [export-screen.tsx](file:///Users/marco/Github.tmp/family_app/fam/src/features/settings/export-screen.tsx): DSGVO-Datenexport-Hinweis & Export-Button.
- [delete-account-screen.tsx](file:///Users/marco/Github.tmp/family_app/fam/src/features/settings/delete-account-screen.tsx): Warnhinweis & Lösch-Button mit 2-Schritt-Bestätigung.
- [sync-settings-screen.tsx](file:///Users/marco/Github.tmp/family_app/fam/src/features/settings/sync-settings-screen.tsx): Sync-Statusanzeige, manuelle Synchronisation, Verweis zur Diagnose.
- [sync-debug-screen.tsx](file:///Users/marco/Github.tmp/family_app/fam/src/features/settings/sync-debug-screen.tsx): Letzter Sync-Lauf, Realtime-Latenz, Push/Scanner-Live-Tests, SQLite-Tabellen, Outbox-Inspektion.
- [dev-tools-screen.tsx](file:///Users/marco/Github.tmp/family_app/fam/src/features/settings/dev/dev-tools-screen.tsx): Umgebungsinfos, Session-Details, SQLite-Status, OFF-Dump-Status, Test-Aktionen (Sentry, Push, EAS Observe, DB-Wipe).
- [liquid-glass-lab-screen.tsx](file:///Users/marco/Github.tmp/family_app/fam/src/features/settings/dev/liquid-glass-lab-screen.tsx): Glas-Verfügbarkeitsstatus, expo-glass-effect Buttons, native SwiftUI Glass-Buttons, ContextMenu, Menü-Varianten, Typografie-Vergleich.

---

## 🧪 Verifikation

- **Biome Linter & Formatter (`bun run check`):** 426 Dateien geprüft, 0 Fehler.
- **TypeScript Typecheck (`bun run typecheck`):** Erfolgreich ohne Fehler (`tsc --noEmit`).
- **Unit Tests (`bun run test`):** Alle 87 Test-Suiten bestanden (666 Tests bestanden).
