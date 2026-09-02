# Release readiness

Use this reference for first releases, updates, hotfixes, and pre-submission audits.

## Build the matrix from evidence

Start with the release's actual feature surface. Inspect the app configuration, dependencies, entitlements, permissions, privacy manifests, environment selection, backend dependencies, in-app purchases, ads, analytics, account flows, support links, and existing release documentation. Do not mark a gate complete from memory or intent.

### Required gates

| Gate | Verify |
| --- | --- |
| Release identity | Bundle ID, app record, marketing version, unique build number, supported platforms, and device families all agree. |
| Build requirements | Current Apple SDK/Xcode/upload minimums are met. The distribution artifact is signed with the intended production entitlements and environment. |
| Runtime quality | Launch, onboarding, authentication, core workflows, offline/error paths, purchase/restore paths, notifications, deep links, and account deletion work on supported real devices as applicable. There are no known release-blocking crashes. |
| Completeness | No placeholder, beta, debug, staging, test-store, sample, or inaccessible content remains. Required backend services and reviewer dependencies will stay available during review. |
| Metadata fidelity | Product-page claims, screenshots, previews, age rating, category, pricing, availability, and in-app purchase descriptions match the submitted build. All URLs are public and functional. |
| Privacy | App Store privacy answers include the app and third-party SDKs. They agree with runtime behavior, consent flows, privacy manifests, tracking choices, privacy policy, retention, and deletion behavior. A privacy manifest does not replace App Store privacy answers. |
| Review access | Review contact details are current. A working demo account or approved full-featured demo mode is available when login is required. Review notes explain non-obvious setup, hardware, permissions, purchases, and feature access. |
| Commercial setup | Agreements, tax, banking, territories, price, subscriptions or in-app purchases, localization, and review assets are complete when applicable. Never ship a RevenueCat Test Store key. |
| Compliance | Export compliance, content rights, age rating, accessibility declarations, local trader/status obligations, and regulated-domain requirements are answered accurately. Escalate legal uncertainty instead of guessing. |
| Release control | The owner has chosen manual, automatic, scheduled, or phased release and understands the rollback or halt path. |

### Triggered reviews

Add these only when the feature exists:

- Account creation: verify in-app account deletion and the related data-deletion path.
- Third-party or social login: verify whether Sign in with Apple is required and that all login paths work.
- Subscriptions or purchases: verify products, pricing, terms, restore purchases, entitlement recovery, review visibility, and production store credentials.
- Tracking or personalized ads: reconcile ATT behavior, SDK collection, consent, privacy answers, and regional behavior.
- Health, nutrition, medications, children, finance, or other sensitive domains: verify data use, claims, disclaimers, minimum necessary access, and the applicable guideline sections.
- User-generated content or social features: verify moderation, reporting, blocking, and contact mechanisms.
- Camera, photos, location, notifications, background tasks, or Bluetooth: verify usage descriptions, denial paths, necessity, and declared capabilities.
- External content, web flows, or deep links: verify every reviewer-visible URL and fallback.

## Testing evidence

Prefer focused evidence over ceremonial checkbox completion:

- Record device and OS, build identifier, environment, tester, date, and result.
- Test the exact release artifact where possible, not only a development build.
- Review TestFlight crash and feedback signals before production submission.
- Treat untested critical flows as `NEEDS EVIDENCE`, not `PASS`.
- For a hotfix, narrow regression scope deliberately but still test launch, authentication, the fixed path, purchase access if affected, and safe upgrade from the prior store version.

## Readiness output

Keep blockers separate from improvements. Each row should state the evidence, not just `done`. A useful row looks like:

| Gate | Status | Evidence | Owner | Next action |
| --- | --- | --- | --- | --- |
| Review access | NEEDS EVIDENCE | Demo account listed, login not tested against production | Release owner | Validate credentials from a clean install and keep account active through review |

## Sources to refresh

- [App Review Guidelines, Before You Submit](https://developer.apple.com/app-store/review/guidelines/)
- [Submitting](https://developer.apple.com/app-store/submitting/)
- [Manage app privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/)
- [Platform version information](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information)
- [Perttu release checklist](https://perttu.dev/articles/checklist-for-releasing-apps), secondary checklist only
- [TestApp release playbooks](https://blog.testapp.io/app-store-release-checklist-playbooks/), secondary checklist-design inspiration only
