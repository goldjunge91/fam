# Password recovery hosting

This folder contains the static HTTPS fallback and association-file source for
the password-recovery route. The HTTPS URL only opens the app at code entry;
the password is changed after a six-digit email code is verified in the app.

## Domain and app configuration

`EXPO_PUBLIC_ACCOUNT_DOMAIN` is the single app-side hostname setting. It must
contain only a hostname, with no scheme, port, or path. The selected Cloudflare
test hostname is `account.test-tozzi.de`; replace it with the production
hostname before release. The app derives
`https://<hostname>/password-recovery`, adds the iOS Associated Domains entry,
and adds the Android App Link filter from that same value.

Set the final hostname in local build environments, EAS build profiles, and
the release environment before producing new native builds. A domain change
requires new iOS/Android builds and matching hosted files; it cannot be
delivered through an OTA update alone. Keep the local Supabase redirect
allow-list in `supabase/config.toml` and the hosted Supabase redirect allow-list
in sync with the selected hostname. The hosted project configuration is
separate from this repository and is not changed by editing local files.

## Static files

The test Worker serves `password-recovery/index.html` at `/password-recovery`;
it contains no password form or app bundle. It serves
`/.well-known/apple-app-site-association` with no redirect. The AASA file uses
the existing iOS Team ID and bundle ID from `app.json`.

`worker.mjs` is the small Cloudflare Worker entry point for those files. Its
multipart upload uses `worker.mjs` as the `main_module`, with content type
`application/javascript+module`. Add two `text/plain` module parts:
`password-recovery.html` from `password-recovery/index.html`, and
`apple-app-site-association.txt` from `.well-known/apple-app-site-association`.
The Worker returns the HTML and AASA content types at their public paths, and
currently returns 404 for Android's asset-links path. Use compatibility date
`2026-10-25` in the upload metadata.

## Test deployment

The test Worker `fam-password-recovery-test` is deployed in Cloudflare account
`6237d34314fccc45bf5b2522f1660e91`, zone
`8070e990009a0c3b26f658615ad937d5` (`test-tozzi.de`). Its Worker ID is
`id508d95cc08aa482680240a38ca168ed7`. The custom domain
`account.test-tozzi.de` is attached with ID
`id05963fd681b92253827f0c4fbb302ae830f3652`.

Live checks passed for the [recovery page](https://account.test-tozzi.de/password-recovery)
and [AASA file](https://account.test-tozzi.de/.well-known/apple-app-site-association):
GET and HEAD return 200 with the expected content types and no redirect, and
the page includes the `fam://` app link. The live AASA response matches the
repository source. Android's asset-links URL returns 404 as expected because
no real signing fingerprint is available yet. Cloudflare's default Python
`urllib` probe received BIC error 1010; the verification User-Agent
`fam-recovery-verification/1.0` passed. No Cloudflare security settings or
rules were changed.

Generate Android's `.well-known/assetlinks.json` only after retrieving the
actual SHA-256 signing fingerprint from Play App Signing (and any separately
distributed signing certificates). The repository deliberately does not make
up fingerprints:

```sh
ANDROID_SIGNING_CERT_SHA256='<real Play App Signing SHA-256 fingerprint>' \
  bun recovery-hosting/generate-assetlinks.mjs
```

The generator validates and normalizes one or more comma-separated SHA-256
fingerprints, then writes the JSON to stdout for review. Adding that output to
hosting also requires adding it to `worker.mjs` as a text module and serving
`/.well-known/assetlinks.json` with `application/json`; publishing the output
file alone will leave the current Worker response at 404. Upload the updated
Worker with the generated asset-links content as a text module.

## Supabase recovery email

The local template is `supabase/templates/recovery.html`; the local Supabase
config points its recovery template at that file. It displays `{{ .Token }}`
and links `{{ .RedirectTo }}`, the value passed by
`resetPasswordForEmail(email, { redirectTo })`. The redirect opens the code
entry screen and carries no recovery credentials. Copy the subject and
template into the hosted project's Authentication > Email Templates > Reset
Password, and configure the hosted SMTP provider before release. Local
`supabase/config.toml` does not update hosted Supabase settings or SMTP.

## Remaining release work

- The hosted Supabase project `ivvebtqasotqpikuydov` is still unchanged; dev
  and preview both point to it. Add the exact HTTPS recovery URL to its redirect
  allow-list, install the recovery template, and configure SMTP before testing
  the complete email flow.
- Retrieve real Android signing fingerprints, generate `assetlinks.json`, add
  it as a Worker text module and route, then deploy the updated Worker.
- Before production release, switch from the test hostname to the production
  hostname and update hosting, Supabase redirect settings, and native builds.
- Build and install signed iOS and Android apps for the chosen release hostname
  and verify cold-start and warm-start links on devices.
