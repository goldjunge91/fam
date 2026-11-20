import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const template = readFileSync(
  join(process.cwd(), 'supabase', 'templates', 'recovery.html'),
  'utf8',
);

describe('recovery email template contract', () => {
  it('keeps the direct redirect link and the manual code in one template', () => {
    expect(template).toMatch(
      /href="\{\{ \.RedirectTo \}\}\?token_hash=\{\{ \.TokenHash \}\}&amp;type=recovery"/u,
    );
    expect(template).toMatch(
      />\{\{ \.RedirectTo \}\}\?token_hash=\{\{ \.TokenHash \}\}&amp;type=recovery<\/a>/u,
    );
    expect(template).toContain('{{ .Token }}');
    expect(template).not.toContain('{{ .ConfirmationURL }}');
  });
});
