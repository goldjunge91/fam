import { readFile } from 'node:fs/promises';
import { describe, expect, it } from '@jest/globals';

const workflowPath = '.github/workflows/update-brochures.yml';

describe('regional brochure metadata workflow', () => {
  it('keeps four run-bound listing scan shards and validates their complete merge', async () => {
    const workflow = await readFile(workflowPath, 'utf8');

    expect(workflow).toContain('fail-fast: false');
    expect(workflow).toContain('max-parallel: 4');
    expect(workflow).toContain('shard: [0, 1, 2, 3]');
    expect(workflow).toContain('brochure-scan-locations-${{ github.run_id }}-${{ matrix.shard }}');
    expect(workflow).toContain('The merge requires all four exact ZIP shards and rejects gaps or overlap.');
    expect(workflow).toContain('overwrite: false');
    expect(workflow).toContain('retention-days: 30');
  });

  it('keeps regional detail metadata and publishes original Bring URLs without R2 image storage', async () => {
    const workflow = await readFile(workflowPath, 'utf8');

    expect(workflow).toContain('Fetch or reuse regional detail metadata');
    expect(workflow).toContain('SUPABASE_URL: ${{ secrets.SUPABASE_URL || secrets.EXPO_PUBLIC_SUPABASE_URL }}');
    expect(workflow).toContain('SUPABASE_SECRET_KEY: ${{ secrets.SUPABASE_SECRET_KEY || secrets.SUPABASE_SERVICE_ROLE_KEY }}');
    expect(workflow).toContain('Persist regional metadata catalog');
    expect(workflow).toContain('Publish regional brochure metadata to Supabase');
    expect(workflow).not.toContain('verify-full-brochures.ts');
    expect(workflow).not.toContain('BROCHURE_VERIFY_BUDGET_BYTES');
    expect(workflow).not.toContain('BROCHURE_R2_STORAGE_BUDGET_GB');
    expect(workflow).not.toContain('R2_');
    expect(workflow).not.toContain('cleanup-demand-cache');
  });

  it('resumes only a failed Supabase publication from its unchanged metadata handoff', async () => {
    const workflow = await readFile(workflowPath, 'utf8');

    expect(workflow).toContain('resume_run_id:');
    expect(workflow).toContain('actions: read');
    expect(workflow).toContain('Download metadata handoff from source run');
    expect(workflow).toContain('github-token: ${{ secrets.GITHUB_TOKEN }}');
    expect(workflow).toContain('repository: ${{ github.repository }}');
    expect(workflow).toContain('run-id: ${{ inputs.resume_run_id }}');
    expect(workflow).toContain('digest-mismatch: error');
    expect(workflow).toContain('only the Supabase publisher unsuccessful');
    expect(workflow).toContain('predecessorManifestSha256 | type == "array" and length == 4');
    expect(workflow).toContain('inputs.resume_run_id != \'\'');
  });

});
