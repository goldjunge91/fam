# Spec: Härtung, Resilienz & Performance der Supabase Edge Functions

- **Status:** Entwurf / Bereit zur Freigabe
- **Datum:** 8. September 2026
- **Autoren:** Antigravity & Marco
- **Referenzen:**
  - `docs/specs/ai-feature/fam-agent-skills.md`
  - `.claude/references/definition-of-done.md`
  - `supabase/schemas/*.sql`
  - `AGENTS.md` & `GEMINI.md`

---

## 1. Objective (Zielsetzung)

Behebung aller identifizierten Sicherheitslücken, Architektur- und Performance-Mängel sowie funktionellen Blocker in den Edge Functions unter `supabase/functions/`:

1. **Behebung des `ai-gateway` Blockers:** Wiederherstellung der Lauffähigkeit von `fam-inventory-capture` durch dynamische Zuweisung des OpenRouter `response_format` (Structured Outputs).
2. **Key-Hygiene & RLS-Schutz:** Eliminierung des gefährlichen Fallbacks auf `SUPABASE_SECRET_KEY` bei der Initialisierung von User-Clients in `ai-gateway` und `enrich-off-product`.
3. **HTTP- & Security-Härtung:** Bereitstellung vollständiger Security-Header (CSP, Clickjacking-Schutz via `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`) in `auth-confirmed` sowie standardkonformes CORS- und `OPTIONS`-Preflight-Handling über alle Endpunkte hinweg.
4. **Resilienz & Denial-of-Service-Schutz:** Absicherung von `delete-account` gegen DoS (Ratelimit) und Leakage interner Fehlermeldungen. Idempotente Quittierung von unauflösbaren Haushalten im `revenuecat-webhook` zur Vermeidung von Endlos-Retry-Schleifen.
5. **Datenbank- & Latenz-Optimierung:** Konsolidierung des 13-fachen PostgREST-HTTP-Wasserfalls in `ai-gateway` (`loadCookingContext`) in eine einzige optimierte, deklarative Datenbankfunktion (`public.get_cooking_context`) gemäß `supabase-postgres-best-practices`.

---

## 2. Assumptions I'm Making (Explizite Annahmen)

1. **Deno & TypeScript:** Alle Edge Functions laufen auf Deno 2 (wie in `config.toml` konfiguriert) und nutzen `@supabase/supabase-js@2` über JSR.
2. **Deklaratives Schema:** Datenbankerweiterungen erfolgen ausschließlich in `supabase/schemas/*.sql`, generiert via `bun run db:diff` und validiert via `bun run test:db`.
3. **Client-Kompatibilität:** Kein bestehender nativer Client (`src/features/...`) darf durch geänderte Fehlerformate brechen. Alle Status-Codes und JSON-Verträge bleiben rückwärtskompatibel.
4. **OpenRouter JSON Schema:** Der Promptvertrag für `fam-inventory-capture` verlangt `inventory_capture_proposal.v1`, `fam-cook-from-inventory` verlangt `cooking_suggestion_v1`.

---

## 3. Capability Map & Modul-Dekonstruktion

```
Capability Map: Edge Functions Hardening
├── mod-config-keys          (Key-Hygiene & config.toml Deklaration)
├── mod-http-cors-sec        (Security-Header & CORS/OPTIONS)
├── mod-ai-gateway-schema    (Dynamische OpenRouter Schemata)
├── mod-webhook-resilience   (Webhook Retry-Guard & Client-Reuse)
├── mod-delete-account-guard (Rate-Limit & Error-Masking)
└── mod-db-context           (Konsolidierung von 13 REST-Calls in 1 DB-RPC)
```

| Modul-ID | Verantwortung | Dateien / Komponenten | Abhängigkeiten |
| :--- | :--- | :--- | :--- |
| **`mod-config-keys`** | Key-Hygiene & `config.toml`-Vollständigkeit | `ai-gateway/index.ts`, `enrich-off-product/index.ts`, `supabase/config.toml` | — |
| **`mod-http-cors-sec`** | Security-Header (CSP, Clickjacking) & universelles CORS/OPTIONS | `auth-confirmed/index.ts`, `delete-account/index.ts`, `enrich-off-product/handler.ts`, `ai-gateway/index.ts` | — |
| **`mod-ai-gateway-schema`** | Dynamische OpenRouter Structured Outputs (Behebung Inventory-Capture-Blocker) | `ai-gateway/openrouter-request.ts`, `ai-gateway/handler.ts`, `ai-gateway/index.ts` | — |
| **`mod-webhook-resilience`** | Idempotente Webhook-Quittierung (Verhinderung von Retry-Loops bei fehlendem Haushalt) & Client-Reuse | `revenuecat-webhook/index.ts`, `revenuecat-webhook/handler.ts` | — |
| **`mod-delete-account-guard`** | Rate-Limiting & Error-Masking für Account-Löschung | `delete-account/index.ts` | — |
| **`mod-db-context`** | Konsolidierung des 13-fachen PostgREST-Wasserfalls in eine deklarative DB-Funktion | `ai-gateway/index.ts`, `supabase/schemas/16_recipe_catalog.sql`, `20_privileges.sql` | `mod-config-keys` |

---

## 4. Detaillierte Modulspezifikationen

### 4.1 Modul `mod-config-keys`: Key-Hygiene & `config.toml`

#### Problem & Bedrohung
In `ai-gateway/index.ts` und `enrich-off-product/index.ts` existiert:
```ts
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY')!;
```
`SUPABASE_SECRET_KEY` ist der neue Name für den Service-Role-Key. Ein Fallback auf diesen Key führt bei Fehlen von `SUPABASE_ANON_KEY` zur Erstellung eines Admin-Clients, der RLS umgehen kann (Elevation of Privilege, OWASP A01). Zudem fehlen `delete-account` und `enrich-off-product` in `supabase/config.toml`.

#### Spezifikation & Umsetzung
1. Ersetzen des Fallbacks durch `SUPABASE_PUBLISHABLE_KEY`:
   ```ts
   const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
   if (!anonKey) {
     throw new Error('SUPABASE_ANON_KEY oder SUPABASE_PUBLISHABLE_KEY erforderlich.');
   }
   ```
2. Vollständige Deklaration in `supabase/config.toml`:
   ```toml
   [functions.delete-account]
   verify_jwt = true

   [functions.enrich-off-product]
   verify_jwt = true
   ```
3. Bereinigung des Kommentars für `[functions.revenuecat-webhook]` in `config.toml` (HMAC-Prüfung via `X-RevenueCat-Webhook-Signature`).

---

### 4.2 Modul `mod-http-cors-sec`: Security-Header & Universelles CORS

#### Problem & Bedrohung
- `auth-confirmed` liefert statisches HTML ohne Framing-Schutz aus (Clickjacking-Gefahr, OWASP A05). Die Bestätigungs-URL trägt im Fragment Auth-Tokens, die ohne `Referrer-Policy: no-referrer` durchsickern könnten.
- `delete-account` und `enrich-off-product` lehnen HTTP-Preflight-Requests (`OPTIONS`) mit 405 ab und liefern keine CORS-Header mit, was zu Fehlern bei Web-/Browser-Zugriffen führt.
- `ai-gateway/index.ts` liefert im globalen 500er-Exception-Handler keine CORS-Header aus.

#### Spezifikation & Umsetzung
1. `auth-confirmed/index.ts` Response-Header:
   ```ts
   headers: {
     'Content-Type': 'text/html; charset=utf-8',
     'Cache-Control': 'no-store',
     'X-Frame-Options': 'DENY',
     'X-Content-Type-Options': 'nosniff',
     'Referrer-Policy': 'no-referrer',
     'Content-Security-Policy': "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; frame-ancestors 'none';",
   }
   ```
2. Zentrale CORS-Konstante in allen betroffenen Funktionen:
   ```ts
   const CORS_HEADERS = {
     'Access-Control-Allow-Origin': '*',
     'Access-Control-Allow-Methods': 'POST, OPTIONS',
     'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   };
   ```
3. Preflight-Behandlung:
   ```ts
   if (req.method === 'OPTIONS') {
     return new Response(null, { status: 204, headers: CORS_HEADERS });
   }
   ```
4. Verlässliche Anreicherung aller Fehlerantworten (auch in Catch-Blöcken) mit `CORS_HEADERS`.

---

### 4.3 Modul `mod-ai-gateway-schema`: Behebung des Inventory-Capture-Blockers

#### Problem & Bedrohung
`createOpenRouterChatBody` in `openrouter-request.ts` erzwingt ausnahmslos `COOKING_SUGGESTION_RESPONSE_FORMAT`. Jeder reale Aufruf von `fam-inventory-capture` scheitert mit HTTP 502 `invalid_capture_kind`, da OpenRouter die Antwort in das Schema von `cooking_suggestion_v1` formatiert.

#### Spezifikation & Umsetzung
1. Erstellung des JSON-Schemas `INVENTORY_CAPTURE_RESPONSE_FORMAT` in `openrouter-request.ts`:
   - `type: 'json_schema'`
   - `strict: true`
   - Schema passend zu `inventory_capture_proposal.v1`:
     - `kind`: const `'inventory_capture_proposal.v1'`
     - `items`: Array von Objekten (`rawText`, `normalizedName`, `quantity`, `unit`, `perishability`, `storage`, `date`, `dateKind`, `confidence`, `evidence`, `missingFields`)
     - `questions`: Array von Strings
     - `warnings`: Array von Strings
2. Signaturanpassung in `openrouter-request.ts`:
   ```ts
   export function createOpenRouterChatBody(input: {
     model: string;
     messages: OpenRouterMessage[];
     skill: 'fam-cook-from-inventory' | 'fam-inventory-capture';
     maxTokens?: number;
     temperature?: number;
   }): Record<string, unknown>
   ```
3. Dynamische Zuweisung des Schemas:
   - `skill === 'fam-cook-from-inventory'` → `COOKING_SUGGESTION_RESPONSE_FORMAT`
   - `skill === 'fam-inventory-capture'` → `INVENTORY_CAPTURE_RESPONSE_FORMAT`
4. Durchleitung des `skill`-Parameters über `complete()` in `ai-gateway/handler.ts` und `index.ts`.
5. Neue Unit-Tests in `openrouter-request.test.ts`.

---

### 4.4 Modul `mod-webhook-resilience`: RevenueCat Webhook Härtung

#### Problem & Bedrohung
Wenn RevenueCat ein Entitlement-Event für einen Nutzer sendet, der keinem Haushalt zugeordnet werden kann, liefert der Webhook HTTP 500. RevenueCat wiederholt fehlgeschlagene 5xx-Webhooks tagelang, was zu Log-Überflutung und unnötigen DB-Abfragen führt. Zudem wird `createClient` für jedes Entitlement innerhalb des Requests neu instanziiert.

#### Spezifikation & Umsetzung
1. Singleton `adminClient` auf Modulebene in `revenuecat-webhook/index.ts`.
2. Semantische Quittierung in `handler.ts`:
   - Wenn `resolveMemberHousehold` keinen Haushalt auflösen kann (`target_household_missing` oder `target_household_forbidden`):
   - Rückgabe von HTTP 200/202 mit `{ ignored: true, reason: 'target_household_missing' }`.
   - Logging via `console.warn(JSON.stringify({ event: 'revenuecat_webhook_ignored', appUserId, reason }))`.
   - Echte Infrastruktur-/DB-Fehler (z. B. Connection Timeout, Postgres-Fehler) liefern weiterhin HTTP 500, um berechtigte Retries zu erlauben.

---

### 4.5 Modul `mod-delete-account-guard`: Account-Löschung Härtung

#### Problem & Bedrohung
- Unbehandelte Ausnahmen in `delete-account/index.ts` können zum Worker-Crash führen.
- Detaillierte Fehlermeldungen (`prepareError.message`, `deleteError.message`) werden direkt an den Client zurückgegeben (OWASP A05).
- Kein Rate-Limiting gegen Flutung des Endpunkts.

#### Spezifikation & Umsetzung
1. Kapselung des gesamten Handlers in `try / catch` mit standardisierter Fehlerantwort.
2. Einbindung von `consume_request_limit`:
   ```ts
   const { data: limitCheck } = await adminClient.rpc('consume_request_limit', {
     p_user_id: user.id,
     p_scope: 'delete-account',
     p_limit: 5,
     p_window_seconds: 60,
   });
   ```
   Bei Überschreitung: HTTP 429 mit `Retry-After`.
3. Maskierung der Fehlermeldungen:
   - `prepare_failed`: `{ error: 'prepare_failed', message: 'Konto konnte nicht zur Löschung vorbereitet werden.' }` (interner Fehler wird mit `console.error` geloggt).
   - `delete_failed`: `{ error: 'delete_failed', message: 'Löschung fehlgeschlagen.' }`.
   - Erhalt des bestehenden 409-Sonderfalls `last_admin_with_members` (da der Client diesen Statuscode explizit auswertet).

---

### 4.6 Modul `mod-db-context`: Konsolidierung des 13-fachen REST-Wasserfalls

#### Problem & Bedrohung
`loadCookingContext` in `ai-gateway/index.ts` führt bis zu 13 einzelne PostgREST-HTTP-Anfragen aus (`fridge_items`, `storage_locations`, 2x `products`, `shopping_list_items`, `profile_food_rules`, `catalog_recipes`, `catalog_recipe_component_items`, `catalog_recipe_steps`, `product_ingredient_links`, `catalog_recipe_item_ingredient_links`, `external_food_ingredients`, `ingredient_allergen_mappings`).
- Massive Latenz (300–600 ms allein für den Datenabruf).
- Hohe Verbindungsbelastung gemäß `supabase-postgres-best-practices`.

#### Spezifikation & Umsetzung
1. Deklarative Postgres-Funktion in `supabase/schemas/16_recipe_catalog.sql` (oder eigenem Modul):
   - Name: `public.get_cooking_context(p_household_id uuid)`
   - `SECURITY INVOKER`, `LANGUAGE plpgsql`, `STABLE`
   - Prüft Haushaltsmitgliedschaft (`auth.uid()`).
   - Aggregiert Fridge-Lots, Storage-Locations, verknüpfte OFF-Produkte, Food Rules des anfragenden Nutzers, aktive Shopping-Items und publizierte Catalog-Rezepte inklusive Zutaten, Schritten und Allergen-Projektionen in ein einzelnes JSONB-Objekt.
2. Berechtigungen in `supabase/schemas/20_privileges.sql`:
   - `REVOKE EXECUTE ON FUNCTION public.get_cooking_context FROM public, anon;`
   - `GRANT EXECUTE ON FUNCTION public.get_cooking_context TO authenticated;`
3. Migration & pgTAP:
   - Migration via `bun run db:diff -- -f cooking_context_rpc`.
   - pgTAP-Test in `supabase/tests/` zur Validierung von RLS, Rechten und Rückgabeformat.
4. Anpassung `ai-gateway/index.ts`:
   - `loadCookingContext` ruft ausschließlich `client.rpc('get_cooking_context', { p_household_id: householdId })` auf.

---

## 5. Definition of Done Checklist (Verbindlicher Abschluss-Gate)

Gemäß `.claude/references/definition-of-done.md` muss die Gesamtimplementierung folgende Kriterien zwingend erfüllen:

### Correctness
- [ ] Alle Akzeptanzkriterien jedes Moduls sind erfüllt.
- [ ] Code läuft und verhält sich zur Laufzeit wie spezifiziert (verifiziert via Deno-Tests und API-Invocations).
- [ ] `fam-inventory-capture` liefert valide `inventory_capture_proposal.v1`-Vorschläge über OpenRouter.
- [ ] Keine Regressionen bei `fam-cook-from-inventory`.
- [ ] Alle Edge-Cases und Fehlerpfade (z. B. Rate-Limit, ungültige EAN, fehlende Auth) liefern saubere Statuscodes (400, 401, 403, 405, 429, 502) mit CORS-Headern.

### Quality
- [ ] Keine `@ts-ignore` oder Lint-Unterdrückungen im neuen/geänderten Code.
- [ ] Kein toter Code, kein verbleibendes Debug-Logging (`console.log` bereinigt, nur strukturierte JSON-Logs für `warn`/`error`).
- [ ] Keine Verletzung des Single-Responsibility-Prinzips.
- [ ] Linter & Formatter sind fehlerfrei (`bun run check`).

### Integration
- [ ] Rückwärtskompatibilität für alle mobilen Screens (`inventory-screen`, `recipe-suggestions-screen`, `members-screen`).
- [ ] `supabase/config.toml` spiegelt den exakten Stand aller 5 Funktionen wider.
- [ ] Datenbank-Migration ist deklarativ generiert (`bun run db:diff` ist nach `db:reset` vollständig sauber).

### Documentation
- [ ] Diese Spezifikation beschreibt den aktuellen Soll-Zustand.
- [ ] Veraltete Kommentare in `supabase/config.toml` und Funktions-Headers sind korrigiert.

### Ship-Readiness
- [ ] Keine Secrets in Quellcode oder Logs.
- [ ] Security-Advisors melden 0 Befunde (`bun run db:advisors`).
- [ ] Vollständige Verifikation durch Deno- und pgTAP-Testsuiten abgeschlossen.

---

## 6. Befehle & Tooling

```bash
# Deno Tests für Edge Functions ausführen
deno test supabase/functions/ai-gateway/
deno test supabase/functions/enrich-off-product/
deno test supabase/functions/revenuecat-webhook/

# Code-Qualität & Types
bun run check
bun run typecheck

# Deklarative Datenbank-Checks
bun run db:diff
bun run test:db
bun run db:advisors
```
