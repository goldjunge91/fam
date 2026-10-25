# Release-Checkliste: Externe Vorbereitungen (Off-App)

> **Fokus:** Alle Voraussetzungen für den App Store Release, die **außerhalb des App-Codes** liegen (Rechtliches, Website, App Store Connect, Metadaten).
> **Projekt:** Scrappy (vormals fam)
> **Plattform:** iOS App Store (Bundle-ID: `com.goldjunge91.fam1`)

---

## Übersicht & Fortschritt

| Bereich | Aufgabe | Status | Notwendig für |
| :--- | :--- | :--- | :--- |
| **1. Web & Hosting** | Öffentliche Landingpage für Legal/Support | `BEREIT (in /website)` | App Store Pflichtlinks |
| **2. Rechtliches** | Datenschutzerklärung (Privacy Policy) | `BEREIT (in website/datenschutz.html)` | App Store Review (Guideline 5.1.1) |
| **3. Rechtliches** | Nutzungsbedingungen / AGB (EULA) | `BEREIT (in website/agb.html)` | App Store / In-App-Käufe |
| **4. Support** | Support-Seite / Kontakt & Impressum | `BEREIT (in website/support.html)` | App Store Pflichtlink |
| **5. Store Connect** | Developer Verträge (Tax & Banking) | `OFFEN` | Monetarisierung / RevenueCat |
| **6. Store Connect** | App Privacy Fragebogen (Datenschutzangaben) | `OFFEN` | App Store Review |
| **7. Store Connect** | Store-Texte (Titel, Subtitle, Keywords) | `ENTWURF VORHANDEN` | App Store Eintrag |
| **8. Review Setup** | Demo-Account für Apple Reviewer | `OFFEN` | App Review Prüfung |
| **9. Creative Assets** | App Icon (1024x1024) & Screenshots | `OFFEN` | Store-Präsenz |

---

## 1. Website & Hosting (Die Basis für alle Pflicht-URLs)

Cloudflare Application `fam` mit Custom Domain auf `tozzi-test.de` ist live und aktiv:

* **Landingpage:** `https://scrappy.tozzi-test.de`
* **Datenschutzerklärung (Privacy Policy):** `https://scrappy.tozzi-test.de/datenschutz`
* **Nutzungsbedingungen & AGB (EULA):** `https://scrappy.tozzi-test.de/agb`
* **Support & Impressum:** `https://scrappy.tozzi-test.de/support`
*(Sobald `scrappy-app.de` registriert ist, kann diese als zusätzliche Domain auf denselben Worker gelegt werden.)*

---

## 2. Datenschutzerklärung (Privacy Policy)

Eine Vorlage existiert bereits in `docs/architecture/DATENSCHUTZ.md`. Diese muss für den öffentlichen Webauftritt formatiert und mit deinen Betreiberdaten befüllt werden.

* [ ] **Betreiberangaben ergänzen:** Name, Anschrift, E-Mail-Adresse.
* [ ] **Eingebundene Drittanbieter transparent aufführen:**
  * **Supabase** (EU/Frankfurt – Auth, Datenbank, Storage)
  * **Google AdMob** (Werbenetzwerk in der Free-Version, ATT & UMP-Consent)
  * **RevenueCat** (Abonnement- & In-App-Kaufverwaltung)
  * **Sentry** (Fehlerberichte & Crash Analytics)
  * **PostHog & Aptabase** (Nutzungsanalyse / Produktverbesserung)
  * **Open Food Facts** (Barcode- & Produktsuche)
* [ ] **DSGVO-Rechte des Nutzers erklären:**
  * Recht auf Auskunft & Datenexport (JSON).
  * Recht auf vollständige Kontolöschung direkt in der App.
* [ ] **Öffentliche URL verifizieren:** Link muss im Browser mobil und am Desktop ohne Fehler laden.

---

## 3. Nutzungsbedingungen & AGB (EULA)

Insbesondere bei In-App-Abonnements (RevenueCat) und werbefinanzierten Apps zwingend erforderlich.

* [ ] **EULA-Modell wählen:**
  * Option A: Apple Standard EULA (Standard-Endbenutzer-Lizenzvereinbarung von Apple). Das reicht für die meisten Indie-Apps.
  * Option B: Eigene Nutzungsbedingungen (regelt Gewährleistungsausschluss, Verlässlichkeit von Haltbarkeitsdaten/Nährwertangaben, Account-Regeln).
* [ ] **Wichtige Klausel für Anti-Waste / Lebensmittel:**
  * *Haftungsausschluss für Mindesthaltbarkeitsdaten:* Klarstellung, dass die App nur der Erinnerung dient und der Nutzer Lebensmittel stets selbst sensorisch prüfen muss (Geruch, Aussehen, Geschmack).
* [ ] **Abo-Bedingungen (Auto-Renewable Subscriptions):**
  * Hinweis auf Kündigungsfristen, Abrechnung über den Apple ID Account, Verlängerung.

---

## 4. Support-Seite & Impressum

Apple prüft, ob Nutzer bei Problemen einen echten Kontakt finden.

* [ ] **Support-Kontakt:** Eine funktionierende Support-E-Mail (z. B. `support@...` oder Kontaktformular).
* [ ] **Häufige Fragen (FAQ kurz):**
  * Wie funktioniert die Haushaltsfreigabe?
  * Wie stelle ich meine Käufe wieder her (Restore Purchases)?
  * Wie lösche ich mein Konto?
* [ ] **Impressum:** Anbieterkennzeichnung nach deutschem Recht (§ 5 DDG).

---

## 5. App Store Connect Vorbereitung

### 5.1 Account & Verträge
* [ ] Apple Developer Program Mitgliedschaft aktiv.
* [ ] **Agreements, Tax and Banking:** In App Store Connect unter „Verträge“ die Vereinbarung für *Paid Applications* abschließen (Steuer- und Bankdaten hinterlegen). Ohne dies können keine In-App-Käufe/Abos freigeschaltet werden.

### 5.2 App Privacy (Datenschutzfragebogen)
In App Store Connect müssen folgende SDK-Datensammlungen deklariert werden:
* [ ] **AdMob:** Kennungen (Geräte-ID, Werbe-ID), Nutzungsdaten (Interaktion mit Werbung), Diagnosedaten.
* [ ] **Supabase:** Kontaktinformationen (E-Mail), Benutzerinhalte (Haushalt, Einkaufsliste, Vorrat).
* [ ] **Sentry:** Diagnosedaten (Absturzdaten, Performance).
* [ ] **PostHog / Aptabase:** Produktinteraktion, Nutzungsdaten.
* [ ] **Standort (Coarse Location):** Falls die Prospekte-Funktion aktiv bleibt.

### 5.3 Metadaten & App-Texte
* [ ] **Name:** `Scrappy` (ggf. mit Zusatz: `Scrappy – Vorrat & Einkauf`, max. 30 Zeichen).
* [ ] **Untertitel:** z. B. `Lebensmittel retten & planen` (max. 30 Zeichen).
* [ ] **Keywords:** z. B. `vorrat,einkaufsliste,lebensmittel,haltbarkeit,kühlschrank,mhd,rezepte,reste` (max. 100 Zeichen).
* [ ] **Altersfreigabe-Fragebogen:** Wahrheitsgemäß beantworten (in der Regel 4+ oder 9+ bei unmoderierten Web-Inhalten/Prospekten).

---

## 6. Reviewer Demo-Account

Apple testet jede App vor der Freigabe manuell.

* [ ] **Dedizierten Testnutzer anlegen:**
  * In Supabase einen sauberen Test-Account erstellen (z. B. `apple-review@deinedomain.de`).
  * Dem Account bereits ein paar beispielhafte Testdaten spendieren (2–3 Artikel auf der Einkaufsliste, 2 Artikel im Vorrat mit Ablaufdatum), damit der Reviewer nicht auf einem leeren Bildschirm startet.
* [ ] **Reviewer-Notizen formulieren:**
  * Zugangsdaten (E-Mail & Passwort).
  * Kurze Erklärung zur App (z. B. „Hinweis: Für Push-Nachrichten und Kamera bitte Berechtigungen erlauben, um Barcode-Scan zu testen.“).

---

## 7. Creative Assets (Icons & Screenshots)

* [ ] **App Store Icon:** 1024 × 1024 px PNG (RGB, kein Alpha/Transparenz).
* [ ] **Screenshots planen:**
  * Mindestens 3–5 Screenshots für 6,7" iPhone (z. B. 1290 × 2796 px).
  * Motive:
    1. *Vorrat im Blick* (Ablaufdaten & Ampelsystem)
    2. *Gemeinsame Einkaufsliste* (Haushaltssync)
    3. *Reste verwerten* (Rezepte & Essensplaner)
    4. *Barcode-Scan / Schnell hinzufügen*
