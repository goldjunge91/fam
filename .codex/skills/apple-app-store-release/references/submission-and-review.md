# Submission and App Review

Use this reference for TestFlight, App Store Connect submission, release control, monitoring, and rejection handling.

## Submission sequence

### 1. Prove the candidate

- Freeze the intended app identity, version, build, environment, and release notes.
- Complete the readiness matrix and resolve required blockers.
- Upload the intended distribution build to TestFlight.
- Verify processing/compliance state, install it from TestFlight, and test the critical flows on supported real devices.
- Review tester feedback, crash signals, and known issues. A TestFlight upload is not an App Review submission.

### 2. Complete App Store Connect

Verify the selected build and current values for:

- product-page metadata and localizations;
- screenshots, previews, category, age rating, accessibility declarations, support URL, marketing URL, and privacy policy;
- App Privacy answers for the app and third-party SDKs;
- pricing, territories, agreements, tax, banking, subscriptions, and in-app purchases when applicable;
- export compliance and content-rights declarations;
- review contact, demo access, and reviewer notes;
- release control and phased-release choice.

Reviewer notes should be short and operational. Explain where to find non-obvious features, how to reach purchase or restore paths, required permissions or hardware, and any test data. Keep passwords out of repository artifacts and enter them through the intended secure store field.

### 3. Submit with an explicit approval boundary

Before `Submit for Review`, show the user:

- app and platform;
- version and exact build;
- included review items such as subscriptions, in-app purchases, custom product pages, or PPO tests;
- unresolved non-blocking risks;
- release mode after approval.

Wait for explicit authorization. Adding an item for review can create a draft, but Apple does not receive it until the submission is sent. All items grouped in a submission must be accepted for that submission to complete.

### 4. Monitor without noise

Track state changes and new App Review messages. Report only a meaningful transition, action request, or new evidence. Keep reviewer access and production services available through the review window.

After approval, respect the selected release mode. Manual release is a new external mutation and needs authorization unless the user already granted it. For a phased release, define which crash, support, purchase, or backend signal would justify pausing it.

## Rejection or unresolved issues

Do not immediately resubmit.

1. Preserve the exact Apple message, guideline reference, affected item, build, and timestamp.
2. Reproduce or inspect the cited behavior against the submitted build.
3. Separate a real product defect, metadata mismatch, reviewer-access problem, policy interpretation, and reviewer misunderstanding.
4. Respond with concise facts, exact navigation steps, and supporting evidence. Avoid argumentative or speculative language.
5. Change only what resolves the verified issue. If Apple appears to misunderstand an already-compliant behavior, answer the question before changing the product.
6. Re-run affected readiness gates and obtain approval before resubmitting.

When an item in a grouped submission is rejected, Apple may require editing and resubmitting or removing that item before accepted items can complete. Verify current App Store Connect behavior before acting.

## Release operations and rollback thinking

- A binary already installed on devices cannot be remotely rolled back through App Store Connect.
- A new corrective build usually requires another review. Keep a hotfix plan realistic.
- Phased release can limit new exposure but does not remove the version from users who already received it.
- Server-side feature flags or kill switches are useful only if they already exist, are tested, and do not create misleading review behavior.
- Do not silently switch pricing, product availability, privacy behavior, or production services during review.

## Sources to refresh

- [Submit an app](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-app)
- [Overview of submitting for review](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/overview-of-submitting-for-review)
- [Upload builds](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds)
- [Manage a submission with unresolved issues](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/manage-a-submission-with-unresolved-issues)
- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Submitting](https://developer.apple.com/app-store/submitting/)
