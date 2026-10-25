# Password recovery hosting

This folder contains the HTTPS app-link redirect and association-file source
for password recovery. The email link carries Supabase's recovery token hash to
the app, where it is verified before the new-password form appears. The email
also contains the six-digit code for manual entry when it is opened on a
different device.

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

## Worker routes

The test Worker responds to `/password-recovery` with a no-store 302 redirect to
`fam:///password-recovery`, forwarding `token_hash` and `type=recovery` when
present. There is no browser recovery page. It serves
`/.well-known/apple-app-site-association` without a redirect. The AASA file
uses the existing iOS Team ID and bundle ID from `app.json`.

`worker.mjs` is the small Cloudflare Worker entry point. Its multipart upload
uses `worker.mjs` as the `main_module`, with content type
`application/javascript+module`. Add one `text/plain` module part:
`apple-app-site-association.txt` from `.well-known/apple-app-site-association`.
The Worker returns a 302 for the app-link path, serves the AASA file, and
currently returns 404 for Android's asset-links path. Use compatibility date
`2026-10-25` in the upload metadata.

## Test deployment

The test Worker `fam-password-recovery-test` is deployed in Cloudflare account
`6237d34314fccc45bf5b2522f1660e91`, zone
`8070e990009a0c3b26f658615ad937d5` (`test-tozzi.de`). Its Worker ID is
`id508d95cc08aa482680240a38ca168ed7`. The custom domain
`account.test-tozzi.de` is attached with ID
`id05963fd681b92253827f0c4fbb302ae830f3652`.

The redirect-only Worker is deployed. A probe to the recovery endpoint
returned `302` with the token hash forwarded to the app scheme, and the [AASA
file](https://account.test-tozzi.de/.well-known/apple-app-site-association)
returned `200`. Android's asset-links URL returns 404 because no real signing
fingerprint is available yet. Cloudflare's default Python
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
config points its recovery template at that file. The email link combines
`{{ .RedirectTo }}` with `{{ .TokenHash }}` and `type=recovery`. The app verifies
that token hash on an isolated recovery client. The same email contains
`{{ .Token }}` for manual code entry on another device; either credential can
be used once. The hosted recovery subject and template were updated through a
scoped Supabase CLI config push. The hosted redirect allow-list includes the
HTTPS recovery URL. Existing Resend SMTP settings were not changed.

## Remaining release work

- Retrieve real Android signing fingerprints, generate `assetlinks.json`, add
  it as a Worker text module and route, then deploy the updated Worker.
- Before production release, switch from the test hostname to the production
  hostname and update hosting, Supabase redirect settings, and native builds.
- Build and install signed iOS and Android apps for the chosen release hostname
  and verify cold-start and warm-start links on devices.
