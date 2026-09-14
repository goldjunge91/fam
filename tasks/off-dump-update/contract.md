# OFF-Dump-Update-Contract

Status: freigegeben am 2026-09-14
Owner: `src/lib/off-dump/`

## Attachment-Verantwortung

- Der aktive OFF-Dump ist der lokale Cache, auf den In-place-Patches schreiben.
- `off_dump` wird deshalb während der Laufzeit schreibbar angehängt. Der bestehende SQLCipher-Vertrag mit leerem Schlüssel bleibt unverändert.
- Ein Patch wird separat als temporäres `off_patch`-Schema angehängt und nach dem Versuch wieder entfernt.

## Patch-Erfolg

- Vor dem Schreiben werden Patch-Metadaten, Versionskette und erwartetes Schema validiert.
- Upserts, Deletes und das Aktualisieren von `dump_meta.data_version` laufen in einer exklusiven SQLite-Transaktion.
- Erfolg wird erst nach erfolgreichem Commit gemeldet.

## Fehlersemantik

- Jeder Fehler beim Schreiben rollt die komplette Zieltransaktion zurück. Der aktive Dump und seine `data_version` bleiben unverändert.
- `manifest-unavailable` beschreibt ausschließlich ein nicht verfügbares oder nicht lesbares Update-Manifest.
- Lokale SQLite-Fehler bleiben als lokale Update-Fehler erkennbar und werden nicht als Manifestfehler maskiert.
- `last_check_at` wird erst nach einem normalen Repository-Ergebnis gespeichert. Ein lokaler Updatefehler darf den nächsten Retry nicht sechs Stunden unterdrücken.

## Baseline-Fallback

- Der Baseline-Installer behält den bestehenden `next`/`recovery`-Austausch bei.
- Nach einem erfolgreichen Austausch wird der neue aktive Dump mit demselben schreibbaren Attachment-Vertrag verbunden.

## Nicht Bestandteil

- Keine neue Sync-/Queue-Abstraktion.
- Keine manuell geschriebenen Supabase-Migrationen.
- Kein Copy-on-Write- oder Locking-Umbau ohne reproduzierbaren Locking-Befund.
