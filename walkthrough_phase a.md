# Walkthrough: Phase A — NativeWind & Component-Klassen Migration

Alle geteilten UI-Komponenten unter [`src/components/`](file:///Users/marco/Github.tmp/family_app/fam/src/components) wurden vollständig auf **NativeWind v4** und **semantische Component-Klassen** migriert. Es gibt kein störendes Inline-CSS mehr; alle Stile sind sauber in `src/global.css` unter `@layer components` gebündelt.

---

## 1. Was wurde umgesetzt?

### A. Semantische Component- & Layout-Klassen ([`src/global.css`](file:///Users/marco/Github.tmp/family_app/fam/src/global.css))
- **Buttons:** `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-link`, `.btn-fab`, `.btn-header-icon`, `.btn-menu`, `.btn-profile`, `.btn-back-arrow`, `.btn-compact-action`
- **Karten & Shell:** `.card-fam`, `.screen-body`, `.app-shell-wrap`
- **Formulare:** `.input-field`, `.input-field-error`, `.stepper-container`, `.stepper-btn`
- **Dialoge & Sheets:** `.modal-sheet`, `.modal-backdrop`, `.snackbar-bar`
- **Badges:** `.badge-nutri-a` bis `.badge-nutri-e`
- **Layout-Primitiven:** `.row-between`, `.row-center`, `.row-start`, `.col-gap`, `.col-center`, `.row-wrap`, `.stack`

### B. `ThemedText` ([`src/components/themed-text.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/components/themed-text.tsx))
- Vollständige semantische Rollen (`small`, `smallBold`, `smallSelected`, `smallMuted`, `smallDanger`, `default`, `bodyBold`, `bodyMuted`, `title`, `subtitle`, `subtitleMuted`, `caption`, `captionMuted`, `captionCompact`, `label`, `labelBold`, `labelMuted`, `link`, `linkPrimary`, `code`).
- NativeWind-Klassen-Mapping statt blockierendem `style`-Array — Single-Word-Rollen und Klassen gewinnen sauber.

### C. Alle geteilten Komponenten in `src/components/`
- [`screen.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/components/screen.tsx): `.screen-body`, `max-w-content`, `px-three`.
- [`card.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/components/card.tsx): `.card-fam`.
- [`text-field.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/components/text-field.tsx): `.input-field`, `.input-field-error`.
- [`quantity-stepper.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/components/quantity-stepper.tsx): `.stepper-container`, `.stepper-btn`.
- [`snackbar.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/components/snackbar.tsx): `.snackbar-bar`.
- [`date-picker.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/components/date-picker.tsx) / [`date-wheel-field.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/components/date-wheel-field.tsx) / [`wheel-picker-field.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/components/wheel-picker-field.tsx): `.modal-sheet`, `.modal-backdrop`, `.input-field`.
- [`fam-icon.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/components/fam-icon.tsx), [`calendar-day-icon.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/components/calendar-day-icon.tsx), [`animated-icon.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/components/animated-icon.tsx), [`animated-icon.web.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/components/animated-icon.web.tsx): NativeWind-Sizing ohne Inline-Styles.
- [`product-information.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/components/ui/product-information.tsx): `.badge-nutri-a`...`.badge-nutri-e`.
- [`buttons/*`](file:///Users/marco/Github.tmp/family_app/fam/src/components/ui/buttons/): Alle Buttons nutzen die semantischen `.btn-*`-Klassen.

---

## 2. Verifikation & Qualitätssicherung

| Test / Check | Befehl | Ergebnis |
| :--- | :--- | :--- |
| **Linter & Formatter** | `bun run check` | ✅ 0 Fehler, 0 Warnungen |
| **TypeScript** | `bun run typecheck` | ✅ 0 Fehler (`tsc --noEmit` sauber) |
| **Unit Test Suite** | `bun run test` | ✅ **80/80 Test Suites bestanden (628/628 Tests)** |
