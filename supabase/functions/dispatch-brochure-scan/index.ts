import { createBrochureDispatchHandler } from './handler.ts';

Deno.serve(
  createBrochureDispatchHandler({
    webhookSecret: Deno.env.get('BROCHURE_DISPATCH_WEBHOOK_SECRET'),
    githubToken: Deno.env.get('GITHUB_WORKFLOW_DISPATCH_TOKEN'),
  }),
);
