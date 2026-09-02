# Product page and growth

Use this reference for store metadata, screenshots, release notes, launch marketing, product page optimization, and custom product pages.

## Product-page brief

Before writing, extract:

- target user and the problem they are trying to solve;
- the single strongest value proposition;
- three to five benefits that are visibly supported by the current build;
- proof that can be substantiated;
- brand voice, priority locales, and search intent;
- subscription or purchase facts that must be disclosed accurately.

Do not invent superlatives, rankings, awards, user counts, savings, health outcomes, or privacy claims. Do not use competitor names, unauthorized trademarks, irrelevant terms, or keyword stuffing.

## Metadata checklist

Verify current field limits and editability in Apple documentation before finalizing. As a working structure:

| Field | Purpose | Quality check |
| --- | --- | --- |
| Name | Recognition and discovery | Memorable, easy to spell, distinctive, and connected to what the app does. |
| Subtitle | Compact value proposition | Adds meaning instead of repeating the name or making generic claims. |
| Promotional text | Timely message | Useful without a new binary where Apple permits; not treated as a search-ranking field. |
| Description | Conversion and understanding | Strong first sentence, concise overview, short benefit-led feature list, accurate purchase language, no region-fragile price claims. |
| Keywords | Search relevance | Locale-specific, relevant, comma-efficient, non-duplicative, and free of competitors or protected terms. |
| Category | Browsing context | The primary category is the best description of the app, not the least competitive category. |
| What's New | Update value | Specific user benefits in importance order, scaled to the size of the release. |
| URLs | Trust and support | Public, stable, localized when appropriate, and tested without an authenticated developer session. |

Apple currently describes a 30-character name and subtitle, 170-character promotional text, and 100-character keyword field. Recheck before delivery instead of treating these values as permanent.

## Release notes

Write for existing users, not engineers:

1. Lead with the most valuable visible change.
2. Explain the user benefit, not the implementation detail.
3. Be specific about meaningful fixes. Replace `bug fixes and improvements` with what is now more reliable, faster, or easier when that claim is verified.
4. Match detail to release size. A hotfix may need one sentence; a major update deserves a short prioritized list.
5. Use the product's established voice, but stay direct for security, billing, data-loss, or outage-related fixes.
6. Do not turn commit messages into customer copy or claim fixes that were not verified.

Produce one final version per locale and, when useful, a literal back-translation for review. Count characters mechanically before handoff.

## Screenshots and previews

Create an ordered story, not a feature inventory:

- The first assets must communicate the app's core promise because they can appear in search results.
- Give each screenshot one message and show real, current UI from the submitted build.
- Keep captions localized and legible at store scale.
- Cover distinct benefits in a natural product journey.
- Include dark mode only when it helps explain the experience.
- Avoid misleading device frames, status data, subscription states, permissions, or features.
- Verify Apple's current device-size, screenshot, preview-duration, audio, and localization specifications.

## Product page optimization

Use PPO to answer a measurable question about the default page, not as a launch blocker.

- Write a hypothesis, primary metric, locale, traffic allocation, and stopping rule before starting.
- Prefer one meaningful changed concept per treatment so the outcome is interpretable.
- Account for review lead time and the binary requirement for alternate icons.
- Do not declare a winner from early noise. Use App Analytics and Apple's confidence guidance.
- Record the result and either apply, reject, or iterate on the treatment.

Apple currently allows up to three treatments, one test at a time, and a maximum 90-day run. Recheck current limits before configuring a test.

## Custom product pages

Use a CPP only when a distinct audience, campaign, feature, season, or acquisition promise benefits from a tailored journey.

- Keep the ad or referral promise, screenshots, promotional text, and in-app destination consistent.
- Assign relevant, non-overlapping search intent when using CPP keywords.
- Add a deep link only when it is implemented, version-compatible, and tested with fallback behavior.
- Localize the whole journey, not only the headline.
- Submit CPP metadata for review and keep it separate from release-critical work when possible.

## Launch marketing

- Use Apple's official localized App Store badge artwork without modification.
- Write `App Store` with Apple's capitalization. Do not call it `Apple App Store` in customer-facing copy.
- Use Apple product names, images, trademark notices, and credit lines only as the current marketing guidelines allow.
- Link to the correct default or custom product page and test attribution or deep-link behavior.

## Sources to refresh

- [Creating your product page](https://developer.apple.com/app-store/product-page/)
- [Product page optimization](https://developer.apple.com/app-store/product-page-optimization/)
- [Custom product pages](https://developer.apple.com/app-store/custom-product-pages/)
- [Marketing resources and identity guidelines](https://developer.apple.com/app-store/marketing/guidelines/)
- [Writing great release notes](https://medium.com/@freddiewrites/writing-great-app-store-release-notes-3f4cf291e9aa), secondary writing guidance only
