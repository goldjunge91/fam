import {
  buildScreenshotTour,
  isFixtureReady,
  isRecentScreenshotFlag,
  normalizeScreenshotPath,
  parseShotsConfig,
} from '@/lib/screenshots';

describe('screenshot tour', () => {
  it('enthält genau die aktuell aktivierten Galerie-Screens', () => {
    // Weitere Screens sind in buildScreenshotTour bewusst auskommentiert (TODO dort beachten).
    const tour = buildScreenshotTour('recipe-demo');

    expect(tour.map((step) => step.name)).toEqual([
      '01-home',
      '02-brochures',
      '03-inventory',
      '04-shopping-list',
      '05-meal-planner',
      '06-recipes',
      '08-recipe-detail',
    ]);
  });

  it('normalisiert Pfade für die Navigationsbestätigung', () => {
    expect(normalizeScreenshotPath('/')).toBe('/');
    expect(normalizeScreenshotPath(' /settings/ ')).toBe('/settings');
  });

  it('startet bei unvollständiger SQLite-Fixture nicht', () => {
    expect(isFixtureReady({ householdId: 'household-demo', recipeId: '' })).toBe(false);
    expect(isFixtureReady({ householdId: 'household-demo', recipeId: 'recipe-demo' })).toBe(true);
  });

  it('akzeptiert nur gültige opt-in shots.json-Konfigurationen', () => {
    expect(parseShotsConfig({ enabled: false })).toBeNull();
    expect(parseShotsConfig({ enabled: true })).toBeNull();
    expect(parseShotsConfig({ enabled: true, settleMs: -1 })).toBeNull();
    expect(parseShotsConfig({ enabled: true, captureTimeoutMs: '15000' })).toBeNull();
    expect(
      parseShotsConfig({
        enabled: true,
        armedAt: 1_000_000,
        settleMs: 0,
        captureTimeoutMs: 15_000,
      }),
    ).toEqual({
      enabled: true,
      armedAt: 1_000_000,
      settleMs: 0,
      captureTimeoutMs: 15_000,
      fixtureTimeoutMs: undefined,
    });
  });

  it('akzeptiert nur ein frisches Capture-Flag', () => {
    const now = 1_000_000;

    expect(isRecentScreenshotFlag(now - 29_999, now)).toBe(true);
    expect(isRecentScreenshotFlag(now - 30_001, now)).toBe(false);
    expect(isRecentScreenshotFlag(undefined, now)).toBe(false);
  });
});
