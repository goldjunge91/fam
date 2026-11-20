# Legacy password-recovery hosting

> **Legacy documentation only.** This folder is not part of the active password-recovery path. Do not deploy or configure these Cloudflare resources for the current app flow.

The active recovery path uses Supabase Auth with Resend SMTP and the direct
`fam:///password-recovery` app link. The app also offers the six-digit code
from the recovery email as a manual fallback. This historical folder remains
only as reference for the retired HTTPS hosting approach.

## Historical domain and app configuration

The former HTTPS flow used `EXPO_PUBLIC_ACCOUNT_DOMAIN` as the hostname for an
app-link handler. The historical test hostname was `account.test-tozzi.de`.
That setting, its generated iOS Associated Domains entry, and its Android App
Link filter are no longer used by the app. Do not restore them for new builds.

A domain change in that retired flow required new native builds and matching
hosted files. The historical hosted Supabase redirect allow-list was separate
from this repository and was not changed by editing local files.

## Historical worker routes

`worker.mjs` contains the retired Cloudflare Worker entry point. It historically
handled `/password-recovery`, forwarded selected recovery parameters to
`fam:///password-recovery`, served the Apple association file, and displayed a
desktop guidance page. It did not verify, display, or forward recovery tokens
on the page.

The worker also contains the historical routes for
`/.well-known/apple-app-site-association` and the email icon. The AASA file uses
the existing iOS Team ID and bundle ID from `app.json`. Android asset-links
content was intentionally not invented without a real signing fingerprint.

No hosting or deployment action is part of this cleanup. Keep `worker.mjs`, the
association files, and the generated icon sources for historical reference only.

## Historical Supabase template notes

The active repository template is `supabase/templates/recovery.html`. It uses
`{{ .RedirectTo }}` with `{{ .TokenHash }}` for the direct app link and
`{{ .Token }}` for manual code entry. The hosted dashboard template and Resend
SMTP settings are configured separately and are not uploaded by this repository.

Earlier versions of this document described the retired HTTPS recovery link,
Cloudflare deployment, and hosted redirect settings. Those descriptions are
historical and must not be treated as current setup instructions.

## Retired release work

The following items belong to the retired hosting approach and are not active
work for the current recovery flow:

- retrieve real Android signing fingerprints and publish asset-links content;
- switch the retired test hostname to a production hostname;
- update retired hosting, redirect settings, and native builds;
- verify the retired hosted link on devices.
