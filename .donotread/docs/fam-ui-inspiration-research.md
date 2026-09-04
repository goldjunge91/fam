---
title: fam — UI-Inspiration-Recherche-Log (nativewind-styling)
date: 2026-09-03
---

# fam UI-Inspiration-Recherche-Log

Begleitdokument zu [`fam-theme-research.md`](./fam-theme-research.md). Hält
fest, woher die *Interaktionsmuster* hinter den neuen `ui.tsx`-Primitiven
(`docs/specs/nativewind-styling/SPEC-component-contract.md`) stammen — im
selben Offenlegungsstil wie `ui-inspiration-research.md` in diesem Ordner.

## Quelle: die Waivy-Referenzdateien, kein Live-Crawl

`src/lib/haptics.ts` und `src/lib/streak.ts` existieren bereits in diesem
Repo (vor der Spec eingebracht, noch nicht mit echten Fam-Imports
verdrahtet — siehe die Problemtabelle in `SPEC.md`) und ihre eigenen
Doc-Kommentare benennen das Muster direkt:

> "Tuned for a Duolingo-style 'rewarding' feel: every tap has a tactile
> response, primary actions hit a little harder, and wins fire a
> celebratory burst." — `src/lib/haptics.ts`

> "Cooking streak — the Duolingo-style 'don't break the chain' reward."
> — `src/lib/streak.ts`

Für diese Passe wurde kein GitHub-Crawl durchgeführt; die Musternamen
kamen direkt aus den bereits im Baum liegenden Quelldateien. Duolingos
konkrete Button-Proportionen, Maskottchen, Farbwahl und
Streak-Flammen-Artwork werden nirgends in fam referenziert oder
reproduziert — nur das generische Interaktionsvokabular (abgestufte
Press-Feedback-Stärken, "die Kette nicht abreißen lassen"-Zähler), das in
gamifizierten Consumer-Apps allgemein üblich ist.

## Erfasste Muster

### Taktiles Press-Feedback (Haptik)

`haptics.ts` bildet UI-Intents auf `expo-haptics`-Aufrufe ab:

| Intent | Aufruf | Verwendet für |
| --- | --- | --- |
| `tap()` / `light()` | `ImpactFeedbackStyle.Light` | Standard-Tap |
| `medium()`, `heavy()`, `soft()`, `rigid()` | passende Impact-Styles | stärkere Primäraktionen |
| `selection()` | `selectionAsync()` | Wechsel in Segmented Control / Picker |
| `success()`, `warning()`, `error()` | `notificationAsync()` | Ergebnis-Feedback |
| `celebrate()` | gestufter Burst: `rigid` → `medium` (+90ms) → `heavy` (+180ms) → `success` (+300ms) | Streak-Meilensteine, Kochvorgang abgeschlossen |

Alle Aufrufe sind Best-Effort (`.catch(() => {})`) und über eine
persistierte `srf:haptics-enabled`-Präferenz steuerbar (Standard: an).
`SPEC-component-contract.md` verlangt, dass `Press`/`Button`/`IconButton`
diese Intent-Funktionen importieren, statt `expo-haptics`-Aufrufe selbst
neu zu implementieren — "keine doppelte Haptics-Implementierung in der
neuen UI-Datei."

### Streak-/"Kette nicht abreißen lassen"-Zähler

`streak.ts` ist ein kleines lokales State-Modul: `recordActivity()`
erhöht bei einem neuen aufeinanderfolgenden Tag, setzt nach einer Lücke
zurück und markiert bei `[3, 7, 14, 30, 50, 100, 365]` Tagen einen
"Meilenstein" für einen größeren Feier-Hook. Das ist das generische
Gamification-Muster (Tage-Streak + Meilenstein-Schwellen), keine
konkrete fremde Implementierung — es wurde kein Code aus einem
Duolingo-artigen Repo übernommen, nur das Konzept, das der Kommentar der
Datei bereits selbst benennt.

**Noch nicht integriert**: `streak.ts` importiert `useKVRaw` aus
`../../store`, ein Pfad, der in fam nicht auflöst. Das liegt außerhalb
des Scopes von `nativewind-styling` (diese Spec deckt nur
`token-integrity`, `theme-runtime`, `typography-contract`,
`core-ui-contract`, `native-boundaries`, `verification-matrix` ab) —
hier vermerkt, damit es nicht für bereits funktionierenden Code gehalten
wird.

### Komponentenvokabular (aus `ui.tsx`)

Gemäß der Komponententabelle in `SPEC-component-contract.md` — das ist
die Form, die übernommen und auf Fam-Tokens ausgerichtet wird:

| Komponente | Zweck | Fam-Token-Oberfläche |
| --- | --- | --- |
| `Txt` | Text/Typografie | Variant, Ton, Gewicht, Ausrichtung |
| `Surface` | themenbasierter Container, ersetzt `ThemedView` | Töne page/surface/soft/selected/accent |
| `Card` | Karten-/Listencontainer | Surface, Border, Radius, Elevation, Padding |
| `Row` / `Spacer` / `Divider` | Layout-Primitiven | Flex-, Space-, Border-Tokens |
| `Press` | pressbare Basis mit optionalem Feedback | Layout + Press-Animation |
| `Button` | Primäraktionen | Variant × Größe × Fill × Tiefe |
| `IconButton` | kompakte Icon-Aktion | Fam-Icon, Surface, Radius |
| `Badge` / `Pill` | Status/Filter | Fam-Ton, Border, Radius |
| `SegmentedControl` | kleiner Optionswechsel | ausgewählte Surface/Border/Ton |
| `Field` | beschriftetes Texteingabefeld | Surface, Border, Placeholder, Text |
| `EmptyState`, `SectionHeading` | strukturell | Typografie, Abstände |

Nichts davon ist neu erfunden — fam hatte bereits `ThemedText`,
`ThemedView` und ad hoc verwendete Button-/Card-Muster. Der Beitrag hier
ist *Konsolidierung*: ein Vertrag statt Komponenten, die jeweils frei
Tailwind-Klassen, Hexwerte und das alte `Colors`-Objekt mischen
(Problemzeile "Stilpriorität" in `SPEC.md`).

## Was diese Passe bewusst NICHT getan hat

- Duolingos (oder irgendeiner konkreten App) exakte Button-Geometrie,
  Eckenradius, Farbe oder Maskottchen-/Reward-Artwork wurden nicht
  übernommen.
- Es wurde keine neue Animations-/Haptik-Bibliothek eingeführt —
  `expo-haptics` war über `haptics.ts` bereits eine Abhängigkeit.
- `streak.ts` wurde nicht erweitert oder verdrahtet — das ist ein
  separates Feature, nicht Teil des Styling-Vertrags.
- `tts.ts` wurde nicht angefasst (siehe die Lücken-Notiz in
  `fam-theme-research.md`) — Audio-Erzählung ist für diese
  UI-Muster-Passe irrelevant.

## Zurückgestellt (in der Spec verfolgt, nicht stillschweigend fallengelassen)

1. Den `useKVRaw`/`../../store`-Import in `streak.ts` reparieren, damit
   der Streak-Chip tatsächlich funktioniert — außerhalb der Modulliste
   von `nativewind-styling`.
2. Eine visuelle Entscheidung zu `BUTTON_DEPTH` (dem 3D-Press-Tiefe-Muster)
   — `SPEC-token-contract.md` verschiebt das ausdrücklich auf nach den
   zwei geforderten Screen-Mocks (Dashboard, Essensplaner), die eine
   gemeinsame Referenz liefern.
3. Den "Haptik deaktivieren"-Schalter in einen Einstellungsbildschirm
   einbauen — die Bibliothek (`hapticsEnabled()`/`setHapticsEnabled()`)
   existiert bereits, nur die UI fehlt noch.
