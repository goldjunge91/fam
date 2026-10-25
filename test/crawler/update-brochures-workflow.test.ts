import { readFile } from 'node:fs/promises';
import { describe, expect, it } from '@jest/globals';

const workflowPath = '.github/workflows/update-brochures.yml';
describe('restartable brochure workflow contract', () => {
  it('keeps the four retryable scan legs and immutable run-scoped artifacts', async () => {
    const workflow = await readFile(workflowPath, 'utf8');
    expect(workflow).toContain('fail-fast: false');
    expect(workflow).toContain('max-parallel: 4');
    expect(workflow).toContain('shard: [0, 1, 2, 3]');
    expect(workflow).toContain('brochure-scan-locations-${{ github.run_id }}-${{ matrix.shard }}');
    expect(workflow).toContain('overwrite: false');
    expect(workflow).toContain('retention-days: 30');
    expect(workflow.match(/BROCHURE_R2_STORAGE_BUDGET_GB: "8"/g)).toHaveLength(2);
    expect(workflow).toContain('--budget-bytes=8000000000');
  });
  it('keeps successful producers out of failed-phase retry paths and fails closed on gaps', async () => {
    const workflow = await readFile(workflowPath, 'utf8');
    expect(workflow).toContain("always() && github.ref == 'refs/heads/main'");
    expect(workflow).toContain('The scan merge requires all four shard artifacts');
    expect(workflow).toContain('needs: [validate-secrets, prepare-inputs, scan-locations]');
    expect(workflow).toContain("needs.scan-locations.result == 'success'");
    expect(workflow).toContain(
      "needs.validate-secrets.result == 'success' &&\n          needs.prepare-inputs.result == 'success'",
    );
    expect(workflow).toContain(
      "needs.validate-secrets.result == 'success' &&\n          needs.prepare-inputs.result == 'success' &&\n          needs.scan-merge.result == 'success'",
    );
    expect(workflow).toContain(
      "needs.validate-secrets.result == 'success' &&\n          needs.scan-merge.result == 'success' &&\n          needs.detail-pages.result == 'success'",
    );
    expect(workflow).toContain(
      "needs.validate-secrets.result == 'success' &&\n          needs.prepare-inputs.result == 'success' &&\n          needs.scan-merge.result == 'success' &&\n          needs.detail-pages.result == 'success' &&\n          needs.grouping.result == 'success'",
    );
    expect(workflow).toContain(
      "needs.validate-secrets.result == 'success' &&\n          needs.page-verification.result == 'success'",
    );
    expect(workflow).toContain(
      "needs.validate-secrets.result == 'success' &&\n          needs.scan-merge.result == 'success' &&\n          needs.page-verification.result == 'success' &&\n          needs.persistence.result == 'success'",
    );
    expect(workflow).toContain(
      "needs.validate-secrets.result == 'success' &&\n          needs.scan-merge.result == 'success' &&\n          needs.page-verification.result == 'success' &&\n          needs.persistence.result == 'success' &&\n          needs.report.result == 'success'",
    );
    expect(workflow).toContain('needs: [validate-secrets, page-verification]');
    expect(workflow).toContain('needs: [validate-secrets, scan-merge, detail-pages]');
    expect(workflow).toContain(
      'needs: [validate-secrets, prepare-inputs, scan-merge, detail-pages, grouping]',
    );
    expect(workflow).toContain(
      'needs: [validate-secrets, scan-merge, page-verification, persistence]',
    );
    expect(workflow).toContain('needs: publication-handoff');
    expect(workflow).not.toContain('needs: full-scan-and-verify');
    expect(workflow).toContain('brochure-publication-${{ github.run_id }}');
    expect(workflow).toContain('path: ${{ runner.temp }}/brochure-publication/');
    expect(workflow).toContain('--artifact-dir="${RUNNER_TEMP}/brochure-publication/phase"');
    expect(workflow).toContain('--bundle-dir="${RUNNER_TEMP}/brochure-publication/handoff"');
    expect(workflow).not.toContain('brochure-publication-phase-');
    expect(workflow).toContain('needs.publication-handoff.outputs.manifest_sha256');
  });
  it('offers a publisher-only cross-run resume contract with fail-closed source checks', async () => {
    const workflow = await readFile(workflowPath, 'utf8');
    expect(workflow).toContain('resume_run_id:');
    expect(workflow).toContain('actions: read');
    expect(workflow).toContain('Download publication handoff from source run');
    expect(workflow).toContain('github-token: ${{ secrets.GITHUB_TOKEN }}');
    expect(workflow).toContain('repository: ${{ github.repository }}');
    expect(workflow).toContain('run-id: ${{ inputs.resume_run_id }}');
    expect(workflow).toContain('digest-mismatch: error');
    expect(workflow).toContain('Veröffentlichungs-Handoff erstellen');
    expect(workflow).toContain('Vollständige Prospektverifikation');
    expect(workflow).toContain('only publish-canonical unsuccessful');
    expect(workflow).toContain('BROCHURE_VERIFY_BUDGET_BYTES: "8000000000"');
    expect(workflow).toContain('source_commit_sha');
    expect(workflow).toContain('predecessorManifestSha256 | type == "array" and length == 4');
    expect(workflow).toContain('inputs.resume_run_id == \'\'');
    expect(workflow).toContain('inputs.resume_run_id != \'\'');
  });
  it('keeps the eight-gigabyte verification and publication budgets aligned', async () => {
    const workflow = await readFile(workflowPath, 'utf8');
    expect(workflow.match(/BROCHURE_R2_STORAGE_BUDGET_GB: "8"/g)).toHaveLength(2);
    expect(workflow).toContain('--budget-bytes=8000000000');
    expect(workflow).toContain('BROCHURE_VERIFY_BUDGET_BYTES: "8000000000"');
  });
  it('passes detail phase digests from its step to downstream jobs', async () => {
    const workflow = await readFile(workflowPath, 'utf8');
    const detailPagesJob =
      workflow.match(/\n {2}detail-pages:\n([\s\S]*?)\n {2}grouping:/)?.[1] ?? '';
    expect(detailPagesJob).not.toBe('');
    expect(detailPagesJob).toContain(
      '    outputs:\n' +
        '      manifest_sha256: ${{ steps.create-manifest.outputs.manifest_sha256 }}\n' +
        '      predecessor_manifest_sha256: ${{ steps.create-manifest.outputs.predecessor_manifest_sha256 }}',
    );
  });
  it('documents native rerun operation and the domain-atomic verification limit', async () => {
    const workflow = await readFile(workflowPath, 'utf8');
    expect(workflow).toContain('Re-run failed jobs');
    expect(workflow).toContain('successful scan shards remain available');
    expect(workflow).toContain('not rerun scan or verification');
    expect(workflow).toContain('fails closed and never falls back to a new scan');
    expect(workflow).toContain(
      'Detail loading, grouping, and full page verification remain domain-atomic',
    );
  });
});
