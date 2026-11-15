import { runMaestro } from './lib/run-maestro';

const args = process.argv.slice(2);
const requestedFlow = args.find(
  (arg) => arg.endsWith('.yaml') && !arg.endsWith('/config.yaml') && arg !== 'config.yaml',
);
const hasExplicitTagExclusions = args.some(
  (arg) => arg === '--exclude-tags' || arg.startsWith('--exclude-tags='),
);
const defaultSuiteExclusions =
  args[0] === 'test' && !requestedFlow && !hasExplicitTagExclusions
    ? ['--exclude-tags', 'fixture,local-session,manual']
    : [];

process.exit(runMaestro([...args, ...defaultSuiteExclusions]));
