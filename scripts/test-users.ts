import { createClient } from '@supabase/supabase-js';
import { getRequiredServiceRoleKey } from './service-role-key';

// Das Skript dient AUSSCHLIESSLICH der lokalen Entwicklung
const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321';
const LOCAL_SERVICE_ROLE_KEY = getRequiredServiceRoleKey();

const supabase = createClient(LOCAL_SUPABASE_URL, LOCAL_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function main() {
  const args = process.argv.slice(2);
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
🛠️  Familie-App Test-Account Helper (Nur lokale Entwicklungsdatenbank)

Befehle:
  bun run user:create [email] [passwort] [name]  Erstellt einen Test-Account auf der lokalen DB
  bun run user:list                              Listet alle vorhandenen Test-Accounts auf
  bun run user:clean                             Löscht ALLE Test-Accounts (*@example.com)
  bun run user:delete <email>                    Löscht einen spezifischen Test-Account

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

  console.log(`\n⏳ Erstelle lokalen Test-Account auf ${LOCAL_SUPABASE_URL}...`);

  const { data: adminData, error: adminErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });

  if (adminErr || !adminData?.user) {
    console.error(
      '❌ Fehler beim Erstellen des Test-Accounts:',
      adminErr?.message || 'Unbekannter Fehler',
    );
    process.exit(1);
  }

  const userId = adminData.user.id;

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

  console.log('\n✅ Lokaler Test-Account erfolgreich erstellt!');
  console.log(`──────────────────────────────────────────`);
  console.log(` 📧 E-Mail:   ${email}`);
  console.log(` 🔑 Passwort: ${password}`);
  console.log(` 👤 Name:     ${displayName}`);
  console.log(` 🆔 User ID:  ${userId}`);
  console.log(`──────────────────────────────────────────\n`);
}

async function handleList() {
  console.log(`\n📋 Suche nach lokalen Test-Accounts... (${LOCAL_SUPABASE_URL})\n`);

  const { data: usersData, error: adminErr } = await supabase.auth.admin.listUsers();

  if (adminErr || !usersData?.users) {
    console.error(
      '❌ Fehler beim Abfragen der Admin-Benutzer:',
      adminErr?.message || 'Keine Daten',
    );
    process.exit(1);
  }

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
}

async function handleDelete(email?: string) {
  if (!email) {
    console.error('❌ Bitte gib eine E-Mail-Adresse an: bun run user:delete <email>');
    process.exit(1);
  }

  console.log(`\n⏳ Lösche lokalen Test-Account ${email}...`);
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
  console.log('\n🗑️  Bereinige lokale Test-Accounts (*@example.com, *@test.fam, tester_*)...');

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
    console.log(`\n✅ Insgesamt ${count} Test-Account(s) gelöscht!\n`);
  }
}

main().catch((err) => {
  console.error('Fataler Fehler:', err);
  process.exit(1);
});
