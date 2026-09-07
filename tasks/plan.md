# Implementation Plan: AI-Entwicklungsbypass

## Overview

Der vorhandene AI-Gateway-Entwicklungsheader wird an die zentrale Client-Env-Verarbeitung gekoppelt. Er darf nur in DEV und bei `EXPO_PUBLIC_FORCE_AI=true` gesendet werden. Die serverseitige Autorisierung, das LLM-Feature-Flag, Haushaltsprüfung, Minutenlimit und Credit-Prüfung bleiben unverändert.

## Architecture Decisions

- `src/lib/env.ts` erhält die einzige Client-seitige Lesestelle für `EXPO_PUBLIC_FORCE_AI`.
- Beide Gateway-Clientvarianten verwenden eine reine Headerentscheidung mit den Eingängen DEV und `env.forceAi`, damit die vollständige Matrix gezielt testbar ist.
- Die vier plattformübergreifenden Gateway-Dateien bleiben inhaltlich synchron, einschließlich ihrer Android-Kopien.
- Es werden keine Supabase-Schemas, Migrationen oder Abhängigkeiten geändert.

## Task List

1. `fam-bnj.1` Zentrale Env-Option `forceAi` ergänzen
2. `fam-bnj.2` Beide AI-Gateway-Clients absichern, abhängig von `fam-bnj.1`
3. `fam-bnj.3` Regressionstests und `.env.example` vervollständigen, abhängig von `fam-bnj.2`

## Verification Checkpoint

Gezielte Env- und Gateway-Tests, Typecheck sowie Biome-Prüfung der geänderten Dateien. Danach werden die abgeschlossenen Beads geschlossen und `git status` kontrolliert.

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Öffentliche Env-Werte werden als Berechtigung missverstanden | High | Nur Header-Steuerung im Client; Server-Gateway bleibt unverändert und prüft seine Freigaben weiter. |
| Android-Kopie driftet vom Hauptpfad ab | Medium | Identische Logik und gezielte Suche über alle vier Clientdateien. |
| Fremde `.env.example`-Änderungen werden überschrieben | Medium | Nur eine additive Zeile patchen; `.claude/settings.local.json` unverändert lassen. |

## Open Questions

Keine.
