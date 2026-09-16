# Spec: Mutation-Testing-Pilot für Sync- und Auth-Domainlogik

## Objective

Der Testqualitäts-Pilot misst, ob fokussierte Unit-Tests relevante
Verhaltensänderungen in zwei reinen Kernmodulen erkennen:

- Sync: `src/lib/sync/backoff.ts`
- Auth: `src/features/auth/domain/auth-error-message.ts`

Der Pilot bewertet damit die Eignung von Mutation Testing für die
Testqualitäts-Roadmap, ohne UI-, Native-Build-, Supabase- oder
Realtime-Integrationsscope in den Lauf zu ziehen. Er bleibt außerhalb des
normalen CI-Unit-Gates.

## Tool and Reproducible Commands

Tool: StrykerJS `10.0.0` mit `@stryker-mutator/jest-runner@10.0.0`.
TypeScript `6.0.3` ist bereits eine Projekt-Dev-Dependency.

Installation:

```bash
bun add --dev --exact @stryker-mutator/core@10.0.0 @stryker-mutator/jest-runner@10.0.0
```

Der fokussierte Pilot läuft danach reproduzierbar mit der lokalen CLI:

```bash
bunx --no-install stryker run stryker.config.mjs
```

Die Konfiguration verwendet die bestehende `jest.config.js`, einen Worker,
per-Test-Coverage-Analyse, zwei feste Mutationsranges und nur die beiden
zugehörigen Testdateien. Der maschinenlesbare Report unter
`reports/mutation/` bleibt lokal; der geprüfte Befund steht in
`docs/spec/mutation-testing-pilot-report.md`.

## Project Structure

- `stryker.config.mjs` — fester Pilot-Scope und ressourcenschonende Runner-
  Konfiguration.
- `src/lib/sync/backoff.ts:7-8` — pure Retry-Delay-Klammerung.
- `src/lib/sync/backoff.test.ts` — Sync-Mutationsvertrag.
- `src/features/auth/domain/auth-error-message.ts:20-25` — Grenze zwischen
  stabilem Auth-Key und Rohtextklassifikation.
- `src/features/auth/domain/auth-error-message.test.ts` — Auth-Mutationsvertrag.
- `docs/spec/spec-mutation-testing-pilot.md` — Scope und Akzeptanzvertrag.
- `docs/spec/mutation-testing-pilot-report.md` — geprüfter Score und
  Mutantenklassifikation.

## Code Style

Die Konfiguration ist ein kleiner nativer ESM-Export und hält den Scope
explizit:

```js
export default {
  testRunner: 'jest',
  coverageAnalysis: 'perTest',
  mutate: ['src/lib/sync/backoff.ts:7-8'],
};
```

Produktionscode wird durch diesen Task nicht verändert. Der Pilot führt keinen
zweiten Anwendungstest-Runner ein.

## Testing Strategy

- Vor dem Pilot: beide fokussierten Jest-Suiten mit `--runInBand` ausführen.
- Stryker nur auf den zwei reinen Mutationsranges ausführen.
- Höchstens einen Mutation-Worker verwenden, um RAM/CPU zu schonen.
- Gesamt-, getötete, überlebende, No-Coverage-, Timeout- und Error-Mutanten
  dokumentieren.
- Jede nicht getötete Mutante als fehlenden Test, absichtliche Robustheit oder
  Tool-Limit klassifizieren.
- Den normalen CI-Unit-Befehl nicht in den Mutation-Lauf integrieren.

## Boundaries

- Always: Zielbereiche explizit halten, die vorhandene Jest-Konfiguration
  verwenden, fokussierte Tests vor und nach dem Pilot ausführen und den
  menschenlesbaren Befund versionieren.
- Ask first: weitere Dev-Dependencies, CI-Laufzeitgates, eine Verbreiterung
  des Mutation-Scopes oder Mutation von Integrations-/Native-Code.
- Never: Dateien in place mutieren, das entfernte Supabase-Projekt verwenden,
  rohe Reports committen oder Tests schwächen/löschen, um den Score zu erhöhen.

## Success Criteria

1. Ein gepinntes Stryker-Tool und ein reproduzierbarer lokaler Befehl sind
   dokumentiert.
2. Der Pilot mutiert mindestens einen Sync-Bereich und einen Auth-Domainbereich
   ohne UI-/Native-Build-Scope.
3. Der lokale Pilot liefert einen Score und eine geprüfte Klassifikation aller
   nicht getöteten Mutanten.
4. Der normale CI-Unit-Gate bleibt unverändert.
5. Die zwei fokussierten Jest-Suiten, `bun run check` und `bun run typecheck`
   sind erfolgreich.

## Open Questions

- Nach diesem Pilot entscheiden, ob weitere Sync-Bereiche wie `outbox-retry.ts`
  und `pull.ts` eigene kleine Mutationsranges erhalten.
- Entscheiden, ob der Pilot manuell, nächtlich oder nur vor Releases läuft.
