export type CrawlerEnvironmentOptions = {
  dryRun: boolean;
  fromBackup: boolean;
  sourceNames: string[];
};

const LIVE_SOURCE_ENV_KEYS = ['BRING_AUTH_TOKEN', 'BRING_API_KEY', 'BRING_USER_UUID'] as const;
function missingEnvironmentKeys(
  keys: readonly string[],
  environment: NodeJS.ProcessEnv,
): string[] {
  return keys.filter((key) => !environment[key]?.trim());
}

/**
 * Verhindert, dass ein produktiver Lauf wegen fehlender Credentials still als
 * leerer Crawl oder impliziter Dry-Run weiterläuft.
 */
export function assertCrawlerEnvironment(
  options: CrawlerEnvironmentOptions,
  environment: NodeJS.ProcessEnv = process.env,
): void {
  const missing = new Set<string>();

  if (!options.fromBackup && options.sourceNames.includes('live')) {
    for (const key of missingEnvironmentKeys(LIVE_SOURCE_ENV_KEYS, environment)) {
      missing.add(key);
    }
  }

  if (!options.dryRun) {
    if (!environment.SUPABASE_URL?.trim() && !environment.EXPO_PUBLIC_SUPABASE_URL?.trim()) {
      missing.add('SUPABASE_URL');
    }
    if (
      !environment.SUPABASE_SECRET_KEY?.trim() &&
      !environment.SUPABASE_SERVICE_ROLE_KEY?.trim()
    ) {
      missing.add('SUPABASE_SECRET_KEY');
    }
  }

  if (missing.size > 0) {
    throw new Error(`Fehlende Crawler-Credentials: ${[...missing].join(', ')}`);
  }
}
