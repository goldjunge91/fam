import type { SqlDatabase } from '@/lib/db/types';

/**
 * Lokaler OpenFoodFacts-Dump (#79 zusammen mit dem Dump-CI-Workflow,
 * `.github/workflows/update_dump.yml`): laedt das neueste `products_de_*.db`
 * GitHub-Release-Asset herunter und haengt es als `off_dump`-Schema an die
 * lokale SQLite-Verbindung an, damit die Produktsuche auch ohne Netz gegen
 * den gesamten DE-Bestand laufen kann (nicht nur gegen den kleinen,
 * selbst gepflegten `products`-Spiegel).
 *
 * `expo-file-system` wird bewusst per `require()` erst innerhalb der
 * Funktionen geladen statt per Top-Level-`import` — dasselbe Muster wie
 * `loadSQLite()` in `db/client.ts`. Ein natives Modul crasht sonst jeden
 * Test, der diese Datei transitiv importiert (z. B. ueber
 * `product-search-dropdown.tsx`), mit einer Fehlermeldung, die auf die
 * falsche Datei zeigt.
 */

const REBUILD_HINT =
  'expo-file-system ist im installierten Build nicht enthalten. Native Module kommen ' +
  'nicht ueber einen Metro-Reload dazu — der Development Build muss neu erstellt werden.';

function loadFileSystem(): typeof import('expo-file-system') {
  try {
    return require('expo-file-system') as typeof import('expo-file-system');
  } catch {
    throw new Error(REBUILD_HINT);
  }
}

const REPO = 'goldjunge91/fam';
const DUMP_FILE_NAME = 'off-dump.db';
const RELEASE_TAG_KEY = 'off_dump_release_tag';

export type GitHubReleaseAsset = {
  name: string;
  browser_download_url: string;
};

/**
 * Waehlt aus den Release-Assets das unkomprimierte SQLite-Dump-Asset
 * (`products_de_<datum>.db`, nicht `.db.gz`) — bewusst unkomprimiert, um
 * keine Gunzip-Abhaengigkeit fuer den Client einzufuehren. Pure Funktion,
 * unabhaengig von Netz/nativen Modulen testbar.
 */
export function pickDbAsset(assets: readonly GitHubReleaseAsset[]): GitHubReleaseAsset | undefined {
  return assets.find((asset) => asset.name.toLowerCase().endsWith('.db'));
}

export type DumpRelease = { tag: string; downloadUrl: string };

/** Fragt den neuesten Dump-Release ab. `null` bei fehlendem Netz/Fehler — kein Wurf. */
export async function checkForNewDumpRelease(): Promise<DumpRelease | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`);
    if (!res.ok) return null;

    const release = (await res.json()) as { tag_name?: string; assets?: GitHubReleaseAsset[] };
    const asset = pickDbAsset(release.assets ?? []);
    if (!asset || !release.tag_name) return null;

    return { tag: release.tag_name, downloadUrl: asset.browser_download_url };
  } catch {
    return null;
  }
}

async function getStoredReleaseTag(db: SqlDatabase): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string | null }>(
    'select value from app_meta where key = ?',
    [RELEASE_TAG_KEY],
  );
  return row?.value ?? null;
}

async function setStoredReleaseTag(db: SqlDatabase, tag: string): Promise<void> {
  await db.runAsync(
    'insert into app_meta (key, value) values (?, ?) on conflict(key) do update set value = excluded.value',
    [RELEASE_TAG_KEY, tag],
  );
}

/**
 * Laedt den Dump herunter, wenn eine neuere Version verfuegbar ist (oder noch
 * keine lokale Datei existiert) — sonst ein No-Op. Wirft nie: bei fehlendem
 * Netz bleibt eine schon vorhandene lokale Datei einfach stehen, das ist
 * kein Fehlerfall. Gedacht fuers Feuern-und-Vergessen beim App-Start
 * (`.catch()` beim Aufrufer reicht als Absicherung).
 *
 * Liefert den lokalen Datei-URI, sobald irgendeine Version vorliegt.
 */
export async function ensureOffDumpDownloaded(db: SqlDatabase): Promise<string | null> {
  const { File, Paths } = loadFileSystem();
  const target = new File(Paths.document, DUMP_FILE_NAME);

  const release = await checkForNewDumpRelease();
  if (!release) return target.exists ? target.uri : null;

  const storedTag = await getStoredReleaseTag(db);
  if (release.tag === storedTag && target.exists) return target.uri;

  await File.downloadFileAsync(release.downloadUrl, target, { idempotent: true });
  await setStoredReleaseTag(db, release.tag);
  return target.uri;
}

function toFsPath(uri: string): string {
  return uri.startsWith('file://') ? uri.slice('file://'.length) : uri;
}

let attachedThisSession = false;

/** Ob `attachOffDump` in diesem Prozesslauf bereits erfolgreich angehaengt hat. */
export function isOffDumpAttached(): boolean {
  return attachedThisSession;
}

/**
 * Haengt den lokalen Dump als `off_dump`-Schema an die uebergebene
 * Verbindung an (`ATTACH DATABASE ... AS off_dump`) — danach per
 * `off_dump.products` abfragbar. Der Pfad kommt aus der App
 * (Dokumentenverzeichnis), nicht von Nutzereingaben, daher reicht Escaping
 * der einfachen Anfuehrungszeichen: `execAsync` (anders als `runAsync`)
 * unterstuetzt laut `SqlDatabase`-Port ohnehin keine Parameterbindung.
 *
 * Einmal pro Prozesslauf: ein zweites `ATTACH ... AS off_dump` auf derselben
 * Connection schlaegt fehl ("database off_dump is already in use").
 */
export async function attachOffDump(db: SqlDatabase): Promise<boolean> {
  if (attachedThisSession) return true;

  const { File, Paths } = loadFileSystem();
  const target = new File(Paths.document, DUMP_FILE_NAME);
  if (!target.exists) return false;

  const escapedPath = toFsPath(target.uri).replace(/'/g, "''");
  await db.execAsync(`ATTACH DATABASE '${escapedPath}' AS off_dump`);
  attachedThisSession = true;
  return true;
}
