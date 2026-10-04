# Expo SDK 57: betroffene Upstream-Issues

**Status:** Lokale Fetch-Global- und Android-Crop-Workarounds sind umgesetzt und geprüft. Der direkte Supabase-Transport mit `expo/fetch` bleibt als separater Befund in `fam-cmq4` offen.

## Befund

Das Projekt verwendet Expo `~57.0.26` und `expo-image-picker` `~57.0.20`.

- Expo [#50213](https://github.com/expo/expo/issues/50213) betrifft unterbrochene native Fetch-Response-Bodies: iOS kann beim Lesen hängen bleiben; Android kann einen verkürzten Body als erfolgreich zurückgeben. Die SDK-57-Doku sagt, dass `EXPO_PUBLIC_USE_RN_FETCH=1` React Natives Fetch global beibehält: [Expo Fetch, SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/expo/). EAS-TestFlight- und Produktionsprofile setzen den Schalter bereits. `bun start` und `bun run ios` führen über `scripts/local-expo.sh`; der iOS-Offline-Test in CI startet Metro ebenfalls über `bun run start` und erreicht denselben Launcher. Dort fehlte ein Default.
- Der Schalter deckt nicht alle Requests ab: `src/lib/backend/supabase/remote-client.ts` übergibt Supabase explizit den benannten Import `fetch` aus `expo/fetch`. Die Expo-Doku bestätigt, dass benannte Imports durch `EXPO_PUBLIC_USE_RN_FETCH` nicht umgestellt werden. Dieser Pfad bleibt von #50213 betroffen. Der bestehende Transport hat einen Binär-Upload-Grund und wird separat untersucht in `fam-cmq4`.
- Expo [#49802](https://github.com/expo/expo/issues/49802) betrifft den nativen Android-Zuschnitt, wenn Android während des Crop-Schritts den Image-Picker-Cache entfernt. Betroffen waren sowohl der Profilbild-Picker als auch der Rezeptbild-Picker; beide nutzten `allowsEditing: true`. Expo-PR [#49958](https://github.com/expo/expo/pull/49958) ist offen gegen `main`; das installierte `expo-image-picker` `~57.0.20` enthält den Fix nicht.

Die versionierten SDK-57-Dokumente bestätigen die relevanten Schalter: [Expo Fetch](https://docs.expo.dev/versions/v57.0.0/sdk/expo/) und [ImagePicker `allowsEditing`](https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/).

## Umsetzung

### `fam-w9rv` — lokalen Fetch-Transport absichern

`scripts/local-expo.sh` erhält vor dem Start von Expo den Default `EXPO_PUBLIC_USE_RN_FETCH=1`. Ein explizit gesetzter Wert aus der aufrufenden Umgebung bleibt bestehen. Die EAS-Konfiguration wird nicht verändert.

Die bestehende Konfigurationsprüfung `test/expo-fetch-config.test.ts` wird gezielt um den lokalen Launcher-Default und den Erhalt eines expliziten Overrides ergänzt.

### `fam-n5sm` — Android-Crop im Profilbild-Picker umgehen

`src/features/profile/avatar-uploader.android.ts` setzt `allowsEditing: false`; die `aspect`-Option entfällt dort, da sie ohne Crop nicht greift. `src/features/profile/avatar-uploader.ts` behält den iOS-Zuschnitt. Die OCR-Picker-Konfiguration bleibt unberührt. Es wird kein natives Modul ergänzt.

Die Android-spezifische Picker-Konfiguration hat eine fokussierte Prüfung in `src/features/profile/avatar-uploader.test.ts`.

### `fam-z184` — Android-Crop im Rezeptbild-Picker umgehen

`src/features/recipes/data/recipe-image-picker.android.ts` setzt `allowsEditing: false`; `aspect` entfällt. Der plattformneutrale `src/features/recipes/data/recipe-image-picker.ts` behält den 4:3-Zuschnitt für iOS. `household-recipe-images.ts` exportiert den plattformabhängig aufgelösten Picker weiter wie zuvor. Die iOS- und Android-Konfigurationen sind in `src/features/recipes/data/recipe-image-picker.test.ts` gezielt geprüft.

## Reihenfolge und Abnahme

Die lokalen Workarounds sind umgesetzt. Der direkte Supabase-Import aus `expo/fetch` bleibt bewusst unverändert, bis ein Transport gefunden und geprüft ist, der Mid-Body-Fehler abfängt und Binär-Uploads erhält. Der Diff der umgesetzten Änderungen wurde geprüft und `git diff --check` ist sauber.

Ausgeführte Checks:

- `bun run test --no-cache test/expo-fetch-config.test.ts src/features/profile/avatar-uploader.test.ts src/features/recipes/data/recipe-image-picker.test.ts` — 3 Suites, 18 Tests bestanden
- `bun run typecheck` — bestanden
- `bunx biome check` auf den geänderten Fetch- und Picker-Dateien — bestanden

Unbeteiligte Änderungen im Arbeitsverzeichnis wurden nicht angefasst.

## Auswirkungen

Android-Profil- und Rezeptbilder durchlaufen vorerst keinen nativen Crop-Bildschirm. Die Auswahl liefert dort keinen quadratischen beziehungsweise 4:3-Ausschnitt; der Android-Upload führt selbst keinen Crop aus. `quality: 0.8` bleibt aktiv. iOS behält den bisherigen Zuschnitt. Der Fetch-Default entspricht lokal der bereits aktiven EAS-Einstellung.
