# NutriTrack (fam) — iOS & TestFlight Build Guide

Dieses Dokument fasst alle Erkenntnisse, gelösten Probleme, Konfigurationsschritte und Befehle zusammen, um den Produktions- und TestFlight-Build für iOS reproduzierbar zu erstellen und bereitzustellen.

---

## 1. Die Konfiguration in `app.json` & `eas.json`

Das Projekt nutzt die Standard-[`app.json`](file:///Users/marco/Github.tmp/family_app/fam/app.json) mit allen Plugins, Capabilities und Berechtigungen:
- **`expo.version`**: `1.0.0` (User-facing Version / `CFBundleShortVersionString`)
- **`ios.buildNumber`**: `"1"` (Developer-facing Build Version / `CFBundleVersion`)
- **`android.versionCode`**: `1` (Developer-facing Build Version für Android)
- **`expo-notifications`** mit `"mode": "production"` und `enableBackgroundRemoteNotifications: true`
- **`./plugins/withPushCapability`** für die Push-Capability in Xcode
- **`./plugins/withoutPushEntitlement`** zum automatischen Abstreifen bei lokalen Non-Store-Builds (`EXPO_NO_PUSH_ENTITLEMENT=1`)
- **`ios.bundleIdentifier`**: `com.goldjunge91.fam1`
- **`ios.appleTeamId`**: `SW8RP7PA3W`

### 1.1. App Version Management (EAS Remote Versioning)
In [`eas.json`](file:///Users/marco/Github.tmp/family_app/fam/eas.json) ist `"cli": { "appVersionSource": "remote" }` und für `preview-testflight` / `production` `"autoIncrement": true` hinterlegt:
- **Remote Version Source**: EAS verwaltet `buildNumber` und `versionCode` in der Cloud und zählt sie bei jedem Store-Build automatisch hoch.
- **Initialisieren / Setzen**: `bunx eas build:version:set` (z. B. Plattform iOS wählen und letzte Build-Nummer angeben).
- **Lokalen Stand synchronisieren**: `bunx eas build:version:sync` (übernimmt die Remote-Version in das lokale Projekt, wenn nativ mit Xcode gebaut wird).

---

## 2. Die 5 gelösten Kernprobleme & Root Causes

### 2.1. Push-Notification Capability & Walkie-Talkie Konflikt
- **Ursache:** In `Info.plist` war unter `UIBackgroundModes` versehentlich `push-to-talk` aktiv. Apple verlangt dafür ein separates Walkie-Talkie-Entitlement, weshalb das Profil abgelehnt wurde (`does not support the Push Notifications capability`).
- **Fix:** `push-to-talk` entfernt; in `app.config.ts` wurde `enableBackgroundRemoteNotifications: true` auf dem Plugin `expo-notifications` gesetzt (aktiviert sauberes `remote-notification`).

### 2.2. Zertifikats-Typ-Mismatch (`iPhone Distribution` vs. `Apple Distribution`)
- **Ursache:** Das alte EAS-Zertifikat war vom Typ `iPhone Distribution`. Modernes Xcode 16 erwartet für automatisches Signing ein universelles `Apple Distribution`-Zertifikat.
- **Fix:** In Xcode (`Settings` → `Accounts` → `Manage Certificates`) wurde mit dem `+`-Symbol ein neues `Apple Distribution`-Zertifikat generiert und im macOS-Schlüsselbund hinterlegt.

### 2.3. Fehlende Profildateien im ausgelagerten SSD-Ordner
- **Ursache:** Durch die Auslagerung des Developer-Ordners (`/Volumes/Programme/Xcode/DeveloperFolder`) wurden Profildateien bei vorherigen Clean-Aktionen gelöscht (`Build input file cannot be found: .../*.mobileprovision`).
- **Fix:** Die `.mobileprovision`-Dateien wurden in `/Volumes/Programme/Xcode/DeveloperFolder/UserData/Provisioning Profiles/` und `~/Library/MobileDevice/Provisioning Profiles/` synchronisiert und das Projekt auf `Automatic Signing` umgestellt.

### 2.4. Bundle-ID in App Store Connect
- **Ursache:** Die ID `com.goldjunge91.fam` war von Xcode als interne Development-ID (`XC com goldjunge91 fam`) registriert worden und tauchte im App Store Connect Dropdown nicht auf.
- **Fix:** Offizieller Identifier `com.goldjunge91.fam1` wurde in Apple Developer & App Store Connect registriert (App-ID: `6802939008`).

### 2.5. RevenueCat StoreKit-Integration
- **Ursache:** In `.env` war ein `test_...`-Key eingetragen. TestFlight- und App-Store-Builds verlangen zwingend einen StoreKit-Live-Key (`appl_...`) und einen hinterlegten In-App Purchase `.p8`-Schlüssel.
- **Fix:** In App Store Connect wurde der In-App Purchase `.p8`-Schlüssel erstellt und in RevenueCat hochgeladen. Der generierte Public Key `appl_GDRsZrhCCImrzNOFEFyrHmnuIWg` ist nun in `.env` hinterlegt.

---

## 3. Komplette Befehlsübersicht

### A. Lokaler Archive-Build (Empfohlener Weg)
Baut das Release-Archiv direkt mit Xcode und CocoaPods auf der externen SSD:

```bash
# 1. CocoaPods-Dependencies im iOS-Ordner synchronisieren (falls nötig)
cd ios && LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install && cd ..

# 2. Release-Archiv kompilieren
xcodebuild archive \
  -workspace ios/fam.xcworkspace \
  -scheme fam \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath /Volumes/Programme/xcode_archive/2026-08-19/fam1.xcarchive \
  -allowProvisioningUpdates

# 3. Fertiges Archiv im Xcode Organizer zum Upload öffnen
open /Volumes/Programme/xcode_archive/2026-08-19/fam1.xcarchive
```

---

### B. All-in-One CLI Workflow (`npx testflight`)
Automatisierter geführter CLI-Ablauf von Expo:

```bash
npx testflight
```

---

### C. Lokaler EAS-CLI Build
Baut über das lokale EAS-Plugin mit Auslagerung auf die externe SSD:

```bash
TMPDIR=/Volumes/Programme/dev-caches/eas-build-tmp/ \
bunx eas-cli build --profile preview-testflight --platform ios --local
```

---

## 4. TestFlight-Upload Checkliste

Wenn sich das **Xcode Organizer**-Fenster öffnet:

1. Wähle das oberste Archiv **`fam 1.0.0 (1)`** (bzw. die aktuelle Build-Nummer) aus.
2. Klicke rechts auf **`Distribute App`** → **`TestFlight & App Store`**.
3. Klicke auf **`Distribute`** (bzw. `Upload`).
4. Nach ca. 5–10 Minuten erscheint der Build in **App Store Connect** unter dem Reiter **`TestFlight`** und kann auf allen Geräten und von Familienmitgliedern installiert werden.

---

## 5. Wichtige Apple & Dashboard Direktlinks

| Bereich | Zweck | Direktlink |
| :--- | :--- | :--- |
| **Apple Identifiers (App IDs)** | App IDs (`com.goldjunge91.fam1`) anlegen, prüfen & Push Notifications aktivieren | [developer.apple.com/account/resources/identifiers/list](https://developer.apple.com/account/resources/identifiers/list) |
| **Apple Provisioning Profiles** | Profile einsehen, herunterladen & Ablaufdaten prüfen | [developer.apple.com/account/resources/profiles/list](https://developer.apple.com/account/resources/profiles/list) |
| **Apple Certificates** | Alle Development- und Distribution-Zertifikate verwalten | [developer.apple.com/account/resources/certificates/list](https://developer.apple.com/account/resources/certificates/list) |
| **App Store Connect (Apps)** | App-Eintrag anlegen (`Neue App`) & TestFlight-Builds verwalten | [appstoreconnect.apple.com/apps](https://appstoreconnect.apple.com/apps) |
| **App Store Connect Integrations** | In-App Purchase `.p8`-Schlüsseldatei für RevenueCat generieren | [appstoreconnect.apple.com/access/integrations/api](https://appstoreconnect.apple.com/access/integrations/api) |
| **RevenueCat Dashboard** | `.p8` hinterlegen & `appl_...` Public SDK Key abrufen | [app.revenuecat.com](https://app.revenuecat.com) |

