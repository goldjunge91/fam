---
name: apple-app-store-release
description: Prepare and guide iOS App Store releases, including release-readiness audits, product-page metadata, TestFlight, App Review, submission, release notes, and post-launch optimization. Use for a first release, update, hotfix, rejection response, or App Store listing work. Do not use for Google Play-only releases.
---

# App Store Release

Help the user reach a defensible App Store release decision, prepare the required artifacts, and execute only the release actions they explicitly authorize.

## Source policy

Apple's current documentation is authoritative. At the start of release work, browse the relevant Apple pages and record the access date in the release report. Always recheck:

- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Submitting](https://developer.apple.com/app-store/submitting/), especially current SDK and upload requirements
- [App Store Connect Help](https://developer.apple.com/help/app-store-connect/), for current fields, roles, statuses, and submission steps
- [Product page guidance](https://developer.apple.com/app-store/product-page/), when preparing metadata or creative assets

Treat third-party checklists as prompts for verification, not policy. If sources disagree, follow Apple. Label inference separately from sourced requirements.

If an App Store Review connector is available, use its read-only audit capabilities as supporting evidence. The connector is optional and never overrides Apple's documentation. Do not install or require it merely to run this skill.

## Route the request

Read only the references needed for the request:

- For a launch or update readiness audit, read [release-readiness.md](references/release-readiness.md).
- For name, subtitle, description, keywords, screenshots, release notes, product page optimization, custom product pages, or launch marketing, read [product-page-and-growth.md](references/product-page-and-growth.md).
- For TestFlight, App Review, submission, release control, monitoring, or rejection handling, read [submission-and-review.md](references/submission-and-review.md).
- In this repository, read [fam-eas-release.md](references/fam-eas-release.md) before suggesting or running any build or submit command.

## Establish the release frame

Inspect available project and store state before asking questions. Determine:

- first release, normal update, hotfix, TestFlight-only, metadata-only, or optimization experiment;
- target app, platform, version, build, locales, territories, and intended release date;
- monetization, login, account creation, sensitive data, tracking, ads, user-generated content, background behavior, and regulated features that trigger extra review checks;
- intended release control: manual, automatic, scheduled, or phased;
- which evidence exists and which claims remain unverified.

Ask only for facts that cannot be discovered safely. Never request secrets in chat when the user can enter them directly in App Store Connect or a secret manager.

## Work in gates

Use these statuses for every material check:

- `PASS`: verified by current evidence.
- `BLOCKED`: a release requirement is unmet.
- `NEEDS EVIDENCE`: plausible, but not verified.
- `NEEDS CONFIRMATION`: an external or costly action awaits user approval.
- `OPTIONAL`: worthwhile but not required for this release.

Do not call a release ready while any required item is `BLOCKED` or `NEEDS EVIDENCE`. Keep optimization ideas from blocking a compliant release.

Distinguish these separate mutations:

1. Building an artifact.
2. Uploading it to App Store Connect or TestFlight.
3. Adding items to a review submission.
4. Clicking or invoking Submit for Review.
5. Releasing an approved version.

Authorization for one step does not authorize the next. Builds may consume paid EAS capacity. Confirm immediately before each unapproved mutation, and identify the exact app, version, build, profile, and expected effect.

## Produce a release dossier

For a full release, return a compact dossier with:

1. `Verdict`: Ready, Not ready, or Ready after confirmation.
2. `Identity`: app, bundle ID, version, build, release type, locales, and release control.
3. `Blockers`: only issues that prevent the requested release.
4. `Readiness matrix`: gate, status, evidence, owner, and next action.
5. `Store artifacts`: final metadata, release notes, screenshot plan, review notes, URLs, and localization gaps.
6. `Execution plan`: exact ordered commands or App Store Connect actions, with approval boundaries.
7. `Post-submit watch`: status, review messages, crash/feedback signals, and release decision.
8. `Sources checked`: direct links and access date.

Match the user's language. Keep App Store copy concise, factual, and audience-facing. In marketing copy, follow Apple's naming rules and write `App Store`, not `Apple App Store`.

## Safety and scope

- Never expose API keys, signing credentials, app-specific passwords, or demo-account passwords in reports, commits, logs, issues, or pull requests.
- Never invent compliance answers, privacy disclosures, age ratings, export classifications, test results, screenshots, customer claims, or reviewer credentials.
- Do not change code, app configuration, metadata, pricing, availability, subscriptions, or release settings unless the user requested that change.
- A rejected submission is a diagnosis task until the user asks for a fix or resubmission.
- Preserve an auditable record of what was verified, what changed, who approved submission, and which build was submitted without copying secrets.
