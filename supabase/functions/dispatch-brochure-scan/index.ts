import { createBrochureDispatchHandler } from './handler.ts';
import { withRequestId } from '../_shared/http.ts';

Deno.serve(
  withRequestId(
    'dispatch-brochure-scan',
    createBrochureDispatchHandler({
      webhookSecret: Deno.env.get('BROCHURE_DISPATCH_WEBHOOK_SECRET'),
      githubToken: Deno.env.get('GITHUB_WORKFLOW_DISPATCH_TOKEN'),
    }),
  ),
);
