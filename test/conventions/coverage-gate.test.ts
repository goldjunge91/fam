import packageJson from '../../package.json';

const jestConfig = require('../../jest.config.js') as {
  collectCoverageFrom?: string[];
  coverageReporters?: string[];
  coverageThreshold?: {
    global?: {
      branches?: number;
      functions?: number;
      lines?: number;
      statements?: number;
    };
  };
};

// Kanonischer Unit-Scope laut package.json. Der native-build-Ausschluss ist mit
// der Entfernung des Fingerprint-Workflows entfallen; beide Skripte teilen sich
// damit denselben unveränderten Jest-Defaultscope.
const CI_UNIT_SCOPE = 'bun run test';

describe('Coverage-Gate-Konfiguration', () => {
  it('definiert die dokumentierte Startbaseline für globale Coverage', () => {
    expect(jestConfig.coverageThreshold).toEqual({
      global: {
        statements: 70,
        branches: 60,
        functions: 65,
        lines: 72,
      },
    });
  });

  it('verwendet für Unit- und Coverage-Lauf denselben CI-Scope', () => {
    expect(packageJson.scripts['test:unit']).toBe(CI_UNIT_SCOPE);
    expect(packageJson.scripts['test:coverage:unit']).toBe(
      'bun run test:unit -- --coverage && bun scripts/check-per-file-coverage.ts',
    );
  });

  it('sammelt alle produktiven Quellformate und schließt nur Test- und Deklarationsdateien aus', () => {
    expect(jestConfig.collectCoverageFrom).toEqual([
      '<rootDir>/src/**/*.{ts,tsx,js,jsx}',
      '!<rootDir>/src/**/*.test.{ts,tsx,js,jsx}',
      '!<rootDir>/src/**/*.spec.{ts,tsx,js,jsx}',
      '!<rootDir>/src/**/*.d.ts',
    ]);
  });

  it('hält den Coverage-Report kompakt', () => {
    expect(jestConfig.coverageReporters).toEqual(['text-summary', 'json-summary']);
  });
});
