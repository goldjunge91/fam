# Scrappy Web & Legal Pages

Dieses Verzeichnis enthält die statische Website für Scrappy (Landingpage, Datenschutzerklärung, AGB und Support/Impressum), optimiert für **Cloudflare Pages**.

## Dateien

* `index.html` — Moderne, responsive Landingpage im warmen Scrappy-Look.
* `datenschutz.html` — DSGVO- und Apple-konforme Datenschutzerklärung (deckt Supabase, AdMob, RevenueCat, Sentry, PostHog, Open Food Facts ab).
* `agb.html` — Allgemeine Geschäftsbedingungen & EULA (inkl. Haftungsausschluss für Haltbarkeitsdaten und In-App-Abo-Klauseln).
* `support.html` — Support-Kontakt, FAQ und Impressum nach § 5 DDG.
* `styles.css` — Leichtgewichtiges CSS ohne externe Abhängigkeiten.

## Cloudflare Pages Deployment (Schritt-für-Schritt)

1. Im **Cloudflare Dashboard** einloggen.
2. Zu **Workers & Pages** ➔ **Create application** ➔ **Pages** ➔ **Connect to Git** navigieren.
3. Dieses Repository (`family_app` / `fam`) auswählen.
4. **Build-Einstellungen festlegen:**
   * **Project name:** `scrappy-app`
   * **Production branch:** `main` (bzw. dein aktueller Branch)
   * **Framework preset:** `None`
   * **Root directory:** `/website`
   * **Build command:** *(leer lassen)*
   * **Build output directory:** `.` *(oder leer lassen)*
5. Auf **Save and Deploy** klicken.
6. Unter **Custom Domains**:
   * Zunächst z. B. `scrappy.tozzi-test.de` hinzufügen zum Testen.
   * Später `scrappy-app.de` als primäre Domain hinzufügen.
