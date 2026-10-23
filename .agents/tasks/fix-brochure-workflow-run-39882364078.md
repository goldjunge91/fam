# Broschüren-Workflow Run 39882364078

## Ergebnis

Die Remote-Ursache ist bestätigt: Im Job `Prospekte gruppieren` (`120185662083`) wurde im Step `Validate detail phase artifact` der Detailseiten-Validator mit leeren Werten aufgerufen:

```text
bun run tools/crawler/brochures/listing-only/phase-artifact.ts validate \
  --phase=detail-pages \
  --artifact-dir="${RUNNER_TEMP}/brochure-detail-pages" \
  --files=detail-pages.json,detail-page-metadata.json \
  --manifest-sha256="" \
  --predecessor-manifest-sha256=""
Phase artifact failed: --manifest-sha256 must be a non-empty string
Process completed with exit code 1.
```

Der erste Fehler trat am `2026-10-23T01:20:57Z` auf. Die Detailseiten-Produktion war vorher erfolgreich: Job `Detailseiten laden` (`120185001927`), Step `Create detail phase artifact`, erzeugte den Manifest-Digest `0e61b4c417e5d8230832f564172950d353eb91c900d7d632ce3b34276b7c8159`, verwendete den Vorgänger-Digest `f3dabb3b8db1d87a347991dddccc8bd25ec7222a4d63fff36c5b7f8f16f79ad6` und lud `brochure-detail-pages-39882364078` erfolgreich hoch.

Die Ursache war die fehlende Job-Output-Weitergabe im Job `detail-pages`. Der Step `create-manifest` schrieb beide Werte über `GITHUB_OUTPUT`, aber der Job definierte kein `outputs:`-Mapping. Deshalb expandierten `needs.detail-pages.outputs.manifest_sha256` und `needs.detail-pages.outputs.predecessor_manifest_sha256` in nachgelagerten Jobs zu leeren Strings. Der Validator verhielt sich fail-closed korrekt.

Die gleichartige Meldung im Job `Vollständige Prospektverifikation` (`120186104030`) war ein Folgefehler. Danach konnten `Verifizierten Katalog persistieren` (`120186519775`), `Konsistenzbericht erstellen` (`120186926219`) und `Veröffentlichungs-Handoff erstellen` (`120187262117`) ihre Page-Verification-Artefakte nicht laden. Der Publisher (`120187654887`) wurde übersprungen.

## Änderung

In `.github/workflows/update-brochures.yml` wurden unter dem bestehenden `detail-pages`-Job-Timeout ausschließlich diese Job-Outputs ergänzt:

```yaml
outputs:
  manifest_sha256: ${{ steps.create-manifest.outputs.manifest_sha256 }}
  predecessor_manifest_sha256: ${{ steps.create-manifest.outputs.predecessor_manifest_sha256 }}
```

In `test/crawler/update-brochures-workflow.test.ts` wurde der fokussierte Regressionstest `passes detail phase digests from its step to downstream jobs` ergänzt. Er isoliert den Abschnitt zwischen `detail-pages:` und `grouping:` und prüft beide Job-Outputs samt ihrer Quelle `steps.create-manifest.outputs.*`. Dadurch kann ein gleichnamiges Mapping in einem anderen Job die Prüfung nicht verdecken.

`tools/crawler/brochures/listing-only/phase-artifact.ts` und `test/crawler/phase-artifact.test.ts` wurden nicht geändert. Scan-Einheiten, retrybare Shards, run-/commit-/digest-gebundene Artefakte, Publisher-Rerun ohne vollständigen Scan, Fail-closed-Validierung und das 8-GB-Limit blieben unverändert. Die vorhandenen Prüfungen für `BROCHURE_R2_STORAGE_BUDGET_GB: "8"` und `--budget-bytes=8000000000` bestehen weiter.

## Remote-Evidenz und Diagnosebefehle

- `bd prime` wurde ausgeführt und lieferte den Repository-/Beads-Kontext.
- `gh api repos/goldjunge91/fam/actions/runs/39882364078 --jq '{id,head_sha,status,conclusion,event,head_branch,workflow_id,run_number,created_at,updated_at,html_url}'` meldete Run `39882364078`, Run-Nummer `32`, `workflow_dispatch`, Branch `main`, Commit `e10d46f25c167ab70f9a80d79a61bfccb75a5aae`, Status `completed`, Ergebnis `failure`.
- `gh run view 39882364078 --log-failed` lief erfolgreich und enthielt die oben dokumentierten Fehler von `Prospekte gruppieren`, `Vollständige Prospektverifikation` sowie die nachfolgenden `Artifact not found`-Fehler.
- `gh api repos/goldjunge91/fam/actions/runs/39882364078/jobs?per_page=100 --paginate --jq ...` lief erfolgreich. Es bestätigte: Scan-Merge und Detailseiten waren erfolgreich; `Prospekte gruppieren` und alle späteren Verifikations-/Persistenz-/Berichts-/Handoff-Jobs schlugen fehl; `publish-canonical` wurde übersprungen.
- `gh run view --job 120185001927 --log ...` lief erfolgreich und bestätigte den nicht leeren Detailseiten-Manifest-Digest sowie den erfolgreichen Upload.
- `gh run view --job 120185662083 --log ...` lief erfolgreich und bestätigte den erfolgreichen Download des Detailseiten-Artefakts mit ZIP-Digest `e0f491afbcdf59eb0d213f9ba20d70beb36b8465a8ce0766618ebb46837bfb00`, gefolgt vom Validator-Aufruf mit zwei leeren erwarteten Manifest-Digests.

## Lokale Reproduktion

Dieser Befehl reproduzierte den Validatorfehler ohne Remote-Artefakt und ohne eine Datei zu verändern:

```bash
GITHUB_REPOSITORY=goldjunge91/fam GITHUB_RUN_ID=39882364078 GITHUB_SHA=e10d46f25c167ab70f9a80d79a61bfccb75a5aae \
  bun run tools/crawler/brochures/listing-only/phase-artifact.ts validate \
  --phase=detail-pages \
  --artifact-dir="$PWD/.agents/tasks" \
  --files=detail-pages.json,detail-page-metadata.json \
  --manifest-sha256='' \
  --predecessor-manifest-sha256=''
```

Ergebnis: Exit-Code `1`, `Phase artifact failed: --manifest-sha256 must be a non-empty string`.

Der neue Regressionstest wurde vor der Workflow-Änderung ausgeführt:

```bash
bun run test test/crawler/update-brochures-workflow.test.ts
```

Ergebnis vor dem Fix: Exit-Code `1`; der Test `passes detail phase digests from its step to downstream jobs` schlug wegen des fehlenden `outputs:`-Mappings fehl.

## Validierung nach dem Fix

- `bun run test test/crawler/update-brochures-workflow.test.ts`
  Ergebnis: Exit-Code `0`, 1 Suite, 4 Tests erfolgreich.
- `bun run test test/crawler/phase-artifact.test.ts`
  Ergebnis: Exit-Code `0`, 1 Suite, 4 Tests erfolgreich. Insbesondere bleibt die Ablehnung fehlender und leerer Manifest-Digests geschützt.
- `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/update-brochures.yml", aliases: true); puts "YAML syntax OK"'`
  Ergebnis: `YAML syntax OK`.
- Zusätzliche Ruby-Strukturprüfung des geladenen `detail-pages`-Jobs auf beide exakten Outputs und den Step `id: create-manifest`
  Ergebnis: `detail-pages job outputs and create-manifest step OK`.
- `git diff --check -- .github/workflows/update-brochures.yml test/crawler/update-brochures-workflow.test.ts`
  Ergebnis: Exit-Code `0`.
- `bun run typecheck`
  Ergebnis: Exit-Code `0`.
- `bunx biome check test/crawler/update-brochures-workflow.test.ts`
  Ergebnis: Exit-Code `1`, weil `biome.json` `test/crawler/**` nicht in `files.includes` aufnimmt; Biome meldete `No files were processed in the specified paths`. Die Lint-Konfiguration wurde nicht geändert.
- Die stdin-Validierung mit einem unter `src/**` liegenden virtuellen Pfad wurde ebenfalls geprüft. Biome zeigte dabei bereits vorhandene Formatierungsabweichungen in älteren Zeilen derselben Testdatei; der neue Testabschnitt selbst entsprach der ausgegebenen Formatierung. Es wurde deshalb keine unaufgeforderte Vollformatierung des direkt betroffenen Tests vorgenommen.

Bei einer parallelen ersten Ausführung der beiden fokussierten Tests meldete der äußere Runner Exit-Code `-1`, obwohl die erzeugten Test-Logs beide vollständige erfolgreiche Jest-Läufe enthielten. Die beiden Befehle wurden danach seriell erneut ausgeführt; beide endeten direkt mit Exit-Code `0` und sind die maßgebliche Validierung.

## Geänderte Dateien und Arbeitsbaum

Durch diese Arbeit geändert:

- `.github/workflows/update-brochures.yml`
- `test/crawler/update-brochures-workflow.test.ts`
- `.agents/tasks/fix-brochure-workflow-run-39882364078.md`

Keine Broschüren-Scan-, Verify- oder Publish-Skripte wurden geändert. Bereits vorhandene Änderungen an `.github/actions/ios-simulator-build/action.yaml`, `.github/actions/setup-bun-env/action.yaml`, `.github/workflows/ios-simulator.yml`, `.vscode/settings.json` sowie vorhandene untracked Verzeichnisse wurden nicht verändert oder entfernt.

Es wurde kein Commit erstellt, kein Push ausgeführt und kein Reset/Revert vorgenommen.

## Unsicherheit und Remote-Fortsetzung

Die Ursache ist durch den erfolgreichen Detailseiten-Step mit nicht leerem Digest, den erfolgreichen Artefakt-Download und die beiden nachgelagerten Validator-Aufrufe mit leeren `needs.detail-pages.outputs.*`-Werten belegt. Eine lokale Ausführung der GitHub-Ausdrucksauswertung ist nicht möglich; die isolierte Workflow-Prüfung und die YAML-Strukturprüfung decken die Job-Output-Kette ab.

Ein neuer Remote-Testlauf ist erforderlich, sobald diese lokale Änderung in einen neuen Commit übernommen und gepusht wurde. Ein Rerun des alten Runs `39882364078` würde weiterhin Commit `e10d46f25c167ab70f9a80d79a61bfccb75a5aae` ohne das Job-Output-Mapping verwenden. In diesem Auftrag wurde kein Remote-Lauf gestartet.
