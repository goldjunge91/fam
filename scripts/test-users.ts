import * as fs from 'node:fs';
import * as path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function parseEnvFile(filePath: string) {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valParts] = trimmed.split('=');
        if (key && valParts.length > 0) {
          const val = valParts.join('=').trim();
          process.env[key.trim()] = val;
        }
      }
    }
  }
}

function loadEnv() {
  const rootDir = process.cwd();
  // Read main .env first
  parseEnvFile(path.resolve(rootDir, '.env'));

  // If EXPO_PUBLIC_USE_LOCAL_DB=true, override with .env.development
  const useLocal = process.env.EXPO_PUBLIC_USE_LOCAL_DB?.trim().toLowerCase();
  if (useLocal === 'true' || useLocal === '1') {
    parseEnvFile(path.resolve(rootDir, '.env.development'));
  }
}

loadEnv();

const isRemote = process.argv.includes('--remote');
const LOCAL_URL = 'http://127.0.0.1:54321';
const LOCAL_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const SUPABASE_URL = isRemote
  ? process.env.EXPO_PUBLIC_SUPABASE_URL || LOCAL_URL
  : process.env.EXPO_PUBLIC_SUPABASE_URL || LOCAL_URL;
const SUPABASE_KEY = isRemote
  ? process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.EXPO_PUBLIC_SUPABASE_KEY ||
    LOCAL_SERVICE_ROLE_KEY
  : LOCAL_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function main() {
  const rawArgs = process.argv.slice(2);
  const args = rawArgs.filter((a) => a !== '--remote' && a !== '--local');
  const command = args[0] || 'help';

  switch (command) {
    case 'create':
      await handleCreate(args[1], args[2], args[3]);
      break;
    case 'list':
      await handleList();
      break;
    case 'clean':
    case 'cleanup':
      await handleClean();
      break;
    case 'delete':
      await handleDelete(args[1]);
      break;
    default:
      printUsage();
  }
}

function printUsage() {
  console.log(`
🛠️  Familie-App Test-Account Helper

Befehle:
  bun run user:create [email] [passwort] [name]  Erstellt einen Test-Account
  bun run user:list                              Listet alle vorhandenen Test-Accounts auf
  bun run user:clean                             Löscht ALLE Test-Accounts (*@example.com)
  bun run user:delete <email>                    Löscht einen spezifischen Test-Account

Optionen:
  --remote                                       Führt den Befehl gegen das gehostete Supabase aus

Beispiele:
  bun run user:create
  bun run user:create alice@example.com Pass123! "Alice Test"
  bun run user:list
  bun run user:clean
`);
}

async function handleCreate(customEmail?: string, customPassword?: string, customName?: string) {
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const email = customEmail || `tester_${randomSuffix}@example.com`;
  const password = customPassword || 'Passwort123!';
  const displayName = customName || `Test User ${randomSuffix}`;

  console.log(`\n⏳ Erstelle Test-Account auf ${SUPABASE_URL}...`);

  let userId: string | null = null;
  const { data: adminData, error: adminErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });

  if (!adminErr && adminData?.user) {
    userId = adminData.user.id;
  } else {
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
      },
    });

    if (signUpErr) {
      console.error('❌ Fehler beim Erstellen des Accounts:', signUpErr.message);
      process.exit(1);
    }
    userId = signUpData.user?.id || null;
  }

  if (userId) {
    // Profil in public.profiles vervollständigen
    const { error: profileErr } = await supabase.from('profiles').upsert({
      id: userId,
      display_name: displayName,
      onboarding_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (profileErr) {
      console.warn('⚠️ Profil-Update Hinweis:', profileErr.message);
    }
  }

  console.log('\n✅ Test-Account erfolgreich erstellt!');
  console.log(`──────────────────────────────────────────`);
  console.log(` 📧 E-Mail:   ${email}`);
  console.log(` 🔑 Passwort: ${password}`);
  console.log(` 👤 Name:     ${displayName}`);
  if (userId) console.log(` 🆔 User ID:  ${userId}`);
  console.log(`──────────────────────────────────────────\n`);
}

async function handleList() {
  console.log(`\n📋 Suche nach Test-Accounts... (${SUPABASE_URL})\n`);

  const { data: usersData, error: adminErr } = await supabase.auth.admin.listUsers();

  if (!adminErr && usersData?.users) {
    console.log(`Gefunden: ${usersData.users.length} Account(s) in auth.users:\n`);
    console.log('  E-Mail                        | Erstellt am          | ID');
    console.log(
      '--------------------------------------------------------------------------------------',
    );
    for (const u of usersData.users) {
      const emailFormatted = (u.email || '–').padEnd(30, ' ');
      const createdFormatted = new Date(u.created_at).toLocaleString('de-DE').padEnd(20, ' ');
      console.log(`  ${emailFormatted} | ${createdFormatted} | ${u.id}`);
    }
    console.log('');
    return;
  }

  // Fallback: public.profiles
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, display_name, onboarding_completed_at, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Fehler beim Abfragen der Profile:', error.message);
    process.exit(1);
  }

  if (!profiles || profiles.length === 0) {
    console.log('ℹ️ Keine Nutzer-Profile gefunden.');
    return;
  }

  console.log(`Gefunden: ${profiles.length} Profil(e) in public.profiles:\n`);
  console.log(
    '  Name                          | ID                                   | Onboarding',
  );
  console.log(
    '--------------------------------------------------------------------------------------',
  );
  for (const p of profiles) {
    const nameFormatted = (p.display_name || 'Unbenannt').padEnd(30, ' ');
    const onboarding = p.onboarding_completed_at ? '✓ Abgeschlossen' : 'Offen';
    console.log(`  ${nameFormatted} | ${p.id} | ${onboarding}`);
  }
  console.log('');
}

async function handleDelete(email?: string) {
  if (!email) {
    console.error('❌ Bitte gib eine E-Mail-Adresse an: bun run user:delete <email>');
    process.exit(1);
  }

  console.log(`\n⏳ Lösche Test-Account ${email}...`);
  const { data: adminUsers } = await supabase.auth.admin.listUsers();
  const target = adminUsers?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  if (target) {
    const { error } = await supabase.auth.admin.deleteUser(target.id);
    if (error) {
      console.error('❌ Fehler beim Löschen:', error.message);
      process.exit(1);
    }
    console.log(`✅ Account ${email} (${target.id}) wurde gelöscht!`);
  } else {
    console.log(`ℹ️ Kein Nutzer mit E-Mail ${email} gefunden.`);
  }
}

async function handleClean() {
  console.log('\n🗑️  Bereinige Test-Accounts (*@example.com, *@test.fam, tester_*)...');

  const { data: adminUsers } = await supabase.auth.admin.listUsers();
  if (adminUsers?.users) {
    const testUsers = adminUsers.users.filter(
      (u) =>
        u.email?.endsWith('@example.com') ||
        u.email?.endsWith('@test.fam') ||
        u.email?.startsWith('test'),
    );

    if (testUsers.length === 0) {
      console.log('ℹ️ Keine Test-Accounts zum Bereinigen gefunden.');
      return;
    }

    let count = 0;
    for (const u of testUsers) {
      console.log(`  - Lösche ${u.email}...`);
      await supabase.auth.admin.deleteUser(u.id);
      count++;
    }
    console.log(`\n✅ Insgesammt ${count} Test-Account(s) gelöscht!\n`);
  } else {
    console.log('ℹ️ Keine Admin-Rechte verfügbar.');
  }
}

main().catch((err) => {
  console.error('Fataler Fehler:', err);
  process.exit(1);
});
