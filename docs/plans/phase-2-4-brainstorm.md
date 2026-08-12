# Phase 2–4 Brainstorm

> Laufendes Sammel-Dokument. Noch keine Issues/Tasks — wird weiter ergänzt,
> bis Entscheidungen gefallen sind. Erst dann werden daraus konkrete
> GitHub-Issues bzw. `tasks/`-Einträge.
>
> Kontext: MVP (Phase 1, `docs/ROADMAP.md` Wellen 0–8) ist komplett, GitHub-
> Milestone "Phase 1 - MVP" hat 0 offene Issues. Phase 2–4 (#11–#24) sind
> bisher nur grobe Epics ohne Kind-Issues.

---

## Zwischenfund: #11 vermutlich schon erledigt

`#11` (Einkaufsliste → Bestand-Übernahme) beschreibt genau das, was
`useCompleteShoppingRun` + `complete-run-sheet.tsx` bereits tun: "Einkauf
abschließen" überträgt abgehakte Artikel in `fridge_items` inkl. Menge,
nicht abgehakte bleiben auf der Liste.

**Nutzer-Antwort:** Für die Einkaufsliste müsste ein MHD vorhanden sein, so
wie beim Vorrat. → **Noch nicht fertig**, nicht einfach schließen.

**Entschieden (2026-08-12): MHD-Vorausfüllung zweistufig.**
1. **Start: statische Kategorie-Heuristik** — Tabelle "Kategorie → typische
   Haltbarkeit in Tagen" (z. B. Milchprodukte 7 Tage, Tiefkühlkost 90 Tage,
   Konserven 365 Tage), gematcht über OFF-Kategorie/Produktname. Sofort
   verfügbar, aber Pflegeaufwand für die Tabelle.
2. **Übergang: gelernte Haushalts-Historie** — sobald für ein Produkt (per
   Name, wie schon bei `product_usage`/#79) **7 eigene MHD-Einträge**
   vorliegen, wird der Schnitt/Median der bisherigen Werte statt der
   Kategorie-Heuristik vorgeschlagen. Rein lokal, kein Server nötig —
   gleiches Muster wie `product_usage`.
3. Der Vorschlag ist immer nur eine **Vorausfüllung**, keine Zwangsvorgabe —
   der Nutzer kann das Datum manuell überschreiben (wie heute schon im
   Complete-Run-Sheet).

**Entschieden (2026-08-12): Vorausfüllung überall, wo ein `fridge_items`-
Eintrag mit MHD entsteht.** Das MHD-Feld existiert ohnehin nur auf
Kühlschrank-Bestand-Ebene, nicht auf dem reinen Einkaufslisten-Eintrag —
kein zusätzliches Feld dort nötig. Der Vorschlag greift an beiden Stellen,
an denen ein solcher Eintrag entsteht: **Complete-Run-Sheet** (Einkauf
abschließen, Einkaufsliste → Vorrat) und **Add-Item-Screen** (direktes
Hinzufügen zum Vorrat) — derselbe Vorausfüll-Mechanismus an beiden Stellen.

---

## Phase 2 — Core (#11, #12, #13, #14)

### #12 — Rezept-Manager & Rezept-Builder

Größtes Epic der Phase. Vorschlag zur Aufteilung:
- Recipe CRUD (Titel, Anleitung, Portionen) — geteilt im Haushalt
- Zutatenliste mit Mengen, verknüpft mit `products` für Nährwertberechnung
- Automatische Nährwert-Summe pro Portion (reine Funktion, auf `units.ts` aufbauend)
- Portionsskalierung
- Rezept-Liste/-Detail-Screens (ersetzt das `recipes/`-Gerüst)

**Nutzer-Feedback:**
- **Screens müssen gut geplant und durchdacht sein** — kein schnelles
  Gerüst, explizite Design-Runde vor der Umsetzung nötig.
- **Kein reines Portions-Skalieren — "Baukasten-Mahlzeiten" als
  Alleinstellungsmerkmal.** Statt einen globalen Skalierungsfaktor auf alle
  Zutaten anzuwenden, werden Mahlzeiten aus **Komponenten** zusammengesetzt,
  die jeweils in Gramm dosiert werden (Beispiel: Spaghetti Bolognese = 300g
  Nudeln + 200g Soße, wobei die Soße selbst aus 50g Tomaten + 300g Hackfleisch
  besteht und die App daraus automatisch 90kcal/100g für die Soße berechnet).

**Entschieden (2026-08-12): Datenmodell "Baukasten-Mahlzeiten".**
- **Rezept** (`recipes`) — eigenständig, Komponenten werden **nicht** über
  Rezepte hinweg geteilt (Kopieren einer Komponente in ein neues Rezept wäre
  denkbar, aber bewusst **out of scope** für jetzt).
- **Komponente** (`recipe_components`) — gehört zu genau einem Rezept.
  Besteht aus einer Liste von Positionen, jede Position referenziert
  **entweder** eine Basis-Zutat (`product_id` + Gramm) **oder** eine andere
  Komponente desselben Rezepts (`sub_component_id` + Gramm) — rekursiv, im
  **Datenmodell technisch unbegrenzt verschachtelbar**. Die UI bekommt aber
  bewusst eine **feste Verschachtelungs-Grenze** (Praxis: 1–2 Ebenen reichen,
  genauer UI-Grenzwert noch offen).
- **Nährwerte kommen ausschließlich aus den hinzugefügten Lebensmitteln** —
  im Idealfall Open-Food-Facts-Daten, sonst manuell vom Nutzer übertragene
  Werte (bestehender `products`-Mechanismus, keine neue Nährwert-Quelle
  nötig).
- **Pro-100g-Wert einer Komponente** wird rekursiv aus ihren Positionen
  berechnet (Summe Gewicht, Summe kcal/Makros, geteilt durch 100) bis
  hinunter zu den Basis-Zutaten.
- **"1 Portion"** (`recipe_servings`) — vom Rezept-Autor definierte
  Gramm-Menge je oberster Komponente (z. B. "300g Nudeln + 200g Soße"),
  Kalorienzahl der Portion ist sofort sichtbar.
- **Klassisches Hochskalieren** — "2 Portionen" multipliziert alle
  Portions-Gramm-Mengen linear, wie in anderen Rezept-Apps üblich.
- **Individuelle Anpassung beim Nachkochen/Loggen** — beim Eintragen ins
  Tagebuch kann ein Nutzer die Portions-Gramm-Mengen frei überschreiben
  (z. B. mehr Soße), **ohne das Original-Rezept zu verändern**. Passt zum
  bestehenden Muster: `food_entries` speichert schon heute einen berechneten
  kcal/Makro-**Snapshot** zum Logzeitpunkt statt einer Live-Referenz — die
  individuelle Gramm-Anpassung fließt einfach in diese Berechnung ein, bevor
  sie gespeichert wird.

**Entschieden (2026-08-12): UI-Limit 2 Ebenen, per Feature-Flag änderbar.**
Rezept → Komponente → Unterkomponente → Zutaten — eine Unterkomponente darf
selbst keine weitere Unterkomponente mehr enthalten, nur noch Zutaten. Da
das Datenmodell (rekursive Positionen) technisch unbegrenzt ist, lässt sich
das UI-Limit später per Feature-Flag erhöhen oder ganz aufheben, ohne das
Datenmodell zu ändern.

### #13 — Fortschritts-Tracking & Charts

Offene Entscheidung: `victory-native` (Skia) vs. eigene Lösung auf
`react-native-svg`. README nennt detaillierte Charts als möglichen
Frustfaktor ("später oder gar nicht") — Scope-Frage vor dem Bau klären.

**Nutzer-Feedback:** Vorschlag (Bibliothek entscheiden → Gewichtsverlauf →
Kalorienbilanz-Verlauf → Körpermaße) klingt gut.

**Entschieden (2026-08-12): Wegwerf-Prototyp-Seite zum Bibliotheksvergleich.**
- `victory-native` (Skia) und eine `react-native-svg`-Eigenlösung bekommen
  denselben Chart-Typ (Gewichtsverlauf als Linien-Chart) mit denselben
  Testdaten nebeneinander.
- **Entscheidungskriterien in Priorität:** 1) Optik/Animations-Qualität,
  2) Performance auf echten Geräten.
- **Bundle-Size wird bewusst nicht als Kriterium gewertet** (nicht erwähnt,
  also nachrangig).
- Die Seite ist ein **einmaliges Wegwerf-Experiment** — kein dauerhaftes
  Entwickler-Werkzeug, wird nach der Entscheidung wieder entfernt.

### #14 — Push-Benachrichtigungen

Remote Push über `expo-notifications` + Edge-Function-Trigger. Offene Frage:
welche Events rechtfertigen einen *Remote*-Push gegenüber den lokalen
Benachrichtigungen, die es schon seit Welle 5 gibt (MHD-Ablauf)?

**Nutzer-Feedback:** Klar prüfen und festlegen, **was, wie und warum**
gepusht wird — bevor irgendetwas gebaut wird, ein explizites Regelwerk
aufstellen (welche Events, welche Trigger-Quelle, welche Nutzer-Opt-ins).

**Entschieden (2026-08-12): Event-Regelwerk, erste Fassung.**

| Kandidat | Push? |
|---|---|
| Haushaltsmitglied tritt bei/aus | Nein |
| Artikel zur Einkaufsliste hinzugefügt | Nein |
| Kühlschrank-Bestand für ein Produkt wird knapp/leer | **Ja** — muss pro Nutzer konfigurierbar sein (An/Aus, ggf. Schwellwert) |
| Rollenänderung / aus Haushalt entfernt | Nein |
| Meal-Plan: Mahlzeit wurde einem zugewiesen (#15) | **Entfällt** — #15 weist Mahlzeiten laut Entscheidung keinen einzelnen Personen zu, nur Portionen-/Personen-Mengen |

**Präzisiert (2026-08-12): "Knapp"-Benachrichtigung.**
- **Konfiguration:** globaler Standard-Schwellwert in den Einstellungen,
  **pro Artikel überschreibbar**. Braucht ein neues Bestandsfeld
  ("Mindestbestand") zusätzlich zu `quantity`/`unit` auf `fridge_items`
  (oder produktbezogen).
- **Automatisches Hinzufügen zur Einkaufsliste bei Unterschreiten** ist ein
  eigenständiges Thema, **losgelöst von der `#15`-Paid-Regel** (die war
  spezifisch für Rezept-basierte Listen-Generierung).

**Entschieden (2026-08-12): Auto-Add bei "knapp" ist Paid.** Teil desselben
Abos wie die übrigen Paid-Kandidaten (siehe `#23`-Abschnitt).

**Neue Idee, bisher in keinem Epic erfasst:** Prospekt-/Angebots-
Benachrichtigung — wenn ein Nutzer im Prospekt ein Produkt gefunden hat, das
er kaufen will, und der jeweilige Markt an bestimmten Wochentagen neue
Prospekt-Ware einräumt, wäre eine Erinnerung an diesem Tag sinnvoll. Berührt
thematisch `#16` (Supermarkt-Preisvergleich/PriceProvider), ist aber genau
genommen ein eigenständiges Feature (Prospekt-Tracking, nicht Preisvergleich).
**Vorschlag:** als eigenen Punkt vormerken, eventuell eigenes Mini-Epic,
statt in `#14` oder `#16` zu verschwinden — siehe "Neue, noch nicht
erfasste Ideen" unten.

---

## Phase 3 — Advanced (#15, #16, #17, #18, #19)

### #15 — Meal-Planner (Wochenplanung)

Wochenplan, Zuordnung pro Haushaltsmitglied, Drag & Drop
(`react-native-gesture-handler`), wiederverwendbare Pläne. Braucht `#12`
(Rezepte) als Voraussetzung.

**Nutzer-Feedback:** Feature wird als klasse bewertet, **hohe Priorität**.
Zusätzliche Anforderung: aus dem Meal-Plan heraus muss man Einkaufslisten
erstellen bzw. einzelne Lebensmittel auf die Einkaufsliste setzen können
(Meal-Plan → Einkaufsliste-Generierung, angedeutet auch schon in
`docs/VISION.md`).

**Entschieden (2026-08-12): Einkaufslisten-Generierung, kuratiert als
Standard.**
- App berechnet immer automatisch die **fehlenden Zutaten** (Rezept-Bedarf
  minus Kühlschrank-/Vorratsbestand) — das ist Kernfunktion, nicht Paid.
- **Standard-Fluss ist kuratiert:** Nutzer sieht die berechnete Liste und
  kann sie vor dem Übernehmen anpassen. Für einzelne Artikel mit
  **Kaufhistorie** (z. B. "Tomaten meistens vom Aldi") schlägt die App die
  History-Präferenz vor (Verknüpfung zu `shopping_history`/`product_usage`,
  ggf. später zu `#16` PriceProvider für Markt-Zuordnung). Hat ein Artikel
  **keine Historie**, wird er direkt ohne Rückfrage übernommen (nichts zum
  Auswählen da).
- **"Alles automatisch ohne jede Rückfrage übernehmen"** (kompletter
  Ein-Klick-Fluss ohne Kuratieren) ist als **Paid-Feature für die Zukunft**
  vorgemerkt — nicht Teil des Basis-Baus.

**Entschieden (2026-08-12, präzisiert): Portionsmenge statt Personen-
Zuweisung.** Kein Verweis auf einzelne Haushaltsmitglied-Profile nötig —
stattdessen direkt mengenbasiert:
- **Portionen-Modus**: beim Anlegen eines Wochenplan-Eintrags direkt eine
  **Portionenzahl** eingeben.
- **Personen-Modus** (Alternative, für größere Runden): Anzahl Personen
  eingeben, App rechnet über einen **Umrechnungsfaktor** (Standard **1,25
  Portionen pro Person**, in den Einstellungen änderbar) in Portionen um.
- **Shortcut "ganzer Haushalt isst"**: füllt automatisch die Personenzahl
  (Anzahl aktiver Haushaltsmitglieder) vor, umgerechnet über denselben
  Faktor — deckt den Alltagsfall ohne manuelle Eingabe ab.
- Deckt sowohl Alltag (ganzer Haushalt) als auch Sonderfälle (Besuch, größere
  Runde) ab, ohne dass man Personen einzeln aus- oder abwählen muss — löst
  damit auch das Gäste-Problem aus der vorherigen Überlegung.

Damit ist auch die Zuweisungsfrage geklärt: es gibt **keine** Zuordnung zu
einzelnen Personen, nur zu Mengen (Portionen/Personen-Anzahl).

### #16 — Supermarkt-Preisvergleich (PriceProvider)

Epic nennt selbst eine Blockerfrage: lohnt sich der Preisvergleich ohne
offizielle API-Anbindung überhaupt?

**Nutzer-Feedback:** **Bleibt unangetastet, nur Idee.** Kein Brainstorming
nötig, keine weitere Priorität aktuell.

### #17 — Aktivitätstracking & Health-Integration

`expo-sensors` Pedometer, manuelle Aktivitätseingabe (MET-Werte),
HealthKit/Health Connect.

**Nutzer-Feedback:** Fokus ist **Bewegungsdaten-Integration fürs Tagebuch
bzw. Kalorien-Tracking** — d. h. der Kalorienverbrauch aus Aktivität soll ins
Tagesbudget einfließen.

**Entschieden (2026-08-12): Direkt HealthKit, iOS-first.**
- **Keine manuelle Eingabe** — explizit ausgeschlossen.
- **Kein Pedometer-Zwischenschritt** — würde nur doppelten Aufwand bedeuten,
  wenn danach ohnehin auf HealthKit umgestellt wird.
- **Direkt `@kingstinct/react-native-healthkit` (iOS)**, Android/Health
  Connect kommt später nach.
- **Priorität: niedrig / nach hinten gestellt** — andere Features sind
  aktuell wichtiger. Kein aktiver Umsetzungsdruck.

### #18 — Intervallfasten-Tracker

Ursprünglich: feste Presets (16:8, 18:6, 20:4, 5:2, OMAD), persistenter
Start-Zeitstempel statt In-Memory-Timer.

**Nutzer-Feedback:** Nur ein reiner Intervallfasten-Tracker wird als zu
schmal empfunden. **Erweiterungsidee:** allgemeiner
**Fastenmethoden-Tracker** — 16:8, 5:2, 20:4, 24h-Fasten etc., plus die
Möglichkeit, **eigene/angepasste Fastenmethoden** zu definieren statt nur
feste Presets. **Priorität:** vorerst zurückgestellt, nicht jetzt umsetzen.

### #19 — Kochmodus & "Was kann ich kochen?"

Rezeptvorschläge auf Basis des Kühlschrank-Bestands, Schritt-für-Schritt-
Kochmodus mit Timern.

**Nutzer-Feedback:** Kochmodus generell **gut bewertet**, soll **ausführlich
besprochen und gebrainstormt** werden. Denkbar als **Paid Feature**. "Was
kann ich kochen?" (Zutaten-Matching-Vorschlag) soll **später** kommen, da
dafür eine KI-Implementierung nötig ist — der reine Kochmodus (Timer,
Schritt-für-Schritt) kann unabhängig davon vorgezogen werden.

**Erste Brainstorming-Runde (2026-08-12):**

- **Navigation**: Kombination aus geführtem Schritt-für-Schritt-Ablauf und
  Freiheit, zurückzuspringen — **ohne** dabei automatisch die
  Audio-Vorlesung des Schritts erneut abzuspielen. D. h. Vorlesen/Audio nur
  beim normalen Vorwärtsgehen (oder auf explizite Anfrage), Zurückspringen
  ist "leise" navigierbar.
- **Timer**: automatische Timer-Erkennung ist grundsätzlich gewünscht, aber
  **immer manuell start-, stopp- und rücksetzbar** — Automatik ersetzt nie
  die manuelle Kontrolle.
  - **Abhängig von #12**: ob Timer automatisch aus Freitext erkannt werden
    müssen (Texterkennung à la "10 Minuten köcheln lassen"), oder ob der
    Autor sie explizit pro Schritt definieren kann, hängt davon ab, wie frei
    vs. wie strukturiert/geführt das Rezept-Erstellen in `#12` wird. Freie
    Texteingabe → Timer-Erkennung nötig. Strikt geführte Schritt-Erfassung →
    Autor kann Timer direkt je Schritt setzen, keine Erkennung nötig.
    **Kopplungspunkt zu `#12`, dort mitentscheiden.**
- **Monetarisierung (Bezug zu `#23`)**: der **komplette interaktive
  Kochmodus** ist Paid — kostenlos sind nur Zutatenliste + Basis-Rezepttext
  (kein geführter Ablauf). Innerhalb des Kochmodus sind zusätzlich
  **Timer-Automatik, Sprachsteuerung und (perspektivisch) Video-
  Live-Erkennung** eigene Paid-Bausteine — konkretes Beispiel für die
  Monetarisierungs-Konsolidierung in `#23`.

---

## Phase 4 — Community (#20, #21, #22, #23, #24)

### #20 — Gamification (XP, Level, Streaks, Achievements)

**Nutzer-Feedback:** Soll **grundsätzlich in die App eingebaut werden, aber
gezielt an den richtigen Stellen** — kein Gamification-Overlay über alles,
sondern bewusst platziert.

**Konkretisiert (2026-08-12, Update): XP, Streaks & stufenbasierte
Achievements.** Alle Zahlenwerte sind Platzhalter/Beispiele — jedes
Achievement und jede Challenge durchläuft mehrere Stufen (Bronze → Silber →
Gold → Platin), um langfristig zu motivieren statt einmalig.

**⚡ XP** (kleine, alltägliche Aktionen):
- MHD-Eintragung beim Einsortieren in den Vorrat
- Smart-Shopping-Bonus: Einkaufslisten-Artikel gescannt **und** direkt einem
  Supermarkt zugeordnet
- Tagebuch-Eintragung je geloggter Mahlzeit

**🔥 Streaks** (gestaffelt, z. B. 3 / 7 / 30 / 100 Tage):
- Lebensmittel-Retter-Streak: Artikel rechtzeitig vor MHD verbraucht statt
  weggeworfen (Bezug zur Ablauf-Ampel)
- Tagebuch-Routine-Streak: tägliches Logging ohne Unterbrechung
- Supermarkt-Treue-Streak: mehrere vollständige Einkäufe hintereinander im
  selben Supermarkt

**🏆 Achievements** (mehrstufiges Medaillensystem, Anforderungen wachsen pro
Stufe):
- **Level-Aufstiege**: XP-Gesamtsumme — Bsp. Lv.5 (Bronze) → Lv.25 (Silber) →
  Lv.50 (Gold) → Lv.100 (Platin)
- **Vorrats-Gewohnheit ("Dauerbrenner")**: derselbe Artikel wiederholt auf
  die Einkaufsliste — Bsp. 10× (Bronze) → 100× (Silber) → 1.000× (Gold)
- **Einkaufs-König**: vollständige Einkäufe hintereinander — Bsp. 3 (Bronze)
  → 15 (Silber) → 50 (Gold)
- **Community-Chefkoch** (Bezug `#21`): Rezepte anderer nachgekocht — Bsp.
  1. Rezept (Bronze) → 10 (Silber) → 50 (Gold)
- **Rezept-Schöpfer** (Bezug `#12`): eigene Rezepte erstellt/geteilt — Bsp.
  1. Rezept (Bronze) → 5 (Silber) → 25 (Gold)
- **Gesunde Lebensweise**: persönliche Ernährungs-/Kalorienziele über einen
  zusammenhängenden Zeitraum eingehalten — Bsp. 7 Tage (Bronze) → 30 Tage
  (Silber) → 100 Tage (Gold).

**Update (2026-08-12):**
- **Level-System: beides, nicht entweder/oder.** Es gibt sowohl ein
  **persönliches Level** (pro Account) als auch ein **Haushalts-Level**
  (gemeinsamer Fortschritt aller Mitglieder) — löst die vorherige offene
  Frage "Account oder Haushalt" auf: **beides parallel**.
- **"Gesunde Lebensweise" präzisiert:** häufige Tütengerichte/Fertiggerichte
  zählen **nicht** als gesunde Lebensweise — das Kriterium muss den
  Verarbeitungsgrad der geloggten Lebensmittel einbeziehen, nicht nur
  Kalorienziel-Treue. **Technisch machbar**: Open Food Facts liefert bereits
  eine `novaGroup` (NOVA-Klassifikation 1=unverarbeitet bis 4=hochverarbeitet)
  — dieses Feld wird im Code schon abgerufen (`src/lib/open-food-facts.ts`),
  aber noch nicht in `products` gespeichert oder sonst irgendwo ausgewertet.
  Für dieses Achievement müsste `novaGroup` persistiert und beim
  Tagebuch-Logging mit einbezogen werden (z. B. Anteil NOVA 1–2 vs. 3–4 über
  den Zeitraum).

**Entschieden (2026-08-12): Haushalts-Level = Summe/Durchschnitt der
persönlichen Level.** Kein eigenes Haushalts-Event-System für den Start —
einfachster Ansatz zuerst, eigene Haushalts-Events (z. B. "gemeinsamer
Einkauf") bleiben eine mögliche spätere Erweiterung.

**Noch offen:** konkrete finale Zahlenwerte pro Stufe (aktuell nur
Beispiele, werden bei der Umsetzung kalibriert).

### #21 — Rezept-Sharing & Community

Ursprünglich: native Share-Sheet, Freunde-Challenges, anonyme Leaderboards.

**Nutzer-Feedback:** Bezieht sich stark auf die **Rezeptdatenbank**, die mit
`#12` aufgebaut wird — dem Nutzer sollen auch **von der App bereitgestellte
Rezepte** angeboten werden, nicht nur selbst angelegte. **Monetarisierungs-
Idee:** kostenlose vs. kostenpflichtige Rezepte. Nutzer sollen außerdem
**eigene Rezepte veröffentlichen und teilen** können. (Note: berührt damit
auch `#23` Premium/Monetarisierung — Kopplungspunkt vormerken.)

### #22 — Erweiterte Analytics & Report-Generator

**Nutzer-Feedback:** **Vorerst zurückgestellt.**

### #23 — Premium-Features & Monetarisierung

Offene Frage im Epic selbst: was liegt überhaupt hinter der Paywall, und wie
verträgt sich das mit dem Datenschutz-Versprechen?

**Nutzer-Feedback:** Wurde bereits an mehreren Stellen mit angesprochen
(Meal-Planner `#15`, Kochmodus `#19`, Rezept-Sharing `#21`) — Monetarisierung
ist ein **Querschnittsthema**, kein isoliertes Epic.

**Bisher gesammelte Paid-Kandidaten (Stand 2026-08-12):**
- `#15` — vollautomatische Einkaufslisten-Übernahme ohne Kuratieren
- `#19` — kompletter interaktiver Kochmodus, plus separat Timer-Automatik/
  Sprachsteuerung/Video-Erkennung
- `#21` — einzelne kostenpflichtige Rezepte (App-eigene Rezeptdatenbank)
- `#24` — eventuell Homescreen-Widgets
- `#14` — automatisches Hinzufügen zur Einkaufsliste bei "Bestand knapp"

**Entschieden (2026-08-12): Modell ist ein Abo, kein Einzelkauf.** Alle
gesammelten Paid-Kandidaten hängen an **einem Abonnement**, nicht an
Einzelkäufen pro Feature oder pro Rezept. Technisch heißt das: RevenueCat
(`react-native-purchases`) mit einer einzigen Subscription-Freischaltung
reicht — kein Konsumierbare-Käufe-System (keine Verbrauchsgüter/In-App-
Einzelkäufe) nötig.

**Entschieden (2026-08-12): eine Abo-Stufe für alles, vorerst.** Eine
zweite/günstigere Einstiegsstufe bleibt eine mögliche spätere Erweiterung,
falls die Paid-Kandidaten-Liste wächst — kein Thema für den ersten Bau.

### #24 — Homescreen-Widgets

**Nutzer-Feedback:** **Vorerst zurückgestellt.** Eventuell ebenfalls ein
**Paid Feature**.

---

## Priorität/Status auf einen Blick (Stand dieser Konversation)

| # | Epic | Status laut Nutzer |
|---|---|---|
| 11 | Einkaufsliste → Bestand | Noch nicht fertig (MHD fehlt); Vorausfüll-Mechanismus entschieden (Kategorie→Historie, Schwellwert 7) |
| 12 | Rezept-Manager | Hohe Priorität; Baukasten-Datenmodell entschieden (Komponenten, rekursiv, UI-Limit 2 Ebenen) |
| 13 | Fortschritts-Charts | Wegwerf-Prototyp entschieden (Optik+Performance als Kriterien) |
| 14 | Push-Benachrichtigungen | Event-Regelwerk entschieden (nur Bestand-knapp, konfigurierbar); Auto-Add ist Paid |
| 15 | Meal-Planner | **Klasse-Feature**, hohe Priorität; Portionen/Personen-Modus statt Personen-Zuweisung entschieden |
| 16 | Preisvergleich | Unangetastet, nur Idee, keine Priorität |
| 17 | Health-Integration | Entschieden: direkt HealthKit iOS-first, kein Pedometer/manuell; niedrige Priorität |
| 18 | Intervallfasten | Erweitern zu generischem Fastenmethoden-Tracker, aber zurückgestellt |
| 19 | Kochmodus | Gut bewertet, erste Brainstorming-Runde durch (Navigation, Timer, Paid-Grenze); evtl. Paid; "Was kann ich kochen" später (KI) |
| 20 | Gamification | Grundsätzlich ja; XP/Streak/Achievement-Konzept mit Stufen (Bronze–Platin) steht; Level pro Account UND pro Haushalt |
| 21 | Rezept-Sharing | An Rezeptdatenbank gekoppelt, App-eigene Rezepte + Sharing, Paid-Kandidat |
| 22 | Analytics | Zurückgestellt |
| 23 | Monetarisierung | Entschieden: ein Abo-Modell (kein Einzelkauf), eine Stufe für alles |
| 24 | Widgets | Zurückgestellt, evtl. Paid |

## Neue, noch nicht erfasste Ideen

- **Prospekt-/Angebots-Tracking + Erinnerung** (aus der #14-Diskussion):
  Nutzer markiert ein im Prospekt gefundenes Produkt als "will ich kaufen",
  App erinnert am Tag, an dem der jeweilige Markt neue Prospekt-Ware
  einräumt. Kein eigenes Issue/Epic bisher — berührt `#14` (Push) und `#16`
  (PriceProvider/Märkte), ist aber inhaltlich eigenständig.

- **UI/UX Polish — Komponenten-/Block-System** (2026-08-12): aktueller
  Zustand wird vom Nutzer als "semi gut bis hin zu schrecklich" eingeschätzt,
  aber noch **ohne konkrete Vorstellung**, wie es besser aussehen soll.
  Langfristige Richtung: UI in **wiederverwendbare Komponenten/Blöcke**
  umbauen, die sich zu neuen Screens zusammenstecken lassen, statt jeden
  Screen einzeln von Grund auf zu bauen. Querschnittsthema wie `#23`, kein
  eigenes nummeriertes Epic — betrifft potenziell alle kommenden Screens
  (z. B. die für `#12` geforderte "gut geplante" Rezept-UI würde von einem
  solchen Baukasten direkt profitieren). **Noch zu tun:** konkrete
  Beispiele sammeln, was aktuell nicht gefällt, bevor daraus eine
  Design-System-Initiative wird.

- **`fridge_items`-Umbenennung zu `inventory_items`?** (aus der #14-Diskussion):
  Tabellenname ist historisch aus Welle 5 (nur Kühlschrank), deckt aber
  schon heute Kühlschrank/Tiefkühler/Vorratskammer über `storage_locations.
  kind` ab — der Name ist also irreführend. **Keine Entscheidung, nur
  vorgemerkt** — ein Rename zieht sich durch Sync-Layer (`entities.ts`),
  RLS-Policies, pgTAP-Tests und den Realtime-Kanal; eigener Migrations-Task,
  falls gewünscht, unabhängig vom Phase-2-4-Brainstorm.

## Überprüfungsschritt vor der Umsetzung

- **Wording-Review**: Bevor aus diesem Dokument Issues/Tasks werden, Namen
  von Tabellen, Funktionen, Spalten etc. einmal bewusst gegenprüfen — Anlass
  war `fridge_items`, das historisch bedingt irreführend benannt ist (deckt
  den ganzen Vorrat ab, nicht nur den Kühlschrank). Gilt auch für neue
  Namen, die aus Phase 2–4 entstehen (z. B. `recipe_components`,
  `meal_plans`), bevor sie in Schema/Code festgeschrieben werden.

## Offene Fragen (Sammlung)

- #20: `novaGroup` in `products` persistieren (Voraussetzung für
  "Gesunde Lebensweise"-Achievement); finale Zahlenwerte pro Stufe
  (Kalibrierung bei Umsetzung).
  - **Geprüft (2026-08-12):** `scripts/dump_data/create_custom_dump.py`
    (baut den lokalen Offline-Dump für `off-dump.ts`) extrahiert aktuell
    **kein** `nova_group`-Feld — nur `nutriscore`, `energy_kcal` und Makros.
    Skript müsste um `nova_group` erweitert werden, sonst funktioniert das
    Achievement nur für Produkte, die live über die OFF-API geladen wurden
    (nicht für den Offline-Produktbestand aus dem Dump).
