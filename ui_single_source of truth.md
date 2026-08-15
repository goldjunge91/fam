### Schriftgrößen

| Verwendung           | Größe | Gewicht          |
| -------------------- | ----: | ---------------- |
| Seitentitel          | 23 px | Medium (500)     |
| Abschnittstitel      | 17 px | Medium (500)     |
| Fließtext / Werte    | 14 px | Regular / Medium |
| Hinweise / Metadaten | 12 px | Regular          |

Zusätzliche UI-Größen: **7, 8, 9, 10, 11, 13, 14, 17 und 25 px**.

Schriftfamilie: **SF Pro Text / Segoe UI / System Sans-Serif**
### Font Weights

| Verwendung                                |  Wert |
| ----------------------------------------- | ----: |
| Regular / normaler Text                   | `400` |
| Medium / Überschriften, Buttons und Werte | `500` |

Hinweis: Im allgemeinen Basis-CSS steht für normalen Text zusätzlich `430`. Im eigentlichen **fam-Designsystem** werden jedoch hauptsächlich **Regular (`400`)** und **Medium (`500`)** verwendet.

### Hauptfarben

| Farbe        | Hex       | Zuweisung                                    |
| ------------ | --------- | -------------------------------------------- |
| Aubergine    | `#705773` | Primärfarbe, Buttons, aktive Controls, Icons |
| Warmweiß     | `#F8F4EF` | Seitenhintergrund                            |
| Dunkler Text | `#312B32` | Primärer Text                                |
| Grün         | `#78906F` | Erfolg                                       |
| Orangebraun  | `#C58D57` | Hinweis / Warnung                            |
| Rot          | `#A6535D` | Kritisch, Fehler, Löschen                    |

### Ergänzende Farben

| Hex                   | Zuweisung                              |
| --------------------- | -------------------------------------- |
| `#EEE5EC`             | Sekundäre Buttons und Flächen          |
| `#FFFFFF`             | Eingabefelder und ausgewählte Controls |
| `#D9CED7`             | Eingabefeld-Rahmen                     |
| `#CFC3CE`             | Outline-Button-Rahmen                  |
| `#756D77` / `#786F79` | Sekundärer Text                        |
| `#AAA2AA`             | Platzhalter und deaktivierter Text     |
| `#F2E2E4`             | Heller Fehler-Hintergrund              |
| `#E0EADF`             | Heller Erfolgs-Hintergrund             |
| `#F1E3CF`             | Heller Hinweis-Hintergrund             |

### Dark Mode

| Hex       | Zuweisung          |
| --------- | ------------------ |
| `#181518` | Seitenhintergrund  |
| `#272228` | Karten / Bereiche  |
| `#211D22` | Eingabefelder      |
| `#F5EEF5` | Primärer Text      |
| `#AAA0AC` | Sekundärer Text    |
| `#896B8D` | Primärfarbe        |
| `#3B313D` | Sekundäre Flächen  |
| `#4B424C` | Rahmen             |
| `#452C31` | Fehler-Hintergrund |


Ja.

### Gradients

| Verwendung               | Wert                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------- |
| Heller Hintergrund       | 2 radiale Verläufe: `rgba(255,190,154,.44)` und `rgba(190,171,221,.30)` auf `#F8F4EF` |
| Dunkler Hintergrund      | `rgba(144,91,82,.22)` und `rgba(113,80,132,.22)` auf `#181518`                        |
| Rezeptbild 1             | `linear-gradient(135deg, #D6A47F, #8B6F71)`                                           |
| Rezeptbild 2             | `linear-gradient(135deg, #82947C, #D1B889)`                                           |
| Avatar                   | `linear-gradient(145deg, #B47C7E, #775E79)`                                           |
| Bottom-Navigation hell   | `linear-gradient(transparent, #F5F0ED 45%)`                                           |
| Bottom-Navigation dunkel | `linear-gradient(transparent, #211D22 45%)`                                           |

### Schatten

| Element             | Schatten                         |
| ------------------- | -------------------------------- |
| Hauptfläche hell    | `0 18px 54px rgba(46,34,49,.13)` |
| Hauptfläche dunkel  | `0 18px 54px rgba(0,0,0,.32)`    |
| Karten hell         | `0 9px 25px rgba(61,47,63,.055)` |
| Karten dunkel       | `0 9px 25px rgba(0,0,0,.14)`     |
| Primärbutton        | `0 8px 18px rgba(79,54,82,.17)`  |
| Großer Add-Button   | `0 11px 22px rgba(72,50,76,.25)` |
| Bottom Sheet hell   | `0 -8px 24px rgba(50,39,52,.10)` |
| Bottom Sheet dunkel | `0 -8px 24px rgba(0,0,0,.20)`    |
| Toast               | `0 12px 25px rgba(0,0,0,.18)`    |
| Fokus-Ring          | `0 0 0 3px rgba(112,87,115,.12)` |

### Overlay

Modal-/Bottom-Sheet-Overlay:

```css
background: rgba(33, 27, 34, 0.34);
```

Also: dunkles Aubergine-Schwarz mit **34 % Deckkraft** über dem gesamten Bildschirm.