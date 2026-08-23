# Dump-Pipeline: lokal testen

Manueller Smoke-Test des kompletten CI-Delta-Zyklus (Baseline → Patch →
Rekonstruktion), ohne GitHub-Zugriff:

```bash
bash scripts/dump_data/test-pipeline.sh
```

Baut synthetische Schema-2-Testdaten, prüft `build-canonical-update.ts` (erster
Lauf, Patch-Lauf, Monatswechsel-Baseline) und `reconstruct-canonical.ts`
gegeneinander und gibt pro Schritt OK/FEHLER aus.

`dump-sqlite-io.bun.test.ts` / `dump-pipeline-cli.bun.test.ts` sind bewusst
aus `bun run test` ausgeschlossen (Jest läuft unter Node, `bun:sqlite` gibt es
dort nicht — siehe Kommentar in `jest.config.js`). Vorgesehen für
`bun run test:dump-pipeline` (Buns eigener Runner) — aktuell in diesem Repo
ungeklärt instabil (bricht ohne Fehlermeldung ab), noch nicht verifiziert.
