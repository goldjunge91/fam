# 003: Add pending-session component tests

**Status**: completed
**Created**: 2026-08-08
**Priority**: medium

## Description

Weder `sign-up-screen.tsx` noch `account-step.tsx` hatten Component-Tests für
den Zweig, in dem `signUp()` ohne Session zurückkommt (E-Mail-Bestätigung
nötig) vs. den Zweig mit direkter Session (Auto-Login).

## Action Items

- [x] `src/features/auth/sign-up-screen.test.tsx` — beide Zweige abgedeckt
- [x] `src/features/onboarding/components/account-step.test.tsx` — beide Zweige abgedeckt
- [x] `PendingAuthBanner` in beiden Tests gemockt (eigene Logik bereits in
      `pending-auth-banner.test.tsx` getestet)

## Notes

Commit `69b110f`. Stolperstein beim Schreiben: in der hier verwendeten
`@testing-library/react-native`-Version müssen `render(...)` **und**
`fireEvent.*(...)` awaited werden, sonst liest `handleSubmit` noch den
State von vor dem `changeText`-Update (führte zu falschen
Validierungsfehlern trotz sichtbar korrektem Feldwert im Debug-Tree).
