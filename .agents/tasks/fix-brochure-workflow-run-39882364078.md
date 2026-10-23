# Broschüren-Workflow-Run 39882364078

## Ergebnis

Die Root Cause ist durch die Remote-Logs und die lokale Reproduktion bestätigt. Der erste kausale Fehler trat nicht im Scanner, im Runner oder im Publisher auf, sondern im Job `Prospekte gruppieren`, Step `Validate detail phase artifact`. Der Detailseiten-Job hatte den Digest zuvor erfolgreich erzeugt, gab ihn aber im historischen Commit nicht als Job-Output an nachgelagerte Jobs weiter.

Der minimale Fix ist im aktuellen Arbeitsstand vorhanden:

```yaml
outputs:
  manifest_sha256: ${{ steps.create-manifest.outputs.manifest_sha256 }}
  predecessor_manifest_sha256: ${{ steps.create-manifest.outputs.predecessor_manifest_sha256 }}
```

Damit werden die beiden Werte aus dem vorhandenen Step `create-manifest` des Jobs `detail-pages` an `needs.detail-pages.outputs.*` weitergegeben. Der Validator und die Artefaktbindung wurden nicht verändert.

## Exakte Remote-Evidenz

Run [39882364078](https://github.com/goldjunge91/fam/actions/runs/39882364078) war ein abgeschlossener `workflow_dispatch` auf `main`, Commit `e10d46f25c167ab70f9a80d79a61bfccb75a5aae`, Ergebnis `failure`.

Ausgeführt und geprüft:

- `gh api repos/goldjunge91/fam/actions/runs/39882364078 --jq '{id,head_sha,event,status,conclusion,html_url}'`
  - Ergebnis: `status=completed`, `conclusion=failure`, `event=workflow_dispatch`, `head_sha=e10d46f25c167ab70f9a80d79a61bfccb75a5aae`.
- `gh api repos/goldjunge91/fam/actions/runs/39882364078/jobs?per_page=100 --paginate --jq '[.jobs[] | {id,name,conclusion}]'`
  - `PLZ-Scan zusammenführen` (`120184569753`) und `Detailseiten laden` (`120185001927`) waren erfolgreich.
  - `Prospekte gruppieren` (`120185662083`) und `Vollständige Prospektverifikation` (`120186104030`) schlugen fehl.
  - Die nachgelagerten Jobs `Verifizierten Katalog persistieren` (`120186519775`), `Konsistenzbericht erstellen` (`120186926219`) und `Veröffentlichungs-Handoff erstellen` (`120187262117`) schlugen als Folgefehler fehl.
  - `Verifizierte Prospekte veröffentlichen` (`120187654887`) wurde übersprungen.
- `gh run view 39882364078 --log-failed`
  - Zeigt im fehlgeschlagenen Schritt `Prospekte gruppieren / Validate detail phase artifact` den Aufruf mit `--manifest-sha256=""` und `--predecessor-manifest-sha256=""`.
- `gh run view --job 120184569753 --log`
  - Der Scan-Merge lief erfolgreich. `Merged 4 verified scan shard manifests.`
  - Der Step `Create scan merge artifact` erzeugte den Manifest-Digest `f3dabb3b8db1d87a347991dddccc8bd25ec7222a4d63fff36c5b7f8f16f79ad6`.
- `gh run view --job 120185001927 --log`
  - Der Step `Create detail phase artifact` lief erfolgreich und erzeugte `0e61b4c417e5d8230832f564172950d353eb91c900d7d632ce3b34276b7c8159`.
  - Das Artefakt `brochure-detail-pages-39882364078` wurde erfolgreich hochgeladen.
- `gh run view --job 120185662083 --log`
  - Der Detailseiten-Download war erfolgreich.
  - Der Step `Validate detail phase artifact` lief am `2026-10-23T01:20:57.544Z` mit leeren erwarteten Digests und endete um `2026-10-23T01:20:57.576Z` mit:

    ```text
    Phase artifact failed: --manifest-sha256 must be a non-empty string
    Process completed with exit code 1.
    ```
- `gh run view --job 120186104030 --log`
  - Wiederholte denselben Aufruf mit `--manifest-sha256=""` und `--predecessor-manifest-sha256=""`.
  - Der Step `Validate detail phase artifact` endete um `2026-10-23T01:22:18.445Z` mit derselben fail-closed Fehlermeldung und Exit-Code `1`.

## Root Cause und lokale Reproduktion

Der direkte historische Vergleich wurde mit folgendem Befehl geprüft:

```bash
git show e10d46f25c167ab70f9a80d79a61bfccb75a5aae:.github/workflows/update-brochures.yml | python3 -c 'import sys; text=sys.stdin.read(); section=text.split("\n  detail-pages:\n", 1)[1].split("\n  grouping:", 1)[0]; print("historical detail-pages job outputs:", "present" if "\n    outputs:" in section else "absent"); print("historical create-manifest step:", "present" if "id: create-manifest" in section else "absent")'
```

Ergebnis: `historical detail-pages job outputs: absent` und `historical create-manifest step: present`.

Der vorhandene `phase-artifact.ts`-Code schreibt beim Erzeugen über `GITHUB_OUTPUT` die beiden Werte `manifest_sha256` und `predecessor_manifest_sha256`. Im historischen Workflow existierte zwar der Step `id: create-manifest`, aber keine Job-Outputs-Deklaration. GitHub expandierte deshalb in den beiden Verbrauchern `needs.detail-pages.outputs.*` zu leeren Strings. Der vorhandene Validator lehnte das korrekt fail-closed ab.

Die konkrete lokale Reproduktion war:

```bash
GITHUB_REPOSITORY=goldjunge91/fam GITHUB_RUN_ID=39882364078 GITHUB_SHA=e10d46f25c167ab70f9a80d79a61bfccb75a5aae \
  bun run tools/crawler/brochures/listing-only/phase-artifact.ts validate \
  --phase=detail-pages \
  --artifact-dir=.agents/tasks/fix-brochure-workflow-run-39882364078-no-artifact \
  --files=detail-pages.json,detail-page-metadata.json \
  --manifest-sha256='' \
  --predecessor-manifest-sha256=''
```

Ergebnis: Exit-Code `1`, `Phase artifact failed: --manifest-sha256 must be a non-empty string`. Der Validator brach vor dem Lesen eines Artefakts ab; der angegebene nicht vorhandene Artefaktpfad wurde dadurch nicht angelegt.

## Änderung und Scope

- `.github/workflows/update-brochures.yml`: Der Job `detail-pages` enthält nun die beiden Job-Output-Mappings aus `steps.create-manifest.outputs.*`. Diese Änderung ist bereits im vorhandenen Commit `1d43b810140863a1b4ef8b3a199a894fb298fc8a` enthalten; in dieser Iteration wurde kein Commit erzeugt und kein Push ausgeführt.
- `test/crawler/update-brochures-workflow.test.ts`: Der fokussierte Regressionstest isoliert den Abschnitt zwischen `detail-pages:` und `grouping:` und prüft beide Mappings samt ihrer Quelle. Zusätzlich wurde nur die vorhandene Datei so formatiert, dass die fokussierte Biome-Prüfung den Test tatsächlich verarbeitet.
- `.agents/tasks/fix-brochure-workflow-run-39882364078.md`: Dieser evidenzbasierte Diagnose- und Validierungsbericht.
- Keine Scan-, Verify- oder Publish-Skripte wurden geändert. `tools/crawler/brochures/listing-only/phase-artifact.ts` und `test/crawler/phase-artifact.test.ts` blieben unverändert.

Erhalten und erneut geprüft wurden: vier retrybare Scan-Shards mit `fail-fast: false` und `max-parallel: 4`, run- und commitgebundene Artefakte, Digest-Prüfung, Publisher-Rerun ohne erneuten vollständigen Scan, fail-closed Verhalten sowie das 8-GB-Limit mit `BROCHURE_R2_STORAGE_BUDGET_GB: "8"` und `--budget-bytes=8000000000`. Es wurde weder ein Limit abgesenkt noch ein zusätzlicher Scan-Merge-Retry-Guard eingeführt.

## Fokussierte Validierung

Erfolgreich, seriell ausgeführt:

```bash
bun run test test/crawler/update-brochures-workflow.test.ts
```

Ergebnis: Exit-Code `0`, 1 Suite, 4 Tests bestanden.

```bash
bun run test test/crawler/phase-artifact.test.ts
```

Ergebnis: Exit-Code `0`, 1 Suite, 4 Tests bestanden, einschließlich der Prüfung, dass fehlende und leere erwartete Manifest-Digests abgelehnt werden.

```bash
bun run test --runInBand test/crawler/update-brochures-workflow.test.ts
bun run test --runInBand test/crawler/phase-artifact.test.ts
```

Ergebnis beider serieller Wiederholungen: Exit-Code `0`; jeweils 1 Suite mit 4 bestandenen Tests. Eine vorherige parallele Ausführung der beiden Tests und des Typechecks wurde vom äußeren Runner mit Exit-Code `-1` beendet und hatte nur Startmeldungen in den Test-Logs. Die seriellen Läufe sind die maßgebliche Validierung.

```bash
bun run typecheck
```

Ergebnis: Exit-Code `0`.

```bash
ruby -e 'require "yaml"; YAML.load_file(".github/workflows/update-brochures.yml", aliases: true); puts "YAML syntax OK"'
```

Ergebnis: `YAML syntax OK`.

```bash
ruby -e 'require "yaml"; workflow = YAML.load_file(".github/workflows/update-brochures.yml", aliases: true); job = workflow.fetch("jobs").fetch("detail-pages"); abort "missing create-manifest step" unless job.fetch("steps").any? { |step| step["id"] == "create-manifest" }; expected = {"manifest_sha256" => "${{ steps.create-manifest.outputs.manifest_sha256 }}", "predecessor_manifest_sha256" => "${{ steps.create-manifest.outputs.predecessor_manifest_sha256 }}"}; abort "detail-pages outputs mismatch" unless job.fetch("outputs") == expected; puts "detail-pages job outputs and create-manifest step OK"'
```

Ergebnis: `detail-pages job outputs and create-manifest step OK`.

Die direkte Prüfung `bunx biome check test/crawler/update-brochures-workflow.test.ts` verarbeitet wegen `biome.json` und dessen `files.includes` keinen `test/crawler`-Pfad. Sie meldete deshalb `No files were processed in the specified paths`; die Konfiguration wurde nicht geändert. Die fokussierte Datei wurde stattdessen über einen virtuellen, von der Konfiguration eingeschlossenen stdin-Pfad verarbeitet:

```bash
bunx biome check --write --stdin-file-path=src/__biome_probe_update_brochures_workflow.test.ts < test/crawler/update-brochures-workflow.test.ts >/dev/null
```

Ergebnis: Exit-Code `0`. Die Ausgabe wurde nicht in eine Datei geschrieben. Die zusätzliche Formatgleichheitsprüfung war:

```bash
bunx biome check --write --stdin-file-path=src/__biome_probe_update_brochures_workflow.test.ts < test/crawler/update-brochures-workflow.test.ts | diff -u test/crawler/update-brochures-workflow.test.ts -
```

Ergebnis: Exit-Code `0`, keine verbleibende Format- oder sichere Assistenzänderung. Damit wurde die fokussierte Testdatei tatsächlich verarbeitet, ohne die allgemeine Biome-Konfiguration zu verbreitern.

```bash
git diff --check -- .github/workflows/update-brochures.yml test/crawler/update-brochures-workflow.test.ts .agents/tasks/fix-brochure-workflow-run-39882364078.md
```

Ergebnis: Exit-Code `0`.

## Remote-Fortsetzung und Unsicherheit

Ein vollständiger erfolgreicher Remote-Nachweis liegt noch nicht vor. Der frühere Fix-Lauf wurde nur lesend geprüft:

```bash
gh api repos/goldjunge91/fam/actions/runs/39887196288 --jq '{id,head_sha,status,conclusion,html_url}'
```

Ergebnis: Run `39887196288` auf `1d43b810140863a1b4ef8b3a199a894fb298fc8a` ist `completed` mit `conclusion=cancelled`.

Die lokale Prüfung kann die GitHub-Auswertung von `needs.*.outputs` nicht ausführen. Die historische Gegenprobe, der Remote-Step-Output, die isolierte Regression und die YAML-Strukturprüfung decken die gesamte konkrete Output-Kette ab.

Ja, ein neuer Remote-Testlauf ist noch erforderlich, um den behobenen Workflow end-to-end zu bestätigen. Run `39882364078` darf dafür nicht einfach wiederholt werden, weil er weiterhin den historischen Commit `e10d46f25c167ab70f9a80d79a61bfccb75a5aae` ohne das Mapping verwendet. Wegen des ausdrücklichen Verbots von Commit, Push und neuem Remote-Lauf wurde hier kein neuer Lauf gestartet. Die vorhandenen Commits und der Remote-Status wurden nicht zurückgesetzt, revertiert oder gelöscht.

## Arbeitsbaum und Prozessgrenzen

`git status --short --branch` zeigte neben dem bestehenden Stand auf `main` bereits die unbeteiligte Änderung `.vscode/settings.json` sowie vorhandene untracked `.agents`-, `.kiro`- und `semantic-review`-Pfade. Diese wurden nicht verändert, zurückgesetzt oder gelöscht. Der aktuelle Branch zeigte `HEAD` und `origin/main` auf `a36145c3`; der Fix-Commit `1d43b810` liegt darin enthalten. In dieser Iteration gab es keinen `git commit`, keinen `git push`, keinen Reset und keinen Revert.
