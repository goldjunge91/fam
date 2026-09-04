---
title: fam — Visual-Effects-Recherche-Log (nativewind-styling)
date: 2026-09-03
---

# fam Visual-Effects-Recherche-Log

Begleitdokument zu `fam-theme-research.md` und
`fam-ui-inspiration-research.md`. Behandelt speziell die
*Bewegungsebene* — die Reanimated-getriebenen Press-/Pop-Animationen in
der Referenz-`ui.tsx`, die `SPEC-component-contract.md` übernimmt, und
was davon in fam landet und was nicht.

## Scope dieser Passe

Kein Live-Crawl, keine neuen Bibliotheken bewertet oder geklont.
`react-native-reanimated` und `react-native-worklets` sind bereits
Projektabhängigkeiten (siehe die "Stack conventions" in `AGENTS.md` —
Animation auf dem UI-Thread ist hier ein etabliertes Muster, `week-grid.tsx`,
`jiggle-wrapper.tsx`, `animated-icon.tsx`). Die Referenz-`ui.tsx` nutzt
dieselbe Bibliothek, auf die fam bereits setzt — genau deshalb ist ihre
Animationsform ein plausibler Fit statt einer neuen Abhängigkeit, die erst
gerechtfertigt werden müsste.

## Was die Referenzdatei tatsächlich tut

Direkt aus der ui-`ui.tsx`-Referenz gelesen (nicht aus dem Gedächtnis
zusammengefasst — siehe Grep-Ausschnitt unten):

```ts
// Springs tuned for a satisfying, Duolingo-ish "pop" on press/release.
const PRESS_SPRING = { damping: 14, stiffness: 320, mass: 0.5 } as const;
const POP_SPRING   = { damping: 9,  stiffness: 380, mass: 0.5 } as const;
```

Zwei Effekte, beide über `useSharedValue` + `useAnimatedStyle` getrieben,
keine JS-Thread-Arbeit pro Frame:

1. **`Press`-Skalier-Pop** — ein generischer Pressable-Wrapper. Beim
   Press-in skaliert er auf `scaleTo` (Standard `0.96`) via
   `withTiming(_, { duration: 70 })`; beim Loslassen federt er mit
   `POP_SPRING` zurück auf `1` (leichtes Überschwingen — "der Pop").
2. **`Button`-3D-Tiefe** — ein `depth`-Shared-Value, der `translateY`
   treibt. Beim Press-in bewegt sich die Fläche um `BUTTON_DEPTH` nach
   unten (`withTiming`, 60ms); beim Loslassen federt sie mit
   `PRESS_SPRING` auf `0` zurück, und ein `paddingBottom: BUTTON_DEPTH`
   bei gefüllten Varianten erzeugt die physische "erhabene Fläche", in
   die die Translation hineinanimiert. Das ist dieselbe
   CSS-Ära-"Border-Bottom-Tiefe"-3D-Button-Technik, die in
   `ui-inspiration-research.md` dokumentiert ist, hier auf
   Reanimated-Transforms statt CSS-`:active` + `border-bottom` übertragen.

Beide Animationen arbeiten nur mit Transforms (`scale`, `translateY`) —
keine Layout-Invalidierung, keine Opacity-/Blur-/Filter-Arbeit,
GPU-komponiert auf dem UI-Thread. Das passt zu fams eigener
Performance-Haltung, die bereits in `AGENTS.md`s Hinweis "Avoid
continuously repainting CSS animations" dokumentiert ist — auch wenn
sich dieser Hinweis auf den *Web*-Build bezieht, gilt derselbe Instinkt
(Transform statt Layout/Paint) auch hier.

## Was in fam landet vs. was zurückgestellt wird

| Effekt | Status laut Spec | Anmerkung |
| --- | --- | --- |
| `Press`-Skalier-Pop | Vertrag übernommen (`SPEC-component-contract.md` nennt `Press` als erforderliche Primitive) | Die Feder-Konstanten selbst werden von der Spec nicht neu justiert — Implementierungsdetail, kein Token |
| `Button`-3D-Tiefe (`BUTTON_DEPTH`) | Als bestehendes Referenzverhalten übernommen; **visuelle Neubewertung ausdrücklich zurückgestellt** | `SPEC-token-contract.md`: "Eine mögliche sichtbare Anpassung wird erst nach den zwei Screen-Mocks entschieden; daraus entsteht kein neuer globaler ui-Token." — d.h. Tiefe/Schattenfarbe jetzt nicht zerreden, Entscheidung erst nach den Dashboard- und Essensplaner-Mocks |
| Schattenfarben, die den Tiefeneffekt speisen (`colors.basilShadow`, `colors.tomatoShadow`) | **So verworfen** | ui-Akzentnamen; fam hat bereits `shadowCard`/`shadowSheet` in `src/constants/theme.ts` und Status-Tokens (`success`/`warning`/`danger`), die das Äquivalent liefern müssen, gemäß der Token-Ablehnungsregel in `fam-theme-research.md` |
| Kopplung von Haptik und Press-Animation | Übernommen, über `src/lib/haptics.ts` | `SPEC-component-contract.md`: "Press und Button importieren die Intent-Funktionen aus src/lib/haptics.ts. Die neue UI-Datei enthält keine eigene Expo-Haptics-Implementierung." |

## Keine neue visuelle Ebene über dies hinaus

Anders als die frühere ui-"Pass-2"-Visual-Effects-Arbeit
(Shader-Gradients, WebGL-Orbs, Chrome-Text, Liquid Glass — alles *Web*,
Next.js-spezifisch, `visual-effects-research.md` in diesem Ordner) gilt
davon **nichts für fam**. fam ist React Native; es gibt hier kein
DOM-`backdrop-filter`, kein `background-clip: text` und kein
Three.js-Canvas-Ziel, und `CAPABILITY_MAP.md` grenzt diese Initiative
ausdrücklich auf Styling-Stabilisierung ein, nicht auf "ein vollständiges
visuelles Redesign der App." Dieses Log stellt das klar fest, statt das
Fehlen wie ein Versehen aussehen zu lassen.

## Performance-/Barrierefreiheits-Haltung (übernommen, nicht neu hergeleitet)

- Beide Animationen laufen nur auf dem UI-Thread (Reanimated Shared
  Values), konsistent mit fams bestehenden Motion-Primitiven.
- Keine der beiden Animationen prüft in der Referenzdatei aktuell
  `prefers-reduced-motion` / `AccessibilityInfo.isReduceMotionEnabled()`
  — das ist eine echte Lücke, die noch von keinem Abnahmekriterium in
  `SPEC-verification-matrix.md` abgedeckt ist. Wird hier benannt statt
  die Lücke stillschweigend weiterzutragen.
- `disabled`-/`loading`-Zustände müssen Press-Animation und Haptik
  gemeinsam unterdrücken (Abnahmekriterien in
  `SPEC-component-contract.md`: "Press, Button und IconButton lösen
  Haptics nur bei tatsächlich erlaubten Aktionen aus").

## Offene Frage benannt, hier nicht gelöst

Die Reduce-Motion-Behandlung für `Press`/`Button` steht in keiner
aktuellen SPEC-*.md-Abnahmeliste. Verdient einen Folge-Eintrag in
`SPEC-verification-matrix.md`, bevor das ausgeliefert wird — nur
vermerkt, nicht durch dieses Dokument stillschweigend in die Spec
gepatcht.
