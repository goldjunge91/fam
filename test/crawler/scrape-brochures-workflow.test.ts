import { readFile } from 'node:fs/promises';
import { describe, expect, it } from '@jest/globals';

const workflowPath = '.github/workflows/scrape-brochures.yml';

describe('Requested brochure scraper workflow', () => {
  it('runs on schedule and validates manual postal-code requests', async () => {
    const workflow = await readFile(workflowPath, 'utf8');

    expect(workflow).toContain("cron: '*/15 * * * *'");
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain('TARGET_ZIP" =~ ^[0-9]{5}$');
    expect(workflow).toContain('A dry run requires one postal code.');
    expect(workflow).toContain('Read only pending app requests');
  });

  it('runs the current KaufDA scraper for queued requests and dry runs', async () => {
    const workflow = await readFile(workflowPath, 'utf8');

    expect(workflow).toContain('run: bun run scripts/scrapers/run-kaufda.ts --zip "$TARGET_ZIP"');
    expect(workflow).toContain('run: bun run scripts/scrapers/run-kaufda.ts --zip "$TARGET_ZIP" --dry-run');
    expect(workflow).toContain('SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY || secrets.SUPABASE_SECRET_KEY }}');
    expect(workflow).toContain('Validate one postal code without database credentials');
  });
});
