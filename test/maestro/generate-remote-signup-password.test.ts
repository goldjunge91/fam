import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

type Context = {
  TEST_PASSWORD?: string;
  Date: { now: () => number };
  Math: { random: () => number };
  console: { log: jest.Mock };
  output: { remoteSignupPassword?: unknown };
};

const source = readFileSync(
  join(process.cwd(), '.maestro/scripts/auth/generate-remote-signup-password.js'),
  'utf8',
);

function createContext(testPassword?: string, deterministic = false): Context {
  return {
    ...(testPassword === undefined ? {} : { TEST_PASSWORD: testPassword }),
    Date: { now: deterministic ? () => 0 : Date.now },
    Math: { random: deterministic ? () => 0 : Math.random },
    console: { log: jest.fn() },
    output: {},
  };
}

function isValidPassword(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 8 &&
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /\d/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  );
}

describe('remote signup password helper', () => {
  it('generates one valid password when TEST_PASSWORD is missing without logging it', () => {
    const testContext = createContext(undefined, true);

    runInNewContext(source, testContext);

    const password = testContext.output.remoteSignupPassword;

    expect(isValidPassword(password)).toBe(true);
    expect(
      typeof password === 'string' && JSON.stringify(testContext.console.log.mock.calls).includes(password),
    ).toBe(false);
  });

  it('generates one valid password when the flow supplies an empty TEST_PASSWORD', () => {
    const testContext = createContext('', true);

    runInNewContext(source, testContext);

    const password = testContext.output.remoteSignupPassword;

    expect(isValidPassword(password)).toBe(true);
    expect(typeof password === 'string' && password.startsWith('Ma')).toBe(true);
    expect(
      typeof password === 'string' && JSON.stringify(testContext.console.log.mock.calls).includes(password),
    ).toBe(false);
  });

  it('treats Maestro\'s missing-value placeholder as absent', () => {
    const testContext = createContext('undefined', true);

    runInNewContext(source, testContext);

    expect(isValidPassword(testContext.output.remoteSignupPassword)).toBe(true);
    expect(JSON.stringify(testContext.console.log.mock.calls)).not.toContain('undefined');
  });

  it('keeps an explicit TEST_PASSWORD override', () => {
    const override = 'provided-value';
    const testContext = createContext(override);

    runInNewContext(source, testContext);

    expect(testContext.output.remoteSignupPassword === override).toBe(true);
  });
});
