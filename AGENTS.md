# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Datenbank: ausschliesslich Declarative Schema

**Migrationsdateien unter `supabase/migrations/` werden niemals von Hand
erstellt oder bearbeitet.** Kein `supabase migration new` mit anschliessendem
Selberschreiben, keine "schnelle Korrektur" in einer bestehenden Datei.

Der Ablauf ist immer:

1. Gewuenschten **Endzustand** in `supabase/schemas/*.sql` eintragen
2. `supabase db diff -f <name>` erzeugt die Migration
3. Generierte Migration reviewen
4. `supabase db reset` (lokal) bzw. `supabase db push` (remote)

Zum Ausprobieren waehrend der Entwicklung `supabase db query` bzw. das
MCP-Werkzeug `execute_sql` verwenden — **nicht** `apply_migration`: das schreibt
bei jedem Aufruf einen Eintrag in die Migrationshistorie und macht spaetere
Diffs leer oder widerspruechlich.

**Warum:** Handgeschriebene Migrationen und generierte Diffs laufen
auseinander. Sobald beides gemischt wird, ist der tatsaechliche Schemazustand
nur noch aus der Historie rekonstruierbar statt an einer Stelle ablesbar.

**Reihenfolge:** Die Dateien in `supabase/schemas/` laufen lexikografisch.
Bei Fremdschluessel-Abhaengigkeiten muss die Elterntabelle zuerst kommen —
entweder ueber die Namensgebung (`01_...`, `02_...`) oder ueber eine explizite
Liste in `schema_paths` in `config.toml`.

**Was das deklarative Schema NICHT erfasst** und deshalb weiterhin in eine
generierte Migration gehoert: DML (INSERT/UPDATE/DELETE), RLS-Policies und
Spaltenrechte, Grants und View-Ownership, Schema-Rechte, Kommentare,
Partitionen und Publications. `supabase db diff` nimmt diese Objekte nicht
automatisch auf — nach einer Aenderung daran pruefen, ob die erzeugte Migration
sie wirklich enthaelt.
