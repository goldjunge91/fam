# NutriTrack — Funktions- und Architekturdiagramme

Diese Dokumentation bietet eine visuelle Übersicht über die Systemarchitektur, Datenmodelle, Workflows und Sicherheitsgrenzen der **NutriTrack (`fam`)** App.

---

## 1. System- & Schichtenarchitektur (High-Level Overview)

NutriTrack folgt einem **Local-First / Offline-First** Ansatz auf Basis von Expo (React Native) und SQLite, synchronisiert über eine Outbox-Engine mit Supabase.

```mermaid
flowchart TB
  subgraph Client["Mobile Client (Expo SDK 57 / React Native 0.86)"]
    subgraph Presentation["Presentation & Routing (Expo Router)"]
      UI["UI Screens & Components\n(Tailwind / NativeWind / Theme Tokens)"]
      Hooks["Feature Hooks & State\n(React Query / Zustand)"]
    end

    subgraph LocalStorage["Local-First Persistence"]
      SQLite[("Local SQLite Database\n(expo-sqlite Mirror)")]
      Outbox[("Sync Outbox Queue\n(_sync_outbox)")]
      SecureStore["SecureStore / Keychain\n(Auth Tokens & Session)"]
    end

    subgraph SyncEngine["Sync Layer (src/lib/sync)"]
      SyncRunner["Sync Runner\n(Coalesce, Push, Pull, Clock)"]
      RealtimeClient["Supabase Realtime Subscriber"]
    end
  end

  subgraph Backend["Supabase Backend (PostgreSQL + GoTrue)"]
    GoTrue["GoTrue Auth Service"]
    PostgresDB[("PostgreSQL Database\n(Declarative Schemas)")]
    RLS["Row Level Security (RLS)\n(Isolations-Engine)"]
    RealtimeEngine["Supabase Realtime Engine\n(WebSocket WAL Broadcasts)"]
    EdgeFuncs["Supabase Edge Functions\n(z. B. revenuecat-webhook)"]
    Storage["Supabase Storage\n(Recipe Images)"]
  end

  subgraph External["Externe Services"]
    OFF["Open Food Facts API\n(Produktsuche & Nährwerte)"]
    RC["RevenueCat\n(In-App Purchases & Subscriptions)"]
  end

  UI --> Hooks
  Hooks --> SQLite
  Hooks --> Outbox
  Outbox --> SyncRunner
  SyncRunner -->|HTTP POST Push| RLS
  RLS --> PostgresDB
  PostgresDB --> RealtimeEngine
  RealtimeEngine -->|WebSocket Events| RealtimeClient
  RealtimeClient -->|Incremental Pull| SyncRunner
  SyncRunner -->|Write Mirror| SQLite
  SQLite --> Hooks

  UI -->|Barcode oder Suche| OFF
  UI -->|Purchase Flow| RC
  RC -->|Webhook Event| EdgeFuncs
  EdgeFuncs -->|Set premium_active| PostgresDB
  UI -->|Auth Flow| GoTrue
  UI -->|Rezeptbilder| Storage
```

---

## 2. Datentrennungs- & RLS-Sicherheitsmodell

Kernpfeiler von NutriTrack ist die strikte Trennung von **geteilten Haushaltsdaten** und **privaten Gesundheitsdaten** auf Datenbankebene (Supabase Row Level Security). Selbst Haushalts-Administratoren haben keinen Zugriff auf private Trackingdaten anderer Mitglieder.

```mermaid
flowchart LR
  subgraph HouseholdPerimeter["Geteilter Haushaltsbereich (Shared Household Perimeter)"]
    direction TB
    H["households\n(Name, Premium-Status)"]
    HM["household_members\n(Rollen: admin, member)"]
    SL["storage_locations\n(Kühlschrank, Vorrat, Tiefkühler)"]
    FI["fridge_items\n(Geteilter Bestand mit MHD)"]
    ST["stores\n(Märkte & Laufstrecken-Sortierung)"]
    SLI["shopping_list_items\n(Geteilte Einkaufsliste)"]
    REC["recipes & recipe_components\n(Gemeinsame Rezepte)"]
    MP["meal_plans & entries\n(Wochenplanungen)"]
    HI["household_invites\n(Einladungscodes)"]

    H --- HM
    H --- SL
    H --- FI
    H --- ST
    H --- SLI
    H --- REC
    H --- MP
    H --- HI
  end

  subgraph PrivatePerimeter["Privater Nutzerbereich (Private User Perimeter)"]
    direction TB
    P["profiles\n(E-Mail, BMR/TDEE Zielwerte)"]
    CP["child_profiles\n(Verwaltete Kinder-Profile)"]
    FE["food_entries\n(Ernährungstagebuch, Kcal, Makros)"]
    WE["weight_entries\n(Gewichtsverlauf)"]

    P --- CP
    P --- FE
    P --- WE
  end

  RLS_Check{{"PostgreSQL RLS Gate"}}
  
  User["Authentifizierter Nutzer"] --> RLS_Check
  RLS_Check -->|is_household_member| HouseholdPerimeter
  RLS_Check -->|auth.uid = user_id| PrivatePerimeter
```

---

## 3. Authentifizierung, Onboarding & Haushalts-Lifecycle

Der Benutzerfluss von der ersten Registrierung über das Profil-Onboarding bis zur Erstellung oder dem Beitritt eines Haushalts.

```mermaid
sequenceDiagram
  autonumber
  actor User as Benutzer
  participant App as Mobile App
  participant Auth as Supabase GoTrue
  participant DB as PostgreSQL DB

  User->>App: Registrierung / Login (E-Mail + Passwort)
  App->>Auth: signInWithPassword / signUp
  Auth-->>App: Session Token + Refresh Token
  
  alt Erstes Onboarding (Profil-Setup)
    App->>User: Frage nach Alter, Geschlecht, Gewicht, Größe, Aktivitätslevel & Ziel
    User->>App: Eingaben bestätigen
    App->>DB: Profil aktualisieren (Berechnung BMR & TDEE)
  end

  alt Option A: Neuen Haushalt erstellen
    User->>App: Haushalt anlegen ("Familie Müller")
    App->>DB: RPC create_household("Familie Müller")
    DB-->>DB: Erstelle households, household_members (Rolle 'admin') & Standard-Lagerorte
    DB-->>App: Neuer Household aktiv
  else Option B: Haushalt beitreten
    User->>App: Einladungscode eingeben oder Deep Link scannen
    App->>DB: RPC join_household_by_invite(invite_code)
    DB-->>DB: Prüfe Gültigkeit & erstelle household_members (Rolle 'member')
    DB-->>App: Beitritt erfolgreich
  end

  App->>DB: Sync initialisieren (Lade Haushaltsbestand & Einkaufsliste)
  App-->>User: Dashboard & Tabs freigeschaltet
```

---

## 4. Local-First Sync Engine & Offline-Pipeline

Änderungen in der App werden unmittelbar lokal in SQLite ausgeführt (**Optimistic UI**) und in der Outbox-Tabelle abgelegt. Der Background Sync Runner sorgt für Batching, Push und Realtime-Aktualisierung.

```mermaid
flowchart TD
  subgraph UserAction["1. Lokale Mutation (Offline-First)"]
    Action["Nutzer ändert Datensatz\n(z. B. Hakt Einkaufsartikel ab)"]
    WriteLocal["Schreibe in SQLite Mirror\n(Sofortiges UI-Feedback)"]
    EnqueueOutbox["Eintrag in Outbox einfügen\n(_sync_outbox: table, row_id, mutation_type, payload)"]
    
    Action --> WriteLocal
    Action --> EnqueueOutbox
  end

  subgraph PushCycle["2. Push Cycle (Outbox -> Supabase)"]
    TriggerSync{"Netzwerk verfügbar?"}
    Coalesce["Coalesce Redundancies\n(Mehrfache Edits zu 1 Mutation zusammenfassen)"]
    PushBatch["HTTP Push an Supabase API"]
    ClearOutbox["Erfolgreiche Zeilen aus _sync_outbox löschen"]
    Backoff["Exponential Backoff bei Fehlern"]

    EnqueueOutbox --> TriggerSync
    TriggerSync -->|Ja| Coalesce
    TriggerSync -->|Nein| Backoff
    Coalesce --> PushBatch
    PushBatch -->|200 OK| ClearOutbox
    PushBatch -->|Fehler| Backoff
    Backoff --> TriggerSync
  end

  subgraph RealtimePull["3. Realtime & Incremental Pull"]
    RTEvents["Supabase Realtime WebSocket Event"]
    PullCursor["Incremental Pull Query\n(SELECT WHERE updated_at > last_synced_at)"]
    Tombstones{"deleted_at gesetzt?"}
    ApplySoftDelete["Markiere/Entferne in SQLite Mirror"]
    ApplyUpsert["Upsert in SQLite Mirror"]
    NotifyUI["React Query Invalidation -> Re-Render UI"]

    RTEvents --> PullCursor
    PullCursor --> Tombstones
    Tombstones -->|Soft Delete| ApplySoftDelete
    Tombstones -->|Upsert| ApplyUpsert
    ApplySoftDelete --> NotifyUI
    ApplyUpsert --> NotifyUI
  end

  PushBatch -->|WAL Change| RTEvents
```

---

## 5. Kühlschrank- & Vorratsverwaltung (Inventory & Expiry)

Lebensmittel werden strukturiert erfasst, Lagerorten zugewiesen und automatisch nach ihrem Mindesthaltbarkeitsdatum (MHD) priorisiert.

```mermaid
stateDiagram-v2
  [*] --> Erfassung: Barcode-Scan / OFF-Suche / Manuell

  state Erfassung {
    [*] --> Datenermittlung
    Datenermittlung --> Produktdetails: Treffer in Open Food Facts / DB
    Datenermittlung --> ManuelleEingabe: Kein Barcode / Unbekannt
    Produktdetails --> Speichern
    ManuelleEingabe --> Speichern
  }

  Erfassung --> BestandEingebucht: Lagerort wählen (Kühlschrank / Vorrat / Tiefkühler)

  state BestandEingebucht {
    state "Frisch (Fresh)" as Fresh
    state "Bald ablaufend (Expiring Soon)" as ExpiringSoon
    state "Abgelaufen (Expired)" as Expired

    [*] --> Fresh: MHD > Schwellenwert (z.B. > 3 Tage)
    [*] --> ExpiringSoon: MHD <= 3 Tage
    [*] --> Expired: MHD < Heute

    Fresh --> ExpiringSoon: Zeit vergeht
    ExpiringSoon --> Expired: MHD überschritten

    ExpiringSoon --> DashboardWarnung: Erscheint in Ablauf-Warnungen
    ExpiringSoon --> PushReminder: Push-Benachrichtigung an Haushalt
    Expired --> DashboardWarnung: Prioritäre Verwendung
  }

  BestandEingebucht --> Verbraucht: Beim Kochen abgezogen / Manuell verzehrt
  BestandEingebucht --> Entsorgt: Wegen Verderb gelöscht
  BestandEingebucht --> NachkaufVorschlag: Bestand niedrig -> Automatisch auf Einkaufsliste

  Verbraucht --> [*]
  Entsorgt --> [*]
  NachkaufVorschlag --> [*]
```

---

## 6. Einkaufslisten-Workflow & Supermarkt-Laufstrecke

Die Einkaufsliste bündelt Bedarfe aus verschiedenen Quellen, sortiert sie nach der physischen Laufstrecke des gewählten Marktes und transferiert abgehakte Artikel beim Abschluss automatisch in den Vorrat.

```mermaid
flowchart TD
  subgraph Bedarfsquellen["Quellen für Einkaufsartikel"]
    Manual["Manuelle Eingabe"]
    Pantry["Vorrats-Vorschlag\n(Niedriger Bestand)"]
    MealPlan["Meal-Planner\n('Fehlende Zutaten')"]
  end

  subgraph ShoppingList["Aktive Einkaufsliste (shopping_list_items)"]
    ListAggregator["Zusammenfassung gleicher Produkte\n& Marktauswahl (Store Preset)"]
    SortingEngine["Laufstrecken-Sortierung\n(Obst/Gemüse -> Kühlung -> Vorrat -> Drogerie)"]
    RealtimeCheck["Echtzeit-Abhaken im Laden\n(checked_at Timestamp, für alle sichtbar)"]
  end

  subgraph CheckoutFlow["'Einkauf abschließen' (Complete Run Sheet)"]
    ActionFinish["Nutzer tippt 'Einkauf abschließen'"]
    ModalPrompt["Sheet: Standard-Lagerort & Standard-MHD für neue Artikel wählen"]
    SplitCheck{"Artikel abgehakt?"}
    TransferFridge["Übertrage als neue Einträge in fridge_items\n(Menge, Einheit, Lagerort, MHD)"]
    SoftDeleteShop["Soft-Delete in shopping_list_items\n(deleted_at = now())"]
    KeepShop["Verbleibt offen auf der Einkaufsliste\n(checked_at ist NULL)"]
  end

  Manual --> ListAggregator
  Pantry --> ListAggregator
  MealPlan --> ListAggregator

  ListAggregator --> SortingEngine
  SortingEngine --> RealtimeCheck

  RealtimeCheck --> ActionFinish
  ActionFinish --> ModalPrompt
  ModalPrompt --> SplitCheck

  SplitCheck -->|Ja - Abgehakt| TransferFridge
  TransferFridge --> SoftDeleteShop
  SplitCheck -->|Nein - Offen| KeepShop
```

---

## 7. Rezept-Baukasten & Kochmodus

Rezepte basieren auf einem flexiblen Baukastensystem (Komponenten & Unterkomponenten). Nährwerte werden automatisch errechnet und der Kochmodus unterstützt das Kochen durch Wake-Lock und integrierte Timer.

```mermaid
flowchart TD
  subgraph RecipeCreation["1. Rezept-Erstellung (Wizard)"]
    Info["Basis-Info: Titel, Zubereitungszeit, Tags, Default-Portionen"]
    Components["Komponenten anlegen (z. B. 'Tomatensauce', 'Nudeln')"]
    Positions["Zutaten zuweisen (product_id + Gramm) oder Unterkomponenten"]
    Steps["Zubereitungsschritte (recipe_steps) mit Zeitangaben"]
    NutritionCalc["Nährwertberechnung (nutrition.ts)\n(Summiert Kcal, Protein, Carbs, Fat pro 100g & Portion)"]
    CoverUpload["Titelbild in Supabase Storage hochladen"]

    Info --> Components --> Positions --> Steps
    Positions --> NutritionCalc
    Info --> CoverUpload
  end

  subgraph RecipeUsage["2. Rezept-Nutzung & Skalierung"]
    DetailView["Rezept-Detailansicht"]
    Scaler["Portionsskalierer (z.B. 1x -> 2x -> 4x)\n(Multipliziert alle Zutatenmengen linear)"]
    CheckFridge["Kühlschrank-Abgleich\n(Markiert verfügbare vs. fehlende Zutaten)"]

    DetailView --> Scaler
    DetailView --> CheckFridge
  end

  subgraph CookingMode["3. Interaktiver Kochmodus (cooking-mode-screen)"]
    WakeLock["Keep-Awake aktiviert\n(Display schaltet nicht ab)"]
    StepByStep["Schritt-für-Schritt UI\n(Große Typografie, leichtes Wischen)"]
    Timers["Integrierte Koch-Timer\n(Start / Pause / Signalton beim Ablauf)"]
    FinishCooking["Mahlzeit fertiggestellt\n(Option: Zutaten aus Kühlschrank abbuchen)"]

    DetailView -->|Starten| WakeLock
    WakeLock --> StepByStep
    StepByStep --> Timers
    StepByStep --> FinishCooking
  end
```

---

## 8. Wochen-Mahlzeitenplaner & Shopping Needs Engine

Der Mahlzeitenplaner verknüpft Rezepte mit der Kalenderwoche und ermittelt automatisch den Einkaufsbedarf unter Berücksichtigung der im Haushalt vorhandenen Vorräte.

```mermaid
flowchart TD
  subgraph MealPlanning["Wochenplanung (meal_plans & entries)"]
    WeekGrid["Wochenplan-Raster (Montag - Sonntag)\nSlots: Frühstück, Mittag, Abend, Snack"]
    AssignRecipe["Rezept zuweisen & Portionsanzahl / Personen einstellen"]
    CloneWeek["'Letzte Woche wiederholen' (Kopiert Einträge mit +7 Tagen)"]

    WeekGrid --> AssignRecipe
    WeekGrid --> CloneWeek
  end

  subgraph NeedsEngine["Shopping Needs Engine (use-shopping-needs.ts)"]
    AggregateNeeds["1. Aggregiere alle benötigten Zutaten aller Rezepte der Woche"]
    FetchFridge["2. Lade aktuellen Haushaltsbestand aus fridge_items"]
    DiffCalculation["3. Differenzberechnung (Bedarf minus vorhandene Vorräte)"]
    MissingList["4. Liste 'Fehlende Zutaten' generieren\n(mit Herkunftsnachweis: recipe_names)"]

    AssignRecipe --> AggregateNeeds
    AggregateNeeds --> DiffCalculation
    FetchFridge --> DiffCalculation
    DiffCalculation --> MissingList
  end

  subgraph ExportShopping["Übertrag in Einkaufsliste"]
    ExportBtn["Button: 'Fehlende Zutaten auf Einkaufsliste'"]
    AddToShoppingList["Erstelle Einträge in shopping_list_items\n(mit Rezept-Referenz snapshot)"]

    MissingList --> ExportBtn
    ExportBtn --> AddToShoppingList
  end
```

---

## 9. Privates Ernährungstagebuch & Makro-Tracking

Individuelles Tracking für Kalorien, Makronährstoffe und Körpergewicht mit striktem Datenschutz und gesundheitlichen Sicherheitsgrenzen.

```mermaid
flowchart TD
  subgraph Setup["1. Ziel- & Stoffwechselberechnung"]
    InputData["Eingabe: Alter, Geschlecht, Größe, Gewicht, Aktivitätslevel"]
    BMRCalc["Grundumsatz (BMR) via Mifflin-St Jeor / Harris-Benedict"]
    TDEECalc["Gesamtumsatz (TDEE = BMR * PAL-Faktor)"]
    DeficitTarget["Zielkalorien je nach Wunsch (z. B. -500 kcal / Tag)"]
    SafetyCap{"Ziel < Grundumsatz oder < 1200 kcal?"}
    ApplySafety["Sicherheitsdeckelung aktivieren (Kappen & Warnhinweis)"]
    SetMacros["Makro-Verteilung festlegen (Protein / Carbs / Fett)"]

    InputData --> BMRCalc --> TDEECalc --> DeficitTarget --> SafetyCap
    SafetyCap -->|Ja| ApplySafety
    ApplySafety --> SetMacros
    SafetyCap -->|Nein| SetMacros
  end

  subgraph Logging["2. Mahlzeit erfassen (food_entries)"]
    SearchProduct["Produktsuche (Open Food Facts / Lokaler Verlauf / Barcode)"]
    SelectPortion["Portionsgröße & Mahlzeittyp wählen (Frühstück, Mittag, Abend, Snack)"]
    SnapshotValues["Nährwert-Snapshotting\n(Kopiert kcal, protein, carbs, fat direkt in food_entries)"]
    SaveEntry["Speichern unter user_id / child_profile_id (RLS-isoliert)"]

    SearchProduct --> SelectPortion --> SnapshotValues --> SaveEntry
  end

  subgraph Dashboard["3. Tagesauswertung & Fortschritt"]
    DailySum["Tagessummen aggregieren (Kcal & Makros)"]
    ProgressBar["Fortschrittsbalken (Kcal vs. Tagesziel)"]
    MacroRings["Makro-Verteilung (Ist vs. Soll)"]
    WeightLog["Gewichtsverlauf dokumentieren (weight_entries)"]

    SaveEntry --> DailySum
    DailySum --> ProgressBar
    DailySum --> MacroRings
  end
```

---

## 10. Monetarisierung & Haushalts-Premium-Sharing

NutriTrack implementiert ein **familienfreundliches Shared-Entitlement**: Sobald *ein* Mitglied des Haushalts ein aktives Premium-Abo besitzt, wird Premium serverseitig für den gesamten Haushalt freigeschaltet.

```mermaid
sequenceDiagram
  autonumber
  actor User as Haushaltsmitglied A
  participant App as NutriTrack Client
  participant RC as RevenueCat SDK / Server
  participant Store as Apple App Store / Google Play
  participant Edge as Supabase Edge Function (revenuecat-webhook)
  participant DB as PostgreSQL DB
  actor MemberB as Haushaltsmitglied B

  User->>App: Öffnet Premium-Screen / Paywall
  App->>RC: Lade Offerings & Pakete
  RC-->>App: Display Packages (Monats- / Jahresabo)
  
  User->>App: Klickt 'Abonnieren'
  App->>Store: In-App Kauf ausführen
  Store-->>App: Kaufbestätigung
  App->>RC: Purchases.purchasePackage(package)
  RC-->>App: Entitlement 'premium' aktiv
  
  RC->>Edge: Webhook: INITIAL_PURCHASE / RENEWAL (household_id)
  Edge->>DB: UPDATE households SET premium_active = true, premium_expires_at = ... WHERE id = household_id
  DB-->>DB: Supabase Realtime Broadcast auf households
  
  DB-->>App: Realtime Event: premium_active = true
  App-->>User: Premium-Features aktiviert

  DB-->>MemberB: Realtime Event: premium_active = true
  MemberB-->>MemberB: Mitglied B erhält automatisch Premium-Zugriff!
```
