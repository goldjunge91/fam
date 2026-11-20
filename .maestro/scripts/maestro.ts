import { basename } from 'node:path';
import { loadRemoteMailosaurEnvironment, runMaestro } from './lib/run-maestro';

const REMOTE_EXCLUDED_TAGS = ['remote-setup', 'remote-recovery'];
const DEFAULT_SUITE_EXCLUDED_TAGS = ['fixture', 'local-session', 'manual', ...REMOTE_EXCLUDED_TAGS];
const REMOTE_FLOW_NAMES = new Set([
  'registration-remote-mailosaur.yaml',
  'password-reset-remote-code.yaml',
  'password-reset-remote-link.yaml',
]);

const args = process.argv.slice(2);
const requestedFlow = args.find(
  (arg) => arg.endsWith('.yaml') && !arg.endsWith('/config.yaml') && arg !== 'config.yaml',
);

function withMandatoryRemoteExclusions(input: readonly string[]): string[] {
  if (args[0] !== 'test' || requestedFlow) return [...input];

  const result = [...input];
  const exclusionIndex = result.findIndex(
    (arg) => arg === '--exclude-tags' || arg.startsWith('--exclude-tags='),
  );

  if (exclusionIndex === -1) {
    return [...result, '--exclude-tags', DEFAULT_SUITE_EXCLUDED_TAGS.join(',')];
  }

  const exclusionOption = result[exclusionIndex];
  if (exclusionOption?.startsWith('--exclude-tags=')) {
    const existingTags = exclusionOption.slice('--exclude-tags='.length).split(',').filter(Boolean);
    result[exclusionIndex] = `--exclude-tags=${[
      ...new Set([...existingTags, ...REMOTE_EXCLUDED_TAGS]),
    ].join(',')}`;
    return result;
  }

  const valueIndex = exclusionIndex + 1;
  const existingValue = result[valueIndex];
  if (existingValue && !existingValue.startsWith('--')) {
    result[valueIndex] = [...new Set([...existingValue.split(','), ...REMOTE_EXCLUDED_TAGS])].join(',');
    return result;
  }

  return [...result, '--exclude-tags', REMOTE_EXCLUDED_TAGS.join(',')];
}

function platformArgument(input: readonly string[]): string | null {
  const platformIndex = input.findIndex(
    (arg) => arg === '--platform' || arg.startsWith('--platform='),
  );
  if (platformIndex === -1) return null;

  const option = input[platformIndex];
  if (option?.startsWith('--platform=')) return option.slice('--platform='.length);
  return input[platformIndex + 1] ?? null;
}

function enforceRemoteIosPlatform(input: readonly string[]): string[] {
  if (!requestedFlow || !REMOTE_FLOW_NAMES.has(basename(requestedFlow))) return [...input];

  const platform = platformArgument(input)?.toLowerCase();
  if (platform && platform !== 'ios') {
    console.error('Remote Mailosaur-Flows dürfen nur mit --platform=ios ausgeführt werden.');
    process.exit(1);
  }

  // Maestro documents --platform as the local test target selector.
  // Source: https://docs.maestro.dev/maestro-cli/maestro-cli-commands-and-options
  return platform ? [...input] : [...input, '--platform=ios'];
}

if (requestedFlow && REMOTE_FLOW_NAMES.has(basename(requestedFlow))) {
  loadRemoteMailosaurEnvironment();
}

process.exit(runMaestro(enforceRemoteIosPlatform(withMandatoryRemoteExclusions(args))));
