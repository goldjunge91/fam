import { spawnSync } from 'node:child_process';
import { createFreshConfirmedUser } from './lib/e2e-fixtures';

// Seedet einen frischen, haushaltslosen Testaccount und fuehrt damit gezielt
// household-create-during-onboarding.yaml aus. Eigenes Script statt Teil der
// `bun run e2e`-Suite, weil der Flow einen Account ohne bestehenden Haushalt
// braucht (siehe household-step.tsx: mit Haushalt wird jede Auswahl
// uebersprungen) - ein fester Testaccount wuerde das nur beim allerersten
// Lauf erfuellen.
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
