import { spawnSync } from 'node:child_process';
import { createFreshConfirmedUser } from './lib/e2e-fixtures';

// Frischer haushaltsloser Account fuer den Maestro-Erstellungsflow.
const HOUSEHOLD_NAME = 'Maestro E2E Haushalt';

async function main() {
  const user = await createFreshConfirmedUser('maestro-e2e-create');
  console.log(`\n⏳ Seed-Account erstellt: ${user.email}`);
  console.log(`⏳ Starte Maestro-Flow household-create-during-onboarding.yaml...\n`);

  const result = spawnSync(
    'maestro',
    [
      'test',
      '.maestro/flows/household-create-during-onboarding.yaml',
      '-e',
      `EMAIL=${user.email}`,
      '-e',
      `PASSWORD=${user.password}`,
      '-e',
      `HOUSEHOLD_NAME=${HOUSEHOLD_NAME}`,
    ],
    { stdio: 'inherit' },
  );

  process.exit(result.status ?? 1);
}

main().catch((err) => {
  console.error('Fataler Fehler:', err);
  process.exit(1);
});
