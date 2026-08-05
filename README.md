# 🥗 NutriTrack – Ganzheitlicher Ernährungs- & Gesundheitsplaner

## 🔍 Projektübersicht

**NutriTrack** ist eine datenschutzfreundliche, moderne **Expo/React-Native-App** für die **ganzheitliche Organisation von Haushalt, Einkauf und Ernährung** — vom gemeinsamen Kühlschrank-Bestand und der geteilten Einkaufsliste über Kalorien- und Bewegungstracking bis zur Rezeptplanung. Die Anwendung richtet sich an Einzelpersonen ebenso wie an Familien und Wohngemeinschaften, die ohne komplizierte Workflows oder intransparente Modelle ihren Alltag rund ums Essen digital organisieren möchten.

Im Zentrum steht ein **gemeinsamer Haushalt mit mehreren Accounts**: Familienmitglieder greifen in Echtzeit auf denselben Kühlschrank-Bestand und dieselbe Einkaufsliste zu, während persönliche Gesundheitsdaten wie Kalorien, Gewicht und Ziele privat pro Account bleiben. Die Einkaufsliste vergleicht dabei automatisch Preise verschiedener Supermärkte (REWE, EDEKA), und abgehakte Artikel wandern nach Abschluss des Einkaufs direkt in den digitalen Kühlschrank-Bestand.

Das Ziel ist eine **komplette Self-Tracking- und Haushalts-App**, die als native iOS- und Android-App über die App Stores installiert werden kann und umfassende Offline-Funktionalität unterstützt. Durch den Einsatz von Expo und Supabase entsteht eine performante, plattformübergreifende Anwendung mit echtem nativem Look & Feel, echter Echtzeit-Synchronisation zwischen Haushaltsmitgliedern und höchsten Datenschutzstandards.

### 🎮 **Gamification & Modulare Architektur**

**NutriTrack** nutzt spielerische Elemente zur langfristigen Motivation und verfügt über eine **vollständig modulare Architektur**, die es Nutzern ermöglicht, nur die gewünschten Features zu aktivieren. Jedes Modul kann unabhängig genutzt werden - von der einfachen Kalorienzählung bis hin zum kompletten Gesundheits-Tracking-System.

---

## 🎮 Gamification & Modulare Architektur

### **Spielerische Motivation durch Smart-Gamification**

#### **Achievement-System & Erfolgs-Animationen**

- **Dynamische Erfolgsmomente**: Animierte Belohnungen für erreichte Meilensteine (erstes eingetragenes Rezept, 7-Tage-Streak, Gewichtsziel erreicht) — umgesetzt mit `react-native-reanimated` und `lottie-react-native`
- **Progressive Achievements**: Gestufte Erfolge von Bronze über Silber bis Gold (z.B. 10, 50, 100 Tage konsequentes Tracking)
- **Überraschungsmomente**: Unerwartete Belohnungen für besondere Leistungen (perfekte Makroverteilung, neue Sportart ausprobiert)
- **Visuelle Feiern**: Konfetti-Animationen (`react-native-confetti-cannon`), Erfolgs-Popups und motivierende Nachrichten bei wichtigen Fortschritten
- **Haptisches Feedback**: `expo-haptics` für spürbares Feedback bei Erfolgen und Interaktionen

#### **Streak-System & Konsistenz-Belohnungen**

- **Tägliche Streaks**: Aufbau von Gewohnheiten durch kontinuierliches Tracking
- **Verschiedene Streak-Kategorien**: Ernährung, Bewegung, Wasseraufnahme, Gewichtseingabe
- **Streak-Schutz**: "Freeze-Days" für Urlaub oder besondere Umstände
- **Wöchentliche Challenges**: Kleine, erreichbare Ziele (5x diese Woche Sport, täglich 2L Wasser)
- **Lokale Erinnerungen**: `expo-notifications` für tägliche Streak-Erinnerungen, auch bei geschlossener App

#### **Level-System & Erfahrungspunkte**

- **Benutzer-Level**: Aufstieg durch konsequente Nutzung und erreichte Ziele
- **Kategorie-Level**: Separate Level für Ernährung, Sport, Kochen etc.
- **Erfahrungspunkte (XP)**: Points für jede Aktivität (Mahlzeit loggen = 10 XP, Workout = 25 XP, Rezept kochen = 15 XP)
- **Level-Belohnungen**: Freischaltung neuer Features oder Anpassungsoptionen

#### **Soziale Gamification (Optional)**

- **Freunde-Challenges**: Wöchentliche Herausforderungen mit Freunden
- **Leaderboards**: Anonyme Ranglisten für verschiedene Kategorien
- **Team-Goals**: Gemeinsame Ziele in kleinen Gruppen
- **Success-Sharing**: Teilen von Erfolgen über die native Share-Sheet (`expo-sharing`), ohne Preisgabe persönlicher Daten

### **Vollständig Modulare Architektur**

#### **Core-Module (Basis)**

- **Benutzerverwaltung**: Authentication, Profile, Grundeinstellungen
- **👨‍👩‍👧‍👦 Familie/Haushalt**: Einrichtung eines gemeinsamen Haushalts mit mehreren Accounts (siehe Details unten)
- **Dashboard**: Zentrale Übersicht und Navigation (Tab-Navigation via Expo Router)
- **Datenschutz & Sync**: Lokale Speicherung und optionale Cloud-Synchronisation

#### **Ernährungs-Module**

- **🧮 Kalorienzähler**: Basis-Tracking mit Tageszielen
- **📊 Nährwert-Analyzer**: Detaillierte Makro-/Mikronährstoff-Analyse  
- **🔍 Barcode-Scanner**: Produkterkennung via native Kamera (`expo-camera`)
- **📋 Lebensmittel-DB**: Umfangreiche Produktdatenbank mit Offline-Support
- **🍽️ Mahlzeiten-Builder**: Eigene Rezepte und Mahlzeiten-Kompositionen

#### **Planungs-Module**

- **📅 Meal-Planner**: Wöchentliche Essensplanung
- **🛒 Shopping-List**: Intelligente Einkaufslisten-Generierung mit Supermarkt-Preisvergleich (REWE, EDEKA)
- **🧊 Kühlschrank-Tracker**: Digitale Bestandsverwaltung von Kühlschrank und Vorratsschrank
- **👨‍🍳 Koch-Modus**: Schritt-für-Schritt Kochanleitungen, optimiert für „Screen-stays-on"-Modus (`expo-keep-awake`)
- **📖 Rezept-Manager**: Eigene Rezeptsammlung mit Kategorisierung

#### **Tracking-Module**

- **🏃 Activity-Tracker**: Bewegung und Sport-Logging, inkl. nativer Pedometer-Anbindung (`expo-sensors`)
- **💧 Hydration-Tracker**: Wasseraufnahme-Monitoring
- **⚖️ Weight-Tracker**: Gewichts- und Körpermaße-Verfolgung
- **⏱️ Intermittent-Fasting**: Fasten-Timer und -Protokolle, mit Hintergrund-Timer via Notifications

#### **Analyse-Module**

- **📈 Progress-Analytics**: Langzeit-Trends und Vorhersagen
- **🎯 Goal-Manager**: Flexible Zielsetzung und -verfolgung
- **🏆 Achievement-Center**: Gamification und Belohnungssystem
- **📊 Report-Generator**: Detaillierte Gesundheitsberichte

#### **Modulare Vorteile**

**Für Benutzer:**

- **Individuelle Anpassung**: Nur gewünschte Features aktivieren
- **Schrittweise Einführung**: Langsamer Einstieg mit einem Modul, Erweiterung nach Bedarf
- **Übersichtlichkeit**: Keine überladene Benutzeroberfläche
- **Performance**: Bessere App-Performance durch weniger aktive Module

**Für Entwicklung:**

- **Unabhängige Entwicklung**: Module können parallel entwickelt werden
- **Einfache Wartung**: Isolierte Fehlerbehebung und Updates
- **Flexible Deployment**: Schrittweise Einführung neuer Features über OTA-Updates (`expo-updates`)
- **Testing**: Separate Test-Suites pro Modul
- **Code-Qualität**: Klare Trennung der Verantwortlichkeiten

#### **Smart-Modul-Aktivierung**

- **Onboarding-Wizard**: Intelligente Empfehlung basierend auf Nutzerzielen
- **Bedarfs-Erkennung**: Automatische Vorschläge für hilfreiche Module
- **Ein-Klick-Aktivierung**: Sofortige Verfügbarkeit ohne App-Neustart
- **Modul-Tutorials**: Interaktive Einführung in neue Features

---

## 🛠️ Technologie-Stack

| **Kategorie** | **Technologie** | **Zweck** |
|---------------|-----------------|-----------|
| **Frontend** | Expo (React Native, SDK 57), Expo Router, TypeScript, NativeWind | Native iOS/Android-UI mit typsicherem, plattformübergreifendem Code |
| **UI-Komponenten** | `react-native-reusables` / eigene Komponenten-Library | Wiederverwendbare, an NativeWind angepasste UI-Bausteine |
| **Backend & Datenbank** | Supabase (Postgres, Auth, Realtime, Storage, Edge Functions) | Managed Backend statt eigenem Server: Datenbank, Login, Echtzeit-Sync, Datei-Storage und Server-Funktionen aus einer Hand |
| **Client-Anbindung** | `@supabase/supabase-js` | Typsicherer Zugriff auf Datenbank, Auth und Realtime direkt aus der App |
| **Lokale Persistenz/Offline** | `expo-sqlite` (lokaler Cache) + Sync-Layer zu Supabase | Offline-Fähigkeit; lokale Änderungen werden bei Wiederverbindung mit Supabase abgeglichen |
| **Authentication** | Supabase Auth (Email/Passwort, später Social-Login) | Sichere Authentifizierung inkl. Row-Level-Security-Anbindung für Haushalte |
| **Realtime-Sync** | Supabase Realtime (Postgres Changes) | Echtzeit-Synchronisation von Haushaltsdaten (Kühlschrank, Einkaufsliste) zwischen Familienmitgliedern |
| **Zugriffskontrolle** | Postgres Row Level Security (RLS) | Trennung von privaten Nutzerdaten und geteilten Haushaltsdaten direkt auf DB-Ebene |
| **Server-Funktionen** | Supabase Edge Functions (Deno) | Für Aufgaben, die serverseitig laufen müssen (z.B. REWE/EDEKA-Preisabfrage, Push-Trigger) |
| **Native APIs** | `expo-camera`, `expo-notifications`, `expo-sensors`, `expo-haptics`, `expo-sharing`, `expo-location` | Zugriff auf Kamera, Push-Benachrichtigungen, Sensoren, Standort u.v.m. |
| **Supermarkt-Integration** | REWE-API/EDEKA-API bzw. Produktdaten-Scraper (über Edge Functions) | Preis- und Angebotsvergleich für die Einkaufsliste |
| **Build & Deployment** | EAS Build, EAS Submit, EAS Update | Cloud-Builds, App-Store/Play-Store-Submission, OTA-Updates |
| **Code Quality** | Biome | Linting und Code-Formatierung |

> **Warum Supabase statt Next.js + oRPC?** Das Haushalts-/Kühlschrank-Feature braucht Echtzeit-Datenaustausch zwischen mehreren Nutzern sowie feingranulare Zugriffsrechte (privat vs. Haushalt). Supabase liefert das (Postgres Realtime + Row Level Security) sowie Auth und Storage direkt mit, ohne dass ihr ein eigenes API-Layer, eigene WebSocket-Logik oder ein eigenes Auth-System bauen müsst. Ein eigener Next.js-Server entfällt dadurch komplett; nur für vereinzelte serverseitige Spezialaufgaben (z.B. Supermarkt-Preisabfrage) kommen schlanke Edge Functions zum Einsatz.

---

## 💡 Kernfeatures (Detaillierte Beschreibung)

### 👨‍👩‍👧‍👦 **1. Familie & Haushalt (Multi-Account)**

#### **Haushalt einrichten**

- **Haushalt erstellen**: Ein Nutzer erstellt einen Haushalt und wird automatisch Administrator
- **Mitglieder einladen**: Einladung weiterer Personen per Link, QR-Code oder E-Mail; Beitritt über eigenen Account
- **Rollen & Rechte**: Unterscheidung zwischen Administrator (verwaltet Haushalt, Mitglieder, Einstellungen) und Mitglied (nutzt geteilte Funktionen)
- **Kinder-Profile**: Vereinfachte Profile für Kinder ohne eigene Account-Anmeldung, verwaltet durch ein Elternteil
- **Mehrere Haushalte**: Ein Account kann bei Bedarf Mitglied in mehreren Haushalten sein (z.B. eigener Haushalt + Eltern-Haushalt)

#### **Geteilte Funktionen im Haushalt**

- **Gemeinsamer Kühlschrank-Bestand**: Alle Mitglieder sehen und bearbeiten denselben Kühlschrank/Vorrat in Echtzeit
- **Gemeinsame Einkaufsliste**: Zentrale Einkaufsliste, die von jedem Mitglied ergänzt und abgehakt werden kann
- **Gemeinsamer Meal-Planner**: Wochenplanung für den ganzen Haushalt, mit Zuordnung einzelner Mahlzeiten zu bestimmten Mitgliedern
- **Rezept-Bibliothek**: Im Haushalt geteilte, selbst erstellte Rezepte
- **Familien-Challenges**: Gemeinsame Gamification-Ziele (z.B. „Diese Woche 5x gemeinsam gekocht") ergänzend zu den individuellen Streaks

#### **Individuelle Daten bleiben privat**

- **Persönliches Tracking getrennt**: Kalorien, Gewicht, Körpermaße und Gesundheitsdaten bleiben pro Account privat und werden nicht automatisch mit anderen Haushaltsmitgliedern geteilt
- **Granulare Freigaben**: Einzelne Mitglieder können optional bestimmte Fortschritte (z.B. Streaks, Achievements) für Familien-Challenges freigeben
- **Getrennte Ziele**: Jedes Mitglied behält eigene Kalorien-, Gewichts- und Aktivitätsziele, unabhängig vom Haushalt

#### **Synchronisation**

- **Echtzeit-Updates**: Änderungen an geteilten Daten (Kühlschrank, Einkaufsliste) werden nahezu in Echtzeit an alle Haushaltsgeräte übertragen
- **Konfliktauflösung**: Klare Regeln bei gleichzeitigen Änderungen (z.B. letzter Schreibzugriff gewinnt, mit Undo-Möglichkeit)
- **Offline-Fähigkeit**: Änderungen im Offline-Modus werden lokal gespeichert und bei Wiederverbindung synchronisiert

### 🛒 **2. Intelligente Einkaufsliste mit Supermarkt-Vergleich**

- **Automatische Generierung**: Erstellung basierend auf geplantem Meal Plan
- **Kategorisierung**: Gruppierung nach Supermarkt-Bereichen (Gemüse, Fleisch, etc.)
- **Mengenoptimierung**: Intelligente Zusammenfassung gleicher Zutaten
- **Multi-Supermarkt-Preisvergleich**: Anbindung an REWE- und EDEKA-Produktdaten (Preise, Verfügbarkeit, Angebote) über die jeweiligen APIs bzw. gescrapte Produktkataloge
- **Sortierung nach Anbieter**: Ansicht der Liste sortiert nach günstigstem Gesamtpreis, nach Supermarkt gruppiert oder als gemischte „Bester-Preis-pro-Artikel"-Liste
- **Angebots-Highlighting**: Kennzeichnung aktueller Rabattaktionen (z.B. REWE-„Wochenangebote", EDEKA-Prospekt-Deals) für Artikel auf der Liste
- **Filial-Auswahl**: Auswahl der bevorzugten Filiale je Kette für lokal korrekte Preise und Verfügbarkeiten (Standort via `expo-location`)
- **Fallback bei fehlenden Daten**: Generische Kategorisierung, falls für ein Produkt keine Supermarkt-Zuordnung verfügbar ist
- **Offline-Verfügbarkeit**: Einkaufsliste funktioniert auch ohne Internetverbindung (lokale SQLite-Datenbank), Preisdaten werden bei der letzten Synchronisation zwischengespeichert
- **Abhak-Funktion**: Digitales Abhaken während des Einkaufs, geteilt in Echtzeit mit allen Haushaltsmitgliedern
- **„Einkauf abschließen"-Button**: Schließt den Einkaufsvorgang ab und überträgt alle abgehakten Artikel automatisch als neuen Bestand in den Kühlschrank-Tracker
- **Nicht erhaltene Artikel bleiben stehen**: Nicht abgehakte Artikel werden beim Abschließen **nicht** gelöscht, sondern verbleiben auf der Einkaufsliste für den nächsten Einkauf

### 🎯 **3. Zielgerichtetes Kalorienmanagement**

#### **Wunschgewicht-Rechner & Intelligente Zielberechnung**

- **Persönliches Profil erstellen**: Nutzer geben aktuelles Gewicht, Wunschgewicht, Körpergröße, Geschlecht, Alter und Aktivitätslevel ein
- **Automatische Kalorienberechnung**: Basierend auf bewährten Formeln (Harris-Benedict, Mifflin-St Jeor) wird der Grund- und Gesamtumsatz berechnet
- **Flexible Zieloptionen**: Gewichtsabnahme, -zunahme oder -erhalt mit anpassbaren Geschwindigkeiten (0,25-1kg pro Woche)
- **Dynamische Anpassung**: Das Kalorienziel passt sich automatisch an Gewichtsveränderungen und Fortschritte an
- **Makronährstoff-Verteilung**: Intelligente Vorschläge für Protein-, Kohlenhydrat- und Fettverteilung basierend auf Zielen und Präferenzen

#### **Intelligentes Ernährungstagebuch**

- **Schnelle Mahlzeiterfassung**: Optimiert für Touch-Eingabe mit intuitiver, nativer Benutzeroberfläche
- **Smart-Search mit Auto-Vervollständigung**: Intelligente Suche in der Lebensmitteldatenbank mit Lernfunktion basierend auf Nutzerhistorie
- **Umfangreiche Lebensmitteldatenbank**:
  - Integration von Open Food Facts (über 2 Millionen Produkte)
  - Optionale API-Anbindung an deutsche Supermärkte (REWE, EDEKA, etc.)
  - Lokale Datenbank (`expo-sqlite`) für häufig verwendete Lebensmittel (Offline-Fähigkeit)
- **Flexible Portionsgrößen**: Eingabe in verschiedenen Einheiten (Gramm, Stück, Tassen, etc.) mit automatischer Umrechnung
- **Häufige Lebensmittel**: Personalisierte Liste der am häufigsten verwendeten Produkte für schnellen Zugriff

#### **Barcode-Scanner Integration**

- **Native Kamera-Anbindung**: Direkte Nutzung der Gerätekamera über `expo-camera` (Barcode-Scanning-API)
- **Offline-Scanner**: Gespeicherte Barcodes können auch ohne Internetverbindung erkannt werden
- **Produkterkennung**: Automatisches Abrufen von Nährwertinformationen und Hinzufügen zum Tagebuch
- **Portionsanpassung**: Nach dem Scannen direkte Möglichkeit zur Portionsanpassung
- **Berechtigungs-Handling**: Sauberer Umgang mit iOS/Android-Kamera-Permissions inkl. Fallback-UI

#### **Detaillierte Nährwertanalyse**

- **Makronährstoffe**: Echtzeitanzeige von Proteinen, Kohlenhydraten, Fetten und Ballaststoffen
- **Mikronährstoffe**: Tracking wichtiger Vitamine und Mineralien (optional konfigurierbar)
- **Individuelle Anpassungen**: Nutzer können in Einstellungen bestimmen, welche Nährstoffe angezeigt werden
- **Prozentuale Tagesverteilung**: Visuelle Darstellung der aktuellen Nährstoffaufnahme vs. Tagesziele (native Chart-Komponenten, z.B. `victory-native` oder `react-native-svg`-basiert)
- **Nährstoff-Timing**: Analyse der Nährstoffverteilung über den Tag (Frühstück, Mittagessen, etc.)

### 📊 **4. Fortschritt & Motivation**

#### **Visuelles Dashboard mit Gamification**

- **Tagesübersicht**: Übersichtliche Darstellung aller wichtigen Metriken auf einen Blick
- **Kalorienbilanz**: Verbleibende Kalorien, verbrauchte Kalorien durch Bewegung, Nettokalorienaufnahme
- **Animierte Fortschrittskreise**: Spielerische Kreisdiagramme für Kalorien- und Makronährstoffziele mit Füllanimationen (`react-native-reanimated` + `react-native-svg`)
- **Live-Achievements**: Einblendung von Erfolgen in Echtzeit (z.B. "🎉 Tagesziel erreicht!") als native Toast/Overlay
- **Streak-Counter**: Prominente Anzeige aktueller Erfolgsserien mit visuellen Belohnungen
- **Motivations-Center**: Personalisierte Ermutigung und nächste Ziele basierend auf Nutzerverhalten
- **Level-Anzeige**: Aktueller Benutzer-Level mit Fortschrittsbalken zum nächsten Level
- **XP-Counter**: Echtzeitanzeige der heute verdienten Erfahrungspunkte
- **Widgets (später)**: iOS/Android Homescreen-Widgets für Tagesfortschritt (`expo-widgets` / native Module)

#### **Langzeit-Tracking & Spielerische Erfolgsvisualisierung**

- **Gewichtsverlauf**: Detaillierte Diagramme mit Trendlinien, Vorhersagen und Meilenstein-Markierungen
- **Körpermaße**: Tracking von Brust-, Taillen-, Hüftumfang mit visuellen Fortschritts-Belohnungen
- **Kalorienbilanz-Historie**: Visualisierung der Kalorienbilanz über Wochen und Monate mit Erfolgs-Highlights
- **Achievement-Timeline**: Chronologische Darstellung aller erreichten Erfolge und Meilensteine
- **Streak-Historie**: Visualisierung der längsten und aktuellen Erfolgsserien mit Rekord-Markierungen
- **Nährstoff-Trends**: Langzeitanalyse mit "Perfekte-Woche"-Auszeichnungen für optimale Nährstoffverteilung
- **Progress-Celebrations**: Automatische Feiern bei wichtigen Fortschritten (10% Gewichtsziel erreicht, etc.)
- **Milestone-Rewards**: Besondere Belohnungen für große Erfolge (6 Monate Tracking, Zielgewicht erreicht)
- **Flexible Zeiträume**: Tages-, Wochen-, Monats- und Jahresansichten mit jahresüberspannenden Challenges
- **Datenexport**: Möglichkeit zum Export der Daten (CSV/PDF) über die native Share-Sheet (später)

#### **Wasseraufnahme-Tracking**

- **Einfache Eingabe**: Ein-Tap-Buttons für verschiedene Trinkgefäßgrößen
- **Individuelle Ziele**: Berechnung des täglichen Wasserbedarfs basierend auf Körpergewicht und Aktivität
- **Erinnerungen**: Sanfte lokale Push-Benachrichtigungen zur Wasseraufnahme (`expo-notifications`)
- **Visualisierung**: Animierte Wasserflasche oder Glas als Fortschrittsanzeige

### 🏃 **5. Bewegungs- und Aktivitätstracking**

#### **Manuelle Aktivitätseingabe**

- **Umfangreiche Aktivitätsdatenbank**: Hunderte von Sportarten und Alltagsaktivitäten mit MET-Werten
- **Flexible Eingabe**: Zeit-, Distanz- oder intensitätsbasierte Eingaben
- **Intensitätsstufen**: Anpassbare Intensitätslevel für genauere Kalorienverbrauchsberechnung
- **Aktivitätskategorien**: Gruppierung nach Cardio, Krafttraining, Alltagsaktivitäten, etc.

#### **Automatische Integration (Optional)**

- **Fitness-Tracker-Sync**: API-Integration mit Fitbit, Garmin, Apple Health, Google Fit
- **Native Health-Anbindung**: `expo-apple-healthkit` (iOS) bzw. Health Connect (Android) für direkten Zugriff auf Gesundheitsdaten
- **Schrittzähler**: Nutzung von `expo-sensors` (Pedometer) für Schrittzählung direkt auf dem Gerät
- **Herzfrequenz-Daten**: Import von Herzfrequenzdaten für präzisere Kalorienberechnung
- **Schlaftracking**: Integration von Schlafdaten (beeinflusst Kalorienbedarf)

#### **Kalorienverbrauch-Integration**

- **Dynamische Anpassung**: Verbrauchte Kalorien werden automatisch zum Tagesbudget hinzugefügt
- **Sport-Ernährungs-Balance**: Visualisierung des Verhältnisses von aufgenommenen zu verbrauchten Kalorien
- **Trainingsplanung**: Empfehlungen für Kalorienaufnahme vor/nach dem Training

### 🍽️ **6. Rezepte & Essensplanung**

#### **Intelligente Rezeptdatenbank**

- **Umfangreiche Sammlung**: Hunderte gesunder Rezepte mit vollständigen Nährwertangaben
- **Smart-Filter**: Filterung nach Zielen (Low-Carb, High-Protein, vegan, etc.), Allergien und Unverträglichkeiten
- **Schwierigkeitsgrade**: Rezepte für Anfänger bis Fortgeschrittene
- **Zubereitungszeit**: Filter nach verfügbarer Kochzeit (15 Min, 30 Min, etc.)
- **Saisonale Rezepte**: Empfehlungen basierend auf saisonalen Zutaten

#### **Eigene Rezepte erstellen**

- **Rezept-Builder**: Einfache Erstellung eigener Rezepte mit automatischer Nährwertberechnung
- **Portionsanpassung**: Automatische Skalierung von Zutaten und Nährwerten
- **Foto-Upload**: Eigene Rezeptfotos direkt über Kamera oder Bibliothek hinzufügen (`expo-image-picker`)
- **Bewertungssystem**: Persönliche Bewertung und Notizen zu Rezepten
- **Rezept-Sharing**: Teilen von Rezepten innerhalb der Community (optional) über die native Share-Sheet

#### **Wöchentlicher Meal Planner**

- **Touch-optimiertes Interface**: Intuitive Wochenplanung durch Ziehen/Antippen von Rezepten in Tagesboxen (`react-native-gesture-handler`)
- **Automatische Nährwertberechnung**: Tagesweise Übersicht der geplanten Nährstoffaufnahme
- **Meal Prep Optimierung**: Gruppierung von Rezepten mit ähnlichen Zutaten
- **Wiederverwendbare Pläne**: Speichern und Wiederverwenden erfolgreicher Wochenpläne
- **Flexibilität**: Einfaches Verschieben und Anpassen von Mahlzeiten

#### **Kühlschrank-Tracking**

- **Digitaler Bestand**: Erfassung vorhandener Lebensmittel in Kühlschrank, Gefrierfach und Vorratsschrank
- **Schnelle Erfassung**: Hinzufügen per Barcode-Scan (`expo-camera`), Sprache oder manueller Suche in der Lebensmitteldatenbank
- **Automatische Übernahme aus dem Einkauf**: Beim Abschließen eines Einkaufs (über den „Einkauf abschließen"-Button) werden alle abgehakten Artikel der Einkaufsliste automatisch als neuer Bestand in den Kühlschrank-Tracker übernommen — inkl. Mengen und, falls vorhanden, Mindesthaltbarkeitsdatum aus der Produktdatenbank
- **Ablaufdatum-Tracking**: Erfassung des Mindesthaltbarkeitsdatums pro Artikel, inkl. Erinnerungen (`expo-notifications`) bevor Produkte ablaufen
- **Mengen-Verwaltung**: Verbrauch wird beim Loggen einer Mahlzeit automatisch vom Kühlschrank-Bestand abgezogen
- **Automatischer Einkaufslisten-Abgleich**: Fehlende oder zur Neige gehende Artikel werden automatisch zur Einkaufsliste vorgeschlagen
- **„Was kann ich kochen?"**: Rezeptvorschläge basierend auf tatsächlich vorhandenem Kühlschrank-Bestand, um Lebensmittelverschwendung zu reduzieren
- **Ablaufende-Artikel-Übersicht**: Dashboard-Widget mit bald ablaufenden Produkten, priorisiert zur Verwendung
- **Haushalts-weite Sichtbarkeit**: Bestand ist für alle Mitglieder des Familien-Haushalts sichtbar und wird in Echtzeit synchronisiert

#### **Kochmodus**

- **Schritt-für-Schritt Anleitung**: Großformatige, kochfreundliche Ansicht
- **Timer-Integration**: Automatische Timer für verschiedene Kochschritte mit Hintergrund-Benachrichtigung
- **Hands-free Navigation**: Sprachsteuerung oder große Touch-Bereiche
- **Bildschirm bleibt an**: `expo-keep-awake` verhindert, dass der Bildschirm beim Kochen ausgeht
- **Portionsanpassung**: Live-Anpassung der Zutatenmengen während des Kochens

### ⏱️ **7. Intervallfasten-Tracker (Optional)**

#### **Flexible Fastenprotokolle**

- **Voreingestellte Methoden**: 16:8, 18:6, 20:4, 5:2, OMAD und weitere
- **Individuelle Pläne**: Erstellung eigener Fastenpläne
- **Adaptive Planung**: Anpassung an Lebensstil und Termine

#### **Fasten-Timer & Tracking**

- **Visueller Countdown**: Ansprechende Darstellung der verbleibenden Fastenzeit
- **Phasen-Anzeige**: Verschiedene Fastenphasen mit körperlichen Vorteilen
- **Flexibilität**: Start/Stop-Funktionen für spontane Anpassungen
- **Hintergrund-Benachrichtigungen**: Erinnerung beim Erreichen wichtiger Fastenphasen, auch bei geschlossener App
- **Historie**: Übersicht aller Fastenepisoden mit Statistiken

---

## 🔒 Datenschutz & Sicherheit

### **Privacy by Design**

- **Lokale Datenspeicherung**: Alle persönlichen Daten werden primär lokal in `expo-sqlite` gespeichert
- **Sicherer Speicher**: Sensible Daten (Tokens, Zugangsdaten) werden über `expo-secure-store` verschlüsselt im nativen Keychain/Keystore abgelegt
- **Verschlüsselung**: End-to-End-Verschlüsselung sensibler Gesundheitsdaten bei der Cloud-Synchronisation
- **Minimale Datensammlung**: Nur absolut notwendige Daten werden erfasst
- **Transparenz**: Vollständige Offenlegung der Datenverwendung (App-Store-Datenschutzangaben, „App Privacy" Label)

### **Benutzerrechte**

- **Datenportabilität**: Vollständiger Export aller Benutzerdaten
- **Löschrecht**: Einfache und vollständige Datenlöschung
- **Anonymisierung**: Option zur anonymen Nutzung ohne Registrierung
- **Open Source**: Transparenter Code für vollständige Nachvollziehbarkeit

---

## 📱 Native App-Erfahrung (iOS & Android)

### **Echte native Integration**

- **App-Store & Play-Store-Distribution**: Vollwertige native Apps statt Web-Installation
- **iOS- & Android-Design-Sprache**: Plattformspezifische Anpassungen über Expo Router und native Komponenten
- **Gestensteuerung**: Native Gesten und Interaktionen via `react-native-gesture-handler`
- **System-Integration**: Status-Bar, Safe-Area, Dark-Mode und Dynamic-Type-Unterstützung über `expo-status-bar` / `react-native-safe-area-context`
- **Push-Benachrichtigungen**: Echte Remote- und lokale Push-Notifications über `expo-notifications`
- **Deep Linking**: Universal Links / App Links über Expo Router für Rezepte, Challenges und Freigaben

### **Offline-Funktionalität**

- **Lokale SQLite-Datenbank**: Vollständige Offline-Fähigkeit für alle Kernfunktionen über `expo-sqlite`
- **Hintergrund-Synchronisation**: Automatische Synchronisation bei Wiederverbindung (`expo-background-task`)
- **Asset-Caching**: Bilder und statische Inhalte werden lokal zwischengespeichert
- **Progressive Enhancement**: Graceful Degradation bei schlechter Verbindung

### **Performance-Optimierung**

- **Lazy Loading**: Intelligentes Laden von Inhalten und Screens über Expo Router
- **Optimistic Updates**: Sofortige UI-Updates mit nachträglicher Synchronisation
- **Bildoptimierung**: Automatische Komprimierung und Format-Auswahl (`expo-image`)
- **OTA-Updates**: Schnelle Bugfix- und Feature-Rollouts ohne erneute Store-Freigabe über `expo-updates`
- **Native Build-Performance**: New Architecture (Fabric/TurboModules) für maximale Performance

---

## 🚀 Entwicklungsphasen

### **Phase 1: MVP (Minimum Viable Product)**

- Expo-Setup (SDK 57 Default-Template), EAS Build-Konfiguration für iOS & Android
- **👨‍👩‍👧‍👦 Familie/Haushalt**: Haushalt erstellen, Mitglieder einladen, Rollen (Admin/Mitglied), geteilte vs. private Daten
- **🧊 Kühlschrank-Tracker**: Digitaler Bestand, manuelle & Barcode-Erfassung, Ablaufdatum-Tracking, Haushalts-weite Echtzeit-Sichtbarkeit
- Basis-Kalorienzähler mit Lebensmitteldatenbank
- Einfaches Ernährungstagebuch
- Grundlegendes Dashboard

### **Phase 2: Core Features**

- Barcode-Scanner (`expo-camera`)
- Einkaufsliste mit Kühlschrank-Sync (Einkauf abschließen → Bestand übernehmen)
- Rezeptdatenbank
- Fortschritts-Tracking
- Erweiterte Nährwertanalyse
- Push-Benachrichtigungen

### **Phase 3: Advanced Features**

- Meal Planner
- Supermarkt-Preisvergleich (REWE, EDEKA) in der Einkaufsliste
- Aktivitätstracking inkl. Health-Kit/Health-Connect-Integration
- Intervallfasten-Features
- API-Integrationen

### **Phase 4: Community & Erweiterungen**

- Rezept-Sharing
- Community-Features
- Erweiterte Analytics
- Premium-Features (In-App-Purchases via `expo-in-app-purchases` / RevenueCat)
- Homescreen-Widgets

---

## 📈 Erfolgs-Metriken

### **Benutzerfreundlichkeit & Engagement**

- **Time-to-first-log**: Zeitdauer bis zur ersten Mahlzeit-Eingabe
- **Täglich aktive Nutzer**: Regelmäßige App-Nutzung
- **Wöchentliche Nutzung**: Konsistenz in der Anwendung
- **Feature-Adoption-Rate**: Anteil der Nutzer, die verschiedene Module aktivieren

### **Gamification-Erfolg**

- **Achievement-Unlock-Rate**: Prozentsatz der freigeschalteten Erfolge pro Nutzer
- **Streak-Durchschnitt**: Mittlere Länge der Erfolgsserien
- **Level-Progression**: Durchschnittliche Level-Entwicklung der Nutzer
- **XP-pro-Session**: Durchschnittliche Erfahrungspunkte pro App-Besuch
- **Challenge-Completion-Rate**: Anteil abgeschlossener wöchentlicher Challenges
- **Retention durch Gamification**: Einfluss spielerischer Elemente auf Nutzer-Verweildauer

### **Gesundheitserfolg**

- **Gewichtsziele erreicht**: Prozentsatz der Nutzer, die ihr Wunschgewicht erreichen
- **Konsistenz im Tracking**: Durchschnittliche Anzahl getrackte Tage pro Woche
- **Makronährstoff-Ziel-Erfüllung**: Anteil der Tage mit optimal erreichten Makrozielen
- **Langzeit-Engagement**: Nutzer-Retention nach 3, 6 und 12 Monaten

### **Technische Performance**

- **Load Times**: App-Startzeiten und Screen-Wechsel-Geschwindigkeit
- **Offline-Funktionalität**: Erfolgreiche Offline-Nutzung und Synchronisation
- **Modul-Performance**: Ladezeiten einzelner Module
- **Crash-Rate**: Technische Stabilität der modularen Architektur (z.B. via Sentry)
- **Store-Install-Rate & Rating**: App-Store/Play-Store-Downloads und Bewertungen

<!-- * **Fortschritts-Tracking:** Visuelle Diagramme für Gewicht, Körpermaße und Kalorienbilanz, optimiert für die mobile Ansicht. --> später oder gar nicht frustration für den User

---

This project is bootstrapped from the official **Expo default template (SDK 57)** and connects to **Supabase** as its backend (Postgres, Auth, Realtime, Storage, Edge Functions) — no self-hosted API server required.

## Features

- **TypeScript** - For type safety and improved developer experience
- **Expo SDK 57** - Cross-platform native app runtime for iOS & Android
- **Expo Router** - File-based navigation for React Native
- **NativeWind** - Utility-first styling (Tailwind syntax) for React Native
- **Supabase** - Managed backend: Postgres database, Auth, Realtime (Live-Sync), Storage, Edge Functions
- **Row Level Security** - Fine-grained access control for personal vs. household data
- **`expo-sqlite`** - Local cache/offline layer, synced with Supabase
- **Biome** - Linting and formatting
- **EAS** - Cloud builds, OTA-Updates und Store-Submission

## Getting Started

### 1. Projekt initialisieren

Das Projekt startet mit dem offiziellen Expo-Default-Template (SDK 57):

```bash
bun create expo --template default@sdk-57
```

### 2. Abhängigkeiten installieren

```bash
bun install
bun add @supabase/supabase-js
```

### 3. Supabase-Projekt anlegen

1. Neues Projekt unter [supabase.com](https://supabase.com) erstellen (Postgres-Datenbank, Auth und Realtime sind sofort dabei)
2. `SUPABASE_URL` und `SUPABASE_ANON_KEY` in eine `.env`-Datei im Projekt-Root eintragen
3. Datenbankschema (Tabellen für Households, Household-Members, Fridge-Items, Shopping-List-Items, Recipes, ...) über Supabase-Migrationen (`supabase/migrations`) anlegen
4. Row-Level-Security-Policies definieren: private Nutzerdaten (Kalorien, Gewicht) nur für den jeweiligen Account, Haushaltsdaten (Kühlschrank, Einkaufsliste) für alle Mitglieder des jeweiligen `household_id`

### 4. Supabase-Client einrichten

Ein zentraler, typsicherer Supabase-Client (`lib/supabase.ts`) wird app-weit verwendet, inkl. `expo-secure-store` als Storage-Adapter für die Auth-Session.

### 5. App starten

```bash
bun start
```

Press `i` to open the iOS Simulator, `a` for the Android Emulator, or scan the QR code with the Expo Go app on your physical device.

## Project Structure

Startpunkt (direkt nach `bun create expo`):

```
my-nutri-app/
├── app/              # Expo Router Screens & Layouts
├── assets/
├── app.json
├── package.json
└── ...
```

**Empfohlene Best-Practice-Struktur** (Single-Package, kein Monorepo nötig, da kein eigener Server-Code):

```
my-nutri-app/
├── app/                          # Expo Router: Screens & Layouts (nur Routing/UI-Komposition)
│   ├── (auth)/                   # Login, Registrierung, Onboarding
│   ├── (tabs)/                   # Haupt-Tabs: Dashboard, Kühlschrank, Einkaufsliste, Rezepte, Profil
│   │   ├── index.tsx
│   │   ├── fridge.tsx
│   │   ├── shopping-list.tsx
│   │   ├── recipes.tsx
│   │   └── profile.tsx
│   ├── household/                # Haushalt anlegen/verwalten, Mitglieder einladen
│   └── _layout.tsx
│
├── src/
│   ├── features/                 # Fachliche Module, jeweils in sich geschlossen
│   │   ├── household/            # Haushalts-/Familien-Logik
│   │   │   ├── components/
│   │   │   ├── hooks/            # z.B. useHousehold(), useHouseholdMembers()
│   │   │   ├── api.ts            # Supabase-Queries für diese Domäne
│   │   │   └── types.ts
│   │   ├── fridge/                # Kühlschrank-Tracking
│   │   ├── shopping-list/         # Einkaufsliste inkl. Supermarkt-Vergleich
│   │   ├── nutrition/              # Kalorien, Ernährungstagebuch
│   │   ├── recipes/
│   │   ├── activity/
│   │   └── gamification/          # Streaks, Achievements, XP, Level
│   │
│   ├── components/                # Geteilte, dumme UI-Komponenten (Button, Card, ProgressRing, ...)
│   ├── lib/
│   │   ├── supabase.ts            # Zentraler Supabase-Client
│   │   ├── db/                    # expo-sqlite Setup, lokales Caching/Offline-Queue
│   │   └── notifications.ts       # expo-notifications Setup
│   ├── hooks/                     # App-weite, feature-übergreifende Hooks
│   ├── stores/                    # Globaler Client-State (z.B. Zustand), nicht Server-State
│   ├── constants/                 # Farben, Spacing, Config
│   └── utils/
│
├── supabase/
│   ├── migrations/                 # SQL-Migrationen (Tabellen, RLS-Policies)
│   └── functions/                  # Edge Functions (z.B. rewe-price-lookup, edeka-price-lookup)
│
├── assets/
├── app.json
├── eas.json
└── package.json
```

**Prinzipien dahinter:**

- **`app/` bleibt schlank**: Nur Routing und Zusammensetzen von Screens aus Feature-Komponenten, keine Business-Logik
- **Feature-first statt Type-first**: Jedes Modul (`household`, `fridge`, `shopping-list`, ...) enthält seine eigenen Components, Hooks und Supabase-Queries — passt direkt zur modularen Architektur des Projekts und lässt sich unabhängig weiterentwickeln
- **Supabase-Zugriff zentral kapseln**: Alle Supabase-Calls laufen über `api.ts`-Dateien pro Feature, nicht verstreut in Komponenten — erleichtert später z.B. den Wechsel einzelner Queries auf Edge Functions
- **`supabase/` als Source of Truth fürs Schema**: Migrationen und RLS-Policies werden versioniert im Repo gepflegt, nicht nur im Supabase-Dashboard geändert

## Reproduce

```bash
bun create expo --template default@sdk-57
```
