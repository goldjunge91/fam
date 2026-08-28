# Migration: theme.ts/StyleSheet → NativeWind + Liquid Glass

> Arbeitsauftrag, parallel bearbeitet von Claude und Gemini. Stand
> 2026-08-17. Bitte diese Datei bei Fortschritt aktualisieren (erledigte
> Punkte abhaken, neue Erkenntnisse ergänzen) statt eine zweite Version
> anzulegen.

## Aufteilung (verbindlich, damit wir uns nicht in die Quere kommen)

- **Gemini → Phase A** (`src/components/`, geteilte Bausteine).
- **Claude → Phase B** (`src/features/*/[a-z]*-screen.tsx`, Screens
  Domain für Domain).
- **Phase C** (Liquid Glass am Dashboard): macht, wer zuerst mit seiner
  Phase fertig ist.
- Wichtig: **niemand fasst Dateien außerhalb der eigenen Phase an.**
  Screens dürfen weiterhin geteilte Komponenten (`ThemedText`, `Card`,
  `Screen`, …) unveraendert per Props nutzen, waehrend diese intern noch auf
  `theme.ts` laufen — das ist waehrend der Uebergangszeit erwartet und kein
  Fehler.

## Entscheidung (vom Maintainer getroffen, nicht mehr offen)

- **StyleSheet.create + `theme.ts`-Tokens werden durch NativeWind v4
  (Tailwind-Utility-Klassen) ersetzt.** Grund: zu lange, schwer lesbare
  Style-Dateien. `theme.ts` bleibt nur so lange bestehen, wie noch Dateien
  darauf verweisen — nicht neu befüllen, nur abbauen.
- **Kein Inline-`style={{...}}` als Ausweichlösung.** Wenn ein Wert fehlt,
  gehört er in `tailwind.config.js`/`src/global.css`, nicht als Inline-Style
  in die Komponente. Einzige Ausnahme: echte Laufzeitwerte, die es zur
  Build-Zeit gar nicht geben kann (z. B. `insets.bottom` von
  `useSafeAreaInsets()`) — dafür gibt es sowieso keine Tailwind-Klasse.
  **Prüfbares Kriterium (Definition of Done, vor jedem Abschluss laufen
  lassen):**

  ```bash
  grep -n "style={{" <geänderte Datei(en)>
  ```

  Jeder Treffer muss entweder (a) verschwinden, weil der Wert stattdessen
  eine `tailwind.config.js`/`global.css`-Klasse bekommt, oder (b) im Code
  direkt daneben kommentiert sein, warum es ein echter Laufzeitwert ist
  (Safe-Area-Insets, `Animated.Value`, o. Ä.) — kein unkommentierter Treffer
  ohne Begründung. Bei Unsicherheit, ob ein Fall unter (b) fällt: fragen,
  nicht selbst entscheiden.
- **Essensplaner:** V2-Vergleichsvariante ist entfernt, es gibt nur noch die
  Original-Struktur (`meal-planner-screen.tsx`). Nicht wieder aufleben
  lassen.
- **Liquid Glass:** beide Pfade kombiniert einsetzen —
  `expo-glass-effect` für Screen-Chrome (Chips, Toolbars, floating Buttons)
  und `@expo/ui` SwiftUI-Glass, wo koordinierte Transitions gebraucht werden.
  Erster Anwendungsfall: die Dashboard-"Glass Cards" (siehe unten). Beide
  Pakete sind bereits in `package.json` installiert
  (`expo-glass-effect`, `@expo/ui`).

## Stand: was schon fertig ist

- `tailwind.config.js` + `src/global.css`: vollständige Token-Basis, 1:1 aus
  `src/constants/theme.ts` übernommen:
  - Farben als CSS-Variablen (`--color-*`) in `src/global.css`, automatischer
    Light/Dark-Wechsel über `@media (prefers-color-scheme: dark)` — **kein**
    `dark:`-Präfix nötig, entspricht dem bisherigen `useTheme()`-Verhalten
    ohne manuellen Umschalter.
  - `spacing`: `half`/`one`/`two`/`three`/`four`/`five`/`six`
  - `borderRadius`: `hairline`/`xs`/`sm`/`control`/`control-lg`/`card`/`sheet`/`fam-large`/`pill`
  - `borderWidth.hairline` (`0.5px`) — Ersatz für `StyleSheet.hairlineWidth`
    (das ist ein Laufzeitwert, kann nicht statisch in die Config)
  - `fontSize` mit passenden `lineHeight`-Tupeln, 1:1 aus `Typography` in
    `src/components/themed-text.tsx`
  - `maxWidth.content` (800px, = `MaxContentWidth`), `height.control` (34px,
    = `ControlSize.compactHeight`), `height.action-area` (88px, =
    `Layout.floatingActionAreaHeight`)
  - **Opazitäts-Modifier funktionieren:** Farben sind als `R G B`-Kanal-Tripel
    in `global.css` hinterlegt und in `tailwind.config.js` über
    `rgb(var(--color-x) / <alpha-value>)` eingebunden. Das bisherige
    `` `${theme.accent}18` ``-Hex-Suffix-Muster (Auswahl-Chips, Badges) wird
    dadurch zu `className="bg-accent/10"` o. Ä. — kein Rechnen mit
    Hex-Strings mehr nötig.
- Build-Infrastruktur (vom Maintainer selbst eingerichtet, nicht anfassen
  außer bei Bedarf): `babel.config.js`, `metro.config.js`,
  `tailwind.config.js`, `types/nativewind-env.d.ts`, `biome.json`
  (CSS-At-Rule-Ausnahme für `@tailwind`), `app.json` (`web.bundler: metro`),
  Import von `global.css` in `src/app/_layout.tsx`.
- **Pilot-Migration abgeschlossen:** `src/features/settings/module-settings-screen.tsx`
  komplett auf NativeWind umgestellt (kein `theme.ts`-Import, kein
  `StyleSheet.create` mehr in der Datei). Als Referenz für das Muster nutzen:
  - `style={{backgroundColor: theme.x}}` → `className="bg-x"`
  - bedingte Farbe (State-abhängig) → Template-String im `className`:
    `` className={`... ${cond ? 'border-accent' : 'border-border'}`} ``
  - `StyleSheet.hairlineWidth` → `className="border-hairline"` (nicht
    inline!)
  - `gap`/`padding`/`borderRadius` aus `Spacing`/`Radius` → passende
    `gap-*`/`p-*`/`rounded-*`-Klasse
- **Essensplaner V1/V2:** V2-Route (`src/app/(app)/meal-planner-v2.tsx`),
  V2-Screen (`meal-planner-screen-v2.tsx`) und Versionsumschalter
  (`meal-planner-version-switcher.tsx`) sind gelöscht, `meal-planner-screen.tsx`
  bereinigt, `docs/DESIGN_SYSTEM.md` Abschnitt 6/7 aktualisiert.
- `bun run check`, `bun run typecheck`, `bun run test` sind auf dem
  aktuellen Stand grün.

## Offene Aufgaben

### Phase A — Geteilte Komponenten (`src/components/`) [ABGESCHLOSSEN]

Alle geteilten Bausteine unter `src/components/` wurden erfolgreich und vollständig auf NativeWind v4 und semantische Component-Klassen (`@layer components` in `src/global.css`) migriert:

1. [x] `src/components/themed-text.tsx` — Vollständiges Mapping aller semantischen Rollen (`small`, `smallBold`, `smallSelected`, `smallMuted`, `smallDanger`, `default`, `bodyBold`, `bodyMuted`, `title`, `subtitle`, `subtitleMuted`, `caption`, `captionMuted`, `captionCompact`, `label`, `labelBold`, `labelMuted`, `link`, `linkPrimary`, `code`) auf NativeWind-Klassen ohne blockierende `style`-Array-Injektion.
2. [x] `src/components/themed-view.tsx` — Migration auf `bgClass`-Mapping via semantische NativeWind-Klassen.
3. [x] `src/components/screen.tsx` — `.screen-body`, `max-w-content`, `px-three`, Beseitigung aller Inline-Layout-Styles.
4. [x] `src/components/card.tsx` (`.card-fam`), `src/components/page-header.tsx`, `src/components/section-heading.tsx`, `src/components/empty-state.tsx`.
5. [x] `src/components/ui/buttons/*` — `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-link`, `.btn-fab`, `.btn-header-icon`, `.btn-menu`, `.btn-profile`, `.btn-back-arrow`, `.btn-compact-action`.
6. [x] Rest von `src/components/*.tsx` (`progress-ring.tsx`, `segmented-control.tsx`, `fam-icon.tsx`, `snackbar.tsx` (`.snackbar-bar`), `sync-status-banner.tsx`, `text-field.tsx` (`.input-field`, `.input-field-error`), `quantity-stepper.tsx` (`.stepper-container`, `.stepper-btn`), `date-picker.tsx` / `date-wheel-field.tsx` / `wheel-picker-field.tsx` (`.modal-sheet`, `.modal-backdrop`), `gradient-background.tsx`, `filter-chip-bar.tsx`, `app-shell.tsx` (`.app-shell-wrap`), `animated-icon.tsx`, `animated-icon.web.tsx`, `calendar-day-icon.tsx`, `ui/product-information.tsx` (`.badge-nutri-a`...`.badge-nutri-e`), `module-gate.tsx`, `progress-bar.tsx`).

Status: `bun run check` (0 Fehler), `bun run typecheck` (0 Fehler), `bun run test` (80 Test-Suites / 628 Tests grün).

### Phase B — Screens, Feature-Domain für Feature-Domain

**`settings/` [ERLEDIGT, inkl. Rest]:** alle 13 Dateien fertig, inkl.
`premium-promo-card.tsx` (Gradient/`withAlpha` bleibt `style`, echter
Laufzeitwert — Bug-Untersuchung: Code 1:1 migriert, Marcos "Gradient-Color"-
Meldung konnte ohne Simulator-Zugriff nicht reproduziert werden, braucht
visuellen Check von Marco), `settings-menu.tsx`, `dev/dev-tools-screen.tsx`.

**`navigation/` [ERLEDIGT]:** `quick-add-sheet.tsx`, `profile-sheet.tsx`,
`navigation-drawer.tsx`. Neue geteilte Klasse `sheet-dim` (Modal-Overlay,
von mehreren Sheets genutzt). `Animated.Value`-Transforms/Interpolationen
und `withAlpha()`-Opazitäten bleiben `style` (dokumentiert). Ein Fund: die
CSS-Opazitäts-Modifier (`border-text/15`) ersetzen `withAlpha()` an einer
Stelle vollständig, wo vorher nur Grund und Alpha gebraucht wurden — bei
Gelegenheit nach weiteren `withAlpha()`-Stellen mit fester Standard-Opazität
suchen, die genauso ersetzbar sind (kein separater Auftrag, nur Hinweis).

**Aufteilung der verbleibenden ~64 Dateien (verbindlich):** Claude und Gemini
arbeiten ab jetzt wieder **beide an Phase B**, aber an **disjunkten Domains**
— niemand fasst eine Datei aus der Liste des anderen an. Innerhalb der
eigenen Liste **von oben nach unten** abarbeiten (klein → groß, damit sich
Wiederverwendungsmuster fuer semantische Klassen frueh zeigen, bevor die
grossen Dateien drankommen). Nach jeder Domain: Fortschritt in diesem
Abschnitt eintragen (Status `[ERLEDIGT]` an die Domain-Überschrift), damit
der jeweils andere sieht, was fertig ist.

#### Claude — Liste (10 Domains, ~9800 Zeilen, 36 Dateien)

1. [x] **`settings/`-Rest** (3 Dateien, 578 Zeilen)
   - `src/features/settings/premium-promo-card.tsx` (84 Zeilen) — **zuerst
     diese Datei, mit Bug-Untersuchung:** Marco meldete "Premium-Card hat
     Gradient-Color"-Problem am 2026-08-17. Vor dem Migrieren erst
     reproduzieren/verstehen (Datei nutzt `experimental_backgroundImage`
     mit `theme.premiumGradientStart/Mid/End` — noch unklar ob das ein
     echter Rendering-Bug ist oder ob Marco das Gradient selbst nicht will;
     bei Unklarheit fragen, nicht raten). Migration selbst: `withAlpha()`
     fuer `boxShadow`/Wasserzeichen-Opazitaet bleibt vermutlich `style`
     (dynamische Alpha-Berechnung, kein Tailwind-Token) — dokumentieren,
     nicht erzwingen.
   - `src/features/settings/settings-menu.tsx` (164 Zeilen)
   - `src/features/settings/dev/dev-tools-screen.tsx` (330 Zeilen)
2. [x] **`navigation/`** (3 Dateien, 710 Zeilen): `quick-add-sheet.tsx` (203),
   `profile-sheet.tsx` (260), `navigation-drawer.tsx` (247). Neue geteilte
   Klasse `sheet-dim`.
3. [x] **`premium/`** (1 Datei, 240 Zeilen): `premium-screen.tsx`
4. [x] **`recipe-templates/`** (1 Datei, 393 Zeilen):
   `recipe-template-detail-screen.tsx`
5. [x] **`dashboard/`** (1 Datei, 376 Zeilen): `dashboard-screen.tsx` — Glass
   Cards migriert (Layout/Farben), aber weiterhin **kein echtes Glass**
   (Phase C steht noch aus, s. u.).
6. [x] **`household/`** (6 Dateien, 1359 Zeilen) — alle fertig. Neue
   geteilte Klassen: `modal-header-row`, `modal-backdrop-bottom` (Ergänzung
   zu `modal-backdrop`, gleiche Optik aber `justify-end` statt `-center`).
   `bun run test` (16 Tests in `household/`, alle 628 app-weit) grün.
7. [x] **`fridge/`** (6 Dateien, 1206 Zeilen) — alle fertig.
   `SheetAction` in `fridge-item-actions-sheet.tsx` von rohen
   Farbwert-Props (`backgroundColor`/`color`) auf einen
   `variant: 'neutral'|'success'|'danger'`-Prop umgebaut (kleinere,
   nebenbei erledigte Vereinfachung — kein Bugfix, nur API-Klarheit an
   einer lokalen Helper-Funktion). `bun run test` (31 Tests in `fridge/`,
   alle 628 app-weit) grün.
8. [x] **`inventory/`** (6 Dateien, 1535 Zeilen) — alle fertig. Neue
   Klassen u. a. `storage-location-row`, `storage-location-name`,
   `storage-location-btn-row`, `frequent-products-chip`,
   `scanner-backdrop`/`scanner-modal-box`/`scanner-target-frame`. In
   `product-search-dropdown.tsx` verbleibt `style={{ elevation: 4 }}` als
   dokumentierte Android-Ausnahme (kein Tailwind-Äquivalent für
   Android-Schatten, der Rest des Dropdown-Schattens läuft über die
   `shadow-sheet`-Klasse). `bun run test` (15 Tests in `inventory/`, alle
   628 app-weit) grün.
9. [x] **`calorie-tracking/`** (4 Dateien, 1862 Zeilen) — alle fertig. Neue
   Klassenpräfixe `diary-*`, `fss-*` (food-search), `afe-*`
   (add-food-entry), `gs-*` (goal-setup). Alpha-Hintergründe per
   Tailwind-Opazitätsmodifier statt Hex-Suffix (`bg-background-element/[84%]`
   statt `${theme.backgroundElement}D6`, `bg-background-selected/[47%]`
   statt `${theme.backgroundSelected}78`, `bg-success/[13%]` /
   `bg-warning/[13%]` statt `${theme.success}22`). `borderCurve: 'continuous'`
   bleibt an mehreren Cards/Buttons als dokumentierte `style`-Ausnahme (kein
   Tailwind-Äquivalent, analog zu dashboard-screen.tsx). `bun run test`
   (35 Tests in `calorie-tracking/`, alle 628 app-weit) grün.
10. [x] **`meal-planner/`** (5 Dateien, 1552 Zeilen) — alle fertig. Neue
    Klassenpräfixe `rpm-*` (recipe-picker-modal), `efm-*` (entry-form-modal,
    teilt sich `rpm-root`/`rpm-safe-area`/`rpm-header`/`rpm-close-button`
    mit recipe-picker-modal.tsx — identisches Modal-Grundgerüst), `mis-*`
    (missing-ingredients), `mp-*` (meal-planner-screen), `wg-*` (week-grid).
    In `week-grid.tsx` das bis dahin eigenständige `SLOT_SIZES`-Konstanten-
    objekt aufgelöst und direkt in die Klassen übernommen (Größen waren
    schon vorher für Tag-/3-Tage-/Wochenansicht identisch, nur die
    Indirektion war unnötig — dokumentierte Vereinfachung, kein
    Verhaltensunterschied). In `meal-planner-screen.tsx` den bereits toten
    `labelStyle`-Prop von `SegmentedControl` entfernt (die Komponente
    destrukturiert ihn zu `_labelStyle` und ignoriert ihn seit ihrer eigenen
    NativeWind-Migration). `borderCurve: 'continuous'` und ein individueller
    Drag-Preview-Schatten (kein passendes boxShadow-Preset) bleiben als
    dokumentierte `style`-Ausnahmen. `bun run test` (79 Tests in
    `meal-planner/`, alle 628 app-weit) grün.

### Claude — alle 10 Domänen abgeschlossen

Damit ist meine gesamte zugewiesene Liste (`settings/`-Rest, `navigation/`,
`premium/`, `recipe-templates/`, `dashboard/`, `household/`, `fridge/`,
`inventory/`, `calorie-tracking/`, `meal-planner/`) fertig migriert. Nächster
Schritt laut Vereinbarung: Rückmeldung an Marco vor Beginn von Phase C
(Liquid-Glass-Dashboard-Karten) — dafür erst statische Mocks bauen und zur
Auswahl vorlegen, bevor echte Komponenten angefasst werden.

#### Gemini — Liste (2 Domains, ~8840 Zeilen, 28 Dateien)

Bewusst als Paar zusammengelegt: `shopping-list/` und `recipes/` teilen sich
viele UI-Muster (Item-Zeilen, Modals/Sheets, Formulare) — eine Hand fuer
beide haelt die neuen semantischen Klassen konsistent, statt dass zwei
Bearbeiter aehnliche Klassen doppelt erfinden.

**Hinweis zu `@expo/ui`:** `complete-run-sheet.tsx` und
`components/category-order-sheet.tsx` nutzen bereits
`@expo/ui/community/bottom-sheet`. Beim Migrieren dieser zwei Dateien kurz
den `expo-ui`-Skill als Nachschlagewerk konsultieren (nicht komplett lesen),
um `Host`/Modifier-Patterns der Bottom-Sheet-Komponente nicht versehentlich
zu brechen.

**Bereits ein konkreter Fund (Stand 2026-08-17, `tsc --noEmit`):**
`category-order-sheet.tsx:180` hat `className` auf `BottomSheetView` —
`BottomSheetViewProps` kennt kein `className` (Typfehler, nicht nur das
`cssInterop`-Laufzeitproblem oben). Genau der `@expo/ui`-Fall aus dem
KRITISCH-Abschnitt: `BottomSheetView` ist nicht NativeWind-registriert,
`style` verwenden.

**Zweiter, wiederkehrender Fund (`tsc --noEmit`, Stand 2026-08-17, 21:00):**
`ThemedText type="headingLarge"`/`"headingMedium"` in mindestens 6 Dateien
(`cooking-mode-screen.tsx` 5×, `recipe-log-screen.tsx`,
`wizard/recipe-wizard-step-basics.tsx`,
`wizard/recipe-wizard-step-preview.tsx` 2×,
`wizard/recipe-wizard-step-steps.tsx` 2×) — diese Rollen existieren nicht in
`TEXT_ROLE_CLASSES`/`TEXT_ROLE_STYLES` (Phase A). Entweder eine bestehende
Rolle verwenden (`title`/`subtitle`/`headingSmall` sind die Kandidaten mit
aehnlicher Groesse) oder die Rolle in `themed-text.tsx` ergaenzen (Phase-A-
Datei — bei Bedarf dort nachziehen, nicht in `recipes/`-Dateien umgehen).

`expo-liquid-glass`/`expo-native-ui` sind fuer Phase B dagegen
nicht relevant (Redesign-Skills, Phase B aendert keine Optik).

1. **`shopping-list/`** [ERLEDIGT] (14 Dateien, 2870 Zeilen), in dieser Reihenfolge:
   `components/total-estimate-card.tsx` (43),
   `components/edit-item-modal.tsx` (79),
   `components/add-item-modal.tsx` (110),
   `**components**/edit-item-form.tsx` (116),
   `components/shopping-item-row.tsx` (131),
   `components/store-filter-bar.tsx` (142),
   `components/shopping-product-suggestions.tsx` (158),
   `components/store-summary-card.tsx` (97),
   `components/category-order-sheet.tsx` (274),
   `components/store-picker-field.tsx` (251), `stores-screen.tsx` (329),
   `shopping-list-screen.tsx` (362), `complete-run-sheet.tsx` (368),
   `components/add-item-form.tsx` (410)
2. **`recipes/`** [ERLEDIGT] (14 Dateien, 5970 Zeilen), in dieser Reihenfolge:
   `components/calorie-carousel.tsx` (100),
   `components/category-carousel.tsx` (142),
   `components/recipe-rating-sheet.tsx` (228),
   `components/recipe-filter-modal.tsx` (302),
   `components/recipe-shopping-sheet.tsx` (302),
   `components/recipe-preview-card.tsx` (304), `recipe-log-screen.tsx`
   (335), `wizard/recipe-wizard-step-preview.tsx` (395),
   `wizard/recipe-wizard-step-steps.tsx` (407),
   `wizard/recipe-wizard-step-basics.tsx` (557), `cooking-mode-screen.tsx`
   (562), `recipes-screen.tsx` (669), `recipe-create-screen.tsx` (783),
   `recipe-detail-screen.tsx` (884)

#### Verbindliche Vorgaben für beide Listen (keine Ausnahme ohne Rücksprache)

1. **KRITISCH zuerst lesen:** Abschnitt "KRITISCH: `className` funktioniert
   nicht auf jeder Komponente" weiter unten in diesem Dokument — vor der
   ersten Datei aus der eigenen Liste. Jede Datei mit `Svg`/`Image`
   (`expo-image`)/anderen Nicht-RN-Kern-Komponenten separat prüfen.
2. **Keine Utility-Ketten im JSX**, nur Ein-/Zwei-Wort-Klassen (semantisch,
   `@layer components` in `global.css`) — siehe Pilot-Beispiel
   (`module-settings-screen.tsx`) und den generischen `selectable-selected`/
   `selectable-idle`-Hinweis oben.
3. **Neue Klasse nur nach Suche in der bestehenden Liste** (siehe oben,
   "Neue semantische Klassen in `global.css`") — Namenskollisionen mit der
   Liste des anderen sind ein Merge-Konflikt in `global.css`, den derjenige
   ausbügelt, der zuletzt committet; am besten vorher kurz nachsehen, was es
   schon gibt.
4. **Kein `style={{...}}`** außer den drei dokumentierten Ausnahmen
   (Laufzeitwerte wie `insets.bottom`/`Animated.Value`, native Farb-Props
   wie `Switch.trackColor`, Nicht-NativeWind-Komponenten wie `Svg`/
   `expo-image`) — jede Ausnahme im Code kommentieren, warum.
5. **Definition of Done pro Datei:** `grep -n "style={{" <datei>` →
   `bun run check` → `bun run typecheck` → `bun run test -- <dateiname>`.
6. **Am Ende der eigenen Domain:**
   `npx tailwindcss -i src/global.css -o /tmp/out.css -c tailwind.config.js`
   muss fehlerfrei durchlaufen (fängt kaputte `@apply`-Referenzen ab, die
   `tsc`/Biome nicht sehen — genau das hat am 2026-08-17 die App komplett
   unsichtbar gemacht, s. u.).
7. **Kein Bugfixing "nebenbei"** außer dem explizit zugewiesenen
   `premium-promo-card.tsx`-Auftrag oben — visuelle Abweichungen, die beim
   Migrieren aber nicht durch die Migration selbst verursacht wurden, werden
   gemeldet, nicht stillschweigend "verbessert".

**`auth/` [ERLEDIGT]:** `sign-in-screen.tsx`, `sign-up-screen.tsx`,
`forgot-password-screen.tsx`, `reset-password-screen.tsx`,
`components/email-verification-panel.tsx` — alle auf NativeWind umgestellt. Neue
`ThemedText`-Rollen aus Phase A genutzt (`smallDanger`, `smallMuted`,
`bodyBold`, `smallSelected`, `code`). Die früheren permanenten Puls-Animationen
des Verifizierungsstatus wurden beim Auth-Umbau entfernt; der Status ist nun statisch.
`bun run check`/`typecheck`/`test` (77 Tests in `auth/`) grün.

**`onboarding/` [ERLEDIGT]:** `onboarding-flow.tsx` und alle 7
`components/*-step.tsx`/`welcome-carousel.tsx`. `useTheme()` bleibt gezielt
nur, wo eine native Komponente einen echten Farbwert braucht
(`ProgressBar`s `color`-Prop) — dokumentiert, keine Regression.
`bun run check`/`typecheck`/`test` (alle 628 Tests app-weit) grün.

**Wichtig fuer die naechsten Domains — generisches Auswahl-Paar:**
Das Muster "ausgewaehlt = bg-accent+border-accent, sonst =
bg-background-element+border-border" kam in `settings/`/`onboarding/`
mehrfach vor. Ab jetzt **immer** `selectable-selected`/`selectable-idle`
verwenden, keine neuen `*-selected`/`*-idle`-Paare mehr anlegen. (Die
aelteren Paare aus `settings/` — `module-row-selected/idle`,
`chip-selected/idle`, `choice-chip-selected/idle` — sind noch nicht
konsolidiert, das ist ein spaeteres Aufraeumen, kein Blocker.)

**Neue semantische Klassen in `global.css`** aus diesen drei Domains (fuer
Wiederverwendung in den naechsten Domains **immer zuerst pruefen**, bevor
neue Namen erfunden werden — viele generische Layout-Klassen wie `gap-three`,
`row-between`, `perm-heading`/`perm-subheading` passen oft direkt):
`stack`, `row-between`, `row-wrap`, `row-text`, `divider`, `link-stack`,
`module-row(-selected|-idle)`, `chip(-selected|-idle)`,
`choice-chip(-selected|-idle)`, `choice-row`, `profile-row`, `profile-avatar`,
`debug-row`, `debug-item`, `action-stack`, `action-list`, `screen-scroll`,
`pending-card`, `hero-container`, `pulse-ring`, `icon-circle`, `live-dot`,
`email-capsule`, `pending-title`, `pending-description`, `code-block`,
`code-input`, `progress-container`, `signout-link`, `signout-text`,
`complete-container`, `complete-icon-circle`, `complete-icon`,
`complete-heading`, `complete-subheading`, `complete-error`,
`complete-button-container`, `carousel-title`, `pagination-row`,
`pagination-dot(-active|-idle)`, `perm-heading`, `perm-subheading`,
`perm-list`, `perm-card(-selected|-idle)`, `perm-row`, `perm-text-col`,
`perm-title`, `perm-desc`, `perm-button-row`, `onboard-module-row`,
`onboard-module-title`, `onboard-module-desc`, `account-active-container`,
`account-active-banner`, `account-active-title`, `account-form`,
`account-tab-toggle`, `account-tab-button(-active)`, `account-tab-text`,
`account-error-text`, `household-active-card`, `household-active-badge`,
`household-active-title`, `household-choice-card(-selected|-idle)`,
`household-choice-title`, `household-choice-desc`, `household-error-text`,
`profile-form-section`, `input-row`, `section-label`, `sex-row`,
`option-button`, `option-text`, `profile-choice-card`, `profile-choice-text`,
`selectable-selected`, `selectable-idle`.

Pro Datei:

1. `StyleSheet.create`-Block durchgehen, jeden Key auf eine bestehende
   Tailwind-Klasse abbilden.
2. Fehlt ein Token (Farbe/Spacing/Radius/Größe), **zuerst in
   `tailwind.config.js`/`src/global.css` ergänzen**, dann erst in der
   Komponente nutzen — nicht umgekehrt.
3. `useTheme()`/`Colors`/`Spacing`/`Radius`/`Gradients`-Importe entfernen,
   sobald nichts mehr davon in der Datei gebraucht wird.
4. Verifikation pro Datei: `grep -n "style={{" <datei>` (Definition of
   Done, siehe oben) → `bun run check` → `bun run typecheck` →
   `bun run test -- <dateiname-pattern>` (gezielt, nicht die ganze Suite
   bei jedem Schritt).
5. Kein `bun test` (Bun-Runner, ignoriert `jest.config.js`) — siehe
   `AGENTS.md`.

Am Ende von Phase B: `grep -rl "from '@/constants/theme'" src | wc -l` → 0,
`grep -rc "StyleSheet.create" src --include="*.tsx" | wc -l` → 0 (oder nur
noch Sonderfälle, siehe unten).

### Phase C — Liquid Glass, Pilot: Dashboard "Glass Cards" [ERLEDIGT, Stand 2026-08-17]

`src/components/glass-card.tsx` (`GlassCard`) gebaut und in
`dashboard-screen.tsx` eingesetzt — nach drei statischen Mock-Varianten
(Artifact, per html-communication-Skill vorgelegt) hat Marco **Variante B**
gewählt: nur die navigierbaren Kacheln (Essensplan-Karte, Vorrat-Kachel,
Einkauf-Kachel) bekommen echtes Glas, die Kalorien-Karte bleibt bewusst solide
(Apple-HIG: Glas ist für Interaktions-Chrome, nicht für reine
Content-Flächen — s. Punkt 1 unten).

- `GlassCard` guardet über `isGlassEffectAPIAvailable()` (aus
  `expo-glass-effect`) + `AccessibilityInfo.isReduceTransparencyEnabled()`
  und faellt sonst auf die alte solide Karte zurück (`fallbackClassName`,
  identische Tailwind-Klasse wie vorher). Kein `expo-blur`-Zwischenschritt
  (Pattern-A-Vorschlag aus dem `expo-liquid-glass`-Skill) — das Paket war gar
  nicht installiert, ein direkter Fallback auf die bestehende solide Karte
  ist einfacher und braucht keine zusätzliche native Dependency.
- `GlassView` hat kein `cssInterop` (s. "KRITISCH"-Abschnitt unten) — die
  Radius-/Padding-/Gap-Werte der Glas-Fläche stehen deshalb als RN-`style`
  in `dashboard-screen.tsx` (`PLANNED_GLASS_STYLE`/`WIDGET_GLASS_STYLE`),
  synchron zu `.dashboard-planned-card`/`.dashboard-widget` in `global.css`
  gehalten (Kommentar im Code weist darauf hin).
- Auf dem Gerät verifiziert (Dev-Client-Rebuild nötig, da natives Modul).
- Zweiter Anwendungsfall für eine generische `GlassCard`-API abwarten, bevor
  z. B. auch `recipe-detail-screen.tsx` o. Ä. umgestellt wird (YAGNI, wie
  schon in `docs/DESIGN_SYSTEM.md` Abschnitt 6 Punkt 5 für die alte
  Screen-lokale Lösung festgehalten).

**Ausblick (noch nicht begonnen, separater Auftrag):** Marco will das
Dashboard perspektivisch frei editierbar machen — verschiebbare Kacheln in
drei Größen. Das ist ein groesseres Grid-/Drag-Redesign, kein Teil dieser
Phase-C-Aufgabe; braucht wieder erst Mocks, bevor irgendetwas Echtes
angefasst wird.

Ursprünglicher Auftrag (Referenz): Siehe `docs/DESIGN_SYSTEM.md` Abschnitt 6,
Punkt 5 — `dashboard-screen.tsx` hatte lokale Styles (`glassCard`,
`calorieCard`, `plannedCard`, `widget`) mit identischem Muster (`boxShadow`,
`borderRadius`, `borderCurve: 'continuous'`, `backgroundColor:
theme.backgroundElement`), aber **kein echtes Glass** — nur Schatten+Radius
unter falschem Namen.

1. Vor dem Umbau: `references/apple-liquid-glass-design.md` (Skill
   `expo-liquid-glass`) lesen — Hierarchie über Layout/Spacing, nicht über
   Deko-Layer; Glass nur für Chrome/Controls, nicht für Content-Flächen.
2. Neue Komponente `src/components/glass-card.tsx` (oder passenderer Name
   nach Rücksprache) bauen:
   - `isGlassEffectAPIAvailable()`-Check aus `expo-glass-effect`, Fallback
     auf `expo-blur`/einfache View mit `bg-background-element` für
     Android/ältere iOS-Versionen (Pattern "Guarded Adaptive Glass Wrapper"
     aus dem `expo-liquid-glass`-Skill, Abschnitt 5 Pattern A).
   - `AccessibilityInfo.isReduceTransparencyEnabled()` prüfen, nicht-Glass
     Fallback bereitstellen.
3. **Erst als statisches Mock bauen und zeigen, nicht direkt in
   `dashboard-screen.tsx` einbauen** — das ist Standing-Constraint aus
   `AGENTS.md` ("Visual and design work": mehrere Mocks bauen, per
   Artifact/html-communication-Skill zeigen, auf Auswahl warten, bevor
   irgendein echter Screen angefasst wird). Erst nach Freigabe in
   `dashboard-screen.tsx` einbauen.
4. **Braucht Dev-Client-Rebuild** (`bash scripts/ios-dev.sh`) — `expo-glass-effect`
   und `@expo/ui` sind native Module, laufen nicht in Expo Go. Maintainer vor
   dem Rebuild informieren (`AGENTS.md`: "Keine stillen
   Native-Module-Installationen").
5. Nach Freigabe: zweiten echten Anwendungsfall abwarten, bevor eine
   generische `GlassCard`/`HubTile`-API app-weit ausgerollt wird (YAGNI,
   s. `docs/DESIGN_SYSTEM.md` Backlog Punkt 5) — nicht vorauseilend
   generalisieren.

## KRITISCH: `className` funktioniert nicht auf jeder Komponente

**Nur Komponenten, die NativeWind per `cssInterop` registriert hat, verstehen
`className`.** Standardmäßig sind das die Kern-RN-Primitives (`View`, `Text`,
`Pressable`, `ScrollView`, `TextInput`, `Image` aus `'react-native'`, …) plus
`SafeAreaView`/`SafeAreaProvider` aus `react-native-safe-area-context` (fest
in `node_modules/react-native-css-interop/dist/runtime/third-party-libs/`
registriert). **Alles andere ignoriert `className` stillschweigend — kein
Fehler, keine Warnung, die Klasse verschwindet einfach.** Das hat am
2026-08-17 die komplette App unsichtbar gemacht (`GradientBackground`s `Svg`
verlor `position: absolute`, hat den ganzen Screen-Inhalt verdrängt) und
mehrere App-weite Icons kaputt gemacht (`fam-icon.tsx`, `calendar-day-icon.tsx`
— `Image` aus `expo-image`, nicht aus `'react-native'`).

**Betroffen (mindestens):**

- `Svg`/`Path`/`Rect`/`Circle`/etc. aus `react-native-svg` — **kein**
  `cssInterop`.
- `Image` aus `expo-image` — **kein** `cssInterop` (Achtung: `Image` aus
  `'react-native'` selbst funktioniert, das ist eine andere Komponente mit
  demselben Namen — immer den Import-Pfad prüfen).
- Vermutlich auch: `expo-blur`s `BlurView`, `expo-linear-gradient`,
  `react-native-purchases-ui`, `react-native-qrcode-svg` — noch nicht
  einzeln geprüft, im Zweifel vor Einsatz verifizieren (siehe Check unten).

**Vor jedem `className` auf einer Nicht-RN-Kernkomponente prüfen:**

```bash
ls node_modules/react-native-css-interop/dist/runtime/third-party-libs/
```

Steht die Bibliothek nicht in der Liste: `className` **nicht** verwenden,
stattdessen `style` (mit Kommentar, warum — analog zur
`Fonts.mono`/`Animated.Value`-Ausnahme unten).

**Wie man das prüft, wenn unsicher:** `grep -rn "cssInterop\|remapProps"
node_modules/nativewind/dist node_modules/react-native-css-interop/dist` und
nachsehen, ob die fragliche Komponente/Bibliothek dort registriert wird.

## Bekannte Lücken / Sonderfälle (bewusst nicht in der globalen Basis)

- **`Fonts.*`** (`src/constants/theme.ts`): plattformabhängig über
  `Platform.select({ios, default, web})`, kann nicht als einzelner
  statischer Tailwind-Wert abgebildet werden. Bis zu einer besseren Lösung:
  in `themed-text.tsx` (dem einzigen nennenswerten Verbraucher neben einer
  Ad-hoc-Stelle in `sync-debug-screen.tsx`) als Ausnahme im `style`-Array
  belassen, nicht erzwingen.
- **`withAlpha(hex, alpha)`** (`src/constants/theme.ts`): erzeugt dynamisch
  `rgba()`-Strings für `boxShadow` mit variabler Opazität. Kein 1:1
  Tailwind-Äquivalent für beliebige Opazitätswerte auf einem
  CSS-Variablen-Farbton. Beim Anfassen einer Screen mit `shadowCard`/
  `shadowSheet` erst prüfen, ob eine feste `shadow-card/20`-artige Klasse
  (Tailwind-Opacity-Modifier, falls NativeWind das für `boxShadow`
  unterstützt) reicht, sonst hier in dieser Datei dokumentieren statt
  einfach zu inline-stylen.
- **`StyleSheet.hairlineWidth`** ist bereits gelöst (`border-hairline`,
  0.5px fest) — nicht durch `style={{borderWidth: StyleSheet.hairlineWidth}}`
  ersetzen, das war ein Fehler im ersten Pilot-Versuch und wurde korrigiert.
- **Native Farb-Props (kein `style`/`className`), z. B. `Switch`s
  `trackColor`/`thumbColor`:** Diese Props erwarten einen echten Farbwert zur
  Laufzeit, keinen CSS-String — `var(--color-x)` oder eine Tailwind-Klasse
  funktionieren hier nicht. Für diese Fälle bleibt `useTheme()` gezielt im
  Einsatz (Ausnahme, nicht der Normalfall), z. B.
  `trackColor={{ false: theme.border, true: theme.accent }}`. Bitte
  kommentieren, warum `useTheme()` an der Stelle bleibt, damit es beim
  nächsten Durchgang nicht faelschlich als vergessene Migration auffaellt.

## Leitplanken (aus `AGENTS.md`/`CLAUDE.md`, gelten weiter)

- `bun run test`, niemals `bun test`.
- Migrationsdateien unter `supabase/migrations/` nicht anfassen — hier
  irrelevant, aber falls im selben Zug DB-nahe Screens dran sind: nicht
  vermischen.
- Fragen sind read-only: falls beim Migrieren unklar ist, ob ein
  visuelles Detail geändert werden soll (nicht nur der Styling-Mechanismus),
  erst fragen statt zu raten.
- Vor jedem Abschluss: `bun run check` → `bun run typecheck` →
  `bun run test`.
- Kein Em-Dash in Copy, keine neuen Feature-Entscheidungen "nebenbei" beim
  Migrieren treffen.

## Hinweis: Custom-Klasse + `ThemedText`-Rolle auf derselben Komponente

Wenn ein eigener Klassenname (z. B. `quick-add-title`) eine Font-Groesse
overridet, die `ThemedText`s Rollen-Klasse (z. B. `text-body-relaxed` vom
Default-`type`) ebenfalls setzt, konkurrieren zwei Utility-Regeln um
dieselbe CSS-Property. Geprueft am 2026-08-17 (generiertes CSS): Tailwinds
`@layer utilities` (Rollen-Klassen) steht **immer nach** `@layer components`
(eigene Klassen) im Stylesheet — auf **Web** (echte CSS-Kaskade) wuerde die
Rollen-Klasse also gewinnen, nicht die eigene. Auf **nativ** (iOS/Android,
Hauptzielplattform) mergt NativeWind Klassen dagegen in der Reihenfolge der
`className`-Zeichenkette (`ThemedText`s `mergedClassName` haengt die eigene
Klasse zuletzt an) — dort gewinnt die eigene Klasse wie beabsichtigt. Bisher
kein Hinweis auf falsche Schriftgroessen im nativen Build (Marco hat den
Stand nach dem `pb-safe`-Fix bestaetigt, keine Groessen-Beschwerden). Bei
einer spaeteren Web-Build-Pruefung diesen Punkt im Hinterkopf behalten, kein
akuter Blocker fuer Phase B.
