# Expo/Metro: Import kann trotz vorhandener Datei nicht aufgelöst werden

## Symptom

Android bundelt mit einem Fehler wie:

```text
Unable to resolve "@/features/..." from "src/app/..."
```

## Schnellprüfung

Zuerst prüfen, ob das Ziel wirklich fehlt:

```powershell
Test-Path -LiteralPath "src/features/<feature>/<file>.tsx"
```

Wenn die Datei vorhanden ist und der Import dem bestehenden Alias-Muster entspricht, nicht sofort Importpfade oder die Feature-Struktur ändern. Der laufende Metro-Prozess kann einen veralteten Resolver-Cache verwenden.

## Minimaler Fix

Metro mit geleertem Cache neu starten:

```bash
bun run metro:android:clear
```

Danach den Android-Dev-Client neu laden.

## Nur wenn der Fehler bleibt

Dann gezielt prüfen:

- `tsconfig.json`: `@/*` zeigt auf `src/*`.
- `metro.config.js`: `sourceExts` und Plattformauflösung sind intakt.
- plattformspezifische Dateien wie `.android.tsx` existieren und sind korrekt benannt.
- keine Merge-Konfliktmarker in `src/**/*.ts` oder `src/**/*.tsx` vorhanden sind.

Ein vollständiger Android-Export oder die komplette Test-/Typecheck-Suite ist für den ersten Cache-Verdacht nicht nötig. Erst nach einem erfolglosen Cache-Reset gezielt weiter verifizieren.
