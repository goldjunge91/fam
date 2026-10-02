import packageJson from '../../package.json';

const jestConfig = require('../../jest.config.js') as {
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

// The unit scope no longer excludes native-build suites, so the filter is gone;
// what the gate protects is that unit and coverage runs share one scope.
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
    expect(packageJson.scripts['test:coverage:unit']).toBe('bun run test:unit -- --coverage');
  });

  it('hält den Coverage-Report kompakt', () => {
    expect(jestConfig.coverageReporters).toEqual(['text-summary', 'json-summary']);
  });
});
