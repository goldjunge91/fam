import type {
  EvaluationExportFile,
} from './import-export';
import type {
  EvaluationLabel,
  BaselineDefinition,
  BaselineId,
  CrowdSignal,
  CrowdSignalImportFile,
  CrowdSignalReview,
  EvaluationProduct,
  EvaluationRun,
  EvaluationRunDetail,
  EvaluationSilverLabel,
  RuleProposal,
  SilverReviewStatus,
  SaveEvaluationLabel,
  SaveCrowdSignalReview,
} from './types';

type HealthResponse = {
  ok: true;
  reviewer: { slug: string; displayName: string };
  classifierVersion: string;
  dumpReady: boolean;
  imageManifestReady: boolean;
  llmConfigured: boolean;
  llmModel: string;
};

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
      ? body.error
      : `API-Anfrage fehlgeschlagen (${response.status})`;
    throw new Error(message);
  }
  return body as T;
}

export function fetchEvaluationHealth(): Promise<HealthResponse> {
  return apiRequest('/health');
}

export function fetchEvaluationLabels(): Promise<EvaluationLabel[]> {
  return apiRequest('/labels');
}

export function exportEvaluationLabels(): Promise<EvaluationExportFile> {
  return apiRequest('/labels/export');
}

export function importEvaluationLabels(file: EvaluationExportFile): Promise<{ imported: number; labels: EvaluationLabel[] }> {
  return apiRequest('/labels/import', { method: 'POST', body: JSON.stringify(file) });
}

export function saveEvaluationLabel(label: SaveEvaluationLabel): Promise<EvaluationLabel> {
  return apiRequest('/labels', { method: 'PUT', body: JSON.stringify(label) });
}

export function fetchCrowdSignals(): Promise<CrowdSignal[]> {
  return apiRequest('/crowd-signals');
}

export function importCrowdSignals(file: CrowdSignalImportFile): Promise<{ imported: number; signals: CrowdSignal[] }> {
  return apiRequest('/crowd-signals/import', { method: 'POST', body: JSON.stringify(file) });
}

export function saveCrowdSignalReview(review: SaveCrowdSignalReview): Promise<CrowdSignalReview> {
  return apiRequest('/crowd-signal-reviews', { method: 'POST', body: JSON.stringify(review) });
}

export function deleteEvaluationLabel(productKey: string): Promise<{ deleted: true }> {
  return apiRequest(`/labels/${encodeURIComponent(productKey)}`, { method: 'DELETE' });
}

export function fetchEvaluationRuns(): Promise<EvaluationRun[]> {
  return apiRequest('/runs');
}

export function fetchBaselines(): Promise<BaselineDefinition[]> {
  return apiRequest('/baselines');
}

export function fetchRuleProposals(): Promise<RuleProposal[]> {
  return apiRequest('/rule-proposals');
}

export function createBaselineRun(baselineId: BaselineId): Promise<EvaluationRunDetail> {
  return apiRequest('/baselines/run', { method: 'POST', body: JSON.stringify({ baselineId }) });
}

export function fetchSilverLabels(): Promise<EvaluationSilverLabel[]> {
  return apiRequest('/silver-labels');
}

export function generateSilverLabels(products: EvaluationProduct[]): Promise<EvaluationSilverLabel[]> {
  return apiRequest('/silver-labels/generate', { method: 'POST', body: JSON.stringify({ products }) });
}

export function reviewSilverLabel(id: number, reviewStatus: Exclude<SilverReviewStatus, 'pending'>): Promise<EvaluationSilverLabel> {
  return apiRequest(`/silver-labels/${id}`, { method: 'PATCH', body: JSON.stringify({ reviewStatus }) });
}

export function createEvaluationRun(): Promise<EvaluationRunDetail> {
  return apiRequest('/runs', { method: 'POST' });
}

export function fetchEvaluationRun(runId: number): Promise<EvaluationRunDetail> {
  return apiRequest(`/runs/${runId}`);
}
