import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

type Context = {
  MAILOSAUR_API_KEY?: string;
  MAILOSAUR_SERVER_DOMAIN?: string;
  MAILOSAUR_SERVER_ID?: string;
  SIGNUP_EMAIL?: string;
  SIGNUP_STARTED_AT?: string;
  console: { log: jest.Mock };
  http: { get: jest.Mock };
  json: (body: string) => unknown;
  output: { signupCode?: string };
  sleep: jest.Mock;
};

const source = readFileSync(
  join(process.cwd(), '.maestro/scripts/auth/read-remote-signup-otp.js'),
  'utf8',
);
const email = 'fam-e2e-123@opbingdz.mailosaur.net';
const startedAt = '2026-11-19T12:00:00.000Z';

function context(): Context {
  const output: Context['output'] = {};
  const detail = {
    id: 'signup-1',
    received: '2026-11-19T12:00:05.000Z',
    subject: 'Bestätige deine E-Mail-Adresse',
    to: [{ email }],
    text: { body: 'Dein Bestätigungscode: 123456' },
  };
  return {
    MAILOSAUR_API_KEY: 'secret-test-key',
    MAILOSAUR_SERVER_DOMAIN: 'opbingdz.mailosaur.net',
    MAILOSAUR_SERVER_ID: 'opbingdz',
    SIGNUP_EMAIL: email,
    SIGNUP_STARTED_AT: startedAt,
    console: { log: jest.fn() },
    http: {
      get: jest.fn((url: string) =>
        url.includes('/api/messages?')
          ? { ok: true, body: JSON.stringify({ items: [{ id: 'signup-1' }] }) }
          : { ok: true, body: JSON.stringify(detail) },
      ),
    },
    json: (body) => JSON.parse(body) as unknown,
    output,
    sleep: jest.fn(),
  };
}

describe('remote signup Mailosaur helper', () => {
  it('reads a fresh OTP for the exact generated recipient without logging secrets', () => {
    const testContext = context();
    runInNewContext(source, testContext);

    expect(testContext.output.signupCode).toBe('123456');
    expect(testContext.http.get.mock.calls[0][0]).toContain(
      `sentTo=${encodeURIComponent(email)}`,
    );
    expect(JSON.stringify(testContext.console.log.mock.calls)).not.toContain('123456');
    expect(JSON.stringify(testContext.console.log.mock.calls)).not.toContain('secret-test-key');
  });

  it('fails before making requests when the runtime secret is missing', () => {
    const testContext = context();
    delete testContext.MAILOSAUR_API_KEY;

    expect(() => runInNewContext(source, testContext)).toThrow(
      'Fehlende Mailosaur-Laufzeitkonfiguration.',
    );
    expect(testContext.http.get).not.toHaveBeenCalled();
  });
});
