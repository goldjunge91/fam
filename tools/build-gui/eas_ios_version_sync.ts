import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

interface PbxReference {
  value: string;
}

interface PbxNativeTarget {
  dependencies?: PbxReference[];
}

interface PbxTargetDependency {
  target?: string;
  targetProxy?: string;
}

interface ParsedPbxProject {
  hash: {
    project: {
      objects: {
        PBXNativeTarget: Record<string, PbxNativeTarget | string>;
        PBXTargetDependency: Record<string, PbxTargetDependency | string>;
      };
    };
  };
  parseSync(): ParsedPbxProject;
  writeSync(): string;
}

interface XcodeModule {
  project(projectPath: string): ParsedPbxProject;
}

const require = createRequire(import.meta.url);
const xcode = require('xcode') as XcodeModule;

function removeExternalTargetDependencies(project: ParsedPbxProject): boolean {
  const { PBXNativeTarget: targets, PBXTargetDependency: dependencies } =
    project.hash.project.objects;
  let changed = false;

  for (const target of Object.values(targets)) {
    if (typeof target === 'string' || !Array.isArray(target.dependencies)) continue;

    const retainedDependencies = target.dependencies.filter(({ value }) => {
      const dependency = dependencies[value];
      const isExternalTargetProxy =
        typeof dependency === 'object' &&
        dependency.target == null &&
        typeof dependency.targetProxy === 'string';
      return !isExternalTargetProxy;
    });

    if (retainedDependencies.length !== target.dependencies.length) {
      target.dependencies = retainedDependencies;
      changed = true;
    }
  }

  return changed;
}

function runEasVersionSync(args: string[]): number {
  const result = spawnSync(process.execPath, ['x', 'eas-cli', ...args], {
    stdio: 'inherit',
  });

  if (result.error) throw result.error;
  return result.status ?? 1;
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  if (args[0] !== 'build:version:sync') {
    throw new Error('Expected EAS command: build:version:sync');
  }

  const projectPath = path.resolve('ios/fam.xcodeproj/project.pbxproj');
  const originalProject = readFileSync(projectPath);
  const project = xcode.project(projectPath).parseSync();
  if (!removeExternalTargetDependencies(project)) {
    return runEasVersionSync(args);
  }

  // EAS expects local target IDs, while CocoaPods stores external project refs as targetProxy.
  try {
    writeFileSync(projectPath, project.writeSync());
    return runEasVersionSync(args);
  } finally {
    writeFileSync(projectPath, originalProject);
  }
}

main()
  .then(exitCode => {
    process.exitCode = exitCode;
  })
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
