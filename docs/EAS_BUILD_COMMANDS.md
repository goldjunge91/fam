# EAS-Cloud-Befehle

Referenz für alle `eas build`/`eas submit`-Kombinationen dieses Projekts. Profile stammen aus `eas.json`: `development`, `development-device`, `preview`, `preview-testflight`, `production`.

Das Projekt hat einen Apple-Developer-Account — iOS-Distribution (TestFlight, App Store) über EAS ist nutzbar, nicht nur Simulator-Builds.

## Builds erstellen

```bash
# Development (Dev-Client, für Metro/Fast-Refresh-Workflow)
eas build --profile development --platform ios          # iOS-Simulator-Build
eas build --profile development-device --platform ios    # iOS, echtes Gerät statt Simulator
eas build --profile development --platform android        # Android APK
eas build --profile development --platform all             # beide Plattformen

# Preview (interne Verteilung, kein Store)
eas build --profile preview --platform ios          # Simulator-Build
eas build --profile preview-testflight --platform ios   # TestFlight-fähiger Build
eas build --profile preview --platform android

# Production (Store-Release)
eas build --profile production --platform ios
eas build --profile production --platform android    # baut app-bundle (.aab)
eas build --profile production --platform all
```

Nützliche Flags: `--non-interactive` (kein Prompt, z. B. in Skripten), `--local` (lokal statt in der EAS-Cloud bauen), `--clear-cache` (Build-Cache verwerfen bei kaputten nativen Deps).y

## An Stores übermitteln

```bash
eas submit --profile preview-testflight --platform ios    # an TestFlight
eas submit --profile production --platform ios       # an App Store Connect
eas submit --profile production --platform android    # an Play Console
```

`eas submit` ohne `--id`/`--path` sucht automatisch den letzten Build zur passenden Plattform und Profil.

## Kombinierter Build-and-Submit-Workflow

```bash
eas build --profile production --platform ios --auto-submit    # baut und übermittelt direkt an TestFlight/App Store
```

## Status & Verwaltung

```bash
eas build:list --platform ios --limit 5    # letzte Builds ansehen
eas build:view <BUILD_ID>                   # Details zu einem Build
eas credentials                                # Signing-Zertifikate/Provisioning-Profile verwalten
```

## Empfehlung für EAS Observe

Damit EAS Observe (siehe `.claude/skills/eas-observe/`) tatsächlich Metriken liefert, braucht es einen Release-artigen Build (Debug-Builds dispatchen standardmäßig nicht):

```bash
eas build --profile preview-testflight --platform ios
eas submit --profile preview-testflight --platform ios
```
