# Implementation Plan: Edge Functions Hardening, Resilienz & Performance

- **Spezifikation:** [`docs/specs/edge-functions-hardening.md`](file:///c:/GIT/fam/docs/specs/edge-functions-hardening.md)
- **Beads Epic:** `fam-608` (Härtung, Resilienz & Performance der Supabase Edge Functions)
- **Definition of Done:** [`.claude/references/definition-of-done.md`](file:///c:/GIT/fam/.claude/references/definition-of-done.md)

---

## 1. Overview

Dieser Implementierungsplan überführt die Spezifikation [`docs/specs/edge-functions-hardening.md`](file:///c:/GIT/fam/docs/specs/edge-functions-hardening.md) in vertikal geschnittene, isoliert testbare und verifizierbare Tasks. Die Tasks werden vollständig über **Beads (`bd`)** unter dem Epic `fam-608` verwaltet.

---

## 2. Architecture Decisions

1. **Deno 2 & JSR:** Alle Edge Functions laufen in Deno 2 und nutzen `@supabase/supabase-js@2` über JSR.
2. **Key-Hygiene:** Der Fallback auf `SUPABASE_SECRET_KEY` wird vollständig verbannt. Wenn kein `SUPABASE_ANON_KEY` vorhanden ist, wird ausschließlich `SUPABASE_PUBLISHABLE_KEY` akzeptiert. Fehlt beides, bricht die Initialisierung ab (Fail-Closed).
3. **Universelle Preflight- & CORS-Unterstützung:** Jede Funktion antwortet auf `OPTIONS` mit Status 204 und standardisierten CORS-Headern (`*`, `POST, OPTIONS`, `authorization, x-client-info, apikey, content-type`).
4. **Dynamisches OpenRouter-Schema:** `openrouter-request.ts` wählt das Structured-Output-Schema anhand des angefragten `skill`:
   - `fam-cook-from-inventory` → `COOKING_SUGGESTION_RESPONSE_FORMAT`
   - `fam-inventory-capture` → `INVENTORY_CAPTURE_RESPONSE_FORMAT`
5. **Idempotente Webhook-Quittierung:** Unauflösbare Haushalte im `revenuecat-webhook` liefern HTTP 200/202 `{ ignored: true }` statt HTTP 500, um Retry-Stürme von RevenueCat zu unterbinden.
6. **Deklarativer Schema-Workflow für Context:** Der Koch-Kontext wird über eine `SECURITY INVOKER` DB-Funktion `public.get_cooking_context(p_household_id)` bereitgestellt, die in `supabase/schemas/16_recipe_catalog.sql` definiert, via `bun run db:diff` migriert und per `bun run test:db` getestet wird.

---

## 3. Beads Dependency Graph & Task Tracking

Alle Aufgaben sind in Beads angelegt und hierarchisch unter Epic **`fam-608`** verknüpft:

```
fam-608.1: Task 1 - Key-Hygiene & config.toml-Vollständigkeit (READY)
    │
fam-608.2: Task 2 - Security-Header & Universelles CORS/OPTIONS
    │
fam-608.3: Task 3 - Dynamische OpenRouter Structured Outputs für Inventory Capture
    │
[Checkpoint 1: Fast Checks, Deno Tests & Types]
    │
fam-608.4: Task 4 - RevenueCat Webhook Härtung (Retry-Guard & Client-Reuse)
    │
fam-608.5: Task 5 - Account-Löschung Härtung (Rate-Limit & Error-Masking)
    │
fam-608.6: Task 6 - Deklarative DB-Funktion get_cooking_context (Konsolidierung 13 REST-Calls)
    │
[Checkpoint 2: Definition of Done Abschluss-Gate]
```

### Beads Issues Index

| Issue ID | Titel | Scope | Abhängigkeit | Status |
| :--- | :--- | :---: | :--- | :--- |
| **`fam-608.1`** | Task 1: Key-Hygiene & config.toml-Vollständigkeit | S | Keine | **Closed** (✓) |
| **`fam-608.2`** | Task 2: Security-Header in auth-confirmed & Universelles CORS/OPTIONS | M | `fam-608.1` | **Closed** (✓) |
| **`fam-608.3`** | Task 3: Dynamische OpenRouter Structured Outputs für fam-inventory-capture | M | `fam-608.2` | **Closed** (✓) |
| **`fam-608.4`** | Task 4: RevenueCat Webhook Härtung (Retry-Guard & Client-Reuse) | M | `fam-608.1` | **Closed** (✓) |
| **`fam-608.5`** | Task 5: Account-Löschung Härtung (Rate-Limit & Error-Masking) | S | `fam-608.2` | **Closed** (✓) |
| **`fam-608.6`** | Task 6: Deklarative DB-Funktion get_cooking_context & Konsolidierung der 13 REST-Calls | M | `fam-608.3` | **Closed** (✓) |

---

## 4. Definition of Done Checkpoints

### Checkpoint 1 (Nach Tasks 1–3)
- `deno test supabase/functions/ai-gateway/`
- `deno test supabase/functions/enrich-off-product/`
- `bun run check`
- `bun run typecheck`

### Checkpoint 2 (Abschluss nach Tasks 4–6)
- Volle Erfüllung aller Kriterien aus `.claude/references/definition-of-done.md`:
  - *Correctness:* Alle Akzeptanzkriterien erfüllt, Deno-Tests grün, pgTAP-Tests grün.
  - *Quality:* 0 Fehler in `bun run check`, keine `@ts-ignore`-Unterdrückungen.
  - *Integration:* `config.toml` synchron, `bun run db:diff` nach Reset leer.
  - *Ship-Readiness:* `bun run db:advisors` meldet 0 Befunde, keine Secrets in Quellcode/Logs.

---

## 5. Risks and Mitigations

| Risk | Impact | Mitigation |
| :--- | :--- | :--- |
| Schema-Inkompatibilität bei OpenRouter Structured Outputs | High | Strikte Validierung von `INVENTORY_CAPTURE_RESPONSE_FORMAT` gegen `inventory_capture_proposal.v1` und Absicherung via Deno Unit-Tests in `openrouter-request.test.ts`. |
| Regressionen bei nativen Clients durch geänderte Fehlertexte | Medium | HTTP-Statuscodes (401, 403, 409, 429) und standardisierte Error-Codes (`prepare_failed`, `delete_failed`, `last_admin_with_members`) bleiben exakt erhalten. |
| RLS-Bruch bei konsolidierter DB-Funktion `get_cooking_context` | High | Funktion wird als `SECURITY INVOKER` deklariert und erzwingt `auth.uid()`-Prüfung gegen `household_members`. Validierung via pgTAP (`supabase/tests/`). |
| Unerwünschte Retries oder verlorene RevenueCat-Events | Medium | Nur permanente Mitgliedschaftskonflikte werden mit 200/202 ignoriert; echte DB-Fehler liefern weiterhin 500 für reguläre Retries. |
