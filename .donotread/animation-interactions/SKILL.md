---
name: animation-interactions
description: Add subtle, tasteful motion. Use to clarify state changes — never to decorate. Always respect Reduce Motion.
when_to_use:
  - You added a new interactive component and want it to feel alive
  - A state change (checked item, saved recipe, drag-reorder drop) is hard to notice
  - You want to add a hover / press / enter animation
  - You are tempted to add a new animation library — read this first
---

# Animation & Micro-interactions

Motion is a tool to clarify state changes. If a user can't tell what changed, motion fixes it. If they can already tell, motion is decoration — skip it.

## Hard rules

1. Check Reduce Motion via Reanimated's `useReducedMotion()` hook (or `AccessibilityInfo.isReduceMotionEnabled()` outside a component) before starting a non-essential animation. Users with Reduce Motion enabled see no transforms.
2. Animations never block interaction. Max duration for UI feedback: 200ms. Max for ambient (image zoom, card entrance): 500ms.
3. Don't animate everything. If everything moves, nothing reads.
4. Don't add a new animation dependency on top of `react-native-reanimated` / `react-native-worklets` (already in the stack) unless justified in writing. Reanimated covers the entire codebase's needs.
5. No parallax. No cursor/pointer effects (this is a touch app, not a mouse app). No infinite decorative loops on visible UI outside a loading state.

## Vocabulary already in the codebase

| Effect | Where / how |
| --- | --- |
| Swipe-to-reveal actions on a row | `ReanimatedSwipeable` from `react-native-gesture-handler/ReanimatedSwipeable` — Vorbild `inventory-item-row.tsx` |
| Drag-reorder jiggle + drop | `Gesture.Pan()` + `useSharedValue`/`withSequence`/`withRepeat` — Vorbild `src/features/dashboard/components/jiggle-wrapper.tsx` |
| Press feedback | `Pressable` mit `active:` NativeWind-Variante, oder projektinterne Button-Primitive prüfen, bevor eine eigene Lösung gebaut wird |
| Keyframe enter/exit animation | Reanimated `Keyframe` — Vorbild `src/components/icons/animated-icon.tsx` (`entering={keyframe.duration(...)}`) |
| Color/scale/rotation loop (splash, loading) | `withRepeat` + `withSequence` + `interpolateColor` — Vorbild `AnimatedSplashOverlay` in `animated-icon.tsx` |
| Drag-reorder list | `react-native-reorderable-list`, nicht FlashList und keine Gesture-Eigenlösung (siehe AGENTS.md) |
| Week-grid Animationen | `src/features/meal-planner/components/week-grid.tsx` als Referenz für UI-Thread-Animation im Kalender-Kontext |

Reduce Motion ist im Repo aktuell **nirgends** verdrahtet — es gibt noch keinen `useReducedMotion()`-Aufruf. Für jede neue Animation gilt trotzdem: gate sie, statt das Muster stillschweigend weiter zu ignorieren.

## Procedure

### Step 1 — Decide if motion is even needed

- State change visible without motion (color/text/icon change alone)? Skip animation.
- New element appearing (sheet, toast, swipe action)? Yes, an entrance animation is helpful.
- Press on an interactive element? A subtle scale (`0.95`–`0.98`) or opacity change, nothing more.

### Step 2 — Reach for `useAnimatedStyle` + `withTiming` first

For most cases, a single shared value driving one transform:

```tsx
const scale = useSharedValue(1);

const animatedStyle = useAnimatedStyle(() => ({
  transform: [{ scale: scale.value }],
}));

// onPressIn / onPressOut
scale.value = withTiming(0.96, { duration: 120 });
```

Gate it:

```tsx
const reduceMotion = useReducedMotion();

scale.value = reduceMotion ? 1 : withTiming(0.96, { duration: 120 });
```

### Step 3 — Reach for `Keyframe` for entrance/exit

```tsx
const keyframe = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: 8 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }], easing: Easing.out(Easing.cubic) },
});

<Animated.View entering={keyframe.duration(200)}>…</Animated.View>;
```

### Step 4 — For staggered entrance (lists, grids)

`Animated.View` `entering` unterstützt `.delay(ms)` pro Item:

```tsx
items.map((item, i) => (
  <Animated.View
    key={item.id}
    entering={FadeInDown.duration(220).delay(Math.min(i * 40, 250))}
  />
));
```

Cap den Stagger bei ~250ms Gesamtdauer, sonst wirkt das letzte Item träge. Achtung bei FlashList: recycelte Rows re-triggern `entering` nicht zuverlässig beim Scrollen — Stagger nur bei kurzen, nicht virtualisierten Listen einsetzen (siehe FlashList-Konvention in AGENTS.md).

### Step 5 — Reduce Motion prüfen

```tsx
const reduceMotion = useReducedMotion();
```

Auf dem Gerät/Simulator: Einstellungen → Bedienungshilfen → Bewegung reduzieren aktivieren. Danach prüfen:

- Keine Transforms, kein Loop mehr sichtbar
- Statuswechsel bleibt erkennbar (Farbe, Icon, Text reichen weiterhin)

## Animations to add (when appropriate)

- **Swipe-reveal-Aktionen** — bereits über `ReanimatedSwipeable` etabliert, für neue Listenzeilen wiederverwenden statt neu bauen.
- **Drag-Reorder-Jiggle** — bereits über `JiggleWrapper`/`react-native-reorderable-list` etabliert.
- **Sheet/Modal Enter** — kurzes Slide-up + Fade, ~200ms, `Easing.out`.
- **Checkbox/Häkchen-Bestätigung** — kurzer Scale-Pop (`1 → 1.1 → 1`) beim Abhaken, keine Endlosschleife.

## Animations to NEVER add

- Parallax beim Scrollen
- Cursor-/Pointer-Effekte (keine Maus-Interaktion auf Mobile)
- Endlos-Loops auf sichtbarer UI außerhalb eines Ladezustands
- Layout-verschiebende Animationen, die nicht über `transform`/`opacity` laufen (kein `width`/`height` animieren — Layout-Sprünge und schlechte Performance auf dem UI-Thread)

## Files to inspect

- `src/components/icons/animated-icon.tsx` (Keyframe, Splash-Loop-Muster)
- `src/features/dashboard/components/jiggle-wrapper.tsx` (Gesture + Drag + Jiggle)
- `src/features/inventory/components/inventory-item-row.tsx` (ReanimatedSwipeable)
- `src/features/meal-planner/components/week-grid.tsx` (Kalender-Animation)
- `src/constants/theme.ts` (Farb-Tokens für Feedback-Zustände, keine hartkodierten Hex-Werte)

## Quality checklist

- [ ] Animation ist per `useReducedMotion()` gegatet, wenn sie nicht essenziell für die Bedienbarkeit ist
- [ ] Keine Animation > 500ms auf sichtbarer UI
- [ ] Keine layout-verschiebende Animation (nur `transform`/`opacity`, kein `width`/`height`)
- [ ] Reduce-Motion-Test durchgeführt (keine Transforms, kein Loop)
- [ ] Animation hat einen *Grund* (Statuswechsel klären, Tap bestätigen, Ankunft signalisieren)
- [ ] Keine neue Animationslibrary ohne schriftliche Begründung hinzugefügt

## Common mistakes

- Endlos-Loop auf einem Element, das gleichzeitig drückbar ist — Accessibility-Falle
- `width`/`height` animieren statt `transform`/`opacity` — bricht Layout, läuft nicht auf UI-Thread
- Hover-artige Lift-Effekte auf nicht-interaktive Karten übertragen (gibt es auf Touch ohnehin nicht)
- `useReducedMotion()` vergessen und einen Loop ungefragt an alle Nutzer ausliefern
- FlashList-Stagger-Animation bei recycelten Rows erwarten, obwohl `entering` dort nicht zuverlässig neu feuert
