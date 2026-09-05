# Spezifikation: Konsistentes fam-Design-System

Status: vollständige Spezifikation; normative Zielverträge überarbeitet, Planung und Codeumsetzung ausstehend  
Stand: 2026-09-05  
Initiative: `ui-consolidation`  
Beads: `fam-jgi` (Erstellung dieser Spezifikation)  
Contracts-Überarbeitung: `fam-c6m`, auf ausdrücklichen Folgeauftrag vom 2026-09-05  
Phase: Specify. Implementierungsplan, Arbeitspakete und Umsetzung folgen separat.

## 1. Ziel und Erfolg

fam erhält eine konsistente, zugängliche UI auf Basis des vorhandenen Design-Systems. Dieselbe Aktion, Information und Auswahl verwendet überall dieselben Darstellungs- und Interaktionsregeln. Themewechsel, größere Schrift, Ladezustände und Offline-Nutzung bleiben verständlich und bedienbar.

Für Endnutzer bedeutet das lesbare Statusinformationen, verlässliche Touchziele, erkennbare Auswahl- und Fehlerzustände sowie erreichbare Aktionen auch bei wenig Platz. Für Entwickler bedeutet es eine eindeutige Antwort auf die Frage, welche Komponente und welches Rezept verwendet werden müssen.

Erfolg ist erreicht, wenn die Anforderungen und Abnahmekriterien dieses Dokuments erfüllt sind und die normativen Verträge, die Referenzseite und der Produktcode denselben Zustand beschreiben. Eine bloße Umbenennung oder Aufteilung von Dateien erfüllt dieses Ziel nicht.

### 1.1 Ausgangsauftrag und Annahmen

- Grundlage sind der UI-Code-Review vom 2026-09-05 und die bestehenden Design-System-Verträge.
- Der Auftrag dieser Phase ist die vollständige Spezifikation. Es werden keine Produktkomponenten geändert und keine Implementierungsreihenfolge festgelegt.
- Die warme Mauve-/Creme-Identität, bestehende Funktionen und die drei zentralen Verantwortlichen bleiben erhalten.
- Sichtbare Änderungen an Dichte, Layout und Copy benötigen vor der Implementierung mehrere statische Mocks und eine Auswahl durch Marco.
- Die Zielverträge wurden mit dem ausdrücklichen Folgeauftrag zur Überarbeitung der Contracts in die normative Dokumentation übernommen. Die Dokumentationsüberarbeitung autorisiert keine App-Codeänderung; konkrete Palette und Layoutvarianten bleiben gesonderte visuelle Entscheidungen.
- Der vorangegangene Review war eine statische Untersuchung mit Stichproben. Er ist kein vollständiger visueller Audit aller Screens und keine Bestätigung von Gerätekonformität.

### 1.2 Umfangsmodell

Diese Spezifikation behandelt die zusammenhängende Fähigkeit „konsistente Darstellung und Bedienung vorhandener fam-Funktionen“. Farben, Primitive, deren Verbraucher und die Prüfoberfläche bilden denselben UI-Vertrag. Sie werden hier als Anforderungsbereiche geführt, nicht als neue Laufzeitmodule, Bibliotheken oder unabhängig freigegebene Features.

| Bereichs-ID | Verantwortung | Voraussetzung innerhalb des Zielvertrags |
| --- | --- | --- |
| `foundations` | Tokens, Themeauflösung, Kontrast, Typografie und Maße | vorhandene fam-Identität |
| `primitives` | gemeinsame Darstellung und Interaktion | `foundations` |
| `consumers` | Anwendung in Komponenten, Screens und nativen Grenzen | `primitives` |
| `verification` | Referenzseite und nachweisbare Abnahme | alle vorgenannten Bereiche |

Die Tabelle beschreibt Verantwortlichkeiten. Sie enthält keine Taskliste oder Build-Reihenfolge. Eigenständige Produktfähigkeiten wie Auth, Bestandsverwaltung oder Tracking werden dadurch nicht neu spezifiziert.

## 2. Bestehende Quellen und Konfliktregel

Die aktuellen normativen Regeln stehen in [docs/design-system/contracts](../../design-system/contracts/README.md). README und alle zehn Verträge wurden auf ausdrücklichen Folgeauftrag am 2026-09-05 überarbeitet. Sie beschreiben den verbindlichen Zielzustand; noch abweichender App-Code und Referenzdarstellung sind Migrationsbestand. Diese Spezifikation enthält Begründung, Umfang und Abnahmekriterien, ist aber keine zweite laufende Designquelle. Weitere Entscheidungen werden in Spec und zuständigem Vertrag konsistent gehalten. Die Dokumentationsüberarbeitung ist kein Nachweis einer Codeumsetzung und keine Freigabe zur Implementierung.

`docs/specs/nativewind-styling/` ist historische Dokumentation. Daraus werden keine konkurrierenden aktuellen Verträge abgeleitet. Die bestehende Spec wird nicht überschrieben. Der in älteren Hinweisen genannte Pfad `docs/DESIGN_SYSTEM.md` war beim Review nicht vorhanden und wird nicht als zusätzliche Designquelle neu angelegt.

| Befund | Konkrete bestehende Quelle | Einordnung |
| --- | --- | --- |
| Doppelte Button-Darstellung mit verschiedenen Props, Ghost-Farben und Disabled-Opacity | `src/constants/ui.tsx`, `src/components/ui/buttons/button.tsx` | im Code bestätigt |
| Fokusfähiges `Field` und separates fehlerfähiges `TextField` | `src/constants/ui.tsx`, `src/components/forms/text-field.tsx` | im Code bestätigt |
| Zwei SegmentedControls mit verschiedenen APIs und Accessibility-Abdeckung | `src/constants/ui.tsx`, `src/components/ui/segmented-control.tsx` | im Code bestätigt |
| Schattenfarben als Textfarben in Accent-/Badge-Rezepten | `src/components/theme/index.ts`, `src/constants/ui.tsx` | im Code bestätigt; Kontrast berechnet |
| CSS-Variablen und System-Media-Query neben aktivem ThemeProvider | `src/global.css`, `src/components/theme/ThemeProvider.tsx` | im Code bestätigt; konkrete native Symptome noch zu prüfen |
| Fensterabhängige Tokens werden einmal beim Modulimport berechnet | `src/components/theme/index.ts` | im Code bestätigt; der Eingriff an `rs()` bleibt ausdrücklich klein und optional |
| Kleine Touchflächen und fehlende Auswahlmetadaten in einzelnen Primitiven | `ui.tsx`, `header-icon-button.tsx`, `segmented-control.tsx` | im Code bestätigt; tatsächliche Trefferbereiche geräteseitig prüfen |
| Leere Inhaltsfläche während Erstladen | Einkaufslisten- und Vorrats-Screen | im Code bestätigt |
| Referenzseite zeigt parallele Produkt- und Foundation-Varianten | `src/features/settings/dev/design-system/showcase-components.tsx` | im Code bestätigt |

### 2.1 Berechnete Kontrast-Baseline

Die Werte beziehen sich auf die deckenden Tokenpaare im Quellcode, nicht auf Screenshots. Transparenz, Verläufe und reale Hintergründe benötigen zusätzliche Prüfung.

| Paar | Modus | Verhältnis, gerundet |
| --- | --- | ---: |
| Weiß / primärer Mauve-Akzent | Light | 6,36:1 |
| Weiß / Danger-Button | Light | 4,07:1 |
| Warning-Text / `backgroundElement` | Light | 2,61:1 |
| Success-Text / `backgroundElement` | Light | 3,27:1 |
| Nicht-solides Pantry-Badge: `shadowCard` / `backgroundSoft` | Dark | 1,41:1 |
| Nicht-solides Saved-Badge: `shadowSheet` / `backgroundSoft` | Dark | 1,23:1 |

Die beiden Badge-Beispiele sind insbesondere in der Entwicklerreferenz belegt. Daraus wird keine Behauptung über deren flächendeckende Verwendung im Produkt abgeleitet.

## 3. Scope und Nichtziele

### 3.1 Enthalten

- Zentrale Tokens und Themeauflösung sowie die Semantik von Text-, Flächen-, Status- und Akzentpaaren.
- Gemeinsame Buttons, Icon-Aktionen, Textfelder, Auswahlkomponenten, Badges, Cards, Text, Leer-/Fehler-/Ladezustände und ihre tatsächlichen Produktadapter.
- Alle aktiven, von diesen Verträgen betroffenen UI-Verbraucher unter `src/components/` und `src/features/`, einschließlich vorhandener Plattformdateien.
- Semantische NativeWind-Migrationsbestände, die diese Verbraucher weiterhin verwenden.
- Responsive Bedienbarkeit, Systemschrift, Screenreader und reduzierte Bewegung auf iOS und Android, soweit die betroffene Plattform verfügbar geprüft werden kann.
- Konsistenz von Screen-/Sheet-Darstellung, Safe Area und Aktionsfreiraum, soweit durch die Konsolidierung betroffen.
- Referenzseite, gezielte Tests und Aktualisierung der normativen Design-System-Verträge.

Die bekannten Audit-Dateien sind Einstiegspunkte, keine abschließende Dateiliste. Die spätere Planung muss alle Verbraucher betroffener öffentlicher Exports sowie deren Plattformvarianten ermitteln. Vollständigkeit wird gegen diese ermittelte Menge geprüft.

### 3.2 Nicht enthalten

- Neue Produktfunktionen, Navigationsstruktur, globale Informationsarchitektur oder ein neues Branding.
- Änderungen an RLS, Supabase-Schema, SQLite-Schema, Outbox-Protokoll, Authentifizierung, Berechnungen, Zahlungslogik oder Datenbesitz.
- Austausch von NativeWind, React Query, Zustand, FlashList, Formular-, Gesture-, Animations- oder Storage-Libraries.
- Neue native Dependencies, SDK-Upgrades, Native-Build-Konfiguration, Store-Veröffentlichung oder Deployment.
- Einführung eines neuen UI-Frameworks, einer Theme-Bridge, eines Token-Generators oder einer allgemeinen Komponentenregistrierung.
- Pauschale Umstellung aller Icons, Entfernung des bestehenden 3D-Buttons oder Neugestaltung aller Screens.
- Fachfremde Bereinigung, etwa Änderung einer Listen-Engine allein aufgrund dieses Reviews.
- Neue Performance-Infrastruktur oder eine vollständige Screenshot-Snapshot-Suite.

### 3.3 Zulässige Integrationsausnahmen

Kamera-/Medienflächen, native Picker, SVG/Canvas/Charts, System-Sign-in und andere Drittanbieter-Views dürfen ihre benötigten nativen Props erhalten. Diese sind keine Erlaubnis, allgemeine fam-Farben oder Zustände lokal neu zu definieren. Offizielle Produktkennzeichnungen wie Nutri-Score, Inhaltsbilder und nutzergewählte Farben werden nicht pauschal in die Markenpalette umgefärbt.

Jede verbleibende Ausnahme wird in der zuständigen normativen Vertragsdatei mit Pfad, Grund, Plattform und Prüffall benannt. Ein Crash-Fallback außerhalb des ThemeProviders darf einen robusten festen Fallback besitzen. Bewusst falsche Beispiele im Entwickler-Screen bleiben klar als Gegenbeispiele gekennzeichnet. Unbenutzte Experiments werden nicht ohne Nachweis ihrer Erreichbarkeit als Produktfehler behandelt.

## 4. Zielarchitektur

### ARC-01: Genau drei Verantwortliche

| Datei | Besitzt | Besitzt nicht |
| --- | --- | --- |
| `src/components/theme/index.ts` | wiederverwendbare Werte, Light-/Dark-Paletten, Maße, semantische Tokentypen | Komponentenverhalten, Persistenz, einmalig gelesene Fenstergröße als Basis globaler Schriftmaße |
| `src/components/theme/ThemeProvider.tsx` | `system/light/dark`, Persistenz, aktive Palette, `useTheme`, `useThemedStyles` | zweite Palette, Feature-Daten, Formularzustand |
| `src/constants/ui.tsx` | Primitive und gemeinsame Rezepte für Typografie, Flächen, Farbpaare, Konturen, Zustände, Motion und Haptikzuordnung | Domänenlogik, Datenabfragen, zusätzliche Theme-Persistenz |

Höhere Komponenten besitzen Verhalten, Komposition, Accessibility-Metadaten und lokales Layout. Sie wenden zentrale Rezepte an. Ein weiterer Wrapper ist nur gerechtfertigt, wenn er eine bestehende Aufrufer-API oder echte Komposition erhält. Es entsteht keine Kette bloßer Umbenennungswrapper.

### ARC-02: Öffentliche APIs und Importgrenzen

- Der kanonische Button wird direkt aus `src/constants/ui.tsx` importiert. Seine bestehende `title`-API mit `sm/md/lg` bleibt der Zielvertrag; `link` und `flat` werden dort ergänzt. `label/default/large/compact` sind nur noch die zu migrierende Alt-API des Produkt-Buttons.
- `Txt`, `Surface` und reine gemeinsame Primitive bleiben über `src/constants/ui.tsx` erreichbar.
- `TextField` bleibt der Produkteinstieg für strukturierte Eingaben. `Field` und `TextField` teilen dieselbe Eingabebasis; bestehende Aufrufer dürfen nicht Fähigkeiten verlieren.
- Produkt-Einzelauswahl verwendet einen kanonischen `SegmentedControl` mit Gruppenlabel, `options`, `selected` und `onSelect`. Die bestehende Produkt-API ist Ausgangspunkt.
- `Card` und `EmptyState` dürfen Produktadapter bleiben, besitzen aber keine unabhängigen visuellen Rezepte.
- Legacy-APIs können vorübergehend als klar markierte Adapter auf derselben Basis bestehen. Zum Abschluss hat jede verbliebene API belegte Verbraucher und eine dokumentierte Zuständigkeit. Zwei konkurrierende Implementierungen für denselben Vertrag sind nicht zulässig.

### ARC-03: Styling und Overrides

`className` beschreibt ausschließlich einfaches statisches Layout. Semantische Zustände werden nicht mehr über `active:*`, `focus:*`, Farbklassen oder globale Komponentenklassen definiert. Lokale `style`-Props bleiben für Layout und native Integrationswerte verfügbar.

Bestehende `color`, `weight`, `backgroundColor` und allgemeine Style-Overrides werden nicht blind entfernt. Jeder semantische Produkt-Override wird auf eine zentrale Rolle abgebildet oder als begründete Integrationsgrenze dokumentiert. Die Verfügbarkeit eines Style-Props ist keine Designfreigabe. Eine Typisierung, die legitime React-Native-Props zerstört, ist kein Abnahmekriterium.

## 5. Foundations

### THEME-01: Eine aktive Themeentscheidung

Alle fam-eigenen Texte, Flächen, Konturen, Placeholder, Cursor und Zustände folgen der aufgelösten Provider-Präferenz. Das gilt insbesondere, wenn die App-Präferenz vom Betriebssystem abweicht. `system` folgt laufenden Systemänderungen; eine explizite Präferenz bleibt davon unabhängig. Themewechsel benötigt keinen Screen-Remount.

Die bestehende Gerätepräferenz und ihr Speicherschlüssel bleiben kompatibel. Bei nicht verfügbarer Persistenz funktioniert die Auswahl innerhalb der laufenden Sitzung weiter. Account-/Haushaltsdaten werden hierfür nicht gespeichert oder verschoben.

CSS-/NativeWind-Farben werden durch Migration der Verbraucher beseitigt, nicht durch eine neue Laufzeit-Bridge. Nach Abschluss sind verbleibende CSS-Farbdefinitionen entweder unbenutzt und entfernbar oder Teil einer ausdrücklich begründeten Ausnahme.

### COLOR-01: Lesbare Farbpaare statt zufälliger Kombinationen

- Jede unterstützte gefüllte Aktion und jedes Badge-Rezept besitzt einen expliziten Hintergrund und dazu passenden Vordergrund.
- Status-Textfarben werden getrennt von Statusfüllungen behandelt, wenn derselbe Wert den Kontrast nicht erfüllt.
- `onAccent` gilt nur für die dafür geprüfte Akzentfläche. Es ist keine universelle Schriftfarbe für beliebige Füllungen.
- Schattenfarben dienen ausschließlich Schatten. Sie sind kein Ersatz für Text-/Iconfarben.
- Texte einschließlich Placeholder und informative Metadaten erreichen mindestens 4,5:1 auf den tatsächlich vorgesehenen Flächen. Dieser konservative Produktwert gilt auch dort, wo große Schrift nach WCAG einen geringeren Wert erlauben würde.
- Erforderliche nichttextliche Zustandsmerkmale und Fokusindikatoren erreichen mindestens 3:1 gegenüber angrenzenden Farben. Nicht jede dekorative Card-Kontur muss dafür verstärkt werden.
- Inaktive Controls sind aus dem Textkontrastziel ausgenommen, bleiben jedoch erkennbar. Ein informatives Status-Badge gilt nicht als deaktiviertes Control.
- Transparenzen werden gegen den tatsächlichen Untergrund berechnet. Bei Verläufen zählt die ungünstigste relevante Stelle hinter Text oder Statusmerkmal; nötigenfalls wird eine definierte Textfläche verwendet.
- Fehler, Warnung und Auswahl werden zusätzlich durch Text, Symbol, Form oder Accessibility-Zustand verständlich.

Exakte korrigierte Hexwerte werden als Palette zur visuellen Review gestellt. Helligkeitskorrekturen dürfen die warme Farbidentität erhalten; es wird keine zusätzliche bunte Palette eingeführt.

### COLOR-02: Semantische Namen und Legacy-Grenze

Aktiver Produktcode verwendet die kanonischen Bedeutungen wie `accent`, `warning`, `danger`, `backgroundElement` und `textSecondary`. Historische Namen wie `basil`, `carrot`, `sky` oder `tomato` dürfen für die Migration intern zugeordnet bleiben, aber nicht die Grundlage neuer Rezepte sein.

Statische Light-Defaults (`colors`, `accent`, `theme.colors`) sind keine Quelle für themeabhängige Produktdarstellung. Vor Entfernung werden Verbraucher geprüft. `legacyWaivyColors` bleibt höchstens ausdrücklich historische Vergleichsdarstellung, ohne produktive Importe. Bestehende Domain-Accent-Keys dürfen weiterleben, wenn sie eine belegte Bedeutung und ein geprüftes Farbpaar haben; redundante Keys werden nicht durch neue ersetzt.

### TYPE-01: Stabile Typografie

Die sieben öffentlichen `Txt`-Varianten bleiben erhalten. Zielwerte bei Systemschriftfaktor 1,0:

| Variante | Größe / Zeilenhöhe | Gewicht |
| --- | ---: | ---: |
| `display` | 48 / 52 | 800 |
| `title` | 32 / 44 | 800 |
| `heading` | 20 / 26 | 700 |
| `subheading` | 17 / 24 | 700 |
| `body` | 16 / 22 | 400 |
| `label` | 13 / 17 | 600 |
| `caption` | 12 / 15 | 500 |

`rs()` bleibt als zentrale, begrenzte Designskalierung erhalten. Die Basisskala ist die gemeinsame Referenz bei Systemschriftfaktor 1,0; dargestellte Werte dürfen geräteabhängig abweichen. Der bestehende Waivy-nahe Istzustand von `rs()` bleibt unverändert, sofern eine Reaktivierung nicht mit einem sehr kleinen lokalen `useWindowDimensions()`-Helper möglich ist. Ein solcher Helper darf keinen neuen Provider, Context, kein Tokenobjekt und keine breite Consumer-Migration einführen. Andernfalls wird `rs()` in dieser Initiative nicht angefasst. Systemschrift-Skalierung bleibt aktiviert. Produktcode führt keine kompensierenden kleineren Schriften oder pauschalen `maxFontSizeMultiplier`-Limits ein. Komponentenspezifische Beschriftungen und Zahlenrezepte bleiben zentral in `ui.tsx`, ohne die öffentliche Variantenzahl zu erhöhen. Kleine Texte wie `rs(12)` werden an der tatsächlichen Darstellung auf schmalen Geräten auf Lesbarkeit geprüft.

### SPACE-01: Stabile Abstände und adaptive Anordnung

Die wiederverwendbare Basisskala lautet `xs=4`, `sm=8`, `md=12`, `lg=16`, `xl=20`, `xxl=28`, `xxxl=40` logische Einheiten. `rs()` skaliert diese zentral und begrenzt; der bestehende Waivy-nahe Istzustand bleibt erhalten, außer ein sehr kleiner lokaler `useWindowDimensions()`-Helper reicht ohne neue Infrastruktur und breite Consumer-Migration aus. Vorhandene feste Layoututilities dürfen weiterverwendet werden. Identische wiederkehrende Abstände müssen denselben Wert besitzen; eine zusätzliche Skala in der Tailwind-Konfiguration wird nicht aufgebaut.

Fensterabhängig dürfen sich Anordnung, Umbruch und nutzbare Breite verändern. Ein konkreter sichtbarer Layoutfehler darf lokal mit verfügbaren Fenstermaßen gelöst werden; eine allgemeine responsive Token-Laufzeit wird nicht eingeführt. Bei begrenzten Inhaltsspalten darf zusätzliche Fensterbreite die UI nicht unnötig vergrößern. Die bestehende maximale Inhaltsbreite von 600 bleibt Ausgangspunkt; ein Tablet-Redesign ist nicht enthalten.

Gemeinsame Mindesttouchgrößen, Header-/Aktionsmaße und unterer Freiraum werden zentral beschrieben. Kein durch `rs()` dargestelltes Touchziel darf unter 44 × 44 logische Einheiten fallen. Safe-Area-Werte werden jeweils genau einmal berücksichtigt. Lokale Sondermaße bleiben möglich, wenn sie tatsächlich nur lokales Layout lösen.

## 6. Komponenten- und Interaktionsverträge

### BTN-01: Buttons und Icon-Aktionen

Varianten bleiben `primary`, `secondary`, `danger`, `accent`, `ghost`, `link`; die kanonischen Größen sind `sm`, `md`, `lg`. Primary bezeichnet die hervorgehobene Aktion, Danger eine destruktive Aktion, Secondary eine weich hinterlegte Nebenaktion, Ghost eine flächentransparente Nebenaktion mit primärem Text und Link eine flächentransparente Textaktion mit Akzenttext.

Der kanonische Button liegt in `src/constants/ui.tsx` und verwendet `title`,
`onPress`, `variant`, `size`, `icon`, `accentKey`, `loading`, `disabled`,
`full`, `haptic`, `flat` und `accessibilityLabel`. Der bisherige Produkt-Button ist kein zweiter
Darstellungsvertrag. Bei der Migration werden `label` zu `title`,
`default` zu `md`, `large` zu `lg` und `compact` zu `sm` übersetzt.

Gefüllte Buttons behalten 4 Punkte sichtbare Tiefe und 4 Punkte Druckweg. Die bestehende Flat-Ausnahme für kompakte Header-Aktionen bleibt möglich. Gleiche Variante und Größe produzieren im kanonischen Foundation-Button und im Showcase dasselbe Rezept, einschließlich Foreground, Depth, Padding und Disabled-Darstellung.

Loading und Disabled blockieren Aktivierung und Haptik. Loading meldet `busy`; Disabled meldet `disabled`. Das Label bleibt lesbar. Ein Ladeindikator verschiebt die Beschriftung nicht überraschend. Mehrzeilige Labels dürfen die Höhe erhöhen.

Jede normale eigenständige Aktion besitzt mindestens 44 × 44 logische Einheiten tatsächlichen Touchbereich. Eine kleinere sichtbare Iconfläche ist erlaubt, wenn der Trefferbereich real erweitert wird, nicht vom Elternlayout abgeschnitten wird und nicht mit Nachbaraktionen überlappt. Eine reine Textlink-Aktion innerhalb eines Fließtextes wird gesondert beurteilt.

Icon-only-Aktionen brauchen eine verständliche Beschriftung. Ein dekoratives Icon erzeugt keinen zweiten Screenreader-Fokus. Interaktive Wrapper reichen unterstützte Accessibility-Props an das tatsächliche Ziel weiter.

### PRESS-01: Vollständige Ereignisse und Feedback

Gemeinsame Press-Wrapper führen ihre internen Effekte und übergebene `onPressIn`-/`onPressOut`-Handler jeweils genau einmal aus. Abbruch, Disabled-Wechsel und Remount dürfen keine dauerhaft gedrückte Darstellung hinterlassen. Verschachtelte Adapter lösen keine doppelte Animation oder Haptik aus.

Bestehende Haptik läuft ausschließlich über `src/lib/haptics.ts`. Der kanonische Button behält standardmäßig Medium, Auswahlaktionen Selection und generische Press-Aktionen ihren bisherigen Light-Default. Ein dokumentierter Override bleibt möglich. Ausgeschaltete Haptikpräferenzen werden nicht umgangen.

Reduzierte Bewegung respektiert die Systempräferenz. In diesem Modus entfallen federndes Überschwingen und Skalierung; ein sofortiger Zustand oder eine ruhige Farb-/Konturänderung erhält das Feedback. Es werden keine dauerhaften Pulse-, Shimmer- oder Blur-Animationen ergänzt. Bestehende kurzlebige native Busy-Indikatoren dürfen bleiben; statisches Erstladefeedback ist der Default für die betroffenen Listen.

### FIELD-01: Ein Eingabevertrag mit Fokus und Fehler

Die gemeinsame Eingabebasis unterstützt Label, Placeholder, Wert, native Input-Props, Fehlertext, Fokus, nicht editierbaren Zustand und optionale trailing action. Bestehende React-Hook-Form-Refs, Autofill, Secure-Text, Tastaturtypen und native Events bleiben nutzbar.

| Zustand | Erkennbare Darstellung | Semantik |
| --- | --- | --- |
| Normal | zentrale Surface, Text-/Placeholderfarben, Basiskontur | Label bezeichnet Eingabe |
| Fokussiert | Akzentkontur, Akzentlabel, Akzentcursor | Fokus bleibt bei Themewechsel erhalten |
| Fehler | lesbarer Fehlertext und Fehlerkennzeichnung | Feld und Meldung sind zugänglich verbunden |
| Fehler + Fokus | Fehler bleibt sichtbar; zusätzlicher Fokusindikator | weder Fokus noch Fehler gehen verloren |
| Nicht editierbar | zentraler Disabled-Zustand | keine Eingabe möglich, Zustand erkennbar |

Fokus-/Fehlerwechsel dürfen durch unterschiedliche Konturbreiten keine Nachbarelemente verschieben. Der bestehende Maßvertrag von 1,5 Punkten Basiskontur und 2 Punkten Fokuskontur bleibt erhalten; das zentrale Rezept gleicht die Geometrie aus. Explizite `accessibilityLabel`-/Hint-Props haben Vorrang vor abgeleiteten Defaults; Label und Fehler dürfen nicht versehentlich native Props überschreiben. Die Fehlermeldung bleibt unabhängig von diesen Overrides zugänglich dem Feld zugeordnet.

Einzeilige Felder behalten den bestehenden Done-/Submit-Vertrag. Mehrzeilige Eingaben und Formulare mit Next-/Submit-Steuerung dürfen ihn überschreiben. Bestehende KeyboardToolbar-Verantwortung liegt beim aktiven nativen Formular-/Screen-Kontext, bei überlagernden Eingaben gegebenenfalls beim Sheet; Adapter erzeugen keine zusätzliche Toolbar pro Feld und keine zweite gleichzeitig bedienbare Toolbar. Fokus-/Blur-Callbacks und Ref-Fokussierung funktionieren über die Produkt-API.

### SELECT-01: Auswahl, Filter und Badges

SegmentedControl hat einen zugänglichen Gruppennamen und genau einen ausgewählten Wert aus den Optionen. Labels, ausgewählter Zustand, Disabled-Zustand und Aktivierung werden korrekt weitergegeben. Für einen Ansichtswechsel sind Tab-Rollen passend; eine fachliche Formulareinzelauswahl muss als solche verständlich bleiben. Eine einzelne universelle Rolle darf nicht jede Auswahlart falsch beschreiben.

`Pill` und interaktive Filter melden Rolle und selected-/checked-Zustand passend zur Bedeutung. Erneutes Betätigen eines Mehrfachfilters kann ihn abwählen. Bei Einzelauswahl bleibt genau ein Wert aktiv. Ein `Badge` ist standardmäßig informativ und kein Button.

Lange Labels und große Systemschrift passen durch höhere Controls, Umbruch oder eine explizit horizontale Auswahlleiste. Der Mindesttouchbereich gilt auch für kompakte Segmente. Der aktive Zustand ist zusätzlich zur Farbe erkennbar. Öffentliche Props dürfen nicht stillschweigend ignoriert werden; das derzeit angenommene, aber ungenutzte `gap` benötigt eine wirksame Bedeutung oder eine abgeschlossene Aufrufermigration.

### SURFACE-01: Flächen, Karten und Hierarchie

`Surface` behält `page/surface/soft/accent`; Auswahl ist ein Interaktionszustand und kein weiterer Surface-Ton. Cards verwenden die gemeinsame Foundation. Layout allein benötigt keine Card. Antippbare Cards erhalten Feedback und eine passende zugängliche Rolle.

Es erfolgt keine pauschale Entfernung aller Rahmen oder Schatten. Dichte Listen sollen ohne dekorative Card-in-Card-Verschachtelung auskommen. Ob konkrete bestehende Cards, Badges oder Headerflächen entfallen, wird über ausgewählte Mocks entschieden. Die Anzahl wiederkehrender Informationen und erreichbarer Aktionen darf dabei nicht reduziert werden.

## 7. Screenverhalten und Datenzustände

### STATE-01: Zustände unterscheiden

| Situation | Erwartete Darstellung | Zulässige Aktion |
| --- | --- | --- |
| Erstladen ohne Daten | ruhiger, zugänglich benannter Ladezustand; für Vorrat/Einkauf statische zur Liste passende Platzhalter | Navigation bleibt möglich |
| Aktualisieren mit vorhandenen Daten | vorhandene Inhalte bleiben sichtbar; dezenter Aktualisierungszustand | bestehende erlaubte lokale Aktionen bleiben möglich |
| Erfolgreich geladen, tatsächlich leer | domänenspezifischer Leerzustand | passende vorhandene Hinzufügen-/Einladen-/Erstellen-Aktion |
| Filter/Suche ohne Treffer | „keine Treffer“, getrennt von leerem Gesamtdatenbestand | Suchbegriff/Filter zurücksetzen |
| Lesefehler ohne Daten | verständlicher Fehlerzustand, keine irreführende Leermeldung | gezielte Wiederholung der fehlgeschlagenen Abfrage |
| Aktualisierungsfehler mit Daten | Daten bleiben sichtbar; erreichbarer Wiederholhinweis | erneut lesen, keine Mutation wiederholen |
| Offline mit lokalen Daten | lokal verfügbare Inhalte und erlaubte Offline-Aktionen | bestehender Outbox-Workflow |
| Kein aktiver Haushalt oder fehlende Berechtigung | bestehender Household-/Zugriffszustand | vorhandener zulässiger Beitritts-/Erstellungsweg |

Loading, Error und Empty sind getrennte Zustände. Fehlender Haushalt wird nicht als leerer Vorrat ausgegeben. Der bestehende globale Sync-Banner bleibt für Sync zuständig; jedes Feature erzeugt keinen zweiten Offline-Banner. Offline allein ist kein Lesefehler des lokalen Mirrors.

Ein Retry verwendet die vorhandene Datenzugriffsgrenze. Er darf keine bereits ausgelöste Mutation erneut senden oder Datensätze anlegen. Rohfehler, Tokens und interne Identifikatoren erscheinen nicht in UI-Copy.

Ein universeller Async-Screen-Wrapper ist nicht erforderlich. Die Entscheidung über den Zustand bleibt in der Domäne, die gemeinsame Darstellung bleibt zentral. Native Spezialladezustände müssen nicht durch identische Listenskeletons ersetzt werden.

### SCREEN-01: Erreichbarkeit und Informationsdichte

Vorrat, Einkaufsliste, Dashboard, Rezepte und Essensplanung behalten ihre vorhandenen Hauptaktionen und Navigationswege. Long-Press-/Swipe-Aktionen bleiben erhalten und sind auch über eine zugängliche Alternative erreichbar, wenn die Geste allein nicht ausreichend bedienbar ist.

Bei 320 logischen Einheiten Breite und Systemschriftfaktor 2,0 bleiben primäre Aktionen, Eingaben und notwendige Informationen erreichbar. Kein pauschales Verkleinern der Schrift zum Einpassen. Kein horizontaler Screen-Overflow; ausdrücklich horizontale Filter oder fachliche Grids sind ausgenommen und zugänglich bedienbar.

Für Einkaufszeilen gelten: Produktname ist identifizierbar, Menge und Preis überlagern ihn nicht, Zahlen bleiben vergleichbar ausgerichtet. Ein gekürzter Name ist über eine zugängliche Detailansicht vollständig erreichbar. Die konkrete ein-/zweizeilige Anordnung ist eine Mockentscheidung. Mengenformatierung und Preisberechnung ändern sich nicht.

Header dürfen bei langen Titeln/großer Schrift wachsen oder kontrolliert umbrechen. Die letzte Listenzeile und ihre Aktionen lassen sich vollständig über globale Aktionsflächen scrollen. Tastatur, Sheet und Safe Area verdecken keine benötigte Eingabe oder Bestätigungsaktion. Pro Inhaltsbereich gibt es einen verantwortlichen Scrollcontainer; FlashList wird nicht in einen ScrollView verschachtelt.

## 8. Plattform- und Migrationsvertrag

### PLATFORM-01: Gleichwertige Ergebnisse

iOS und Android bleiben Zielplattformen und müssen dieselben semantischen Zustände und Produktfunktionen liefern. Native Darstellung darf plattformgerecht abweichen. Plattformnachweise werden je tatsächlich geprüfter Plattform separat dokumentiert; eine ungeprüfte Android-Abnahme wird nicht behauptet und ist für diesen ersten Konsolidierungsschritt kein Abschlusskriterium.

Es werden keine neuen `.android.ts`- oder `.android.tsx`-Kopien angelegt. Vorhandene Plattformdateien werden nur geändert, wenn sie direkt eine entfernte API importieren oder der Typecheck sonst bricht. Die drei zentralen Designverantwortlichen bleiben die Quelle der Regeln; Plattformdateien führen keine unabhängig gepflegte neue Palette ein.

### MIG-01: Sichere Übergänge

- Bestehende Aufrufer bleiben während eines abgegrenzten Änderungsschritts funktionsfähig. Adapter übersetzen Props, ohne das zentrale Rezept zu duplizieren.
- Eine alte API oder ein Tokenexport wird erst entfernt, wenn alle tatsächlichen Verbraucher einschließlich vorhandener Plattform- und Showcase-Varianten berücksichtigt sind.
- Neue Produktstellen verwenden sofort den Zielvertrag. Die Migration darf keine neue parallele Styling-Schicht benötigen.
- Jeder aufgespürte verbleibende semantische Sonderweg wird entweder migriert oder gemäß Abschnitt 3.3 ausdrücklich begründet. „Historisch gewachsen“ allein ist keine Ausnahme für den Endzustand.
- Tests, die bisher lediglich beliebige Style-Overrides festschreiben, werden gegen den tatsächlichen Vertrag bewertet. Sinnvolle Kompatibilitätsprüfungen bleiben erhalten; ein geänderter zulässiger Vertrag wird nicht durch Entfernen von Fehlermeldungen kaschiert.
- Persistenz, Datenmodelle und native Konfiguration benötigen für diese Konsolidierung keine Migration. Rollback erfolgt über die betroffene Codeänderung, ohne Datenkonvertierung.

### MIG-02: Bestehende Verträge gezielt aktualisieren

| Vertrag | Überarbeiteter Zielvertrag |
| --- | --- |
| `01-theme-and-colors.md` | geprüfte Farbpaare, Legacy-Grenze, keine Schatten als Vordergrund |
| `02-typography.md` | feste Basisskala, begrenzter `rs()`-Eingriff; Systemschrift und große Inhalte |
| `03-spacing-and-layout.md` | feste Abstandsskala, lokale Layoutreaktion nur bei Befund, Mindesttouchbereiche |
| `04-radius-shadow-gradient.md` | widersprüchliches positives Beispiel korrigieren; Kontrast auf Verläufen und erhaltene Schattenzuständigkeit; `Fonts` dem Typografievertrag zuordnen |
| `05-nativewind-and-stylesheet.md` | Ende aktiver semantischer Legacy-Verbraucher und explizite Ausnahmen |
| `06-surfaces-and-cards.md` | gemeinsame Foundation, Interaktion, Abgrenzung lokaler Komposition |
| `07-buttons-and-interaction.md` | kanonische Foundation-API, vollständige Events, 44-Punkte-Ziele, Motion und `link`/`flat` |
| `08-fields-and-selection.md` | gemeinsame Eingabebasis, Fokus + Fehler, Ref-/Callback- und Auswahlvertrag |
| `09-screens-and-navigation.md` | große Schrift, Aktionsfreiraum und eindeutige Scrollverantwortung |
| `10-accessibility-and-states.md` | messbare Kontrast-/Touchkriterien, Zustandsmatrix und native Nachweise |

Die Dokumentationsänderungen dieser Tabelle wurden mit dem Folgeauftrag zur Contracts-Überarbeitung vorgenommen. Die zugehörige Codeumsetzung und ihre Nachweise stehen aus. Die Contracts benennen diese Migrationsgrenze ausdrücklich.

### MIG-03: Vollständige Prüfung der bestehenden Vertragsdateien

Die nachfolgende Tabelle hält den Befund vor der Überarbeitung vom 2026-09-05 fest und umfasst README und alle zehn Verträge. Sie beschreibt nicht erneut den aktuellen Dateistand. Ein normativer Satz ist eine Anforderung, keine automatische Behauptung, dass jeder Verbraucher sie bereits erfüllt. Die frühere Formulierung „Vertrag umgesetzt“ wurde durch ausdrücklich als solche benannte Beispiele und separate Nachweisanforderungen ersetzt.

| Datei | Dokumentationsbefund | Konsequenz für die Überarbeitung |
| --- | --- | --- |
| `README.md` | Die drei Verantwortlichen sind korrekt beschrieben. Gültiger Vertrag, Migrationsbestand, Vorschlag und tatsächlich geprüfte Umsetzung werden nicht ausdrücklich unterschieden. | Rollen der Dokumente erläutern; auf den freigegebenen Änderungs-Spec verweisen, ohne eine neue konkurrierende Quelle zu schaffen. Positive Beispiele als Beispiele kennzeichnen, nicht als Abnahmestatus. |
| `01-theme-and-colors.md` | Richtiger Grundvertrag, aber keine Regeln für Vordergrund-/Hintergrundpaare, Kontrast oder aktive Verwendung statischer Light-Exports. Die Aussage zu fehlender CSS-Palette ist als Zuständigkeitsregel richtig; tatsächlich enthält CSS noch eine Legacy-Palette. | Normative Zuständigkeit und vorhandenen Migrationsbestand unterscheiden. Farbpaare, Statusrollen und Theme-Gegenpräferenz ergänzen. |
| `02-typography.md` | Die sieben Varianten sind klar. `rs()` ist ausdrücklich verbindlich. Optionale Overrides werden aufgelistet, obwohl spätere Absätze lokale Typografieentscheidungen verbieten. Der Waivy-Vergleich dokumentiert Herkunft statt einen aktuellen fam-Vertrag. | Abschaffung von `rs()` nur als freigegebene Vertragsänderung. Zulässige Layout-/Integrations-Overrides von semantischen Änderungen unterscheiden. Historische Begründung aus dem normativen Teil entfernen. |
| `03-spacing-and-layout.md` | Importzeit-Konstanten `SCREEN_W`/`IS_TABLET` und responsive Skalierung sind ausdrücklich benannt. Verhältnis zwischen festen NativeWind-Abständen und zentraler Skala bleibt unscharf. | Feste Basisskala als bewusste Änderung beschließen, aktuelle Layoutmaße reaktiv behandeln und die Bedeutung erlaubter Layoututilities eindeutig beschreiben. |
| `04-radius-shadow-gradient.md` | Das positive Beispiel `<View style={{ borderRadius: radius.md, ...shadow.sm }} />` setzt gemeinsame Darstellung direkt am Aufrufer. Das widerspricht der zentralen Rezeptzuständigkeit aus Vertrag 05. Der Shadow-Token enthält zudem eine feste Farbe. `Fonts` ist unter Radien/Schatten/Verläufen thematisch falsch eingeordnet. | Positives Beispiel durch Anwendung einer gemeinsamen Card-/Surface-Komposition ersetzen oder ausdrücklich als isolierte Tokenvisualisierung kennzeichnen. `Fonts` zu Vertrag 02 verschieben. Echte native Grenzen als solche benennen. |
| `05-nativewind-and-stylesheet.md` | Verantwortungsgrenze und Verbot einer Theme-Bridge sind bereits richtig. Der aktuelle Code verletzt sie an verschiedenen Stellen; das ist kein Grund, den Vertrag zu lockern. | Grundsatz beibehalten; konkrete Ausnahme- und Abschlussregeln ergänzen. Gegenbeispiele auch für hart codierte gültige Klassen und lokale semantische Styles zeigen, nicht nur für dynamisch ungültige Klassen. |
| `06-surfaces-and-cards.md` | Gemeinsame Card-Foundation und Vermeidung dekorativer Verschachtelung sind richtig. „Sie unterscheiden sich nur durch ihren Inhalt“ lässt lokale Komposition, Verhalten und erlaubte zentrale Varianten offen. | Gemeinsame Darstellung versus legitime Komposition präzisieren. Press-/Accessibility-Vertrag antippbarer Cards ergänzen; keine pauschale Abschaffung von Cards oder Schatten. |
| `07-buttons-and-interaction.md` | Produktimport, Varianten und 4-Punkte-Tiefe sind bereits explizit. Der Vertrag erklärt nicht den Umgang mit dem parallelen Produkt-Button, Flat-Ausnahme oder Reduced Motion. | Foundation-API und direkte Migrationsgrenze festhalten. Ereigniskomposition, Zustände, Haptik, Touchziele und Reduced-Motion-Ausnahme ergänzen. Zentrale Darstellung im Code durchsetzen. |
| `08-fields-and-selection.md` | Beschreibt `Field` und Fokus, aber nicht das produktive `TextField`, Fehler + Fokus, Refs, explizite Accessibility-Props oder konkrete Auswahlrollen. Die Kontur wechselt von 1,5 auf 2 Punkte ohne Regel zur Geometriestabilität. | Beide vorhandenen Einstiegspunkte unter einem Vertrag zusammenführen. Die Fokusmaße dürfen bleiben, sofern außen kein Layoutsprung entsteht; andernfalls die gewählte technische Lösung ausdrücklich in den Vertrag übernehmen. Fehler-/Auswahlmatrix und Submit-Ausnahmen ergänzen. |
| `09-screens-and-navigation.md` | Zuständigkeit des Screen-Gerüsts und Header-Modi sind richtig. Scroll-Owner, große Schrift, lange Titel und unterer Aktionsfreiraum fehlen als prüfbare Regeln. | Diese Regeln ergänzen, nicht die Navigationsarchitektur ersetzen. Native Spezialflächen dürfen weiterhin begründete eigene Container haben. |
| `10-accessibility-and-states.md` | Gute Mindestanforderungen, aber „44 Punkte“ benennt nicht beide Dimensionen oder den realen Trefferbereich. „Reduzierte Bewegung respektieren“ besitzt keinen Prüffall. Empty/Error/Refresh fehlen. | 44 × 44, reale Treffergrenzen, konkrete Assistenz-/Motion-Prüfung, Kontrastziele und vollständige Datenzustände ergänzen. |

Damit gab es drei unterschiedliche Änderungsarten: einen konkreten widersprüchlichen Lehrfall in Vertrag 04; inhaltliche Präzisierungen insbesondere in 01, 07, 08 und 10; und bewusste Änderungen des Typografie-/Spacing-Zielvertrags in 02 und 03. Diese Dokumentationsbefunde wurden mit dem Folgeauftrag in allen Vertragsdateien bearbeitet. Bestehende Codeabweichungen sind dadurch nicht behoben.

## 9. Referenzseite

### REF-01: Produkt als Referenz

`/settings/design-system` bleibt die einzige bestehende interaktive Designreferenz. Sie rendert die kanonischen Produktkomponenten und ihre zentralen Grundlagen. Legacy-Adapter dürfen als Kompatibilitätsbeispiele beschriftet werden, nicht als zweite empfohlene Variante.

Die Referenz deckt ab: alle öffentlichen Textvarianten, unterstützte Farbpaare, Surface-Töne, Buttonvarianten/-größen, Icon-Aktionen, Felder normal/focused/error/disabled, Auswahl aktiv/inaktiv/disabled sowie Empty/Loading/Error/Refresh mit Daten.

Die Prüfoberfläche enthält lange deutsche Beschriftungen und kann in Light/Dark betrachtet werden. Schmale Breite und Systemschrift werden auf verfügbaren Plattformen durch tatsächliche Geräte- und Fenstereinstellungen geprüft, nicht durch eine neue produktive Theme- oder Fontscale-Einstellung simuliert. Eine Android-Geräteprüfung wird in diesem ersten Dokumentationsschritt weder vorausgesetzt noch ohne Nachweis als bestanden geführt. Gegenbeispiele bleiben eindeutig getrennt. Dummy-Aktionen benötigen keine Produktionsdaten.

## 10. Technik, Struktur und Codestil

### 10.1 Bestehender Stack

Stand aus `package.json`: Expo `~57.0.19`, React `19.2.3`, React Native `0.86.3`, NativeWind `^4.2.6`, Reanimated `4.5.1`, Gesture Handler `~2.32.0`, FlashList `2.0.2`, MMKV `^4.3.2`. Diese Angaben sind deklarierte Abhängigkeiten, keine neue Installationsvorgabe. Lockfile und vorhandener Dev-Client bleiben maßgeblich.

React Query behält Server-/Cachezustand, Zustand UI-Zustand, React Hook Form + Zod strukturierte Formulare. Bestehende native Module benötigen den Dev-Client. Die [versionierte Expo-SDK-57-Referenz](https://docs.expo.dev/versions/v57.0.0/) wurde für diese Spezifikation konsultiert; konkrete native API-Änderungen benötigen weiterhin die jeweils passende versionierte Dokumentation.

### 10.2 Dateiverantwortung

```text
src/components/theme/index.ts                gemeinsame Tokens
src/components/theme/ThemeProvider.tsx        aktive Themeauflösung
src/constants/ui.tsx                         gemeinsame Primitive und Rezepte
src/components/ui/                          Komposition; kein doppelter Button
src/components/forms/                       native Formularintegration
src/components/layout/                      Screen-/Header-/Safe-Area-Verhalten
src/features/<domain>/                      Zustandsauswahl, Verhalten, lokales Layout
src/features/settings/dev/design-system/    lebende Referenz
src/app/                                    Routing
docs/design-system/contracts/               normative laufende Verträge
docs/specs/ui-consolidation/SPEC.md          Ziel und Abnahme dieser Initiative
```

Tests liegen bei den betroffenen Modulen. Bestehende Einstiegspunkte sind `src/constants/ui.test.tsx`, `src/components/theme/index.test.ts`, `src/components/theme/themed-text.test.tsx` und `src/components/layout/screen.test.tsx`. Neue gezielte Komponententests liegen neben dem jeweils kanonischen Primitive. Es werden keine Markdown-Dateien zur Aufgabenverwaltung angelegt; Arbeitspakete gehören später in Beads.

### 10.3 Codestil

TypeScript ohne neues `any`; Varianten als endliche Unions; Inferenz statt redundanter Interfaces; bestehende React-Native-Props soweit sinnvoll erhalten. Semantik wird in der Komponente ausgewählt, nicht aus Rohtokens im Screen zusammengesetzt. Ein zulässiges Beispiel mit bestehenden öffentlichen APIs:

```tsx
import { View } from 'react-native';
import { space } from '@/components/theme/index';
import { Surface, Txt, Button } from '@/constants/ui';

export function SaveSection({
  saving,
  onSave,
}: {
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <Surface tone="surface" style={{ padding: space.lg }}>
      <View className="flex-col" style={{ gap: space.md }}>
        <Txt variant="heading">Änderungen speichern</Txt>
        <Button title="Speichern" loading={saving} onPress={onSave} />
      </View>
    </Surface>
  );
}
```

Das Beispiel zeigt Komposition und Importgrenzen, keine neu einzuführende Wrapper-Komponente. Biome bleibt Formatter/Linter. Kommentare erklären Gründe, nicht Änderungshistorie. Produktcopy ist kurz, deutsch, ohne Em-Dash und ohne technische Implementierungsdetails.

## 11. Verifikation

### 11.1 Automatisierte Nachweise

- Reine Tokenprüfungen berechnen Kontrast für die tatsächlich unterstützten Paare beider Paletten; keine Behauptung, beliebige Kombinationen aller Farben seien zulässig.
- Theme-Tests prüfen persistierte Präferenz, Systemwechsel, explizite Gegenpräferenz und Verhalten ohne verfügbare Persistenz.
- RNTL-Tests prüfen Rollen, Namen, States, gesperrte Aktionen, einmalige Callbacks, Ref-Fokus, Fehlerausgabe, Haptikgrenze und relevante Produktszenarien.
- Kleine gezielte Style-Prüfungen sind zulässig, wenn sie einen zentralen Vertrag wie Farbpaare oder Mindestmaße belegen. Sie ersetzen keine Touch-/Layoutprüfung auf Geräten.
- Zustandsprüfungen für Vorrat und Einkauf unterscheiden Initial Loading, Empty, Filter ohne Treffer, Error und Refresh mit vorhandenen Daten.
- Architekturprüfung ermittelt semantische Legacy-Verbraucher und statische Light-Imports. Ein pauschaler Regex, der beispielsweise Produktfarben oder Kamera-Schwarz verbietet, ist nicht ausreichend.
- Vor Komponententeständerungen gelten `.agents/rules/react-native-testing-library.md` und die relevanten Testing-Skills. Benutzernahe Queries haben Vorrang vor Test-IDs und Bauminspektion.

Es gibt kein pauschales Coverage-Prozent und keine vollständige Testsuite als Abnahmebedingung. Jede relevante Vertragsänderung besitzt einen passenden Nachweis; bloße Implementierungsduplikate und Tests für entfernte Dekoration sind nicht erforderlich.

### 11.2 Visuelle und interaktive Prüffälle

| Dimension | Mindestfälle | Nachweis |
| --- | --- | --- |
| Plattform | Verfügbarer iOS-Dev-Client; Android-Dev-Client nur bei verfügbarer Prüfung | Plattform und Ergebnis separat dokumentiert; fehlende Nachweise werden offen benannt und sind für `fam-6zf.1` kein Android-Abnahme-Gate |
| Theme | System hell/dunkel; explizit hell bei dunklem System und umgekehrt; Wechsel bei geöffnetem Formular | Texte, Konturen, Flächen und Eingaben wechseln zusammen |
| Platz | 320 und 393 logische Einheiten, Tabletbreite ab 768, Rotation/Resize | kein verbotener Overflow oder Neustart nötig |
| Schrift | Faktor 1,0 und 2,0; zusätzlich größte angebotene Accessibility-Schrift als explorativer Grenzfall | bei 2,0 sind zentrale Aktionen und Informationen erreichbar; Grenzfälle ausdrücklich bewertet |
| Eingabe | Tastatur offen, Fehler + Fokus, trailing action, Disabled, mehrzeilig | Fokus/Ref/Submit und Erreichbarkeit korrekt |
| Assistenz | VoiceOver, TalkBack | Namen, Auswahl, Busy, Fokusfolge und Aktivierung |
| Bewegung | Reduced Motion an/aus | kein verpflichtendes Springen/Skalieren bei Reduktion |
| Daten | Zustände gemäß STATE-01; lokale Daten bei Offline | kein Datenverlust oder falscher Empty-Zustand |

Alle kanonischen Primitive werden in der Referenz für Light/Dark und große Schrift geprüft. In den Kernflows Vorrat, Einkauf und einem Auth-/Bearbeitungsformular werden die kritischen Kombinationen schmal + große Schrift + Dark sowie Tastatur + Fehler tatsächlich durchgespielt. Dashboard, Rezepte, Essensplanung und weitere migrierte Features erhalten eine gezielte Prüfung ihrer geänderten Verbraucher. Eine beliebige Vollkombination aller Screens ist nicht erforderlich.

Native Integrationsgrenzen wie Picker, Sheets, Swipeable, FlashList und SVG werden auf der betroffenen Plattform geprüft. Nicht erreichbare Geräte oder fehlende Testdaten werden als fehlender Nachweis benannt, niemals als bestanden.

### 11.3 Ausführbare Projektbefehle

Diese Befehle sind vorhandene Einstiegspunkte für spätere Validierung, keine jetzt auszuführende Implementierungsplanung. Pro Änderung wird nur die passende Auswahl verwendet.

```bash
# Zentrale Tests, gezielt und ohne Bun-eigene Testengine
bun run test --runInBand --runTestsByPath src/constants/ui.test.tsx src/components/theme/index.test.ts src/components/theme/themed-text.test.tsx

# Gemeinsames Screen-Gerüst
bun run test --runInBand --runTestsByPath src/components/layout/screen.test.tsx

# Betroffene Hauptscreens
bun run test --runInBand --runTestsByPath src/features/inventory/inventory-screen.test.tsx src/features/shopping-list/screens/shopping-list-screen.test.tsx

# Statische Projektprüfung nach Codeänderungen
bun run typecheck
bun run check

# Nur CSS-Validierung, wenn isoliert erforderlich
bun run check:css

# Bestehender Android-Entwicklungspfad, nur bei benötigtem Dev-Client
bun run android:development

# Bestehender iOS-Entwicklungspfad, ausschließlich auf geeignetem macOS-Host
bun run ios:dev

# Native-Baseline lesen; ein Mismatch ist kein Auftrag zum Neusetzen
bun run native:status

# Dokumentationsprüfung
git diff --check
git status --short
```

Die Skripte verwenden ihre vorhandenen Umgebungsdateien. Fehlende Dateien/Zugänge sind Voraussetzungsmängel; es werden dafür keine Secrets kopiert, Datenbanken gestartet oder Skripte umgebaut. Fehlende Plattformnachweise werden nicht als bestanden ausgegeben. Kein Store-Build ist für eine reine UI-JavaScript-Änderung erforderlich.

## 12. Abnahmekriterien und Rückverfolgbarkeit

| ID | Überprüfbares Ergebnis | Anforderungen / Nachweis |
| --- | --- | --- |
| AC-01 | Für jeden migrierten Komponentenvertrag existiert genau eine Darstellungsquelle; Adapter enthalten keine konkurrierenden Rezepte. | ARC-01/02, Import- und Codeprüfung |
| AC-02 | Explizite App-Präferenz setzt sich auf Text, Hintergrund, Kontur und Eingaben gegen das Systemtheme durch. | THEME-01, Provider-Test und Plattformmatrix |
| AC-03 | Alle unterstützten informativen Text-/Flächenpaare erfüllen 4,5:1 in Light/Dark; relevante nichttextliche Zustände erfüllen 3:1. | COLOR-01, Berechnung und reale Hintergrundprüfung |
| AC-04 | Schatten werden nicht als Textfarben verwendet; keine produktive Farbwahl hängt von statischen Light-Defaults ab. | COLOR-01/02, Verbraucherprüfung |
| AC-05 | Typografie und wiederkehrende Abstände verwenden bei Schriftfaktor 1,0 die gemeinsame Basisskala. `rs()` bleibt begrenzt im bestehenden Waivy-nahen Istzustand; eine reaktive globale Skala wird in dieser Initiative nicht eingeführt. | TYPE-01, SPACE-01, Tokenprüfung und gezielte lokale Layoutprüfung |
| AC-06 | Gleiche Buttonvarianten und -größen sind über den kanonischen Foundation-Button und die Referenz identisch; 4-Punkte-Tiefe und Flat-Ausnahme bleiben erhalten. Der doppelte Produkt-Button hat nach der Verbrauchermigration keine Verbraucher mehr. | BTN-01, zentraler Test, Importprüfung und native Prüfung |
| AC-07 | Normale eigenständige Aktionen haben mindestens 44 × 44 tatsächlichen Touchbereich ohne kollidierende Nachbarziele. | BTN-01, SELECT-01, Geräteprüfung |
| AC-08 | Disabled/Loading blockieren Aktionen und Haptik; Press-Callbacks laufen je Ereignis genau einmal und hinterlassen keinen hängenden Zustand. | PRESS-01, BTN-01, Interaktionstests |
| AC-09 | Produktfelder zeigen Fokus und Fehler gemeinsam, erhalten explizite Accessibility-Props, native Events, RHF-/Fokus-Refs und Toolbar-Verhalten. | FIELD-01, RNTL und Tastaturprüfung |
| AC-10 | Auswahlzustände sind visuell und per Assistenztechnik verständlich; ein Mehrfachfilter kann wieder abgewählt werden. | SELECT-01, RNTL/VoiceOver/TalkBack |
| AC-11 | Bei 320 Breite und Schriftfaktor 2,0 bleiben Hauptaktionen und notwendige Informationen ohne unerlaubten horizontalen Overflow erreichbar. | SCREEN-01, visuelle Matrix |
| AC-12 | Reduced Motion verhindert federndes Überschwingen und Skalierung; Zustandsfeedback bleibt verständlich. | PRESS-01, reale Präferenzprüfung |
| AC-13 | Vorrat und Einkauf unterscheiden Erstladen, echten Leerzustand, Filterleere, Fehler und Aktualisierung; vorhandene Daten bleiben bei Refresh/Offline sichtbar. | STATE-01, Zustands- und Interaktionstests |
| AC-14 | Alle ermittelten aktiven UI-Verbraucher einschließlich vorhandener Plattformvarianten verwenden die Zielverträge oder besitzen eine konkrete Integrationsausnahme. | ARC-03, PLATFORM-01, MIG-01 |
| AC-15 | Referenzseite, öffentliche APIs und normative Verträge beschreiben denselben Endzustand. | REF-01, MIG-02, Dokumentationsprüfung |
| AC-16 | Bestehende Funktionen, Datenzugriffsgrenzen, Offline-Mutationen und Gegenaktionen bleiben erhalten; betroffene Typ-/Lint-/Tests bestehen. | Scope, STATE-01, gezielte Regression der geänderten Flows |
| AC-17 | Sichtbare Layout-/Copy-Änderungen lassen sich auf ausgewählte Mocks zurückführen; nicht geprüfte Plattformen werden nicht als bestanden geführt. Eine Android-Geräteabnahme ist für `fam-6zf.1` kein Abschlusskriterium. | Abschnitt 1.1, Verifikation und Reviewnachweise |

## 13. Grenzen der späteren Umsetzung

### Immer

- Bestehende drei Verantwortliche, Design-System-Verträge und Plattformgrenzen beachten.
- Vor Änderungen betroffene Verbraucher und vorhandene Plattformvarianten prüfen; bestehende Funktionen und Gegenaktionen erhalten. Keine neuen Android-Kopien anlegen.
- Gezielte, zur Änderung passende Prüfungen ausführen und fehlende Nachweise offen dokumentieren.
- Für Native-API-Arbeit die exakten Expo-SDK-57-Dokumente lesen.
- Beads für Arbeitsstatus verwenden; Spec und spätere Planung als unterschiedliche Artefakte behandeln.

### Vorher eine konkrete Entscheidung einholen

- Sichtbare nichttriviale Layout-/Copy-Änderungen: mehrere statische Mocks vorlegen und Auswahl abwarten, wie in `AGENTS.md` verlangt.
- Scope-Erweiterungen, neue Dependencies, Änderungen an nativer Build-Konfiguration, Schema, Datenlogik oder Navigation: sind durch diesen Spec nicht freigegeben.
- Abweichungen von den überarbeiteten normativen Zielverträgen: Spec und betroffenen Vertrag zuerst aktualisieren.

### Niemals im Rahmen dieser Initiative

- Migrationen von Hand schreiben, lokale Supabase-Datenbank starten/stoppen, Produktdaten für UI-Tests zurücksetzen oder laufende Instanzen beenden.
- `bun test` oder die vollständige Jest-/DB-Testsuite ausführen.
- Semantische CSS-Klassen, eine NativeWind-Theme-Bridge oder weitere Designquellen neu einführen.
- Native Dependencies still installieren, Build-Lock-Mismatch ungeprüft neutralisieren oder automatisch deployen.
- Prüfungen als bestanden ausgeben, wenn nur Code gelesen oder eine andere Plattform getestet wurde.
- Ohne ausdrückliche Autorisierung committen oder pushen.

## 14. Entscheidungen für den Spec-Review

| Entscheidung | Ziel | Status / nächster Entscheidungspunkt |
| --- | --- | --- |
| D-01: Umfang | Alle aktiven Verbraucher der betroffenen gemeinsamen Verträge migrieren; fachlich begründete native Ausnahmen dokumentieren. | In Contracts als Ziel übernommen; konkrete Verbraucher und Arbeitspakete folgen in der gesonderten Planung. |
| D-02: Responsive Tokens | Gemeinsame Basiswerte bleiben die Referenz; `rs()` bleibt begrenzt im Waivy-nahen Istzustand oder erhält höchstens einen kleinen lokalen Helper ohne neue Runtime-Schicht und breite Consumer-Migration. Lokale Layoutreaktion und Umbruch bleiben möglich; Schrift respektiert die Systemeinstellung; Mindesttouchziele bleiben 44 × 44. | In Contracts 02/03 als begrenzter Zielvertrag dokumentiert; Codeumstellung ausstehend. |
| D-03: API-Konsolidierung | Vorhandene Produkt-APIs als kanonischen Einstieg erhalten; Foundation-/Legacy-APIs bei Bedarf als dünne Adapter. | In Contracts übernommen; Umsetzung und Prüfung der Adapter folgen separat. |
| D-04: Korrigierte Farbwerte | Bestehende Farbidentität mit explizit kontrastfähigen Paaren erhalten; keine Hexwerte ohne Prüfung festschreiben. | Palettenreview vor entsprechender Implementierung |
| D-05: Dichte und Zeilenlayout | Mehrzeilige Inhalte und größere Trefferbereiche ermöglichen; dekorative Flächen nur gezielt reduzieren. | Auswahl konkreter statischer Mocks vor Screenänderungen |

Offene technische Voraussetzungen für spätere native Nachweise sind verfügbare Dev-Clients und geeignete Testdaten. Das ändert den Zielvertrag nicht und steht der dokumentationsgetriebenen Korrektur von `fam-6zf.1` nicht entgegen. Eine Android-Geräteabnahme wird für diesen Task nicht behauptet oder verlangt; native Theme-, Touch- und Systemschriftverhalten bleiben außerhalb dieses Nachweises zu verifizieren.

Die Punkte D-01 bis D-03 sind mit der beauftragten Dokumentationsüberarbeitung als normative Ziele übernommen. D-04 und D-05 bleiben ausdrücklich spätere visuelle Auswahlentscheidungen. Der Folgeauftrag betrifft die Contracts, nicht die Implementierung; der Implementierungsplan entsteht erst im gesonderten Planungsschritt.

## 15. Quellen

- [Aktuelle Design-System-Verträge](../../design-system/contracts/README.md).
- Repository-Quellen und Befunde gemäß Abschnitt 2; Pfade beziehen sich auf das Repository-Root.
- [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/), konsultiert am 2026-09-05.
- [W3C: Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), Grundlage der Kontrastberechnung und des 4,5:1-Vergleichswerts. Das einheitliche Textziel dieses Specs ist bewusst strenger als die Ausnahme für große Schrift.
- [W3C: Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html), Referenz für notwendige nichttextliche UI-Zustandsmerkmale.

## 16. Übergabe dieser Phase

Liefergegenstände sind diese Spezifikation mit Zielverträgen und Abnahmekriterien sowie die auf Folgeauftrag überarbeiteten normativen Contracts. Das bedeutet nicht, dass AC-01 bis AC-17 bereits erfüllt oder App-Codeänderungen freigegeben sind. Der Implementierungsplan entsteht separat; erst danach werden daraus ausführbare Beads-Arbeitspakete abgeleitet.
