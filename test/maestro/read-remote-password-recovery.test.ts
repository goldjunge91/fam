import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

type HttpResponse = {
  body: string;
  ok: boolean;
  status: number;
};

type HttpConfig = {
  headers: {
    Accept: string;
    Authorization: string;
  };
};

type ScriptContext = {
  MAILOSAUR_ADDRESS_SUFFIX?: string;
  MAILOSAUR_API_KEY?: string;
  MAILOSAUR_SERVER_DOMAIN?: string;
  MAILOSAUR_SERVER_ID?: string;
  MAILOSAUR_SENDER?: string;
  CONFIRMED_RECOVERY_EMAIL?: string;
  RECOVERY_EMAIL?: string;
  RECOVERY_MODE?: string;
  RECOVERY_REQUEST_STARTED_AT?: string;
  console: {
    log: jest.Mock;
  };
  http: {
    get: jest.Mock<HttpResponse, [string, HttpConfig?]>;
  };
  json: (body: string) => unknown;
  output: {
    confirmedRecoveryEmail?: string;
    recoveryCode?: string;
    recoveryLink?: string;
    testEmail?: string;
  };
  sleep?: jest.Mock;
};

const helperPath = join(
  process.cwd(),
  '.maestro',
  'scripts',
  'auth',
  'read-remote-password-recovery.js',
);
const helperSource = readFileSync(helperPath, 'utf8');
const requestStartedAt = '2026-11-18T12:00:00.000Z';
const recipient = 'reset-123@mailosaur.example';
const apiKey = 'test-mailosaur-api-key';
const serverId = 'server-123';
const serverDomain = 'mailosaur.example';

function messageDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: 'recovery-message',
    received: '2026-11-18T12:00:05.000Z',
    subject: 'Setze dein Passwort für fam zurück',
    to: [{ email: recipient }],
    ...overrides,
  };
}

function runHelper({
  mode,
  messages,
  details,
  sender,
  listResponses,
  responseForMissingMessages = false,
  allowFailure = false,
  recoveryEmail = recipient,
}: {
  mode: 'code' | 'link';
  messages?: unknown[];
  details?: Record<string, unknown>;
  sender?: string;
  listResponses?: unknown[][];
  responseForMissingMessages?: boolean;
  allowFailure?: boolean;
  recoveryEmail?: string;
}): ScriptContext {
  const output: ScriptContext['output'] = {};
  let listRequestCount = 0;
  const context: ScriptContext = {
    MAILOSAUR_API_KEY: apiKey,
    MAILOSAUR_SERVER_DOMAIN: serverDomain,
    MAILOSAUR_SERVER_ID: serverId,
    RECOVERY_EMAIL: recoveryEmail,
    RECOVERY_MODE: mode,
    RECOVERY_REQUEST_STARTED_AT: requestStartedAt,
    ...(sender ? { MAILOSAUR_SENDER: sender } : {}),
    console: { log: jest.fn() },
    http: {
      get: jest.fn<HttpResponse, [string, HttpConfig?]>((url) => {
        if (url.includes('/api/messages?')) {
          const responseItems =
            listResponses?.[listRequestCount] ?? messages ?? [{ id: 'recovery-message' }];
          listRequestCount += 1;
          return {
            body: JSON.stringify({ items: responseItems }),
            ok: !responseForMissingMessages,
            status: responseForMissingMessages ? 503 : 200,
          };
        }

        const messageId = decodeURIComponent(url.split('/').pop() ?? '');
        const detail = details?.[messageId] ?? messageDetail();
        return { body: JSON.stringify(detail), ok: true, status: 200 };
      }),
    },
    json: (body) => JSON.parse(body) as unknown,
    output,
    sleep: jest.fn(),
  };

  try {
    runInNewContext(helperSource, context);
  } catch (error) {
    if (!allowFailure) throw error;
  }
  return context;
}

function runPreflight({
  recoveryEmail = recipient,
  confirmedRecoveryEmail = recipient,
  serverDomainValue = serverDomain,
  allowFailure = false,
}: {
  recoveryEmail?: string;
  confirmedRecoveryEmail?: string;
  serverDomainValue?: string;
  allowFailure?: boolean;
}): ScriptContext {
  const output: ScriptContext['output'] = {};
  const context: ScriptContext = {
    MAILOSAUR_SERVER_DOMAIN: serverDomainValue,
    RECOVERY_EMAIL: recoveryEmail,
    CONFIRMED_RECOVERY_EMAIL: confirmedRecoveryEmail,
    RECOVERY_MODE: 'preflight',
    console: { log: jest.fn() },
    http: { get: jest.fn() },
    json: (body) => JSON.parse(body) as unknown,
    output,
  };

  try {
    runInNewContext(helperSource, context);
  } catch (error) {
    if (!allowFailure) throw error;
  }
  return context;
}

describe('read-remote-password-recovery Maestro helper', () => {
  it('accepts the confirmed setup handoff without contacting Mailosaur', () => {
    const context = runPreflight({
      recoveryEmail: '  reset-123@mailosaur.example  ',
      confirmedRecoveryEmail: 'reset-123@mailosaur.example',
    });

    expect(context.output.confirmedRecoveryEmail).toBe(recipient);
    expect(context.http.get).not.toHaveBeenCalled();
  });

  it('rejects a missing or different confirmed handoff before any request', () => {
    const missing = runPreflight({ confirmedRecoveryEmail: '', allowFailure: true });
    const different = runPreflight({
      confirmedRecoveryEmail: 'other@mailosaur.example',
      allowFailure: true,
    });

    expect(missing.output.confirmedRecoveryEmail).toBeUndefined();
    expect(different.output.confirmedRecoveryEmail).toBeUndefined();
    expect(missing.http.get).not.toHaveBeenCalled();
    expect(different.http.get).not.toHaveBeenCalled();
  });

  it('rejects an address outside the configured Mailosaur domain before any request', () => {
    const context = runPreflight({
      recoveryEmail: 'reset-123@other.example',
      confirmedRecoveryEmail: 'reset-123@other.example',
      allowFailure: true,
    });

    expect(context.output.confirmedRecoveryEmail).toBeUndefined();
    expect(context.http.get).not.toHaveBeenCalled();
  });

  it('rejects a recovery recipient outside the configured Mailosaur domain', () => {
    const context = runHelper({
      mode: 'code',
      recoveryEmail: 'reset-123@other.example',
      allowFailure: true,
    });

    expect(context.output.recoveryCode).toBeUndefined();
    expect(context.http.get).not.toHaveBeenCalled();
  });

  it('rejects missing runtime configuration before making an HTTP request', () => {
    const context = {
      console: { log: jest.fn() },
      http: { get: jest.fn() },
      json: (body: string) => JSON.parse(body) as unknown,
      output: {},
    };

    expect(() => runInNewContext(helperSource, context)).toThrow(
      'Fehlende Mailosaur-Laufzeitkonfiguration.',
    );
    expect(context.http.get).not.toHaveBeenCalled();
  });

  it('generates a unique full TEST_EMAIL from the configured Mailosaur suffix', () => {
    function generateAddress() {
      const context = {
        MAILOSAUR_ADDRESS_SUFFIX: '@opbingdz.mailosaur.net',
        MAILOSAUR_SERVER_DOMAIN: 'opbingdz.mailosaur.net',
        RECOVERY_MODE: 'address',
        console: { log: jest.fn() },
        output: {} as { testEmail?: string },
      };

      runInNewContext(helperSource, context);
      return context.output.testEmail;
    }

    const firstAddress = generateAddress();
    const secondAddress = generateAddress();

    expect(firstAddress).toMatch(/^fam-e2e-[a-z0-9]+-[a-z0-9]{8}@opbingdz\.mailosaur\.net$/);
    expect(secondAddress).toMatch(/^fam-e2e-[a-z0-9]+-[a-z0-9]{8}@opbingdz\.mailosaur\.net$/);
    expect(firstAddress).not.toBe(secondAddress);
  });

  it('prints only the generated address for the later confirmed-account handoff', () => {
    const output: { testEmail?: string } = {};
    const consoleLog = jest.fn();
    const context = {
      MAILOSAUR_ADDRESS_SUFFIX: '@mailosaur.example',
      MAILOSAUR_SERVER_DOMAIN: 'mailosaur.example',
      RECOVERY_MODE: 'address',
      console: { log: consoleLog },
      output,
    };

    runInNewContext(helperSource, context);

    expect(consoleLog).toHaveBeenCalledWith(
      `Eindeutige Mailosaur-Testadresse erzeugt: ${output.testEmail}`,
    );
    expect(JSON.stringify(consoleLog.mock.calls)).not.toContain('api-key');
    expect(JSON.stringify(consoleLog.mock.calls)).not.toContain('123456');
  });

  it('filters by exact recipient, subject, sender, and receivedAfter before extracting a link', () => {
    const sender = 'noreply@fam.example';
    const context = runHelper({
      mode: 'link',
      sender,
      messages: [
        { id: 'stale', received: '2026-11-18T11:59:59.000Z' },
        { id: 'wrong-recipient', received: '2026-11-18T12:00:01.000Z' },
        { id: 'wrong-subject', received: '2026-11-18T12:00:02.000Z' },
        { id: 'wrong-sender', received: '2026-11-18T12:00:03.000Z' },
        { id: 'valid', received: '2026-11-18T12:00:05.000Z' },
      ],
      details: {
        stale: messageDetail({ id: 'stale', received: '2026-11-18T11:59:59.000Z' }),
        'wrong-recipient': messageDetail({
          id: 'wrong-recipient',
          to: [{ email: 'other@mailosaur.example' }],
        }),
        'wrong-subject': messageDetail({
          id: 'wrong-subject',
          subject: 'Bestätige deine E-Mail-Adresse',
        }),
        'wrong-sender': messageDetail({
          id: 'wrong-sender',
          from: [{ email: 'other@example.com' }],
        }),
        valid: messageDetail({
          id: 'valid',
          from: [{ email: sender }],
          html: {
            body: '<a href="fam:///password-recovery?token_hash=hash-123&type=recovery">Reset</a>',
          },
        }),
      },
    });

    expect(context.output.recoveryLink).toBe(
      'fam:///password-recovery?token_hash=hash-123&type=recovery',
    );
    const [listUrl, listConfig] = context.http.get.mock.calls[0] ?? [];
    expect(listUrl).toContain('https://mailosaur.com/api/messages?');
    expect(listUrl).toContain(`sentTo=${encodeURIComponent(recipient)}`);
    expect(listUrl).toContain(`receivedAfter=${encodeURIComponent(requestStartedAt)}`);
    expect(listUrl).toContain(`sentFrom=${encodeURIComponent(sender)}`);
    expect(listConfig?.headers.Authorization).toBe(
      `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`,
    );
    expect(context.http.get.mock.calls.some(([url]) => url.endsWith('/valid'))).toBe(true);
  });

  it('extracts the six-digit value from the rendered German template label', () => {
    const context = runHelper({
      mode: 'code',
      details: {
        'recovery-message': messageDetail({
          text: { body: 'Dein Einmalcode\n654321' },
        }),
      },
    });

    expect(context.output.recoveryCode).toBe('654321');
    expect(context.output.recoveryLink).toBeUndefined();
  });

  it('waits between bounded polls when delivery appears after the first attempt', () => {
    const context = runHelper({
      mode: 'code',
      listResponses: [[], [{ id: 'recovery-message' }]],
      details: {
        'recovery-message': messageDetail({
          text: { body: 'Dein Einmalcode\n654321' },
        }),
      },
    });

    expect(context.output.recoveryCode).toBe('654321');
    expect(context.sleep).toHaveBeenCalledWith(3000);
    expect(context.http.get.mock.calls.filter(([url]) => url.includes('/api/messages?'))).toHaveLength(2);
  });

  it('stops after the fixed polling budget when Mailosaur has no matching message', () => {
    const context = runHelper({
      mode: 'code',
      allowFailure: true,
      responseForMissingMessages: true,
    });

    expect(context.output.recoveryCode).toBeUndefined();
    expect(context.http.get).toHaveBeenCalledTimes(8);
  });

  it('never writes the API key or recovered value to console output', () => {
    const secretLink = 'fam:///password-recovery?token_hash=secret-hash&type=recovery';
    const secretCode = '987654';
    const context = runHelper({
      mode: 'link',
      details: {
        'recovery-message': messageDetail({
          html: { body: `<a href="${secretLink}">Reset</a>` },
          text: { body: `Token: ${secretCode}` },
        }),
      },
    });
    const consoleOutput = JSON.stringify(context.console.log.mock.calls);

    expect(consoleOutput).not.toContain(apiKey);
    expect(consoleOutput).not.toContain(secretLink);
    expect(consoleOutput).not.toContain(secretCode);
  });
});
