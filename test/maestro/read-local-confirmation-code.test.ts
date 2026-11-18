import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

type HttpResponse = {
  body: string;
  ok: boolean;
  status: number;
};

type AuthOutput = {
  confirmationCode?: string;
  email: string;
  password: string;
};

type ScriptOutput = {
  auth: AuthOutput;
};

type ScriptContext = {
  console: {
    log: jest.Mock;
  };
  http: {
    get: jest.Mock<HttpResponse, [string]>;
  };
  json: (body: string) => unknown;
  output: ScriptOutput;
};

const helperPath = join(
  process.cwd(),
  '.maestro',
  'scripts',
  'auth',
  'read-local-confirmation-code.js',
);
const helperSource = readFileSync(helperPath, 'utf8');

function runHelper(): ScriptContext {
  const email = 'maestro-e2e-signup-123@example.com';
  const output: ScriptOutput = {
    auth: {
      email,
      password: 'Passwort123!',
    },
  };
  const searchUrl =
    'http://127.0.0.1:54324/api/v1/search?query=to%3Amaestro-e2e-signup-123%40example.com&limit=10';
  const detailUrl = 'http://127.0.0.1:54324/api/v1/message/mail-message-id';
  const get = jest.fn<HttpResponse, [string]>((url) => {
    if (url === searchUrl) {
      return {
        body: JSON.stringify({ messages: [{ ID: 'mail-message-id' }] }),
        ok: true,
        status: 200,
      };
    }

    if (url === detailUrl) {
      return {
        body: JSON.stringify({
          HTML: '<p>Gib diesen Code in der App ein: <strong>123456</strong></p>',
          Subject: 'Bestätige deine E-Mail-Adresse',
          Text: 'Gib diesen Code in der App ein: 123456',
        }),
        ok: true,
        status: 200,
      };
    }

    return {
      body: '{}',
      ok: false,
      status: 404,
    };
  });
  const context: ScriptContext = {
    console: { log: jest.fn() },
    http: { get },
    json: (body) => JSON.parse(body) as unknown,
    output,
  };

  runInNewContext(helperSource, context);
  return context;
}

describe('read-local-confirmation-code Maestro helper', () => {
  it('reads the OTP from the exact local Mailpit recipient and stores it in flow output', () => {
    const context = runHelper();

    expect(context.output.auth.confirmationCode).toBe('123456');
    expect(context.http.get).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:54324/api/v1/search?query=to%3Amaestro-e2e-signup-123%40example.com&limit=10',
    );
    expect(context.http.get).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:54324/api/v1/message/mail-message-id',
    );
    expect(context.http.get.mock.calls.every(([url]) => url.startsWith('http://127.0.0.1:54324/'))).toBe(
      true,
    );
  });
});
