---
title: fam — Visual-UI-Inspiration-Recherche-Log (nativewind-styling)
date: 2026-09-03
---

# fam Visual-UI-Inspiration-Recherche-Log

Viertes und letztes Log dieser Reihe (siehe `fam-theme-research.md`,
`fam-ui-inspiration-research.md`, `fam-visual-effects-research.md`).
Behandelt Layout-/Kompositionsvokabular — das Äquivalent zur
Bento-Grid-/Icon-Tile-Übersicht aus `visual-ui-inspiration-research.md`
— für das, was tatsächlich auf fams `nativewind-styling`-Arbeit zutrifft.

## Scope

Dieselbe Quellenbeschränkung wie in den anderen drei Logs: die drei
Referenzdateien unter `/Users/marco/Downloads` (`index.ts`,
`ThemeProvider.tsx`, `ui.tsx`) plus fams eigene bestehende Screens. Für
diese Passe wurde keine externe App oder kein externes Repo untersucht —
das war nicht nötig, da das eigentliche Referenzmaterial lokal liegt und
bereits in `CAPABILITY_MAP.md` benannt ist.

## Layout-/Kompositionsmuster, die tatsächlich in `ui.tsx` stecken

Anders als die Bento-Grids und Icon-Tile-Dashboards des ui-Webprojekts
(die nicht zutreffen — fam ist eine Mobile-App mit eigenen bestehenden
Screen-Konventionen, gemäß der Feature-First-Architektur in `AGENTS.md`)
ist das relevante Vokabular hier die kleinere Menge an **strukturellen
Primitiven**, die der Komponentenvertrag benennt:

| Primitive | Kompositionsrolle | Bestehendes Fam-Äquivalent, das sie ersetzt |
| --- | --- | --- |
| `Row` | horizontales Flex-Layout, Ausrichtung, Gap | ad hoc verstreute `flex-row`-className-Nutzung je Screen |
| `Spacer` | vertikaler Rhythmus | ad hoc `mt-*`/`mb-*`- bzw. `gap-*`-Klassen |
| `Divider` | Listen-/Abschnittstrennung | ad hoc `border-b`-Klassen mit uneinheitlicher Farbquelle |
| `SectionHeading` | Titel + optionale nachgestellte Aktion | Muster, das bereits informell über Screens hinweg genutzt wird, aber noch nicht konsolidiert ist |
| `EmptyState` | Leerzustand-Meldung + optionale Aktion | fam hat bereits einen entsprechenden Bedarf (gemäß der Reverse-States-Regel in `AGENTS.md` — jede Liste braucht einen durchdachten Leerzustand) |

Keines davon ist ein neuartiges UI-Konzept — es ist dasselbe
Layout-Vokabular, das fams Screens bereits verwenden, nur aktuell als
wiederholte Inline-Tailwind-Klassen ausgedrückt statt als ein Vertrag. Die
"Inspiration" hier ist interne Konsolidierung, kein Import eines
externen Musters.

## Was bewusst NICHT übernommen wurde

- **Bento-Grids / Icon-geführte Tiles** — kein Fam-Screen in dieser
  Codebase nutzt dieses Muster, und die Spec verlangt keins. Es zu
  übernehmen wäre genau die Art unangeforderten visuellen Redesigns, die
  `CAPABILITY_MAP.md` ausschließt ("Ein vollständiges visuelles Redesign
  der App" ist ein Nicht-Ziel).
- **Ring-Fortschrittsanzeigen, Stat-Dashboards, horizontale
  Snap-Karussells** — ui-Web-spezifische Kompositionen ohne
  Gegenstück-Anforderung in irgendeiner `SPEC-*.md`-Datei dieser
  Initiative. Nicht bewertet, nicht übernommen.
- **Eine zweite Display-Schriftart** — fams Typografievertrag
  (`SPEC-typography-contract.md`) leitet jede Größe/Gewicht/Zeilenhöhe
  aus der bestehenden `Typography`-Tabelle in `src/constants/theme.ts`
  ab. Diese Passe führt keine neue Schriftfamilie ein.

## Die eine wirklich folgenreiche Entscheidung: `Surface` statt `ThemedView`

Die folgenreichste "Visual-UI"-Änderung dieser Passe ist keine neue
Kompositionsform, sondern die Reparatur einer kaputten: `ThemedView`s
`lightColor`-/`darkColor`-Props werden heute stillschweigend ignoriert
(Problemzeile "Views" in `SPEC.md`). `Surface` ersetzt das durch eine
kleine, geschlossene Menge semantischer Töne (`page`, `surface`, `soft`,
`selected`, `accent`) statt freier Farb-Props — derselbe Instinkt
"kleines geschlossenes Vokabular statt freier Werte", der sich durch den
gesamten Token-Vertrag zieht (`fam-theme-research.md`), hier auf
Komposition statt Farbe angewendet.

## Status: Spec vollständig, noch nicht implementiert

Wie bei den anderen drei Logs beschreibt alles hier, wozu sich
`docs/specs/nativewind-styling/SPEC-component-contract.md` und
`SPEC-native-boundaries.md` bereits schriftlich verpflichten. `git status`
zeigt zum Zeitpunkt des Schreibens die Spec-Dateien als
staged/hinzugefügt und `src/components/theme/{index.ts,ThemeProvider.tsx,ui.tsx}`
als vorhanden, aber noch nicht in den Rest der App migriert (kein
Production-Screen importiert bisher `Txt`, `Surface` oder den neuen
`Button`). Die Build-Reihenfolge laut `CAPABILITY_MAP.md` ist:

```
token-integrity → theme-runtime → typography-contract →
core-ui-contract → native-boundaries → verification-matrix
```

Diese Log-Reihe (`fam-theme-research.md` bis hierher) dokumentiert die
*Entscheidungsgrundlage* hinter dieser Reihenfolge, nicht die Behauptung,
die Implementierung sei fertig — es gab keine Geräteprüfung, keine
Screen-Migration und keine Screen-Mocks als Teil der Erstellung dieser
vier Dokumente.
