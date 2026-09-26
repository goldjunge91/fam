# Vertrag: Theme und Farben

## Zuständigkeit

Paletten und Farbwerte liegen in [index.ts](../../../src/components/theme/index.ts).
Semantische Farbpaare und Komponentenrezepte liegen in [ui.tsx](../../../src/constants/ui.tsx).
Der ThemeProvider wählt die aktive Palette.

## Theme-Regeln

- Texte, Flächen, Konturen, Cursor, Icons und Zustände folgen der aktiven
  Theme-Präferenz. system folgt laufenden Betriebssystemänderungen; explizites
  light oder dark bleibt unabhängig davon.
- Ein Themewechsel braucht keinen Remount und erhält Formulareingaben und Fokus.
  Der bestehende Präferenzschlüssel bleibt kompatibel. Ohne verfügbare
  Persistenz funktioniert die Auswahl in der Sitzung weiter.
- Produktcode verwendet keine statische Light-Palette für themeabhängige
  Darstellung und erfindet keine zweite Theme-Auflösung.
- Screens wählen semantische Rollen statt eigener Hexwerte.

## Farbpaare und Semantik

Gefüllte Aktionen, Status und Badges brauchen ein geprüftes Vordergrund-/
Hintergrundpaar. Status und Auswahl bleiben zusätzlich über Text, Symbol oder
Form erkennbar. Schattenfarben sind nur für Schatten bestimmt.

Domain- und Medienfarben bleiben bei ihrem Fach- oder Integrations-Owner, wenn
sie externe Kennzeichnung oder nutzergewählte Werte darstellen. Sie werden nicht
in die globale Palette kopiert.

### SpeedDial

SpeedDial-Aktionsflächen sind gemeinsame UI-Semantik und liegen als Tokens in
index.ts. Die Feature-Registry trägt nur den semantischen Theme-Key, keine
Hexwerte oder zweite Farbzuordnung. Consumers lösen den Key über die aktive
Palette auf.

## Kontrast

Informativer Text, einschließlich Placeholder und Metadaten, erreicht mindestens
4,5:1. Notwendige nichttextliche Zustandsmerkmale und Fokusindikatoren erreichen
mindestens 3:1 gegenüber angrenzenden Farben. Das Textziel gilt auch für große
Schrift. Deaktivierte Controls sind vom 4,5:1-Textziel ausgenommen, bleiben
aber erkennbar. Informative Status-Badges fallen nicht unter diese Ausnahme.

Transparenzen werden gegen den tatsächlichen Untergrund bewertet. Bei Verläufen
zählt der ungünstigste Hintergrund hinter dem Inhalt. Rein dekorative Konturen
brauchen keinen künstlich erhöhten Kontrast.

Quellen: [W3C Textkontrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
und [W3C nichttextlicher Kontrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).
