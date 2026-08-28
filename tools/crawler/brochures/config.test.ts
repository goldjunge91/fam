import { describe, expect, it } from '@jest/globals';
import { assertCrawlerEnvironment } from './config';

const completeEnvironment: NodeJS.ProcessEnv = {
  BRING_AUTH_TOKEN: 'token',
  BRING_API_KEY: 'api-key',
  BRING_USER_UUID: 'user-id',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SECRET_KEY: 'secret-key',
};

describe('Crawler-Konfiguration', () => {
  it('bricht einen Live-Crawl bei fehlenden Bring-Credentials ab', () => {
    const environment = { ...completeEnvironment };
    delete environment.BRING_USER_UUID;

    expect(() =>
      assertCrawlerEnvironment(
        { dryRun: false, fromBackup: false, sourceNames: ['live'] },
        environment,
      ),
    ).toThrow('BRING_USER_UUID');
  });

  it('bricht einen produktiven Lauf bei fehlenden Supabase-Credentials ab', () => {
    const environment = { ...completeEnvironment };
    delete environment.SUPABASE_SECRET_KEY;

    expect(() =>
      assertCrawlerEnvironment(
        { dryRun: false, fromBackup: false, sourceNames: ['live'] },
        environment,
      ),
    ).toThrow('SUPABASE_SECRET_KEY');
  });

  it('erlaubt im expliziten Dry-Run fehlende Supabase-Credentials', () => {
    const environment = { ...completeEnvironment };
    delete environment.SUPABASE_URL;
    delete environment.SUPABASE_SECRET_KEY;

    expect(() =>
      assertCrawlerEnvironment(
        { dryRun: true, fromBackup: false, sourceNames: ['live'] },
        environment,
      ),
    ).not.toThrow();
  });
});
