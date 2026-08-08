# 002: Remove dead code and orphaned onboarding duplicates

**Status**: completed
**Created**: 2026-08-08
**Priority**: low

## Description

Aus dem `PendingAuthBanner`-Umbau (Commit `b3d4cd3`) blieben Reste liegen:
ein auskommentierter Dead-Code-Block in `sign-up-screen.tsx` (der alte
"Check your email"-Dead-End), sowie zwei nirgends mehr referenzierte
Duplikat-Dateien `src/features/auth/onboarding-screen.tsx` und
`src/features/auth/onboarding/step-account.tsx` (letztere trug noch das
alte `session === null`-Pattern).

## Action Items

- [x] Referenzen verifiziert (nur gegenseitig, sonst nirgends importiert)
- [x] Auskommentierten Block in `sign-up-screen.tsx` entfernt
- [x] `onboarding-screen.tsx` + `onboarding/step-account.tsx` gelöscht
- [x] `typecheck`/`lint`/`test` grün gehalten

## Notes

Commit `1a6a4ca`. Die aktive Route (`src/app/onboarding.tsx`) nutzt den
`OnboardingFlow` → `account-step.tsx`, nicht die gelöschten Dateien.
