# Alpha: Einkaufsbereiche – Backend-, Offline- und Evaluation-Spec

Status: Umsetzungsgrundlage
Version: 4.0
Stand: 2026-08-24

Diese Spec beschreibt Datenbank, SQLite, Outbox und manuelle Evaluation. Die
App steht in `ALPHA_UX_KATEGORIEN_SPEC.md`; die verbindlichen Zonen in
`ALPHA_KATEGORIEN_ZONEN.md`.

## Ziel und Grenzen

Korrekturen werden local-first gespeichert. Artikeländerung, Präferenz und
Feedback-Event entstehen lokal in einer Transaktion. Feedback wird später
push-only in die Haupt-Supabase synchronisiert und ausschließlich manuell,
pseudonymisiert in eine separate Evaluation-Supabase importiert.

Die App liest Feedback nicht und verbindet sich nie direkt mit der Evaluation-
Supabase. Rohsignale werden niemals automatisch zu Regeln, Goldlabels oder
Trainingsdaten.

## 1. Kanonische Daten und Legacy

Die gemeinsame Quelle ist:

```text
src/features/shopping-list/classification/placement-taxonomy.ts
```

Neue Schreibvorgänge verwenden ausschließlich die 27 V2-Zonen aus
`ALPHA_KATEGORIEN_ZONEN.md`. Bestehende Legacy-IDs bleiben in Server- und
SQLite-Constraints lesbar. Ein Adapter konvertiert sie beim Lesen zu V2;
beim nächsten bewussten Schreiben darf die V2-ID persistiert werden, ohne
Feedback-Event.

`category_id` bleibt der technische Spaltenname. `category_source` unterstützt:

```text
user
store_preference
household_preference
off_taxonomy
name_fallback
```

Die Klassifikation liefert immer eine gültige Zone:

```ts
type PlacementClassification = {
  productFamilyId: ProductFamilyId;
  productFormId: ProductFormId;
  placementZoneId: PlacementZoneId;
  classifierVersion: string;
  confidence: number;
  trace: ClassificationTrace;
};
```

Klassifikatorversion: `placement-v2.0.0`.

## 2. Store-Präferenzen

`public.shopping_category_preferences` erhält:

```sql
store_id uuid references public.stores(id) on delete cascade
```

`store_id IS NULL` ist eine Haushaltspräferenz. Eine UUID ist eine Präferenz
für diesen Markt im Haushalt. Die natürliche Identität lautet:

```text
household_id | store_id-or-household | key_type | normalized_key_value
```

Dafür gelten zwei partielle Unique-Indizes:

```text
(household_id, key_type, normalized_key_value) WHERE store_id IS NULL
(household_id, store_id, key_type, normalized_key_value) WHERE store_id IS NOT NULL
```

Präferenz-API, Hooks, lokale Tabelle und Entity-Metadaten erhalten ebenfalls
`storeId`/`store_id`. Ein Store darf nur zum selben Haushalt gehören.

Zu ändern:

```text
supabase/schemas/21_shopping_category_preferences.sql
src/features/shopping-list/preferences/preference-identity.ts
src/features/shopping-list/preferences/api.ts
src/features/shopping-list/preferences/hooks.ts
src/lib/db/migrations.ts
src/lib/db/entities.ts
```

## 3. Feedback-Tabelle

Neu: `supabase/schemas/22_shopping_category_feedback.sql`.

Tabelle: `public.shopping_category_feedback_events`.

Pflichtfelder:

```text
event_id uuid primary key                 -- clientseitig, ohne Default
schema_version smallint                  -- 1
taxonomy_version text                    -- placement-taxonomy-v2
event_type text                          -- manual_reassign | reset_to_automatic
input_method text                        -- add_form | edit_form
household_id uuid                        -- FK, cascade
actor_user_id uuid                       -- FK, beim Insert = auth.uid()
shopping_list_item_id uuid               -- Snapshot, keine FK
product_key_type text                    -- product | barcode | name
product_key text                         -- nicht leer
product_id uuid                          -- Snapshot, nullable
barcode text                             -- nullable, 6–32 Ziffern
product_name text                        -- getrimmt, 1–200 Zeichen
store_id uuid                            -- Snapshot, nullable
preference_scope text                    -- store | household
old_placement_zone text
new_placement_zone text
predicted_placement_zone text
old_category_source text
new_category_source text
predicted_product_family text
predicted_product_form text
classifier_version text
platform text                            -- ios | android | web
app_version text
build_channel text
client_created_at timestamptz
created_at timestamptz                   -- default now()
```

Zusätzliche Regeln:

- `store` verlangt `store_id IS NOT NULL`; `household` verlangt `store_id IS NULL`.
- `manual_reassign` verlangt unterschiedliche alte und neue Zonen.
- `reset_to_automatic` darf dieselbe sichtbare Zone behalten.
- Notizen, Rezeptnamen, Haushaltsnamen, Marktnamen und Profilnamen werden nicht
  gespeichert.
- Indizes: Haushalt/Zeit, Zeit/Event, Store/Zeit und Produktschlüssel.
- Keine Realtime-Subscription.

Produktschlüssel:

```text
Barcode -> barcode / Barcode
sonst Produkt-ID -> product / product_id
sonst Name -> name / normalizePreferenceName(product_name)
```

## 4. RLS und Rechte

RLS ist aktiv. Die einzige Client-Policy ist `INSERT TO authenticated` und
prüft:

1. `auth.uid()` ist gesetzt.
2. `actor_user_id = auth.uid()`.
3. Der Actor ist Mitglied von `household_id`.
4. Ein gesetzter Store gehört zum selben Haushalt. Ein bereits gelöschter
   Store darf ein lokal erzeugtes Offline-Event nicht nachträglich verhindern.

Es gibt keine SELECT-, UPDATE- oder DELETE-Policy für `authenticated` oder
`anon`.

In `supabase/schemas/20_privileges.sql`:

```text
anon:           keine Rechte
authenticated:  INSERT
service_role:   SELECT
```

`service_role` erhält kein UPDATE oder DELETE. Datenschutzlöschungen erfolgen
administrativ; Haushaltslöschung löscht Feedback per Cascade.

Testdatei:

```text
supabase/tests/15_shopping_category_feedback.test.sql
```

## 5. SQLite und Outbox

Die lokale Tabelle `shopping_category_feedback_events` enthält die Client-
Spalten aus Abschnitt 3 sowie:

```text
_dirty integer not null default 1
synced_at integer
```

`created_at` wird lokal nicht benötigt.

`src/lib/db/outbox.ts` erhält `enqueueMutations()`. In einer
`withExclusiveTransactionAsync` werden ausgeführt:

1. Artikelmutation
2. Präferenzmutation
3. optionales Feedback-Event
4. zugehörige Outbox-Einträge

Ein Fehler rollt alles zurück. Danach wird genau eine Outbox-Changed-
Benachrichtigung gesendet.

Feedback ist eine Push-only-Entity:

- nur `insert`, kein Pull, kein Realtime, kein Coalescing
- PostgREST `.insert(payload)` ohne `.select()`
- Erfolg setzt `_dirty = 0`, `synced_at` und entfernt den Outbox-Eintrag
- PostgreSQL-Fehler `23505` gilt beim Retry als erfolgreicher Abschluss
- update/delete/restore sind Programmierfehler vor dem Netzwerkaufruf
- nicht in `ALL_ENTITIES`, sofern diese Liste Pull-Entities beschreibt

Zu ändern:

```text
src/lib/db/migrations.ts
src/lib/db/types.ts
src/lib/db/entities.ts
src/lib/db/outbox.ts
src/lib/sync/push.ts
```

## 6. Alpha-Freischaltung

Feedback wird nur bei aktivem PostHog-Flag
`shopping-category-feedback-alpha` erzeugt. Bei deaktiviertem Flag funktionieren
Taxonomie und Präferenzen unverändert. Es gibt keinen Schalter und keinen
Dialog im Einkaufsablauf. Secrets bleiben außerhalb des App-Bundles.

## 7. Manueller Evaluation-Import

Der Import läuft ausschließlich über:

```text
tools/category-debugger/scripts/import-app-feedback.ts
```

Lokale Secrets:

```text
APP_SUPABASE_URL
APP_SUPABASE_SECRET_KEY
EVALUATION_SUPABASE_URL
EVALUATION_SUPABASE_SECRET_KEY
CATEGORY_FEEDBACK_PSEUDONYM_KEY
```

Der Importer liest nach `(created_at, event_id)`, pseudonymisiert Actor-,
Haushalts- und Store-ID mit HMAC-SHA256, entfernt direkte IDs, schreibt
idempotent in `evaluation_crowd_signals` und erzeugt keinen Review oder
Trainingsfreigabe. Der Cursor wird erst nach erfolgreicher Seite gespeichert;
nach Abbruch wird am letzten vollständigen Cursor fortgesetzt.

`evaluation_import_runs` protokolliert Status, Cursor, Mengen und Fehler. Die
Haupt-Supabase erhält keinen Exportstatus. Review, Goldlabel, Dataset-Snapshot,
Training und Veröffentlichung bleiben manuell getrennt.

## 8. Umsetzungsreihenfolge

1. Zonenreferenz und kanonische App-Taxonomie anlegen.
2. Legacy-Adapter, Klassifikator und Gruppierung umstellen.
3. Store-Scope in deklarativem, lokalem Schema und Präferenz-API ergänzen.
4. Feedback-Tabelle, Grants und pgTAP-Tests ergänzen.
5. SQLite-Tabelle, Batch-Outbox und Push-only-Entity implementieren.
6. Formular-Speichervorgang anschließen.
7. Importer und Evaluation-Schema implementieren.
8. Typen generieren und verifizieren.

Migrationen werden ausschließlich über `bun run db:diff` erzeugt. Keine
Migration wird manuell geschrieben oder editiert.

## 9. Akzeptanzkriterien

- Neue Schreibvorgänge speichern nur V2-Zonen; Legacy-Daten bleiben lesbar.
- Store- und Haushaltspräferenzen besitzen getrennte Identitäten.
- Item, Präferenz, Event und Outbox sind lokal atomar.
- Netzwerkfehler lassen die lokale Änderung bestehen.
- Clients können Feedback nicht lesen, ändern oder löschen.
- Push-only-Feedback wird ohne Representation-Select und idempotent gesendet.
- Feedback wird nie gepullt oder per Realtime verteilt.
- Direkte IDs verlassen die Haupt-Supabase beim Import nicht.
- Wiederholte Importe erzeugen keine Duplikate.
- Kein Rohsignal wird automatisch Trainingsmaterial.
- `bun run check`, `bun run typecheck`, `bun run test` und bei Schemaänderungen
  `bun run test:db` bestehen.

## Nicht Bestandteil

Direkte App-Verbindung zur Evaluation-Supabase, automatisches Crowd-Learning,
Training oder Publishing, neue Rohdaten-/Sync-Ansichten, GPS-Daten und die
Entfernung von Legacy-IDs aus bestehenden Constraints.
