import { readFile } from 'node:fs/promises';
import { describe, expect, it } from '@jest/globals';

const workflowPath = '.github/workflows/scrape-brochures.yml';

describe('Requested brochure scraper workflow', () => {
  it('runs on demand and validates manual postal-code requests', async () => {
    const workflow = await readFile(workflowPath, 'utf8');

    expect(workflow).not.toContain('schedule:');
    expect(workflow).not.toContain('cron:');
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain('TARGET_ZIP" =~ ^[0-9]{5}$');
    expect(workflow).toContain('A dry run requires one postal code.');
    expect(workflow).toContain('Read only pending app requests');
    expect(workflow).toContain("github.event_name == 'workflow_dispatch' && inputs.zip == ''");
  });

  it('limits concurrent scrapes to one running and one pending per postal code', async () => {
    const workflow = await readFile(workflowPath, 'utf8');

    expect(workflow).toContain('group: kaufda-brochure-${{ matrix.zip_code }}');
    expect(workflow).toContain('cancel-in-progress: false');
    expect(workflow).not.toContain('queue: max');
  });

  it('runs the current KaufDA scraper for queued requests and dry runs', async () => {
    const workflow = await readFile(workflowPath, 'utf8');

    expect(workflow).toContain('run: bun run scripts/scrapers/run-kaufda.ts --zip "$TARGET_ZIP"');
    expect(workflow).toContain('run: bun run scripts/scrapers/run-kaufda.ts --zip "$TARGET_ZIP" --dry-run');
    expect(workflow).toContain('SUPABASE_SECRET_KEY: ${{ secrets.SUPABASE_SECRET_KEY }}');
    expect(
      workflow.match(/GOOGLE_PLACES_API_KEY: \$\{\{ secrets\.GOOGLE_PLACES_API_KEY \}\}/g),
    ).toHaveLength(2);
    expect(workflow).toContain('Validate one postal code without database credentials');
  });
});
