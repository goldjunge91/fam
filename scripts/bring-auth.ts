/**
 * Headless Bring! Authentication Script.
 *
 * Loggt sich mit BRING_EMAIL und BRING_PASSWORD bei Bring! ein,
 * holt einen frischen access_token und exportiert die Zugangsdaten:
 *   - In GitHub Actions: nach $GITHUB_ENV (automatisch maskiert)
 *   - Lokal: nach tokens_backup.env und tools/crawler/.env
 */

import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BRING_API_KEY = 'cof4Nc6D8saplXjE3h3HXqHH8m7VU2i1Gs0g85Sp';
const BRING_AUTH_URL = 'https://api.getbring.com/rest/v2/bringauth';

type BringAuthResponse = {
  access_token: string;
  refresh_token?: string;
  uuid: string;
  publicUuid?: string;
  email?: string;
  name?: string;
  expires_in?: number;
  message?: string;
  error?: string;
};

function parseArgs(): { email?: string; password?: string } {
  const args = process.argv.slice(2);
  let email: string | undefined;
  let password: string | undefined;

  for (const arg of args) {
    if (arg.startsWith('--email=')) {
      email = arg.slice('--email='.length).trim();
    } else if (arg.startsWith('--password=')) {
      password = arg.slice('--password='.length).trim();
    }
  }

  return { email, password };
}

function loadEnvCandidates(): Record<string, string> {
  const currentDir = typeof __dirname !== 'undefined' ? __dirname : import.meta.dirname;
  const rootDir = resolve(currentDir, '..');
  const candidates = [
    resolve(rootDir, '.env.local'),
    resolve(rootDir, '.env.development.local'),
    resolve(rootDir, '.env'),
    resolve(rootDir, 'tokens_backup.env'),
    resolve(rootDir, 'tools/crawler/.env'),
  ];

  const envs: Record<string, string> = {};
  for (const p of candidates) {
    if (!existsSync(p)) continue;
    try {
      const content = readFileSync(p, 'utf8');
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const match = trimmed.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
        if (match) {
          const key = match[1];
          const val = match[2].trim().replace(/^["']|["']$/g, '');
          if (!envs[key]) envs[key] = val;
        }
      }
    } catch {
      // Ignorieren
    }
  }
  return envs;
}

function updateEnvFile(filePath: string, updates: Record<string, string>): void {
  let lines: string[] = [];
  if (existsSync(filePath)) {
    try {
      lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
    } catch {
      lines = [];
    }
  }

  const written = new Set<string>();
  const newLines: string[] = [];

  for (const line of lines) {
    const match = line.match(/^([A-Za-z0-9_]+)\s*=/);
    if (match && updates[match[1]] !== undefined) {
      newLines.push(`${match[1]}=${updates[match[1]]}`);
      written.add(match[1]);
    } else {
      newLines.push(line);
    }
  }

  for (const [k, v] of Object.entries(updates)) {
    if (!written.has(k)) {
      newLines.push(`${k}=${v}`);
    }
  }

  writeFileSync(filePath, `${newLines.join('\n').trim()}\n`, 'utf8');
}

function decodeJwtExpiry(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson);
    if (typeof payload.exp === 'number') {
      return new Date(payload.exp * 1000).toLocaleString('de-DE', { timeZoneName: 'short' });
    }
  } catch {
    // Ignorieren
  }
  return null;
}

export async function authenticateBring(
  emailInput?: string,
  passwordInput?: string,
): Promise<{ token: string; userUuid: string; apiKey: string }> {
  const fileEnvs = loadEnvCandidates();
  const cliArgs = parseArgs();

  const email =
    emailInput !== undefined
      ? emailInput
      : cliArgs.email !== undefined
        ? cliArgs.email
        : (process.env.BRING_EMAIL ?? fileEnvs.BRING_EMAIL);

  const password =
    passwordInput !== undefined
      ? passwordInput
      : cliArgs.password !== undefined
        ? cliArgs.password
        : (process.env.BRING_PASSWORD ?? fileEnvs.BRING_PASSWORD);

  if (!email || !password) {
    throw new Error(
      'Bring-Authentifizierung fehlgeschlagen: BRING_EMAIL und BRING_PASSWORD müssen gesetzt sein (als Umgebungsvariable, Argument --email=... --password=... oder in .env.local).',
    );
  }

  console.log(`[Bring-Auth] Melde an bei Bring! API für: ${email}...`);

  const body = new URLSearchParams({ email, password });
  const response = await fetch(BRING_AUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-BRING-API-KEY': BRING_API_KEY,
      'X-BRING-CLIENT': 'web',
      'X-BRING-VERSION': '4.110.0',
    },
    body,
  });

  if (!response.ok) {
    let detail = '';
    try {
      const errJson = (await response.json()) as BringAuthResponse;
      detail = errJson.message || errJson.error || JSON.stringify(errJson);
    } catch {
      detail = await response.text();
    }
    throw new Error(`Bring-Login fehlgeschlagen (HTTP ${response.status}): ${detail}`);
  }

  const data = (await response.json()) as BringAuthResponse;
  const token = data.access_token;
  const userUuid = data.uuid;

  if (!token || !userUuid) {
    throw new Error('Ungültige Antwort von Bring!: access_token oder uuid fehlt.');
  }

  return { token, userUuid, apiKey: BRING_API_KEY };
}

// Direkte CLI-Ausführung
async function main(): Promise<void> {
  try {
    const { token, userUuid, apiKey } = await authenticateBring();
    const expiry = decodeJwtExpiry(token);

    console.log('============================================================');
    console.log('✅ [Bring-Auth] Login erfolgreich!');
    console.log(`   👤 User UUID:     ${userUuid}`);
    console.log(`   🔑 Token (Auszug): ${token.slice(0, 15)}...${token.slice(-8)}`);
    if (expiry) {
      console.log(`   ⏳ Gültig bis:     ${expiry}`);
    }
    console.log('============================================================');

    // 1. GitHub Actions Umgebungsexport
    if (process.env.GITHUB_ENV) {
      // Token maskieren, damit er nicht im Log erscheint
      console.log(`::add-mask::${token}`);
      console.log(`::add-mask::${userUuid}`);
      appendFileSync(
        process.env.GITHUB_ENV,
        `BRING_AUTH_TOKEN=${token}\nBRING_API_KEY=${apiKey}\nBRING_USER_UUID=${userUuid}\n`,
        'utf8',
      );
      console.log('   ☁️ In $GITHUB_ENV für Folgeschritte exportiert.');
    }

    // 2. Lokale Speicherung
    const currentDir = typeof __dirname !== 'undefined' ? __dirname : import.meta.dirname;
    const rootDir = resolve(currentDir, '..');
    const targetFiles = [
      resolve(rootDir, 'tokens_backup.env'),
      resolve(rootDir, 'tools/crawler/.env'),
    ];

    const updates = {
      BRING_AUTH_TOKEN: token,
      BRING_API_KEY: apiKey,
      BRING_USER_UUID: userUuid,
    };

    for (const file of targetFiles) {
      updateEnvFile(file, updates);
      console.log(`   💾 Gespeichert in: ${file}`);
    }

    console.log('============================================================\n');
  } catch (err: unknown) {
    console.error('❌ [Bring-Auth] Fehler:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

const isMain =
  (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) ||
  (typeof import.meta !== 'undefined' && Boolean((import.meta as { main?: boolean }).main));

if (isMain) {
  void main();
}
