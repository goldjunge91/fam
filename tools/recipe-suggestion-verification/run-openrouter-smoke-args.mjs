export const MAX_RETRIES = 3;

function parseRetries(value) {
  if (!/^\d+$/.test(value)) {
    throw new Error('--retries muss eine ganze Zahl sein.');
  }

  const retries = Number(value);
  if (retries > MAX_RETRIES) {
    throw new Error(`--retries darf höchstens ${MAX_RETRIES} sein.`);
  }
  return retries;
}

export function parseSmokeArgs(args, scenarioIds) {
  if (!Array.isArray(scenarioIds) || scenarioIds.length === 0) {
    throw new TypeError('scenarioIds muss mindestens ein Szenario enthalten.');
  }

  let scenarioId;
  let retries = 0;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--retries') {
      const value = args[index + 1];
      if (value === undefined) throw new Error('--retries benötigt einen Wert.');
      retries = parseRetries(value);
      index += 1;
      continue;
    }
    if (argument.startsWith('--retries=')) {
      retries = parseRetries(argument.slice('--retries='.length));
      continue;
    }
    if (argument.startsWith('-')) {
      throw new Error(`Unbekannte Option ${JSON.stringify(argument)}.`);
    }
    if (scenarioId !== undefined) {
      throw new Error('Es darf nur ein Szenario angegeben werden.');
    }
    scenarioId = argument;
  }

  const selectedScenarioId = scenarioId ?? scenarioIds[0];
  if (!scenarioIds.includes(selectedScenarioId)) {
    throw new Error(
      `Unbekanntes Szenario ${JSON.stringify(selectedScenarioId)}. Erlaubt: ${scenarioIds.join(', ')}`,
    );
  }

  return { scenarioId: selectedScenarioId, retries };
}
