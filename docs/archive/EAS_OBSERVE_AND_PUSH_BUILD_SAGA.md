# EAS Observe Setup & Push-Notifications-Build-Problem

Zusammenfassung der Session vom 2026-08-19: EAS Observe eingerichtet, danach beim ersten TestFlight-Build auf ein hartnäckiges, letztlich ungelöstes Push-Notifications-Signing-Problem gestoßen.

## Teil 1: EAS Observe (erledigt, funktioniert)

`expo-observe` ist vollständig eingerichtet:

- **`src/app/_layout.tsx`**: `export default Sentry.wrap(ObserveRoot.wrap(RootLayout))` (SDK 57 → `ObserveRoot`/`useObserve`-API) — misst Time to First Render.
- `markInteractive()` via `useObserve()` in `RootNavigator`, sobald Session + Onboarding-Flag geladen sind und der Splash ausgeblendet wird.
- `Observe.configure({ integrations: { 'expo-router': true } })` auf Modulebene — Per-Route-`cold_ttr`/`warm_ttr`-Metriken.
- Test-Button „EAS-Observe-Testevent senden" in `src/features/settings/dev/dev-tools-screen.tsx` (`Observe.logEvent('dev_tools.test_event', ...)`).

**Offen:** Ein Release-artiger Build (nicht Debug) muss tatsächlich ausgeliefert werden, damit Metriken im Dashboard erscheinen — das ist der Grund, warum wir danach versucht haben, einen `preview-testflight`-Build zu erstellen. Genau dabei kam es zur unten beschriebenen Build-Saga.

## Teil 2: Apple-Developer-Account jetzt vorhanden

`AGENTS.md` wurde aktualisiert — das Projekt hat seit heute einen Apple-Developer-Account (Individual, Team `SW8RP7PA3W`, Marco Tozzi). iOS-Distribution (TestFlight, App Store) ist damit grundsätzlich möglich. Vollständige Befehlsreferenz: [`docs/EAS_BUILD_COMMANDS.md`](./EAS_BUILD_COMMANDS.md).

## Teil 3: Die Build-Saga — 7 Versuche, ungelöst

### Ausgangsproblem: EAS-Cloud-Build-Quota aufgebraucht

```bash
eas build --profile preview-testflight --platform ios
```
```
This account has used its iOS builds from the Free plan this month, which will reset in 12 days (on Tue Sep 01 2026).
Error: build command failed.
```
→ Ausweichen auf `eas build --local` (lokaler Build, zählt nicht gegen die Cloud-Quota).

### Speicherplatz-Problem (gelöst)

```bash
eas build --profile preview-testflight --platform ios --local
```
```
[INSTALL_PODS] [ReactNativeCore] Failed to download release tarball: No space left on device - fcopyfile
```
Interne Platte war bei 95 % (642 MB frei). Fix: bun-/npm-/CocoaPods-Caches auf externe USB-Platte (`/Volumes/Programme`, 1,5 TB frei) verschoben und per Symlink zurückverknüpft, `TMPDIR` für Build-Läufe dorthin umgeleitet:

```bash
mkdir -p /Volumes/Programme/dev-caches/{bun-cache,npm-cache,cocoapods-cache,eas-build-tmp}
mv ~/.bun/install/cache/* /Volumes/Programme/dev-caches/bun-cache/ && ln -s /Volumes/Programme/dev-caches/bun-cache ~/.bun/install/cache
mv ~/.npm ~/.npm.bak_removeme && ln -s /Volumes/Programme/dev-caches/npm-cache ~/.npm
mv ~/Library/Caches/CocoaPods/* /Volumes/Programme/dev-caches/cocoapods-cache/ && ln -s /Volumes/Programme/dev-caches/cocoapods-cache ~/Library/Caches/CocoaPods
```
Danach alle Builds mit vorangestelltem `TMPDIR=/Volumes/Programme/dev-caches/eas-build-tmp/`. Ergebnis: 8,7 GB frei, Speicherplatz war ab hier nie wieder ein Problem.

### Das eigentliche, ungelöste Problem: Push-Notifications-Capability

Jeder der folgenden Build-Versuche endete mit exakt derselben Xcode-Fehlermeldung:

```
Error: The "Run fastlane" step failed because of an error in the Xcode build process.
- Provisioning profile "*[expo] com.goldjunge91.fam AppStore <TIMESTAMP>" doesn't include the Push Notifications capability. (in target 'fam' from project 'fam')
```

**Verlauf der Diagnose- und Fix-Versuche (chronologisch):**

1. **Build 1** (Profil-Zeitstempel `04:57:39.155Z`) — Ursprünglicher Fehler. Vermutung: App-ID-Capability nicht aktiviert.
   → Im Apple-Portal (`developer.apple.com` → Identifiers → `com.goldjunge91.fam`) Push Notifications aktiviert und gespeichert (per Screenshot bestätigt: Häkchen gesetzt, „Certificates (1)").

2. **Build 2** (neues Profil, Zeitstempel `08:19:55.731Z`, via `eas credentials -p ios` → Provisioning Profile löschen + „All: Set up all required credentials" neu erzeugt) — **derselbe Fehler**.

3. **Build 3** (nochmals neues Profil, Zeitstempel `08:53:15.454Z`) — **derselbe Fehler**.
   → Online-Recherche: Verdacht auf bekannten EAS-Server-Cache-Bug ([expo/expo#40851](https://github.com/expo/expo/issues/40851), [expo/eas-cli#987](https://github.com/expo/eas-cli/issues/987)) — EAS soll laut GitHub-Issues teils veraltete, gecachte Profile ausliefern.

4. **Verifikation außerhalb von EAS:** Profil direkt von Apple heruntergeladen (nicht über EAS) und lokal entschlüsselt:
   ```bash
   security cms -D -i "*.mobileprovision" | plutil -extract Entitlements xml1 -o - -
   ```
   → Enthielt korrekt `aps-environment: production`. Das widerlegt die reine „Apple hat es nie aktiviert"-Theorie, stützt aber zunächst weiter die EAS-Cache-Theorie.

5. **Build 4** — Umstellung auf lokale Credentials, um EAS' Remote-Cache komplett zu umgehen:
   - `eas credentials -p ios` → credentials.json-Download (Zertifikat + Profil lokal exportiert)
   - Frisch von Apple heruntergeladenes Profil nach `credentials/ios/profile.mobileprovision` kopiert
   - `.gitignore` um `credentials.json` und `/credentials/` ergänzt (enthielt Zertifikat-Passwort im Klartext)
   - `eas.json`: `"credentialsSource": "local"` für `preview-testflight` gesetzt
   → **Derselbe Fehler**, trotz garantiert frischer, korrekter lokaler Dateien. Das widerlegt die EAS-Cache-Theorie.

6. **Root-Cause gefunden (Ebene 1):** `npx expo prebuild --platform ios --no-install` lokal ausgeführt, generierte Entitlements geprüft:
   ```xml
   <key>aps-environment</key>
   <string>development</string>
   ```
   Ursache: `expo-notifications`' Config-Plugin (`node_modules/expo-notifications/plugin/build/withNotificationsIOS.js`) hat einen Default von `mode: 'development'`, war aber nirgends explizit in `app.json` konfiguriert. Für App-Store-Distribution (`preview-testflight`/`production`) muss `aps-environment: production` sein — sonst genau dieser Xcode-Fehler.

   **Fix:** `app.json` zu `app.config.ts` konvertiert, `expo-notifications` explizit mit dynamischem `mode` basierend auf `process.env.EAS_BUILD_PROFILE` konfiguriert (`production` für `preview-testflight`/`production`, sonst `development`). Lokal verifiziert:
   ```bash
   EAS_BUILD_PROFILE=preview-testflight npx expo prebuild --platform ios --no-install
   # → aps-environment: production ✓ korrekt
   ```

7. **Build 5** (mit dem app.config.ts-Fix) — **derselbe Fehler**, trotz verifiziertem Fix.

8. **Build 6 — Live-Diagnose:** Während des laufenden Builds direkt aus dem temporären Arbeitsverzeichnis gelesen, bevor Xcode überhaupt startet:
   ```bash
   cat .../build/ios/fam/fam.entitlements                          # → aps-environment: production ✓
   grep PROVISIONING_PROFILE_SPECIFIER .../project.pbxproj          # → korrekt gesetzt, matcht Profilname ✓
   # zusätzlich: CODE_SIGN_STYLE = Manual, CODE_SIGN_IDENTITY = "iPhone Distribution", DEVELOPMENT_TEAM korrekt ✓
   ```
   Alles korrekt verdrahtet. **Build scheiterte trotzdem identisch.**

9. **Build 7 — Live-Diagnose der tatsächlich installierten Profildatei:** Während des laufenden Builds das von EAS nach `~/Library/MobileDevice/Provisioning Profiles/<random-uuid>.mobileprovision` geschriebene File abgefangen und entschlüsselt:
   ```bash
   security cms -D -i ~/Library/MobileDevice/Provisioning\ Profiles/*.mobileprovision | plutil -extract Entitlements xml1 -o - -
   ```
   → Exakt das erwartete, korrekte Profil (`aps-environment: production`, richtige UUID). **Trotzdem derselbe Fehler.**

10. **Weitere Ausschlussdiagnose:**
    - `~/Library/Developer/Xcode/DerivedData` existiert nicht einmal → kein DerivedData-Cache-Problem.
    - `~/Library/MobileDevice/Provisioning Profiles/` war vor jedem Lauf leer → keine Namenskollision mit alten Profilen.
    - `~/Library/Developer/Xcode/UserData/Provisioning Profiles/` enthielt nur ein unrelated altes „iOS Team Provisioning Profile" (Development-Typ, anderer Name) → nicht die Ursache, da Manual-Signing per `PROVISIONING_PROFILE_SPECIFIER` diesen Cache nicht konsultieren sollte.
    - Recherche zu `eas-cli-local-build-plugin`-Quellcode bestätigt: `EAS_BUILD_PROFILE` wird korrekt an den `PREBUILD`-Subprozess durchgereicht; „Local build, skipping project archive refresh" bedeutet nur „kein Remote-Reupload nötig", keine Stale-Cache-Implikation.

11. **Letzter Hinweis aus den Expo-Docs** (`docs.expo.dev/build-reference/local-builds`): Lokale Builds folgen laut Doku explizit „anderen Prozeduren als Cloud-Builds" — das war noch nie mit einem echten Cloud-Build getestet (alle 7 Versuche liefen `--local`, wegen der aufgebrauchten Quota). **Ungetestete, aber plausible Hypothese:** Ein echter Cloud-Build könnte das Problem nicht haben, weil die Cloud-Signing-Pipeline anders arbeitet als der lokale Signing-Pfad.

### Stand am Ende der Session

- **Nicht gelöst.** Jede denkbare Konfigurationsebene wurde verifiziert korrekt (App-ID-Capability, Profil-Entitlements, App-Entitlements, `pbxproj`-Verdrahtung, Zertifikat-Profil-Pairing) — der Fehler tritt trotzdem bei jedem lokalen Build auf.
- **Zwei offene, nicht ausprobierte Optionen:**
  1. Echten **Cloud-Build** testen (Plan upgraden oder bis 01.09.2026 auf Quota-Reset warten) — bisher komplett ungetestet, laut Doku-Hinweis am ehesten vielversprechend.
  2. Pragmatischer Bypass: `EXPO_NO_PUSH_ENTITLEMENT=1` setzen (Plugin `plugins/withoutPushEntitlement.js` existiert bereits im Projekt genau dafür) — Build funktioniert dann garantiert, aber ohne Push-Notifications-Entitlement in diesem Build.
- **Code-Änderungen, die unabhängig vom Push-Problem sinnvoll bleiben** (nicht rückgängig gemacht):
  - `app.json` → `app.config.ts` mit korrektem, dynamischem `expo-notifications`-Modus (behebt einen echten Bug, unabhängig davon, ob er die eigentliche Build-Ursache war).
  - `eas.json`: `credentialsSource: "local"` für `preview-testflight` (kann bei Bedarf wieder auf `remote` zurückgestellt werden).
  - `.gitignore`: `credentials.json`, `/credentials/` ergänzt.

### Nächste Schritte (Vorschlag)

1. `eas build --profile preview-testflight --platform ios` **ohne** `--local` probieren, sobald Quota/Plan es erlauben — das ist der einzige noch nicht getestete Pfad, der laut Doku-Hinweis eine andere (und ggf. funktionierende) Signing-Pipeline nutzt.
2. Falls auch das scheitert: Apple Developer Technical Support (DTS) Ticket eröffnen — ein Apple-DTS-Techniker hat in einem sehr ähnlichen Forum-Thread ([developer.apple.com/forums/thread/808162](https://developer.apple.com/forums/thread/808162)) bestätigt, dass es sich bei identischem Symptom um ein Tooling-seitiges (nicht Apple-seitiges) Problem handelte.
3. Für einen schnellen TestFlight-Build ohne Push: `EXPO_NO_PUSH_ENTITLEMENT=1` setzen und `eas build --profile preview-testflight --platform ios --local` erneut laufen lassen.
