# Vertrag: Screens und Navigation

## Zuständigkeit

Screen bündelt Safe Area, Hintergrund, Inhaltsbreite, Scrollen, Tastatur,
unteren Freiraum und Header. Es verwendet Tokens aus
[index.ts](../../../src/components/theme/index.ts), die aktive Palette aus dem
ThemeProvider und gemeinsame Darstellung aus
[ui.tsx](../../../src/constants/ui.tsx). HubScreen und andere Kompositionen
verwenden dieselben Regeln. Fachscreens wählen Datenzustände und Aktionen;
Kamera und Medienviewer dürfen einen begründeten nativen Container verwenden.

## Header und Navigation

chrome ist der Hauptbereich mit Menü, Titel, Aktionen und Profil; back ist eine
Unterseite mit Historie und optionalem Fallback. Ein normaler Titel ist für
einfache Screens. ScreenHeader kann denselben Vertrag gezielt manuell
komponieren. chrome und back werden nicht gleichzeitig verwendet. Navigationswege
und Aktionen bleiben erhalten; diese Regeln schreiben keine neue
Informationsarchitektur vor.

SectionHeading kommt ausschließlich aus ui.tsx. Es bietet title, optional
eyebrow, titleVariant, action/onAction und lokales style. Der Default ist
heading; body ist eine bewusste Wahl für bestehende Hierarchie. Eine Aktion ist
nur mit sichtbarem Namen und Callback interaktiv, hat Button-Semantik und einen
wirksamen Touchbereich. Pressed- und Reduced-Motion-Feedback verwenden Press.
Consumers erfinden keine semantische Farbe, Typografie oder Pressable-Darstellung.

Lange Titel und große Schrift dürfen umbrechen. Aktionen bleiben erreichbar und
drücken Titel nicht unlesbar zusammen. Neue dekorative Untertitel werden nicht
eingeführt. Änderungen an konkreter Header-Copy oder Anordnung benötigen die
Mockauswahl nach AGENTS.md.

## Scrollen, Insets und Tastatur

- Pro Inhaltsbereich verantwortet genau ein Container das Scrollen. FlashList
  wird nicht in ScrollView verschachtelt.
- Safe-Area-Insets werden einmal berücksichtigt. Gemeinsame Aktionsmaße kommen
  aus Tokens, native Insets bleiben Laufzeitwerte.
- Letzte Zeile und Aktionen bleiben über globalen Aktionsflächen erreichbar;
  lokales Padding reserviert denselben Freiraum nicht doppelt.
- Tastatur und Sheets verdecken keine Eingabe oder Bestätigungsaktion. Für die
  Toolbar-Verantwortung gilt [Vertrag 08](./08-fields-and-selection.md).
- Rotation und Web-Resize aktualisieren das Layout ohne Neustart. Die zentrale
  maximale Inhaltsbreite bleibt in den Theme-/Layoutwerten definiert.

## Inhalte und erreichbare Aktionen

Bei schmaler Breite und großer Systemschrift bleiben notwendige Informationen und
Aktionen erreichbar. Schrift wird nicht pauschal verkleinert; Screens laufen
nicht horizontal über. Fachliche Grids und Filter dürfen horizontal scrollen,
wenn sie bedienbar bleiben.

Einkaufszeilen behalten erkennbare Namen und nicht überlagerte Mengen/Preise.
Vollständige Information bleibt erreichbar, auch wenn die Anzeige gezielt kürzt.
Mengenformatierung und Preislogik ändern sich nicht im Rahmen dieser Layoutregeln.

Long-Press und Swipe behalten eine erreichbare alternative Aktion, wenn die
Geste allein nicht zugänglich bedienbar ist. Lade-, Fehler- und Datenzustände
folgen [Vertrag 10](./10-accessibility-and-states.md). Ein fehlender Haushalt
ist kein leerer Datenbestand; lokal vorhandene Daten bleiben offline nutzbar.

## Nachweis

Gezielte Prüfungen bewerten Header, Scrollen, Insets und betroffene Aktionen.
Native Prüfung umfasst Tastatur, Sheet, Sync-Banner, lange Listen, Titel und
große Schrift. Web-Resize und native Rotation sind getrennte Fälle. Ein
Web-Screenshot belegt kein natives Verhalten.
