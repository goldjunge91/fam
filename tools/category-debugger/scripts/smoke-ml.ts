import { existsSync } from 'node:fs';
import path from 'node:path';

const dataDir = process.env.CATEGORY_ML_DATA_DIR?.trim()
  || process.env.DUMP_DATA_DIR?.trim()
  || '/Volumes/Programme/off-dump-data';
const python = process.env.CATEGORY_ML_PYTHON?.trim()
  || path.join(process.env.CATEGORY_ML_VENV?.trim() || path.join(dataDir, 'category-ml-venv'), 'bin', 'python');
const runner = path.resolve(import.meta.dirname, 'train-baseline.py');

if (!existsSync(python)) throw new Error(`ML-Python fehlt: ${python}`);

const payload = {
  classes: ['produce', 'beverages', 'other'],
  train: [
    { text: 'apfel frisch obst', classId: 'produce', snapshotHash: 'a', imagePath: null },
    { text: 'birne frisch obst', classId: 'produce', snapshotHash: 'b', imagePath: null },
    { text: 'mineralwasser getränk', classId: 'beverages', snapshotHash: 'c', imagePath: null },
    { text: 'orangensaft getränk', classId: 'beverages', snapshotHash: 'd', imagePath: null },
  ],
  test: [
    { label_id: 1, text: 'frischer apfel', imagePath: null },
    { label_id: 2, text: 'wasser getränk', imagePath: null },
  ],
};

const child = Bun.spawn([python, runner, 'fasttext'], { stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' });
child.stdin.write(JSON.stringify(payload));
child.stdin.end();
const [stdout, stderr, exitCode] = await Promise.all([
  new Response(child.stdout).text(),
  new Response(child.stderr).text(),
  child.exited,
]);
if (exitCode !== 0) throw new Error(stderr.trim() || `fastText-Smoke-Test fehlgeschlagen (${exitCode}).`);
const predictions: unknown = JSON.parse(stdout);
if (!Array.isArray(predictions) || predictions.length !== payload.test.length) {
  throw new Error('fastText-Smoke-Test lieferte keine vollständigen Vorhersagen.');
}
console.log(`fastText-Smoke-Test: ${predictions.length}/${payload.test.length} Vorhersagen`);
