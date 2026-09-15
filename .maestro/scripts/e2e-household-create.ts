import { createFreshConfirmedUser } from './lib/e2e-fixtures';
import { runMaestro } from './lib/run-maestro';

// Seedet einen frischen, haushaltslosen Testaccount und fuehrt damit gezielt
// household-create-during-onboarding.yaml aus. Der Flow bleibt ein eigener
// direkter Fixture-Einstieg, weil er einen Account ohne bestehenden Haushalt
// braucht (siehe household-step.tsx: mit Haushalt wird jede Auswahl
// uebersprungen) - ein fester Testaccount wuerde das nur beim allerersten
// Lauf erfuellen.
const HOUSEHOLD_NAME = 'Maestro E2E Haushalt';

async function main() {
  const user = await createFreshConfirmedUser('maestro-e2e-create');
  console.log(`\n⏳ Seed-Account erstellt: ${user.email}`);
  console.log(`⏳ Starte Maestro-Flow household-create-during-onboarding.yaml...\n`);

  process.exit(
    runMaestro([
      'test',
      '.maestro/ios/flows/household/household-create-during-onboarding.yaml',
      '-e',
      `EMAIL=${user.email}`,
      '-e',
      `PASSWORD=${user.password}`,
      '-e',
      `HOUSEHOLD_NAME=${HOUSEHOLD_NAME}`,
    ]),
  );
}

main().catch((err) => {
  console.error('Fataler Fehler:', err);
  process.exit(1);
});
