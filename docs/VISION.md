# NutriTrack — Produktvision

Ganzheitliche Organisation von Haushalt, Einkauf und Ernährung — vom gemeinsamen
Kühlschrank-Bestand über die geteilte Einkaufsliste bis zu Kalorien-Tracking und
Rezeptplanung. Für Einzelpersonen, Familien und WGs.

Im Zentrum steht ein **gemeinsamer Haushalt mit mehreren Accounts**: Alle Mitglieder
greifen in Echtzeit auf denselben Bestand und dieselbe Einkaufsliste zu, während
persönliche Gesundheitsdaten pro Account privat bleiben. Abgehakte Artikel wandern
beim Abschluss des Einkaufs direkt in den digitalen Kühlschrank.

---

## Korrekturen gegenüber der ursprünglichen Vision

Diese Punkte waren in der ersten Fassung so nicht umsetzbar. Sie sind hier bewusst
richtiggestellt, damit die Roadmap nichts verspricht, was die Architektur nicht hält.

| Ursprünglich geplant | Problem | Stattdessen |
|---|---|---|
| REWE-/EDEKA-API für Preisvergleich | Keine öffentlichen APIs; Scraping verstößt gegen die ToS beider Ketten und bricht bei jedem Layout-Wechsel | `PriceProvider`-Interface mit manueller Preiseingabe und Open Food Facts; echte Kette erst mit offiziellem Zugang ([#16](https://github.com/goldjunge91/fam/issues/16)) |
| `expo-apple-healthkit` | Paket existiert nicht auf npm | `@kingstinct/react-native-healthkit` (iOS), Health Connect (Android) ([#17](https://github.com/goldjunge91/fam/issues/17)) |
| `expo-in-app-purchases` | Deprecated, kein SDK-57-Build | RevenueCat oder `expo-iap` ([#23](https://github.com/goldjunge91/fam/issues/23)) |
| `expo-widgets` | Kein offizielles Expo-Paket | Native Targets (WidgetKit / Glance) via Config-Plugin ([#24](https://github.com/goldjunge91/fam/issues/24)) |
| E2E-Verschlüsselung der Gesundheitsdaten | E2EE und serverseitige Queries/RLS schließen sich aus — bei echter E2EE könnte der Server nicht filtern | TLS, Verschlüsselung at rest, Zugriffstrennung über RLS, Tokens im Keychain/Keystore ([#96](https://github.com/goldjunge91/fam/issues/96)) |
| `react-native-reusables` als Library | Ist eine Copy-Paste-Registry, keine Runtime-Dependency | Eigene Komponenten auf `theme.ts` |
| NativeWind | Stable 4.2.6 nicht für RN 0.86 / React 19; SDK-57-Variante nur als Preview | StyleSheet + `src/constants/theme.ts` |

Ebenfalls bewusst festgelegt: Die Konfliktauflösung ist **Last-Write-Wins**, kein CRDT.
Bei gleichzeitiger Bearbeitung gewinnt der spätere Schreibzugriff; Undo ist Aufgabe der UI.

---

## Kernfeatures

### Familie & Haushalt (Multi-Account)

Ein Nutzer erstellt einen Haushalt und wird Administrator; weitere Mitglieder treten per
Link, QR-Code oder Code bei. Es gibt Administratoren (verwalten Mitglieder und
Einstellungen) und Mitglieder. Kinder bekommen vereinfachte Profile ohne eigenen Account,
verwaltet durch ein Elternteil. Ein Account kann in mehreren Haushalten sein.

**Geteilt:** Kühlschrank-Bestand, Einkaufsliste, Meal-Planner, Rezept-Bibliothek,
Familien-Challenges.
**Privat:** Kalorien, Gewicht, Körpermaße, Ziele — technisch getrennt über RLS, nicht nur
in der UI ausgeblendet. Selbst ein Haushalts-Admin hat keinen Zugriff.

### Kühlschrank-Tracker

Digitaler Bestand für Kühlschrank, Gefrierfach und Vorratsschrank. Erfassung manuell oder
per Barcode-Scan, mit Mindesthaltbarkeitsdatum und Erinnerungen vor Ablauf. Der Verbrauch
wird beim Loggen einer Mahlzeit abgezogen, zur Neige gehende Artikel landen als Vorschlag
auf der Einkaufsliste. Ein Dashboard-Widget zeigt bald ablaufende Produkte, priorisiert zur
Verwendung — der direkte Hebel gegen Lebensmittelverschwendung.

### Einkaufsliste

Automatisch aus dem Meal-Plan generierbar, gruppiert nach Supermarkt-Bereichen, mit
Zusammenfassung gleicher Zutaten. Abhaken passiert in Echtzeit für alle Mitglieder
sichtbar. „Einkauf abschließen" überträgt alle abgehakten Artikel als neuen Bestand in den
Kühlschrank — nicht abgehakte Artikel bleiben ausdrücklich auf der Liste stehen.

Der Preisvergleich zwischen Ketten ist auf einen `PriceProvider` abstrahiert (siehe
Korrekturtabelle) und startet mit manueller Preiserfassung pro Filiale.

### Kalorienmanagement

Zielberechnung über Mifflin-St Jeor und Harris-Benedict aus Gewicht, Größe, Alter,
Geschlecht und Aktivitätslevel, daraus Gesamtumsatz und Zielkalorien je nach Vorhaben
(0,25–1 kg pro Woche). Makro-Verteilung mit Presets, frei anpassbar.

**Sicherheitsgrenze:** Das Kalorienziel fällt nie unter den Grundumsatz und nicht unter
anerkannte Mindestwerte. Bei zu aggressiven Zielen wird gekappt und der Nutzer darauf
hingewiesen — eine App, die zu einem gefährlichen Defizit rät, ist ein echtes Risiko.

**Offene fachliche Frage:** Beide Formeln kennen nur zwei Geschlechter. Für Nutzer, die
sich weder als männlich noch weiblich einordnen, gibt es keine validierte Formel. Vorgesehen
ist ein separates Feld „Berechnungsbasis" neben der Geschlechtsidentität oder ein manuell
gesetztes Ziel — kein stillschweigender Default.

### Ernährungstagebuch & Lebensmitteldatenbank

Erfassung nach Mahlzeit, Suche mit Auto-Vervollständigung, Liste häufig verwendeter
Produkte für kurze Time-to-first-log. Datenquelle ist Open Food Facts, gespiegelt in eine
eigene `products`-Tabelle — damit Suche und Offline-Zugriff nicht von einem fremden Dienst
abhängen. Die Daten sind crowdsourced und teils fehlerhaft, das Mapping prüft deshalb auf
Plausibilität statt blind zu übernehmen.

Nährwerte werden beim Speichern in den Tagebuch-Eintrag kopiert: Korrigiert jemand später
das Produkt, darf sich die Vergangenheit nicht rückwirkend ändern.

### Weitere Module

Rezept-Manager mit Nährwertberechnung und Portionsskalierung, Meal-Planner für die Woche,
Kochmodus mit Timern und `expo-keep-awake`, Aktivitäts- und Gewichts-Tracking,
Wasseraufnahme, Intervallfasten-Timer.

---

## Modulare Architektur

Jedes Modul ist unabhängig nutzbar. Nutzer aktivieren nur, was sie brauchen; nicht
aktivierte Module verschwinden aus der Navigation ([#95](https://github.com/goldjunge91/fam/issues/95)).
Dashboard und Profil sind nicht abwählbar.

**Core:** Benutzerverwaltung, Haushalt, Dashboard, Sync
**Ernährung:** Kalorienzähler, Nährwert-Analyzer, Barcode-Scanner, Lebensmittel-DB, Mahlzeiten-Builder
**Planung:** Meal-Planner, Einkaufsliste, Kühlschrank-Tracker, Koch-Modus, Rezept-Manager
**Tracking:** Aktivität, Hydration, Gewicht, Intervallfasten
**Analyse:** Progress-Analytics, Goal-Manager, Achievement-Center, Report-Generator

Für die Entwicklung heißt das: Module lassen sich parallel bauen, isoliert testen und
schrittweise über OTA-Updates ausrollen.

---

## Gamification

Bewusst **Phase 4**, nicht früher. Streaks, XP, Kategorie-Level und gestufte Achievements
(Bronze/Silber/Gold) mit Konfetti-Animationen und haptischem Feedback motivieren nur dann
sinnvoll, wenn die Datenbasis darunter stimmt — sonst belohnt das System Verhalten, das die
App noch gar nicht korrekt misst.

Die dafür nötigen Ereignisse (Mahlzeit geloggt, Gewicht eingetragen) fallen aber schon in
Phase 1 sauber als Events an, damit die Auswertung später nicht rekonstruiert werden muss.

Geplant sind außerdem Streak-Schutz („Freeze-Days"), wöchentliche Challenges und optionale
Familien-Challenges. Soziale Features bleiben opt-in und geben keine persönlichen Daten preis.

---

## Datenschutz

**Privacy by Design.** Persönliche Daten liegen primär lokal in `expo-sqlite`, Tokens
verschlüsselt im nativen Keychain/Keystore. Übertragung per TLS, Verschlüsselung at rest,
Zugriffstrennung über Row Level Security auf Datenbankebene.

Beim Logout werden die lokalen Daten gelöscht — sonst sähe ein zweiter Nutzer auf demselben
Gerät den Kühlschrank des ersten.

**Nutzerrechte:** vollständiger Datenexport als JSON (DSGVO Art. 20), kaskadierende
Account-Löschung, minimale Datenerhebung, transparente Store-Privacy-Labels.

Zur Verschlüsselungszusage siehe die Korrekturtabelle oben — die Datenschutzerklärung
beschreibt exakt das, was tatsächlich implementiert ist.

---

## Erfolgs-Metriken

**Nutzung:** Time-to-first-log, täglich und wöchentlich aktive Nutzer, Feature-Adoption pro Modul
**Gesundheit:** erreichte Gewichtsziele, getrackte Tage pro Woche, Retention nach 3/6/12 Monaten
**Technik:** App-Startzeit, erfolgreiche Offline-Nutzung und Synchronisation, Crash-Rate, Store-Rating

Detaillierte Fortschritts-Diagramme sind bewusst zurückgestellt: Sie können bei ausbleibendem
Fortschritt demotivierend wirken. Vor der Umsetzung wird das explizit entschieden
([#13](https://github.com/goldjunge91/fam/issues/13)).
