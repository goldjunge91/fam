# M1: SQLCipher-Schlüssel sicher löschen und teilen

Priorität: Medium, lokale Extraktion als Voraussetzung. Reihenfolge: Phase 3 und 5.
Maßgeblicher Bead: `fam-pbd8`. Umsetzungsstatus ausschließlich in Beads.
Ausgangsbasis: Audit `fam-aen4` vom 27. Oktober 2026.
Dieser Einzelplan ersetzt für M1 den entsprechenden Abschnitt des bisherigen Gesamtplans.

[Übersicht](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/plan.md) · [Gemeinsamer Arbeitsrahmen](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/workflow.md) · [Auditbericht](/Volumes/Programme/github/family_app/fam/reports/code-security-review-2026-10-27.md)

## Problem und Ziel

Die iOS-App speichert den SQLCipher-Key als Klartext neben der Datenbank im App-Group-Container. Der aktuelle Keychain-Cleanup lässt diese Datei zurück, sodass ein nächster Account den Key übernehmen kann.


## Eigener Task und begrenzte Umsetzungspakete

| Reihenfolge | Bead | Verantwortung |
| --- | --- | --- |
| 1 | `fam-pbd8.1` | SQLCipher-Dateischlüssel beim Account-Cleanup vollständig entfernen |
| 2 | `fam-pbd8.2` | Siri und Haupt-App über gemeinsam provisionierte Keychain verbinden |


## Vorgehen

1. In fam-pbd8.1 nach bestätigter DB-Löschung alle Datei- und Keychain-Kopien retrybar entfernen und den frischen Key des nächsten Accounts prüfen.
2. Die tatsächlich signierte gemeinsame Keychain-Gruppe von App und Siri in fam-pbd8.2 provisionieren.
3. Vorhandene Installationen mit ihrem bisherigen Key sicher migrieren und gemeinsamen Zugriff nachweisen.
4. Den Klartextspiegel erst nach realem App-/Siri-Nachweis entfernen; Neustart, Logout und Accountwechsel abnehmen.

## Dateiscope

- `src/lib/db/local-database-encryption.ts`
- `src/lib/db/database-key-file-store.ts`
- `src/lib/db/local-database-encryption.test.ts`
- `src/lib/db/database-key-file-store.test.ts`
- `app.config.ts`
- `src/lib/apple/shared-app-group.ts`
- `betroffener Siri-Key-Reader unter targets/siri`
- `gezielter Entitlement-/Key-Integrationsnachweis`


## Abhängigkeiten

Keine fachliche Vorbedingung aus einem anderen Problemplan. Gemeinsame Dateigrenzen und Betriebsfreigaben bleiben zu beachten.

## Gezielte Verifikation

- Gezielte bestehende Key-/Datei-Tests mit Löschfehlern und Reihenfolge.
- Accountwechsel-/Logout-Regressionen.
- Kein Logging von Keymaterial.
- Vor Implementierung Expo-57-/Apple-Keychain-Dokumentation prüfen.
- Marco steuert Signing/Build ausdrücklich; kein automatischer Buildstart/-stopp.
- Device Hub auf den freigegebenen Geräten; SQLCipher-Key niemals exportieren/loggen.


## Abnahme

Die verbindlichen Akzeptanzkriterien und die tatsächlichen Nachweise besitzt
`fam-pbd8`. Der vorgesehene fachliche Abnahmerahmen lautet:

- Datei-/Keychain-Cleanup entfernt nach bestätigter DB-Löschung alle Schlüsselkopien und der nächste Account erhält einen neuen Schlüssel.
- Siri/Haupt-App verfügen über tatsächlich signiertes gemeinsames Keychain-Sharing und sichere Migration bestehender Installationen.
- Der Klartextspiegel wird erst nach realem Nachweis entfernt; ohne Provisioning-/Gerätenachweis bleibt die native Teilaufgabe offen.


## Grenzen und Entscheidungen

Kein vorzeitiger Key-Wechsel bei noch vorhandener DB, kein Schlüssel-Export und kein automatischer Buildstart.

Signing/Provisioning und Builds steuert Marco. Ohne gültige Profile und nativen Nachweis bleibt der zweite Slice offen; eine TS-Suite ersetzt diesen Nachweis nicht.
