# G1: Edge-Qualitätsgate reproduzierbar grün herstellen

Priorität: Qualitätsnacharbeit. Reihenfolge: Phase 0.
Maßgeblicher Bead: `fam-z33t.1`. Umsetzungsstatus ausschließlich in Beads.
Ausgangsbasis: Audit `fam-aen4` vom 27. Oktober 2026.
Dieser Einzelplan ersetzt für G1 den entsprechenden Abschnitt des bisherigen Gesamtplans.

[Übersicht](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/plan.md) · [Gemeinsamer Arbeitsrahmen](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/workflow.md) · [Auditbericht](/Volumes/Programme/github/family_app/fam/reports/code-security-review-2026-10-27.md)

## Problem und Ziel

`check:functions` brach im Audit an 14 nicht formatierten Dateien ab. Separates Lint meldete vier `require-await`-Fälle und einen ungenutzten Parameter. Die Typprüfung war durch die npm-Auflösung über `node_modules` blockiert.

Die vorhandene `supabase/functions/deno.lock` bindet Supabase-js und seine npm-Pakete bereits auf Version 2.118.0. Der Audit-Log nennt dagegen eine fehlende `@supabase/realtime-js@2.112.3` im vorhandenen `node_modules`. Die Lockfile wird deshalb nicht pauschal neu geschrieben. Die Deno-Auflösungsart wird ausdrücklich festgelegt und mit einem frischen task-spezifischen `DENO_DIR` geprüft.

## Eigener Task und begrenzte Umsetzungspakete

| Reihenfolge | Bead | Verantwortung |
| --- | --- | --- |
| 1 | `fam-z33t.1` | Edge-Formatierung, Lint und reproduzierbare Typprüfung herstellen |

## Vorgehen

1. Deno CLI für lokale Prüfung und CI auf Version `2.9.7` festlegen.
2. `nodeModulesDir: "none"` in `supabase/functions/deno.json` setzen. npm-Pakete werden damit über das ausdrücklich gesetzte task-spezifische `DENO_DIR` aufgelöst, ohne das von Bun verwaltete Root-`node_modules` zu verwenden.
3. Die 14 Formatierungsdateien in getrennten, rein mechanischen Batches formatieren.
4. Die vier Test-Mocks ohne `async` schreiben, dabei ihre `Promise`-Rückgaben erhalten. Den absichtlich ungenutzten Parameter in `loadCookingContext` als `_userId` markieren. Keine Abfrage- oder Handler-Semantik ändern und keine Lint-Regel abschalten.
5. Die vorhandene Lockfile nur dann generatorgestützt ändern, wenn Deno nach der Konfigurationskorrektur eine erforderliche Änderung ausweist. Jede Versionsänderung prüfen und breite Dependency-Upgrades ausschließen.
6. `check:functions`, alle vorhandenen Edge-Tests sowie Biome und App-Typecheck mit den unten festgelegten Befehlen ausführen.

## Dateiscope

- `supabase/functions/deno.json`
- `supabase/functions/deno.lock`, nur falls Deno eine erforderliche Änderung generiert
- `.github/workflows/ci.yml`, Deno-Version von `v2.x` auf `v2.9.7` festlegen
- Mechanische Formatierung dieser 14 Dateien in getrennten Batches:
  - `supabase/functions/enrich-off-product/off-client.ts`
  - `supabase/functions/enrich-off-product/index.ts`
  - `supabase/functions/enrich-off-product/off-client_test.ts`
  - `supabase/functions/auth-confirmed/index.ts`
  - `supabase/functions/revenuecat-webhook/index.ts`
  - `supabase/functions/enrich-off-product/rate-limiter_test.ts`
  - `supabase/functions/_shared/bring-image-url.ts`
  - `supabase/functions/enrich-off-product/handler.ts`
  - `supabase/functions/revenuecat-webhook/handler.ts`
  - `supabase/functions/revenuecat-webhook/handler_test.ts`
  - `supabase/functions/enrich-off-product/handler_test.ts`
  - `supabase/functions/ai-gateway/index.ts`
  - `supabase/functions/ai-gateway/handler_test.ts`
  - `supabase/functions/ai-gateway/handler.ts`
- Lint-Korrekturen: `supabase/functions/ai-gateway/handler_test.ts` und `supabase/functions/ai-gateway/index.ts`

## Abhängigkeiten

Keine fachliche Vorbedingung aus einem anderen Problemplan. Gemeinsame Dateigrenzen und Betriebsfreigaben bleiben zu beachten.

## Gezielte Verifikation

Task-spezifische, ignorierte Verzeichnisse unter `.tmp/g1-edge-qualitaetsgate/` verwenden:

```sh
mkdir -p .tmp/g1-edge-qualitaetsgate/tmp .tmp/g1-edge-qualitaetsgate/deno
TMPDIR="$PWD/.tmp/g1-edge-qualitaetsgate/tmp" DENO_DIR="$PWD/.tmp/g1-edge-qualitaetsgate/deno" deno --version
TMPDIR="$PWD/.tmp/g1-edge-qualitaetsgate/tmp" DENO_DIR="$PWD/.tmp/g1-edge-qualitaetsgate/deno" bun run check:functions
TMPDIR="$PWD/.tmp/g1-edge-qualitaetsgate/tmp" DENO_DIR="$PWD/.tmp/g1-edge-qualitaetsgate/deno" bun run test:functions
TMPDIR="$PWD/.tmp/g1-edge-qualitaetsgate/tmp" DENO_DIR="$PWD/.tmp/g1-edge-qualitaetsgate/deno" bun run check
TMPDIR="$PWD/.tmp/g1-edge-qualitaetsgate/tmp" DENO_DIR="$PWD/.tmp/g1-edge-qualitaetsgate/deno" bun run typecheck
```

Der erste Lauf erfolgt mit dem neu angelegten, leeren `DENO_DIR`. Vorhandene Caches werden nicht gelöscht. `test:functions` führt alle bestehenden Edge-Tests aus, nicht nur Tests ausgewählter Owner. `.tmp/` ist in Git ignoriert und im Jest-Modulgraphen ausgeschlossen.

### Ergebnis dieses Durchlaufs am 2. November 2026

- `check:functions` war mit Deno `2.9.7` und leerem task-spezifischem Cache erfolgreich.
- Nach Behebung der Dependency-Auflösung zeigte die erste Typprüfung fünf vorhandene Typfehler in AI-Gateway und RevenueCat-Webhook. Sie wurden mit präziseren Rückgabewerten und erhaltener Client-Inferenz korrigiert; die abschließende Prüfung ist grün.
- `test:functions` war mit 64 bestandenen und 0 fehlgeschlagenen Tests erfolgreich.
- Der fokussierte Jest-Lauf `test/conventions/unistyles-entry-convention.test.ts` war mit 3 bestandenen Tests erfolgreich; der Deno-Cache im `.tmp/` erzeugte keine Jest-Kollision.
- `bun run check` bleibt an einer Formatierung in `src/features/auth/domain/auth-deep-link.test.ts` rot.
- `bun run typecheck` bleibt wegen des Imports `parseOAuthTokensFromUrl` in `src/features/auth/oauth-provider-actions.ts` rot; das Ziel exportiert `parseAuthTokensFromUrl`.

Die beiden App-Gate-Fehler liegen in separat geänderten Auth-Dateien außerhalb dieses G1-Scopes. Sie wurden nicht angepasst. `fam-z33t.1` bleibt offen, bis die App-Gates nach Abschluss dieser unabhängigen Änderungen erneut erfolgreich laufen.

## Abnahme

Die Akzeptanzkriterien und tatsächlichen Nachweise stehen in `fam-z33t.1`.

- `check:functions` läuft mit Deno `2.9.7`, `nodeModulesDir: "none"` und leerem task-spezifischem Cache vollständig durch.
- Die 14 Dateien sind formatiert und die fünf Lint-Befunde behoben, ohne Regeln abzuschalten oder Verhalten zu ändern.
- Alle vorhandenen Edge-Tests, `bun run check` und `bun run typecheck` sind erfolgreich.
- Es entstehen keine Jest-Modulkollisionen durch Deno-Caches.
- Die vorhandene Deno-Lockfile bleibt unverändert, sofern der Generator keine erforderliche Änderung ausweist.

## Grenzen und Entscheidungen

Keine pauschalen Dependency-Upgrades und keine fachlichen AI-/Webhook-Änderungen in der Formatierung. Die Formatierung bleibt von den beiden Lint-Korrekturen getrennt. Keine Cache-Löschung und kein Aufruf gegen eine Remote-Datenbank.
