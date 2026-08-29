# Research: Chart-Lib für Zeitreihen-Trends (Keto/CGM/Gewicht)

Issue: #269. Related: #260 (Ketosis-Trend), #261 (Blood-Glucose-Trend), potenziell später Gewichtsverlauf.

## Question

Which time-series/chart library fits best for small trend displays (ketosis trend, blood-glucose
trend, potentially later weight history) in an Expo SDK 57 / React Native 0.86 / React 19.2 /
New Architecture app?

## Context

- Use case is deliberately small: a simple line chart with few data points (days/weeks of
  measurements), no streaming, no zoom/pan/crosshair interactivity, no dashboards.
- Already-installed dependencies relevant to charting: `react-native-svg@15.15.4`,
  `react-native-reanimated@4.5.1`, `react-native-gesture-handler@~2.32.0`,
  `react-native-qrcode-svg@^6.3.21`.
- Not installed: `@shopify/react-native-skia`, `victory-native`, `react-native-chart-kit`,
  `react-native-svg-charts`, `react-native-gifted-charts`.
- Project philosophy (AGENTS.md): smallest solution that solves the problem, avoid overkill for
  architecture's own sake — a heavy dashboard-grade charting library is explicitly out of scope
  for this use case.

Research date: 2026-08-29. Anything not touched in ~18 months is flagged as a maintenance concern.

## Comparison table

| Library | Latest / Published | Last Commit (repo `pushed_at`) | Native or JS/SVG | Unpacked Size (npm) | New Arch / Expo | Fit for small use case |
|---|---|---|---|---|---|---|
| `victory-native` (= victory-native-xl codebase) | 42.0.0 / 2026-08-25 | 2026-08-26 | **Native** (Skia) | 795 KB, but pulls in `@shopify/react-native-skia` (~10 MB unpacked) | Peer-requires Reanimated ≥4.0, react-native-worklets ≥0.7 (Skia peer dep), RN ≥0.78 (Skia); no explicit Expo/New Arch statement in README, but Skia itself ships prebuilt Fabric support | Overkill — brings in a whole GPU-accelerated canvas engine and a Dev Client rebuild for a few data points |
| `react-native-gifted-charts` | 1.4.78 / 2026-08-10 | 2026-08-10 | **Pure JS/SVG** (built on `react-native-svg`) | 402 KB (+ `gifted-charts-core` dep) | README explicitly documents an Expo install path (`expo-linear-gradient` instead of `react-native-linear-gradient`); no explicit New Arch statement, but has no native code of its own — inherits `react-native-svg`'s Fabric support | Good fit, but adds a general-purpose charting API (bar/pie/line/area/candlestick) for what is really "one `<LineChart>`" |
| `react-native-svg-charts` | 5.4.0 / 2020-04-14 | 2024-08-21 (repo), no npm release since 2020 | Pure JS/SVG | 417 KB | No New Arch statement; peer dep pinned to old `react-native-svg` ranges (`^6.2.1‖^7.0.3` vs. installed 15.x) | **Stale — do not use.** Confirmed unmaintained: no npm publish in ~6 years, peer-dep range incompatible with the installed `react-native-svg` major version. |
| Hand-rolled SVG chart on `react-native-svg` | n/a (no extra package) | n/a — `react-native-svg` itself: 15.15.5 / 2026-05-11, repo pushed 2026-08-20 | Pure JS/SVG, zero new dependency | 0 KB extra (already a dependency) | `react-native-svg` README: "Fabric is supported... as of v13.0.0" for RN ≥0.69 — already satisfied by the installed 15.15.4 | **Best fit** — a line/area chart for a handful of points is a `<Path>` (or `<Polyline>`) plus optional `<Circle>` markers and grid `<Line>`s, well within what `react-native-svg` documents as supported (`Rect`, `Circle`, `Line`, `Polyline`, `Polygon`, `Path`, `G`, …) |
| Newer Skia-adjacent alternatives (2025/2026) | — | — | — | — | — | No credible, actively-maintained alternative found beyond victory-native-xl (Formidable/Skia) and gifted-charts (SVG); nothing under `github.com/wcandillon` or elsewhere stood out as more current or better suited than the two above, so no additional candidate is padded in here. |

## Per-candidate detail

### 1. `victory-native` (npm package name) = Victory Native XL codebase

- npm registry: latest `42.0.0`, published 2026-08-25T21:01:57Z, unpacked size 794,672 bytes.
  https://registry.npmjs.org/victory-native
- GitHub repo is `FormidableLabs/victory-native-xl` (the npm package `victory-native` now ships the
  Skia-based "XL" rewrite, not the old pure-SVG Victory Native): 1,217 stars, 88 open issues, last
  push 2026-08-26T20:56:06Z, not archived. https://github.com/FormidableLabs/victory-native-xl
- `peerDependencies` from the published package: `@shopify/react-native-skia: >=2.6.0 <3.0.0`,
  `react-native-gesture-handler: >=2.0.0`, `react-native-reanimated: >=3.19.1`, `react: *`,
  `react-native: *`. Source: `registry.npmjs.org/victory-native` version metadata (fetched
  2026-08-29).
- `@shopify/react-native-skia` itself: latest `2.11.1`, published 2026-08-23T13:56:41Z, unpacked
  size ~10.18 MB, and its own peer deps require `react-native-reanimated >=4.0.0`,
  `react-native-worklets >=0.7.0`, `react-native >=0.78`, `react >=19.0`.
  https://registry.npmjs.org/@shopify%2freact-native-skia
- This is a **native module**: Skia ships prebuilt binaries per platform
  (`react-native-skia-android`, `-apple-ios`, `-apple-tvos`, `-apple-macos` sub-packages) — adding
  it requires a Dev Client rebuild (per this project's own native-dependency rule in `AGENTS.md`).
- Maintenance is excellent (commits/releases within the last few days as of research date), so the
  concern here is not staleness but fit: it's a full charting/canvas engine (touch gestures, area,
  bar, pie, candlestick, custom Skia paint) built for rich, animated, high-density dashboards.

### 2. `react-native-gifted-charts`

- npm registry: latest `1.4.78`, published 2026-08-10T13:04:02Z, unpacked size 401,742 bytes, plus
  its own runtime dependency `gifted-charts-core@0.1.82`.
  https://registry.npmjs.org/react-native-gifted-charts
- GitHub repo `Abhinandan-Kushwaha/react-native-gifted-charts`: 1,362 stars, 99 open issues, last
  push 2026-08-10T13:33:24Z, not archived. https://github.com/Abhinandan-Kushwaha/react-native-gifted-charts
- `peerDependencies`: `react-native-svg: *`, one of `expo-linear-gradient`/`react-native-linear-gradient`,
  `react`, `react-native`. Source: same npm registry fetch as above.
- Pure JS/SVG — no native binary of its own, built on top of `react-native-svg` (already installed).
  README documents an explicit Expo install path:
  `npx expo install react-native-gifted-charts expo-linear-gradient react-native-svg`.
  https://github.com/Abhinandan-Kushwaha/react-native-gifted-charts (README, fetched 2026-08-29)
- Ships a ready-made `<LineChart data={data} />` component — directly usable for the ketosis/CGM
  use case with zero SVG hand-rolling, at the cost of pulling in a general-purpose chart library
  (bar/pie/line/area/candlestick/BarChart3D etc.) and an extra `gifted-charts-core` package for
  functionality this project won't touch.

### 3. `react-native-svg-charts`

- npm registry: latest `5.4.0`, no publish since 2020-04-14T19:04:09Z.
  https://registry.npmjs.org/react-native-svg-charts
- GitHub repo `JesperLekland/react-native-svg-charts`: 2,398 stars, 219 open issues, last push
  2024-08-21T01:06:53Z (repo has some post-2020 commits that never shipped an npm release), not
  archived but effectively dormant. https://github.com/JesperLekland/react-native-svg-charts
- `peerDependencies` pin `react-native-svg` to `^6.2.1||^7.0.3` — this project runs
  `react-native-svg@15.15.4`, several major versions past what this library declares support for.
- **Conclusion confirmed:** stale/unmaintained. Do not adopt.

### 4. Hand-rolled SVG line chart on `react-native-svg` (no extra library)

- `react-native-svg` itself: latest `15.15.5`, published 2026-05-11T15:58:55Z; repo
  `software-mansion/react-native-svg`: 8,003 stars, 237 open issues, last push
  2026-08-20T08:28:01Z — actively maintained, and already the project's chosen SVG dependency
  (installed at 15.15.4, one patch behind latest).
  https://registry.npmjs.org/react-native-svg · https://github.com/software-mansion/react-native-svg
- README states explicit Fabric/New Architecture support: "Fabric is React Native's new rendering
  system. As of version 13.0.0 of this project, Fabric is supported only for react-native
  0.69.0+." — comfortably covers RN 0.86. It documents `Rect`, `Circle`, `Line`, `Polyline`,
  `Polygon`, `Path`, `G`, and more as supported elements — everything needed for a line/area trend
  chart (a `<Path>` built from `d3-shape`'s `line()`/`area()` or straightforward point math, an
  optional gradient `<Defs>`/`<LinearGradient>` fill, `<Circle>` markers, `<Line>` grid/axis).
  https://github.com/software-mansion/react-native-svg (README, fetched 2026-08-29)
- No new dependency, no peer-dependency drift to track, no native rebuild (it's already built into
  the app), and full control over the exact minimal visual language (a few points, a smooth line,
  maybe a shaded area under a "ketosis"/"in range" band) without adopting a general-purpose
  charting API's conventions, theming system, or bundle weight.

### 5. Newer 2025/2026 alternatives

Searched npm/GitHub for any charting library that has emerged more recently as a serious
alternative (including anything from `github.com/wcandillon`, who maintains/contributes to Skia
and Victory Native XL). Nothing beyond `victory-native`/`victory-native-xl` (Skia) and
`react-native-gifted-charts` (SVG) surfaced as a genuinely newer, better-fitting, actively
maintained option for this project's small-chart use case — so no additional candidate is added
here to avoid padding the comparison with dead options.

## Recommendation

**Hand-roll the trend chart directly with `react-native-svg`, adding no new chart library.**

Reasoning tied to the project's stated preference for the smallest solution that solves the
problem:

- The use case is explicitly small: a handful of days/weeks of measurements, one line (maybe a
  shaded band), no interactivity beyond perhaps a tap-to-reveal-value. That is a `<Path>`/`<Circle>`
  composition, not a charting-library problem.
- `react-native-svg` is already a dependency, already proven compatible with RN 0.86/New
  Architecture/Fabric per its own README, and needs zero Dev Client rebuild since it's already
  built into the app.
- `victory-native` would newly pull in `@shopify/react-native-skia` (~10 MB, a native module
  requiring a Dev Client rebuild) purely to draw a few points on a line — solving a problem this
  project doesn't have (GPU-accelerated, animation-heavy, high-density charting).
- `react-native-gifted-charts` is a reasonable, actively maintained, pure-SVG fallback if the team
  later wants many chart types (bar/pie/candlestick) across the app for a broader "analytics"
  surface — but for exactly two-to-three simple line trends, it's still more surface area
  (its own component API, theming, `gifted-charts-core` dependency) than writing ~50-100 lines of
  `<Path>` construction directly against `react-native-svg`, which the codebase already uses this
  way for QR codes (`react-native-qrcode-svg`).
- `react-native-svg-charts` is ruled out outright: no release since 2020, peer-dep range
  incompatible with the installed `react-native-svg` major version.

### Application to #260 / #261

- **#260 (Ketosis-Trend)** and **#261 (Blood-Glucose-Trend)** both fit a single small, reusable
  presentational component (e.g. `src/components/trend-line-chart.tsx` or feature-local under
  `src/features/calorie-tracking/` per the existing tracking domain split): given an array of
  `{date, value}` points, render a `Path` line (optionally with a shaded reference band — e.g. the
  ketosis target range or a normal blood-glucose range), a couple of axis/grid `Line`s, and
  `Circle` markers for the latest/selected point. Both features can share this one component with
  different color/range/unit props rather than needing two chart-library configurations.
- If **weight history** is added later, it's the same shape of data (few points, one line) and can
  reuse the same component — no need to revisit the library choice unless a future requirement
  (zoom/pan, live streaming, many overlapping series) actually demands `victory-native`'s
  Skia-backed capabilities.

## Sources

- https://registry.npmjs.org/victory-native
- https://github.com/FormidableLabs/victory-native-xl
- https://registry.npmjs.org/@shopify%2freact-native-skia
- https://registry.npmjs.org/react-native-gifted-charts
- https://github.com/Abhinandan-Kushwaha/react-native-gifted-charts
- https://registry.npmjs.org/react-native-svg-charts
- https://github.com/JesperLekland/react-native-svg-charts
- https://registry.npmjs.org/react-native-svg
- https://github.com/software-mansion/react-native-svg
