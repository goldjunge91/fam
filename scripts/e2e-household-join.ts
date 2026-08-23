import { spawnSync } from 'node:child_process';
import { createFreshConfirmedUser, createInviteFixture } from './lib/e2e-fixtures';

// Getrennte Host- und Beitrittsaccounts fuer den Maestro-Einladungsflow.
const HOUSEHOLD_NAME = 'Maestro E2E Einladungs-Haushalt';

async function main() {
  const invite = await createInviteFixture(HOUSEHOLD_NAME);
  console.log(`\n⏳ Host-Haushalt "${invite.householdName}" erstellt (Host: ${invite.host.email})`);

  const joiner = await createFreshConfirmedUser('maestro-e2e-join');
  console.log(`⏳ Beitretender Testaccount erstellt: ${joiner.email}`);
  console.log(`⏳ Starte Maestro-Flow household-join-via-invite.yaml...\n`);

  const result = spawnSync(
    'maestro',
    [
      'test',
      '.maestro/flows/household-join-via-invite.yaml',
      '-e',
      `EMAIL=${joiner.email}`,
      '-e',
      `PASSWORD=${joiner.password}`,
      '-e',
      `INVITE_TOKEN=${invite.token}`,
      '-e',
      `HOUSEHOLD_NAME=${invite.householdName}`,
    ],
    { stdio: 'inherit' },
  );

  process.exit(result.status ?? 1);
}

main().catch((err) => {
  console.error('Fataler Fehler:', err);
  process.exit(1);
});
