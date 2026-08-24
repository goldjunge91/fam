import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const dataDir = process.env.CATEGORY_ML_DATA_DIR?.trim()
  || process.env.DUMP_DATA_DIR?.trim()
  || '/Volumes/Programme/off-dump-data';
const venv = process.env.CATEGORY_ML_VENV?.trim() || path.join(dataDir, 'category-ml-venv');
const python = path.join(venv, 'bin', 'python');
const requirements = path.resolve(import.meta.dirname, '../requirements-ml.txt');

function run(command: string[]): void {
  const result = Bun.spawnSync(command, { stdout: 'inherit', stderr: 'inherit' });
  if (result.exitCode !== 0) process.exit(result.exitCode);
}

const action = process.argv[2] ?? 'status';
if (action === 'setup') {
  mkdirSync(dataDir, { recursive: true });
  if (!existsSync(python)) run(['python3', '-m', 'venv', venv]);
  run([python, '-m', 'pip', 'install', '--upgrade', 'pip']);
  run([python, '-m', 'pip', 'install', '-r', requirements]);
}

if (!existsSync(python)) {
  console.log(`ML-Umgebung fehlt: ${venv}`);
  process.exit(action === 'status' ? 0 : 1);
}

run([python, '-c', "import fasttext, setfit, sklearn, torch, transformers; print('ML-Umgebung bereit')"]);
console.log(`Python: ${python}`);
console.log(`Modellcache: ${process.env.CATEGORY_ML_CACHE?.trim() || path.join(dataDir, 'category-ml-cache')}`);
