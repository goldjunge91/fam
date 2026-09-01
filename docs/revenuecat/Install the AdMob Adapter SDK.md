---
id: "getting-started/adapter-sdks/admob"
title: "Install the AdMob Adapter SDK"
description: "This feature is currently in beta."
permalink: "/docs/getting-started/adapter-sdks/admob"
slug: "admob"
version: "current"
original_source: "docs/getting-started/adapter-sdks/admob.mdx"
---

> **AI agents:** This is the Markdown version of a RevenueCat documentation page. For the complete documentation index, see [llms.txt](https://www.revenuecat.com/docs/llms.txt).

:::warning[Beta Feature]
This feature is currently in beta.
:::

:::warning[Enable Impression-Level Ad Revenue in AdMob]
You must enable **"Impression-level ad revenue"** in your AdMob account before RevenueCat can receive ad revenue events. Follow [Google's guide to turn on impression-level ad revenue](https://support.google.com/admob/answer/11322405).
:::

The RevenueCat AdMob adapter wraps standard AdMob ad loading calls so RevenueCat can track ad events automatically. Install it once for your platform, then follow the [AdMob SDK Integration guide](https://www.revenuecat.com/docs/ad-monetization/admob) to start tracking ads with `loadAndTrack`.

## Requirements

#### iOS

- **Minimum iOS version**: iOS 15.0+
- **RevenueCat SDK**: `purchases-ios` 5.0.0+
- **AdMob SDK**: Google Mobile Ads SDK 12.0.0+
- **Swift only**: This adapter does not expose Objective-C entrypoints. Use RevenueCat's base `AdTracker` APIs directly for Objective-C integrations.

#### Android

- **Minimum SDK**: `purchases-android` 8.0.0+
- **AdMob SDK**: Google Mobile Ads SDK 22.0.0+

## Installation

#### iOS

Add the AdMob adapter package via Swift Package Manager:

```swift
.package(url: "https://github.com/RevenueCat/purchases-ios-admob", from: "5.0.0")
```

Then add the `RevenueCatAdMob` product to your target.

:::info SPM Dependency Note
If your project depends on RevenueCat via SPM, use the [`purchases-ios-spm`](https://github.com/RevenueCat/purchases-ios-spm) package (not `purchases-ios`). The adapter declares this dependency correctly, but if you add RevenueCat separately, make sure both resolve from the same `purchases-ios-spm` repository to avoid duplicate package errors.
:::

#### Android

Add the AdMob adapter module to your app's `build.gradle`:

```gradle
dependencies {
    implementation 'com.revenuecat.purchases:purchases-admob:8.0.0+'
}
```

This module depends on the RevenueCat Purchases SDK and Google Mobile Ads SDK.

## Next Steps

Once the adapter is installed, follow the integration guide:

- [AdMob SDK Integration](https://www.revenuecat.com/docs/ad-monetization/admob)
