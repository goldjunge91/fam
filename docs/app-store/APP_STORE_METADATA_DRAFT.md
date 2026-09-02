# fam — App Store Arbeitsentwurf

> Status: Arbeitsentwurf für #328. Noch nicht final in App Store Connect übertragen.
> Die Texte beschreiben ausschließlich Funktionen, die im aktuellen Build vorhanden oder
> als bestehender Kernbereich umgesetzt sind.

## Technischer Abgleich

| Feld | Aktueller Stand |
| --- | --- |
| Store-Name | `fam` |
| iOS Bundle Identifier | `com.goldjunge91.fam1` |
| App-Version im Projekt | `0.0.5` |
| Zielplattform | iPhone; iPad-Unterstützung vor dem Upload bestätigen |
| Kostenmodell | Kostenlose Version mit Werbung; Premium werbefrei |
| Datenschutz-URL | Noch einzutragen |
| Support-URL | Noch einzutragen |
| Marketing-URL | Optional; noch einzutragen |

## Deutsch

### Name

`fam`

### Untertitel

`Haushalt gemeinsam planen`

### Werbetext

`Einkauf, Vorrat und Ernährung gemeinsam organisieren.`

### Beschreibung

`fam bringt Haushalt, Einkauf und Ernährung an einen Ort.

Teilt Einkaufslisten mit eurem Haushalt, behaltet euren Vorrat im Blick und plant eure Mahlzeiten für die Woche. Produkte lassen sich manuell oder per Barcode erfassen. Mehrere Einkaufslisten und Geschäfte helfen dabei, den Einkauf übersichtlich zu organisieren.

Eigene Rezepte und der Essensplan unterstützen euch bei der Wochenplanung. Bestände mit Lagerort und Ablaufdatum machen sichtbar, was bald verbraucht werden sollte.

Für die persönliche Ernährung kannst du Kalorien, Nährwerte und Gewicht privat erfassen. Diese Daten bleiben von den gemeinsam genutzten Haushaltsdaten getrennt.

Die kostenlose Version enthält Werbung. Premium bietet zusätzliche Funktionen und ist werbefrei.

fam ist für den gemeinsamen Alltag gemacht: mehr Überblick beim Einkauf, ein organisierter Vorrat und eine klare Trennung zwischen Haushalt und persönlichen Daten.`

### Keywords

`Haushalt,Einkaufsliste,Vorrat,Essensplan,Rezepte,Kalorien,Nährwerte,Barcode`

## English

### Name

`fam`

### Subtitle

`Shared home, simple planning`

### Promotional text

`Organize groceries, pantry and nutrition together.`

### Description

`fam brings household organization, groceries and nutrition together in one place.

Share shopping lists with your household, keep track of your pantry and plan meals for the week. Add products manually or scan their barcode. Multiple shopping lists and stores help keep every trip organized.

Save your own recipes and use the meal planner to prepare the week. Pantry items can include a storage location and expiry date, so you can see what should be used soon.

For personal nutrition, you can privately track calories, nutrients and weight. These records remain separate from shared household data.

The free version includes advertising. Premium unlocks additional features and is ad-free.

fam is made for everyday life together: a clearer grocery routine, an organized pantry and a deliberate separation between shared and personal data.`

### Keywords

`household,shopping list,pantry,meal planner,recipes,calories,nutrition,barcode`

## URLs

Diese URLs dürfen nicht erfunden oder auf eine interne Dokumentationsdatei gesetzt werden.

- [ ] Öffentliche Datenschutz-URL festlegen und testen
- [ ] Öffentliche Support-URL festlegen und testen
- [ ] Optional: öffentliche Marketing-URL festlegen
- [ ] Links aus jedem geplanten Storefront und ohne Anmeldung erreichbar

## Screenshot-Arbeitsentwurf

Die finale Reihe wird aus dem finalen TestFlight-Build erstellt. Vorhandene Demo-Daten
müssen erkennbar Testdaten sein und dürfen keine privaten Daten enthalten.

| Reihenfolge | Motiv | Deutscher Text | English text | Quelle/Status |
| --- | --- | --- | --- | --- |
| 1 | Dashboard | `Alles für euren Haushalt im Blick` | `Your household at a glance` | `screenshots/dashboard_first_page_1-2.png`; neu exportieren |
| 2 | Einkauf | `Gemeinsam einkaufen, nichts vergessen` | `Shop together, forget nothing` | `screenshots/einkaufen_third_page_hauptansicht_alle_maerkte.png`; neu exportieren |
| 3 | Vorrat | `Vorrat und Ablaufdaten im Blick` | `Know what is in your pantry` | `screenshots/vorrats_hauptansicht.png`; neu exportieren |
| 4 | Rezepte aus dem Vorrat | `Passende Rezepte aus eurem Vorrat` | `Find recipes for what you have` | `screenshots/rezepte_second_page.png`; gegen finalen Build prüfen |
| 5 | Privates Tracking | `Persönliche Ernährung privat erfassen` | `Track nutrition privately` | Nur verwenden, wenn das Motiv zur aktuellen UI passt |

Der vorhandene dunkle Tracking-Screenshot wird nicht als Hauptmotiv verwendet, weil er
visuell nicht zur aktuellen App-Oberfläche passt.

## Asset-Status

- Icon-Vektorquelle: `assets/images/icon-fam-v4-pantry.svg`
- Raster-Icon: `assets/images/icon-fam-v4-pantry.png`
- Splash-Asset: `assets/splash/fam-splash-icon.png`
- Screenshot-Arbeitsmaterial: `screenshots/`
- iPhone-6.5-Screenshotmaterial mit passender Rohgröße: `screenshots/tagebuch/`
- Vor dem Upload: neue Screenshots mit dem finalen `fam1`-TestFlight-Build erzeugen

## Finaler Abgleich vor App Store Connect

- [ ] Name, Untertitel, Beschreibung und Keywords freigegeben
- [ ] Deutsche und englische Fassung geprüft
- [ ] Datenschutz- und Support-URL öffentlich erreichbar
- [ ] Altersfreigabe-Fragebogen beantwortet
- [ ] Screenshots aus dem finalen Build erstellt
- [ ] Screenshots für die tatsächlich unterstützten Geräte hochgeladen
- [ ] Premium, Werbung und Gesundheits-/Trackingfunktionen korrekt beschrieben
- [ ] Keine Aussagen zu nicht ausgelieferten KI- oder Zukunftsfunktionen
