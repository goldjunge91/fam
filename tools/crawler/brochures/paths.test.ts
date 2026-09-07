import { join } from 'node:path';
import { describe, expect, it } from '@jest/globals';
import { crawlerGeoNamesCandidatePaths, defaultCrawlerBackupPath } from './paths';

describe('Zentrale Crawler-Pfade', () => {
  it('priorisiert die verschobenen GeoNames- und Backup-Dateien', () => {
    const paths = crawlerGeoNamesCandidatePaths('C:\\repo', 'C:\\repo\\tools\\crawler\\brochures');

    expect(paths[0]).toBe('C:\\repo\\tools\\crawler\\brochures\\geonames-DE.txt');
    expect(paths[1]).toBe('C:\\repo\\tools\\crawler\\data\\geonames-DE.txt');
    expect(defaultCrawlerBackupPath('C:\\repo')).toBe(
      join('C:\\repo', 'tools', 'crawler', 'brochures', 'last_crawl_backup.json'),
    );
  });
});
