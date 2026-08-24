import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { explainCategory } from '../../../../src/features/shopping-list/classification/shopping-category-classifier';
import type { CategoryTrace } from '../../../../src/features/shopping-list/classification/types';
import {
  CANONICAL_CATEGORY_IDS,
  type BaselineDefinition,
  type BaselineId,
  type CanonicalCategoryId,
  type EvaluationLabel,
  type EvaluationPrediction,
  type EvaluationSilverLabel,
} from './types';

export { BASELINE_IDS, type BaselineId } from './types';

type TrainingExample = { text: string; classId: EvaluationClassId; snapshotHash: string; imagePath: string | null };
type EvaluationClassId = CanonicalCategoryId | 'other';
type ModelResult = { version: string; fingerprint: string; predictions: EvaluationPrediction[] };
type PythonPrediction = { label_id: number; category_id: EvaluationClassId; confidence: number };

const CLASSES: EvaluationClassId[] = [...CANONICAL_CATEGORY_IDS, 'other'];
const FEATURE_DIMENSION = 8192;
const ML_DATA_DIR = process.env.CATEGORY_ML_DATA_DIR?.trim()
  || process.env.DUMP_DATA_DIR?.trim()
  || '/Volumes/Programme/off-dump-data';
const EXTERNAL_PYTHON = path.join(ML_DATA_DIR, 'category-ml-venv', 'bin', 'python');
const LOCAL_PYTHON = path.resolve(import.meta.dirname, '../../.venv-ml/bin/python');
const PYTHON_RUNNER = path.resolve(import.meta.dirname, '../../scripts/train-baseline.py');

function pythonExecutable(): string {
  const configured = process.env.CATEGORY_ML_PYTHON?.trim();
  if (configured) return configured;
  if (existsSync(EXTERNAL_PYTHON)) return EXTERNAL_PYTHON;
  return LOCAL_PYTHON;
}

export function baselineDefinitions(): BaselineDefinition[] {
  const python = pythonExecutable();
  const pythonReady = existsSync(python) && existsSync(PYTHON_RUNNER);
  return [
    { id: 'linear_ngram', label: 'Linear N-Gramme', description: 'Lokales Wort- und Zeichen-N-Gramm-Modell ohne Zusatzpakete.', available: true, unavailableReason: null, externalNetwork: false },
    { id: 'robotoff', label: 'Robotoff', description: 'Offizieller OFF-Kategorieclassifier mit Mapping auf unsere Taxonomie.', available: true, unavailableReason: null, externalNetwork: true },
    { id: 'fasttext', label: 'fastText', description: 'Echtes fastText-Supervised-Modell mit Subword-N-Grammen.', available: pythonReady, unavailableReason: pythonReady ? null : 'ML-Python-Umgebung fehlt.', externalNetwork: false },
    { id: 'setfit', label: 'SetFit multilingual', description: 'Few-shot Sentence-Transformer plus Klassifikationskopf.', available: pythonReady, unavailableReason: pythonReady ? null : 'ML-Python-Umgebung und Modell fehlen.', externalNetwork: true },
    { id: 'siglip', label: 'Text + SigLIP', description: 'Textmerkmale kombiniert mit lokalen Frontbild-Embeddings.', available: pythonReady, unavailableReason: pythonReady ? null : 'ML-Python-Umgebung, Modell oder Frontbilder fehlen.', externalNetwork: true },
  ];
}

function productText(input: { name: string; brand: string | null; categoryTags: readonly string[] }): string {
  return [input.name, input.brand ?? '', input.categoryTags.join(' ')].filter(Boolean).join(' | ').normalize('NFKC').toLocaleLowerCase('de-DE');
}

function trainingExamples(
  labels: readonly EvaluationLabel[],
  silverLabels: readonly EvaluationSilverLabel[],
  imagePathForBarcode: (barcode: string | null) => string | null,
): TrainingExample[] {
  const goldKeys = new Set(labels.map((label) => label.productKey));
  const gold: TrainingExample[] = labels
    .filter((label) => label.split === 'calibration'
      && label.status === 'labeled'
      && label.expectedProductFamilyId !== null
      && label.expectedProductFormId !== null
      && label.expectedPlacementZoneId !== null)
    .map((label) => ({
      text: productText(label),
      classId: label.expectedCategoryId ?? 'other',
      snapshotHash: label.snapshotHash,
      imagePath: imagePathForBarcode(label.barcode),
    }));
  const silver: TrainingExample[] = silverLabels
    .filter((label) => label.split === 'calibration'
      && label.annotationStatus === 'labeled'
      && label.reviewStatus === 'accepted'
      && label.proposedCategoryId !== null
      && !goldKeys.has(label.productKey))
    .map((label) => ({
      text: productText(label),
      classId: label.proposedCategoryId as CanonicalCategoryId,
      snapshotHash: label.snapshotHash,
      imagePath: imagePathForBarcode(label.barcode),
    }));
  return [...gold, ...silver];
}

function hashFeature(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % FEATURE_DIMENSION;
}

function rawFeatures(text: string): Map<number, number> {
  const result = new Map<number, number>();
  const words = text.match(/[\p{L}\p{N}]+/gu) ?? [];
  const features = [...words.map((word) => `w:${word}`)];
  for (let index = 0; index + 1 < words.length; index++) features.push(`b:${words[index]}_${words[index + 1]}`);
  const compact = `^${words.join('_')}$`;
  for (let size = 3; size <= 5; size++) {
    for (let index = 0; index + size <= compact.length; index++) features.push(`c:${compact.slice(index, index + size)}`);
  }
  for (const feature of features) {
    const id = hashFeature(feature);
    result.set(id, (result.get(id) ?? 0) + 1);
  }
  return result;
}

function idfFor(examples: readonly TrainingExample[]): Float32Array {
  const documentFrequency = new Uint32Array(FEATURE_DIMENSION);
  for (const example of examples) for (const id of rawFeatures(example.text).keys()) documentFrequency[id]++;
  return Float32Array.from(documentFrequency, (count) => Math.log((examples.length + 1) / (count + 1)) + 1);
}

function vector(text: string, idf: Float32Array): Map<number, number> {
  const raw = rawFeatures(text);
  let norm = 0;
  for (const [id, count] of raw) {
    const value = (1 + Math.log(count)) * (idf[id] ?? 1);
    raw.set(id, value);
    norm += value * value;
  }
  const scale = norm > 0 ? 1 / Math.sqrt(norm) : 1;
  for (const [id, value] of raw) raw.set(id, value * scale);
  return raw;
}

function softmax(scores: Float64Array): Float64Array {
  const max = Math.max(...scores);
  const probabilities = Float64Array.from(scores, (score) => Math.exp(score - max));
  const sum = probabilities.reduce((total, value) => total + value, 0);
  return Float64Array.from(probabilities, (value) => value / sum);
}

function linearPredictions(training: readonly TrainingExample[], labels: readonly EvaluationLabel[]): EvaluationPrediction[] {
  if (training.length < 2 || new Set(training.map((example) => example.classId)).size < 2) {
    throw new Error('Linear N-Gramme benötigen mindestens zwei Calibration-Klassen.');
  }
  const idf = idfFor(training);
  const weights = CLASSES.map(() => new Float32Array(FEATURE_DIMENSION));
  const biases = new Float32Array(CLASSES.length);
  const counts = new Map<EvaluationClassId, number>();
  for (const example of training) counts.set(example.classId, (counts.get(example.classId) ?? 0) + 1);
  const vectors = training.map((example) => ({
    features: vector(example.text, idf),
    classIndex: CLASSES.indexOf(example.classId),
    classWeight: Math.sqrt(training.length / (CLASSES.length * (counts.get(example.classId) ?? 1))),
  }));
  for (let epoch = 0; epoch < 30; epoch++) {
    const learningRate = 0.18 / (1 + epoch * 0.08);
    for (let offset = 0; offset < vectors.length; offset++) {
      const sample = vectors[(offset * 31 + epoch * 17) % vectors.length]!;
      const scores = new Float64Array(CLASSES.length);
      for (let classIndex = 0; classIndex < CLASSES.length; classIndex++) {
        let score = biases[classIndex] ?? 0;
        const classWeights = weights[classIndex]!;
        for (const [id, value] of sample.features) score += (classWeights[id] ?? 0) * value;
        scores[classIndex] = score;
      }
      const probabilities = softmax(scores);
      for (let classIndex = 0; classIndex < CLASSES.length; classIndex++) {
        const gradient = ((classIndex === sample.classIndex ? 1 : 0) - (probabilities[classIndex] ?? 0)) * sample.classWeight;
        biases[classIndex] = (biases[classIndex] ?? 0) + learningRate * gradient;
        const classWeights = weights[classIndex]!;
        for (const [id, value] of sample.features) classWeights[id] = (classWeights[id] ?? 0) + learningRate * (gradient * value - 0.0001 * (classWeights[id] ?? 0));
      }
    }
  }
  return labels.map((label) => {
    const features = vector(productText(label), idf);
    const scores = new Float64Array(CLASSES.length);
    for (let classIndex = 0; classIndex < CLASSES.length; classIndex++) {
      let score = biases[classIndex] ?? 0;
      for (const [id, value] of features) score += (weights[classIndex]?.[id] ?? 0) * value;
      scores[classIndex] = score;
    }
    const probabilities = softmax(scores);
    const bestIndex = probabilities.reduce((best, value, index) => value > (probabilities[best] ?? 0) ? index : best, 0);
    const classId = CLASSES[bestIndex] ?? 'other';
    return prediction(label.id, classId === 'other' ? null : classId, 'baseline:linear_ngram@1', probabilities[bestIndex] ?? 0);
  });
}

function prediction(labelId: number, categoryId: CanonicalCategoryId | null, version: string, confidence: number): EvaluationPrediction {
  const trace: CategoryTrace = {
    classifierVersion: version,
    input: { source: 'dump', dataVersion: null, categoryTags: [], normalizedName: null },
    candidates: [],
    rejectedCandidates: [],
    winner: { categoryId, source: null, classifierVersion: version },
    conflictReason: `baseline confidence=${confidence.toFixed(4)}`,
  };
  return { labelId, predictedCategoryId: categoryId, predictionSource: null, conflictReason: trace.conflictReason, trace };
}

async function robotoffPredictions(labels: readonly EvaluationLabel[]): Promise<EvaluationPrediction[]> {
  if (labels.length > 250) throw new Error('Robotoff-Runs sind aus Rücksicht auf die öffentliche API auf 250 Gold-Labels begrenzt.');
  const result: EvaluationPrediction[] = [];
  for (const label of labels) {
    const response = await fetch('https://robotoff.openfoodfacts.org/api/v1/predict/category', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'NutriTrackCategoryLab/1.0 (local baseline evaluation)' },
      body: JSON.stringify({ product: { product_name: label.name }, deepest_only: true, threshold: 0.2 }),
    });
    if (!response.ok) throw new Error(`Robotoff-Anfrage fehlgeschlagen (${response.status}).`);
    const raw: unknown = await response.json();
    const neural = raw && typeof raw === 'object' && !Array.isArray(raw) && Array.isArray((raw as { neural?: unknown }).neural)
      ? (raw as { neural: unknown[] }).neural
      : [];
    const tags = neural.flatMap((entry) => entry && typeof entry === 'object' && typeof (entry as { value_tag?: unknown }).value_tag === 'string'
      ? [(entry as { value_tag: string }).value_tag]
      : []);
    let maxConfidence = 0;
    for (const entry of neural) {
      if (entry && typeof entry === 'object' && typeof (entry as { confidence?: unknown }).confidence === 'number') {
        maxConfidence = Math.max(maxConfidence, (entry as { confidence: number }).confidence);
      }
    }
    const mapped = explainCategory({ name: '', categoryTags: tags, source: 'dump' });
    result.push(prediction(label.id, mapped.winner.categoryId as CanonicalCategoryId | null, 'baseline:robotoff@public', maxConfidence));
  }
  return result;
}

async function pythonPredictions(
  baselineId: Extract<BaselineId, 'fasttext' | 'setfit' | 'siglip'>,
  training: readonly TrainingExample[],
  labels: readonly EvaluationLabel[],
  imagePathForBarcode: (barcode: string | null) => string | null,
): Promise<EvaluationPrediction[]> {
  const python = pythonExecutable();
  if (!existsSync(python)) throw new Error(`ML-Python fehlt: ${python}`);
  const payload = {
    classes: CLASSES,
    train: training,
    test: labels.map((label) => ({ label_id: label.id, text: productText(label), imagePath: imagePathForBarcode(label.barcode) })),
  };
  const process = Bun.spawn([python, PYTHON_RUNNER, baselineId], { stdin: 'pipe', stdout: 'pipe', stderr: 'pipe', env: processEnv() });
  process.stdin.write(JSON.stringify(payload));
  process.stdin.end();
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  if (exitCode !== 0) throw new Error(stderr.trim() || `${baselineId} wurde mit Exit-Code ${exitCode} beendet.`);
  const rows = JSON.parse(stdout) as PythonPrediction[];
  return rows.map((row) => prediction(row.label_id, row.category_id === 'other' ? null : row.category_id, `baseline:${baselineId}@1`, row.confidence));
}

function processEnv(): Record<string, string> {
  const inherited = Object.fromEntries(Object.entries(process.env).flatMap(([key, value]) => value === undefined ? [] : [[key, value]]));
  const cacheRoot = process.env.CATEGORY_ML_CACHE?.trim() || path.join(ML_DATA_DIR, 'category-ml-cache');
  return {
    ...inherited,
    HF_HOME: process.env.HF_HOME?.trim() || path.join(cacheRoot, 'huggingface'),
    TORCH_HOME: process.env.TORCH_HOME?.trim() || path.join(cacheRoot, 'torch'),
  };
}

export async function runBaseline(
  baselineId: BaselineId,
  labels: readonly EvaluationLabel[],
  silverLabels: readonly EvaluationSilverLabel[],
  imagePathForBarcode: (barcode: string | null) => string | null,
): Promise<ModelResult> {
  const training = trainingExamples(labels, silverLabels, imagePathForBarcode);
  if (training.length === 0) throw new Error('Keine akzeptierten Calibration-Labels zum Trainieren vorhanden.');
  const version = `baseline:${baselineId}@1`;
  const fingerprint = createHash('sha256')
    .update(JSON.stringify({ baselineId, training: training.map(({ snapshotHash, classId }) => [snapshotHash, classId]) }))
    .digest('hex');
  if (baselineId === 'linear_ngram') return { version, fingerprint, predictions: linearPredictions(training, labels) };
  if (baselineId === 'robotoff') return { version, fingerprint, predictions: await robotoffPredictions(labels) };
  return { version, fingerprint, predictions: await pythonPredictions(baselineId, training, labels, imagePathForBarcode) };
}
