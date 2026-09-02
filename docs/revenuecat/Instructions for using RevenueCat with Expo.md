---
id: "getting-started/installation/expo"
title: "Expo"
description: "What is RevenueCat?"
permalink: "/docs/getting-started/installation/expo"
slug: "expo"
version: "current"
original_source: "docs/getting-started/installation/expo.mdx"
---

> **AI agents:** This is the Markdown version of a RevenueCat documentation page. For the complete documentation index, see [llms.txt](https://www.revenuecat.com/docs/llms.txt).

## What is RevenueCat?

RevenueCat provides a backend and SDKs that wrap StoreKit, Google Play Billing, and [RevenueCat Billing](https://www.revenuecat.com/docs/web/overview) to make implementing in-app and web purchases and subscriptions easy. With our SDK, you can build and manage your app business on any platform without having to maintain IAP infrastructure. You can read more about [how RevenueCat fits into your app](https://www.revenuecat.com/blog/where-does-revenuecat-fit-in-your-app) or you can [sign up free](https://app.revenuecat.com/signup) to start building.

## Introduction

Expo is a framework for building React Native apps. It's a popular choice for rapidly iterating on your app, while letting Expo take care of all the platform-specific code.

To use and test RevenueCat with Expo, you'll need to create an Expo development build. Follow the instructions below and learn more about Expo development builds [here](https://docs.expo.dev/develop/development-builds/introduction/).

:::info
This guide is specific to Expo, but you may also find our [React Native guide](https://www.revenuecat.com/docs/getting-started/installation/reactnative) useful.
:::

## Create an Expo development build

### Set up the Expo project

You can use an existing Expo project, or [create a new one](https://docs.expo.dev/get-started/create-a-project/).

This command will create a default project with example code, and install the Expo CLI as a dependency:

```sh
npx create-expo-app@latest
```

Change to the project directory:

```sh
cd <expo-project-directory>
```

Install the [expo-dev-client](https://docs.expo.dev/versions/latest/sdk/dev-client/):

```sh
npx expo install expo-dev-client
```

### Install RevenueCat's SDKs

Install RevenueCat's `react-native-purchases` for core functionality and `react-native-purchases-ui` for UI components like [Paywalls](https://www.revenuecat.com/docs/tools/paywalls), [Customer Center](https://www.revenuecat.com/docs/tools/customer-center), and more.

Either run:

```sh
npx expo install react-native-purchases react-native-purchases-ui
```

or update your package.json with the [latest package versions](https://github.com/RevenueCat/react-native-purchases/releases):

```json
{
  "dependencies": {
    "react-native-purchases": "latest_version",
    "react-native-purchases-ui": "latest_version"
  }
}
```

:::info
After installing RevenueCat's SDKs, you **must** run the full build process as described below in the `Testing your app` section to ensure all dependencies are installed. Hot reloading without building will result in errors, such as:

```
Invariant Violation: `new NativeEventEmitter()` requires a non-null argument.
```

:::

### RevenueCat Dashboard Configuration

#### Configure a new project

RevenueCat projects are top-level containers for your apps, products, entitlements, paywalls, and more. If you don't already have a RevenueCat project for your app, [create one here](https://www.revenuecat.com/docs/projects/overview).

#### Connect to a Store (Apple, Google, Web, etc.)

Depending on which platform you're building for, you'll need to connect your RevenueCat project to one, or multiple, stores. Set up your project's supported stores [here](https://www.revenuecat.com/docs/projects/connect-a-store).

#### Add Products

For each store you're supporting, you'll need to add the products you plan on offering to your customers. Set up your products for each store [here](https://www.revenuecat.com/docs/offerings/products/setup-index).

#### Create an Entitlement

An entitlement represents a level of access, features, or content that a customer is "entitled" to. When customers purchase a product, they're granted an entitlement. Create an entitlement [here](https://www.revenuecat.com/docs/getting-started/entitlements). Then, [attach your products](https://www.revenuecat.com/docs/getting-started/entitlements#attaching-products-to-entitlements) to your new entitlement.

#### Create an Offering

An offering is a collection of products that are "offered" to your customers on your paywall. Create an offering for your products [here](https://www.revenuecat.com/docs/offerings/overview).

#### Configure a Paywall

A paywall is where your customers can purchase your products. RevenueCat's Paywalls allow you to remotely build and configure your paywall without any code changes or app updates. Create a paywall [here](https://www.revenuecat.com/docs/tools/paywalls).

### RevenueCat SDK Configuration

#### Initialize the SDK

Once you've installed the RevenueCat SDK, you'll need to configure it. Add the following code to the entry point of your app and be sure to replace `<revenuecat_project_platform_api_key>` with your [project's API keys](https://www.revenuecat.com/docs/projects/authentication).

More information about configuring the SDK can be found [here](https://www.revenuecat.com/docs/getting-started/configuring-sdk).

**Expo**

```ts
import { Platform } from 'react-native';
import { useEffect } from 'react';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { GALAXY_BILLING_MODE } from 'react-native-purchases-store-galaxy';

//...

export default function App() {

  useEffect(() => {
    Purchases.setLogLevel(LOG_LEVEL.VERBOSE);

    if (Platform.OS === 'ios') {
      Purchases.configure({ apiKey: <revenuecat_project_apple_api_key> });
    } else if (Platform.OS === 'android') {
      Purchases.configure({ apiKey: <revenuecat_project_google_api_key> });

      // OR: if building for Amazon, be sure to follow the installation instructions then:
      Purchases.configure({ apiKey: <revenuecat_project_amazon_api_key>, useAmazon: true });

      // OR: if building for Galaxy Store, install react-native-purchases-store-galaxy, then:
      Purchases.configure({
        apiKey: <revenuecat_project_galaxy_api_key>,
        store: 'GALAXY',
        galaxyBillingMode: GALAXY_BILLING_MODE.TEST,
      });
    }

  }, []);
}
```

#### Identify a user and check subscription status

RevenueCat is the single source of truth for your customer's subscription status across all platforms. Learn more about the different ways to identify your customers to RevenueCat [here](https://www.revenuecat.com/docs/customers/identifying-customers).

Then, [check the customer's subscription status](https://www.revenuecat.com/docs/customers/customer-info) by fetching the [CustomerInfo object](https://www.revenuecat.com/docs/customers/customer-info#reference):

**Expo**

```ts
try {
  const customerInfo = await Purchases.getCustomerInfo();
  // access latest customerInfo
} catch (e) {
 // Error fetching customer info
}
```

and inspecting the `entitlements` object to see if the customer is subscribed to your entitlement:

**Expo**

```ts
if(typeof customerInfo.entitlements.active[<my_entitlement_identifier>] !== "undefined") {
  // Grant user "pro" access
}
```

#### Present a paywall

If the customer is not subscribed to your entitlement, you can present a paywall to them where they can purchase your products.

There are several ways to present a paywall in Expo, each with different use cases, so please review the [React Native Paywalls documentation](https://www.revenuecat.com/docs/tools/paywalls/displaying-paywalls#react-native).

### Testing your app

To test, we'll use EAS to build the app for the simulator. You'll need to sign up at [expo.dev](https://expo.dev) and use the account below.

For more information about EAS, see the [EAS docs](https://docs.expo.dev/tutorial/eas/introduction/).

:::info
You can also follow these instructions on Expo's docs: https://docs.expo.dev/tutorial/eas/configure-development-build/#initialize-a-development-build
:::

Get started by installing the EAS-CLI:

```sh
npm install -g eas-cli
```

Then login to EAS:

```sh
eas login
```

After logging in, initialize the EAS configuration:

```sh
eas init
```

Then run the following command, which will prompt you to select the platforms you'd like to configure for EAS Build.

```
eas build:configure
```

#### Testing on iOS simulator

Next, you'll need to update `eas.json` with the simulator build profile [as described here](https://docs.expo.dev/tutorial/eas/ios-development-build-for-simulators/).

Your `eas.json` file might look like this:

```json
{
  "cli": {
    "version": ">= 7.3.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {},
    "ios-simulator": {
      "extends": "development",
      "ios": {
        "simulator": true
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

Next, build the app for the simulator:

```
eas build --platform ios --profile ios-simulator
```

Building creates a container app with your installed dependencies. Once the build completes and you run it on the device (or simulator, in this case), the app will hot reload with your local changes during development.

Enter your app's bundle ID, matching your RevenueCat config and App Store Connect. Once the build completes, Expo will ask if you want to open the app in the simulator. Choose yes, and it'll launch the simulator with your app.

After your app is running, you'll need to start the Expo server:

```sh
npx expo start
```

Finally, choose the local development server in the iOS simulator.

#### Testing on Android device or emulator

To test on an Android device, you'll need to build the app for a physical device or Android emulator as described [here](https://docs.expo.dev/tutorial/eas/android-development-build/).

Please ensure that `developmentClient` in your `eas.json` file is set to true under the `build.development` profile. Then, build the app:

```sh
eas build --platform android --profile development
```

Enter your app's application ID matches your RevenueCat config and Google Play Console. Choose "Yes" when asked if you want to create a new Android Keystore.

Once the build completes, you can run the application on the device or emulator. To run the app on an [Android device](https://docs.expo.dev/tutorial/eas/android-development-build/#android-device), install [Expo Orbit](https://expo.dev/orbit), connect your device to your computer, and [select your device](https://docs.expo.dev/tutorial/eas/android-development-build/#android-device:~:text=and%20Install%20button.-,Expo%20Orbit,-allows%20for%20seamless) from the Orbit menu. Alternatively, use the [provided QR code method](https://docs.expo.dev/tutorial/eas/android-development-build/#android-device:~:text=and%20Install%20button.-,Expo%20Orbit,-allows%20for%20seamless).

To run the app on an [Android emulator](https://docs.expo.dev/tutorial/eas/android-development-build/#android-emulator), choose "Yes" in the terminal after the build completes.

After the app is running, you'll need to start the Expo server:

```sh
npx expo start
```

## Expo Go

[Expo Go](https://expo.dev/go) is a sandbox that allows you to rapidly prototype your app. While it doesn’t support running custom native code—such as the native modules required for in-app purchases—`react-native-purchases` includes a built-in **Preview API Mode** specifically for Expo Go.

When your app runs inside Expo Go, `react-native-purchases` automatically detects the environment and replaces native calls with JavaScript-level mock APIs. This allows your app to load and execute all subscription-related logic without errors, even though real purchases will not function in this mode.

This means you can still preview subscription UIs, test integration flows, and continue development without needing to build a custom development client immediately.

However, to fully test in-app purchases and access real RevenueCat functionality, you must use a [development build](https://www.revenuecat.com/docs/getting-started/installation/expo#create-an-expo-development-build).

## React Native Web Configuration

RevenueCat's React Native SDK supports web platforms, allowing you to manage subscriptions across React Native web, mobile, and desktop apps using the same SDK. This also applies to Expo projects that target web platforms.

### Web Product Configuration

To enable web purchases in your Expo app, you'll need to configure products using a [RevenueCat Billing app](https://www.revenuecat.com/docs/web/overview).

1. **Create a RevenueCat Billing App** in your RevenueCat project dashboard
2. **Configure your products** for web purchases

For detailed instructions on setting up web products and configuring RevenueCat Billing, see the [RevenueCat Billing Overview](https://www.revenuecat.com/docs/web/overview).

:::info[RevenueCat Billing vs In-App Purchases]
RevenueCat Billing is RevenueCat's billing engine for web purchases, which uses Stripe as the payment processor. This is separate from iOS/Android in-app purchases but integrates with the same RevenueCat entitlements system, allowing unified subscription management across platforms.
:::

### Current Limitations

When using the React Native SDK on web with Expo, keep in mind the following:

- **RevenueCat Billing Required**: Web purchases require RevenueCat Billing setup. Native iOS/Android in-app purchases cannot be processed through the web platform.
- **Payment Processing**: RevenueCat Billing purchases use Stripe as the payment processor through RevenueCat Billing.
- **Customer Portal**: Users can manage their web subscriptions through the RevenueCat-provided customer portal.
- **Platform Separation**: Web products must be configured separately from iOS/Android products in the RevenueCat dashboard, though entitlements can be shared across platforms.
- **User Identity**: For unified cross-platform subscriptions, ensure you're using the same `appUserID` across web and mobile platforms.
- **Unsupported operations**: There are some unsupported operations. Mainly operations `getProducts`, `purchaseProduct` or `restorePurchases` won't work on web environments.
