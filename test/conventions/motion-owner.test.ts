import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SOURCE_ROOT = path.join(REPO_ROOT, 'src');
const SOURCE_FILE = /\.[jt]sx?$/u;
const EXCLUDED_PATHS = ['/features/settings/dev/'];
const MOTION_OWNER = '/constants/motion.ts';
const DUPLICATED_MOTION = [
  /Easing\.inOut\(Easing\.cubic\)/u,
  /Easing\.out\(Easing\.cubic\)/u,
  /Easing\.elastic\(/u,
  /Easing\.inOut\(Easing\.sin\)/u,
  /duration:\s*(?:1800|450|700|180|140|100)\b/u,
  /duration:\s*140\s*\+\s*\(index\s*%\s*3\)\s*\*\s*10/u,
  /60\s*\*\s*1000\s*\*\s*4/u,
  /damping:\s*14,\s*stiffness:\s*320/u,
  /damping:\s*9,\s*stiffness:\s*380/u,
];

function getSourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return getSourceFiles(filePath);
    return entry.isFile() && SOURCE_FILE.test(entry.name) ? [filePath] : [];
  });
}

describe('Motion-Owner-Gate', () => {
  it('keeps repeated motion recipes in constants/motion.ts', () => {
    const violations = getSourceFiles(SOURCE_ROOT)
      .filter((filePath) => !filePath.endsWith(MOTION_OWNER))
      .filter((filePath) => {
        const relativePath = `/${path.relative(SOURCE_ROOT, filePath).split(path.sep).join('/')}`;
        return !EXCLUDED_PATHS.some((excludedPath) => relativePath.includes(excludedPath));
      })
      .flatMap((filePath) => {
        const source = fs.readFileSync(filePath, 'utf8');
        const relativePath = path.relative(REPO_ROOT, filePath).split(path.sep).join('/');
        return DUPLICATED_MOTION.filter((pattern) => pattern.test(source)).map(
          (pattern) => `${relativePath}: ${pattern.source}`,
        );
      });

    expect(violations).toEqual([]);
  });
});
