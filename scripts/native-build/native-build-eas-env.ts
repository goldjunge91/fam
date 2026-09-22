import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';

type EasLocalBuildEnvironmentOptions = {
  configuredWorkingDir?: string;
  ccacheDir?: string;
  projectRoot: string;
  temporaryRoot?: string;
};

type EasLocalBuildEnvironment = {
  workingDir: string;
  environment: Record<string, string>;
};

export function createEasLocalBuildEnvironment({
  configuredWorkingDir,
  ccacheDir,
  projectRoot,
  temporaryRoot = tmpdir(),
}: EasLocalBuildEnvironmentOptions): EasLocalBuildEnvironment {
  const workingDir =
    configuredWorkingDir ??
    (ccacheDir
      ? join(dirname(ccacheDir), 'eas-build-local-workingdir')
      : join(temporaryRoot, `${basename(projectRoot)}-eas-build-local-workingdir`));

  return {
    workingDir,
    environment: {
      EAS_LOCAL_BUILD_WORKINGDIR: workingDir,
      EAS_LOCAL_BUILD_SKIP_CLEANUP: '1',
    },
  };
}
