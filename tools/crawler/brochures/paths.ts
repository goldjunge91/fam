import { existsSync } from 'node:fs';
import { join } from 'node:path';

const BROCHURES_DATA_DIRECTORY = ['tools', 'crawler', 'brochures'] as const;
const LEGACY_DATA_DIRECTORY = ['tools', 'crawler', 'data'] as const;

/** Liefert den aktuell verschobenen Backup-Pfad und hält den alten Pfad als Fallback lesbar. */
export function defaultCrawlerBackupPath(cwd = process.cwd()): string {
  const movedPath = join(cwd, ...BROCHURES_DATA_DIRECTORY, 'last_crawl_backup.json');
  const legacyPath = join(cwd, ...LEGACY_DATA_DIRECTORY, 'last_crawl_backup.json');
  return existsSync(movedPath) || !existsSync(legacyPath) ? movedPath : legacyPath;
}

/** Liefert die GeoNames-Kandidaten in Prioritätsreihenfolge nach der Dateiverschiebung. */
export function crawlerGeoNamesCandidatePaths(
  cwd = process.cwd(),
  moduleDirectory = import.meta.dirname,
): string[] {
  return [
    join(cwd, ...BROCHURES_DATA_DIRECTORY, 'geonames-DE.txt'),
    join(cwd, ...LEGACY_DATA_DIRECTORY, 'geonames-DE.txt'),
    join(moduleDirectory, 'geonames-DE.txt'),
    join(moduleDirectory, '..', 'data', 'geonames-DE.txt'),
    '/tmp/geonames-DE.txt',
  ];
}
