---
id: "getting-started/configuring-sdk/ios-app-extensions"
title: "iOS App Extensions"
description: "App Extensions in iOS are an important component of the iOS ecosystem that are supported by RevenueCat. The most popular use of App Extensions for subscription apps are Today Widgets and iMessage apps."
permalink: "/docs/getting-started/configuring-sdk/ios-app-extensions"
slug: "ios-app-extensions"
version: "current"
original_source: "docs/getting-started/configuring-sdk/ios-app-extensions.mdx"
---

> **AI agents:** This is the Markdown version of a RevenueCat documentation page. For the complete documentation index, see [llms.txt](https://www.revenuecat.com/docs/llms.txt).

[App Extensions](https://developer.apple.com/app-extensions/) in iOS are an important component of the iOS ecosystem that are supported by RevenueCat. The most popular use of App Extensions for subscription apps are Today Widgets and iMessage apps.

Other target types, such as [App Clips](https://developer.apple.com/documentation/appclip) and [watchOS Apps](https://developer.apple.com/documentation/watchos-apps) are not app extensions, but can also be integrated with RevenueCat. Simply use the same public API key from your main RevenueCat project — there is no need to create an additional one.

:::warning[Purchases aren't allowed on extensions]
Even though you can configure the SDK, it's just read-only. Purchasing will not work because extensions don't have access to the parent's app Bundle and therefore can't extract the receipt after a purchase
:::

## Configuring for App Extensions

To enable data sharing between the main app and extensions, you'll need to use Xcode or the Developer portal to [enable app groups for the containing app and its contained app extensions](https://developer.apple.com/library/archive/documentation/General/Conceptual/ExtensibilityPG/ExtensionScenarios.html#//apple_ref/doc/uid/TP40014214-CH21-SW1). Then, [register the app group in the portal](https://developer.apple.com/library/archive/documentation/Miscellaneous/Reference/EntitlementKeyReference/Chapters/EnablingAppSandbox.html#//apple_ref/doc/uid/TP40011195-CH4-SW19) and specify the app group to use in the containing app. If you are building a Safari extension, you will need to configure and interact with the RevenueCat SDK in the Swift code, rather than in the Javascript code.

After you enable app groups, you will be able to access a user's active subscriptions in your App Extension by configuring *Purchases* with a custom UserDefaults that's shared across your App Extension.

**Swift**

```swift
Purchases.configure(
  with: Configuration.Builder(withAPIKey: <your_api_key)
    .with(appUserID: <app_user_id>)
    .with(userDefaults: .init(suiteName: <group.your.bundle.here>))
    .build()
)
```

Now the app extension and parent app can both use the a shared UserDefaults suite.
