# Focused Context-Pack: receipt-authority

**Purpose:** Selektiver Kontext für die Beads fam-qesi.2.1 bis fam-qesi.2.6.  
**Scope:** Ausschließlich Receipt Authority; keine UI-, OCR-, Learning- oder Insights-
Implementierung.  
**Spec:** docs/specs/household-purchase-memory/SPEC-receipt-authority.md  
**Plan:** tasks/plan.md
**Scoped Constraints:** tasks/household-purchase-memory/CONSTRAINTS.md

**Code-Owner:** `src/features/ocr/authority/` innerhalb des gemeinsamen
Parents `src/features/ocr/`; `capture/` und `processing/` bleiben getrennte
Verantwortungsbereiche.

## Read order

1. Die automatisch geladenen Projektregeln aus AGENTS.md und CLAUDE.md nur für
   den aktuellen Task-Abschnitt verwenden.
2. Root-`CONSTRAINTS.md` und den feature-lokalen Vertrag
   `tasks/household-purchase-memory/CONSTRAINTS.md` lesen, bevor
   Produktionscode geändert wird.
3. Die Abschnitte 1 bis 7 der Receipt-Authority-Spec und den eigenen Abschnitt
   im Plan lesen.
4. Danach ausschließlich die für das eigene Bead genannten Source- und
   Testdateien lesen.
5. Erst bei einem konkreten Fehler weitere Dateien laden. Kein globaler
   Repository-Braindump.

## Quellenhierarchie und Vertrauensstufen

### Verbindlich

- AGENTS.md: Arbeitsregeln, Sicherheitsgrenzen, Stack und Testbefehle.
- CLAUDE.md: ergänzende Architektur-/Command-Regeln und der Beads-Workflow.
- CONSTRAINTS.md: aktuelle Qualitäts- und Arbeitsgrenzen.
- SPEC-receipt-authority.md: fachlicher Vertrag dieses Moduls.
- tasks/plan.md: exklusive Dateibesitzrechte, Bead-Abhängigkeiten und Gates.
- Aktueller Sourcecode und fokussierte Tests: tatsächliches Laufzeitverhalten.

### Mit Vorsicht lesen

- supabase/config.toml, seed.sql und generierte Typen: technische Konfiguration
  bzw. Outputs, keine eigenständige Fachspezifikation.
- drizzle/local/*: generierter lokaler Migrationsoutput; niemals als Hand-
  geschriebenes Modell interpretieren.
- docs/ideas/haushalts-einkaufsgedaechtnis.md: Produktinput vor der Spec,
  nicht die Implementierungsquelle.

### Zusammenspiel mit dem Root-Kontext

Die Root-Datei `CONTEXT.md` besitzt die projektweite Domänensprache und
Datenverantwortung. Dieser Task-Kontext präzisiert sie ausschließlich für die
Receipt Authority. Bei einer echten fachlichen Abweichung wird zuerst der
Root-Kontext oder ein ADR aktualisiert; die Task-Spezifikation überschreibt ihn
nicht stillschweigend.

## Shared contract

- purchase_receipts und purchase_receipt_items sind household-scoped, tombstone-fähige,
  offline synchronisierte Entities.
- receipt_assets ist ausschließlich ein serverseitiger Storage-Index.
  Keine Entity-Union, kein Local-Mirror, kein Realtime-Eintrag und keine
  Bildbytes in SQLite oder Outbox.
- Alle Haushaltsmitglieder dürfen lesen, korrigieren, soft-deleten, restoren und
  Bilder entfernen.
- Ein Receipt unterstützt mehrere Assets. Bildlöschung erhält strukturierte
  Receipt-/Item-Daten.
- Geld ist EUR und wird in Cent gespeichert.
- Rabatt-, Coupon-, Pfand- und Treuekartenzeilen sind keine eigenen Items.
  Keine neue Rabattlogik ergänzen.
- Bestätigte Receipts sind die einzige Quelle für spätere Insights.
- Bestätigte Kaufdaten, Gesamtsummen und Artikelpreise bleiben als
  strukturierte Receipt-/Item-Daten gespeichert, auch wenn Bonbilder später
  entfernt werden. OCR-Volltext wird nicht dauerhaft gespeichert.
- Receipt-Operationen ändern niemals Inventory, Fridge oder Shopping List und
  erzeugen keine entsprechenden Outbox-Operationen.
- Wiederkehrende Artikel werden in dieser Phase nicht automatisch
  zusammengeführt; ein späterer expliziter Produktbezug hat keine
  Bestandswirkung.
- Jede sichtbare Mutation braucht das logische Gegenstück, besonders
  delete/restore und confirmed/needs_review.

## Task-specific context

### fam-qesi.2.1 — Domain Contract

**Laden:**

- SPEC-receipt-authority.md: Objective, Canonical data contract,
  Lifecycle and invariants.
- tasks/plan.md: Dateibesitz und Acceptance.
- src/features/recipes/domain/recipe-favorites.ts
- src/features/recipes/domain/recipe-favorites.test.ts
- test/conventions/inventory-operation-ownership.test.ts als Architektur-
  und Convention-Testmuster
- src/features/shopping-list/classification/ für reine Domänenfunktionen,
  nur wenn ein konkretes Pattern benötigt wird.

**Nicht laden:** Supabase-, SQLite-, Storage- oder React-Query-Dateien.

**Zusätzlich:** `test/conventions/receipt-authority-ownership.test.ts` als
fokussierten Gate-Test anlegen; er prüft ausschließlich die
Infrastrukturgrenze der Receipt-Domain.

**Erwartetes Ergebnis:** Reine TypeScript-Typen und Statusfunktionen ohne
generierte Database-Typen oder Infrastrukturimporte.

### fam-qesi.2.2 — Supabase Schema, RLS und Storage

**Laden:**

- SPEC-receipt-authority.md: Canonical data contract sowie Authorization,
  RLS and Storage.
- supabase/schemas/08_inventory.sql
- supabase/schemas/12_recipe_storage.sql
- supabase/tests/07_inventory.test.sql
- supabase/tests/10_recipes.test.sql
- supabase/config.toml
- supabase/seed.sql
- relevante private Haushalts-/RLS-Helfer aus supabase/schemas/01_private.sql
  und supabase/schemas/03_households.sql.

**Prüfen:**

- Die deklarative Quelle liegt unter supabase/schemas/.
- Jede Tabelle erhält RLS und pgTAP.
- UPDATE-Policies haben USING und WITH CHECK.
- Storage-Bucket-DML und storage.objects-Policies folgen dem bestehenden
  Recipe-Storage-Ausnahmevertrag.
- Fremdhaushalt, Asset-Löschung und strukturierte Daten werden getrennt
  getestet.

**Nicht laden:** lokale Sync-Implementierung, solange nur das Serverschema
betrachtet wird.

### fam-qesi.2.3 — Local Mirror

**Laden:**

- SPEC-receipt-authority.md: Canonical data contract sowie Local-first and
  sync contract.
- src/lib/db/schemas/inventory.ts
- src/lib/db/schemas/shopping.ts
- src/lib/db/schemas/index.ts
- src/lib/db/schemas/mirror-columns.ts
- src/lib/db/migrations.ts
- src/lib/db/schema.integration.test.ts
- drizzle.config.ts
- drizzle/local/migrations.js
- test/node-sqlite-adapter.ts

**Prüfen:**

- Drizzle-Schema und vorhandene lokale Legacy-Migrationskette sind beide
  relevant.
- Server-Fremdschlüssel sind im lokalen Spiegel nicht automatisch erforderlich.
- receipt_assets und Bildbytes bleiben absichtlich abwesend.
- Neue Tabellen müssen in index.ts und im fokussierten SQLite-Test sichtbar
  sein, aber noch nicht in Entity-Registries.

### fam-qesi.2.4 — Sync Registry

**Laden:**

- SPEC-receipt-authority.md: Local-first and sync contract.
- src/lib/db/types.ts
- src/lib/db/entities.ts
- src/lib/db/entities.test.ts
- src/lib/db/entities.integration.test.ts
- src/lib/sync/realtime.ts
- src/lib/sync/realtime.test.ts
- src/lib/sync/mirror-write.ts
- src/lib/sync/pull.ts
- src/lib/sync/push.ts

**Prüfen:**

- Die Spaltenliste in ENTITIES muss mit dem Local Mirror und dem Server-
  Select-Vertrag übereinstimmen.
- household_id ist der generische Realtime-/Pull-Scope.
- Keine receipt-spezifischen Branches in pull.ts oder push.ts ohne
  reproduzierbaren Test.
- receipt_assets darf in keinem Sync-Registry-Set erscheinen.

### fam-qesi.2.5 — Feature Data API

**Laden:**

- SPEC-receipt-authority.md: Canonical data contract, Lifecycle,
  Authorization und Local-first contract.
- src/features/household/api.ts
- src/features/inventory/use-inventory-items.ts
- src/features/shopping-list/hooks/use-stores.ts
- src/features/recipes/data/household-recipe-images.ts
- src/lib/backend/supabase/remote-client.ts
- src/lib/db/local-client.ts
- src/lib/db/outbox.ts
- src/lib/db/entities.ts

**Prüfen:**

- Strukturierte Daten laufen über den bestehenden Local-first-/Outbox-Pfad.
- Asset-Metadaten und Signed URLs sind ein separater Online-Pfad.
- React Query hält Server-/Cache-Zustand; kein zweiter Receipt-Server-State in
  Zustand.
- Die API bietet inverse Aktionen und löscht bei Asset-Entfernung keine
  Receipt-/Item-Zeilen.

### fam-qesi.2.6 — Cross-Surface Validation

**Laden:**

- SPEC-receipt-authority.md: Testing strategy und Success criteria.
- tasks/plan.md: Checkpoint C und exklusive Testdatei.
- src/lib/db/outbox.integration.test.ts
- src/lib/sync/pull.integration.test.ts
- src/lib/sync/push.integration.test.ts
- src/lib/sync/realtime.integration.test.ts
- supabase/tests/07_inventory.test.sql als RLS-Testmuster.

**Prüfen:**

- Nur den neuen fokussierten Integrationstest erstellen.
- Shared Harnesses nicht ändern, wenn ein Testfehler durch die eigene
  Produktionsänderung lösbar ist.
- Testfluss: Mitglied anlegen, mehrere Assets/Items, korrigieren,
  bestätigen, Bilder entfernen, strukturierte Daten behalten, Außenstehenden
  blockieren.

## Known project guardrails

- Niemals bun test verwenden; fokussierte Tests laufen über bun run test.
- Keine vollständige Suite starten, wenn ein fokussierter Test genügt.
- Supabase-Migrationen nicht von Hand schreiben oder editieren. Erst
  supabase/schemas/*.sql ändern und bun run db:diff verwenden. Die bekannte
  storage.objects-Ausnahme muss dem bestehenden Projektmuster folgen.
- Keine neue Abhängigkeit ohne ausdrückliche Prüfung.
- Keine UI-Änderung in diesen Beads; deshalb keine Mockup-Runde und keine
  Unistyles-Dateien.
- Keine nativen Dependencies hinzufügen.
- Security-/Ownership-Gates aus
  `tasks/household-purchase-memory/CONSTRAINTS.md` sind blockierend. Der erste
  Gitleaks-Lauf misst die Baseline; der lokale fokussierte Check bleibt bei
  höchstens 90 Sekunden, langsamere Scans laufen in CI.
- Lokale Supabase-/Docker-/Simulator-Prozesse nicht parallel starten, ohne
  Ressourcen und laufenden Zustand zu prüfen.
- Vor dem Abschluss: Bead-Status, relevante fokussierte Gates und git status
  gemäß Session Close Protocol prüfen. Kein Commit/Push ohne ausdrückliche
  Autorisierung.

## Context refresh rule

Nach einem Fehler nur die konkrete Fehlermeldung, die betroffene Funktion,
ihren Test und die direkt beteiligte Typdefinition nachladen. Bei einem Wechsel
des Beads den vorherigen Task-Kontext verwerfen und nur den neuen Abschnitt
dieses Packs laden.
