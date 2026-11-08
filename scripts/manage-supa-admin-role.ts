import { createClient } from '@supabase/supabase-js';

type Action = 'grant' | 'revoke';

function requiredEnv(name: 'SUPABASE_URL' | 'SUPABASE_SECRET_KEY'): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} fehlt.`);
  return value;
}

function readArguments(): { action: Action; userId: string } {
  const [action, userId, confirmation] = process.argv.slice(2);
  const isAction = action === 'grant' || action === 'revoke';
  const isUserId =
    typeof userId === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId);
  if (!isAction || !isUserId || confirmation !== `--confirm-user-id=${userId}`) {
    throw new Error(
      'Nutzung: bun scripts/manage-supa-admin-role.ts <grant|revoke> <user-id> --confirm-user-id=<user-id>',
    );
  }
  return { action, userId };
}

async function main() {
  const { action, userId } = readArguments();
  const supabase = createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SECRET_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !data.user) throw new Error('Nutzerkonto konnte nicht geladen werden.');

  const appMetadata = { ...data.user.app_metadata };
  if (action === 'grant') {
    appMetadata.platform_role = 'supa-admin';
  } else {
    delete appMetadata.platform_role;
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
    app_metadata: appMetadata,
  });
  if (updateError) throw new Error('Plattformrolle konnte nicht aktualisiert werden.');
  console.log(`supa-admin Rolle ${action === 'grant' ? 'vergeben' : 'entzogen'} für ${userId}.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Rollenänderung fehlgeschlagen.');
  process.exitCode = 1;
});
