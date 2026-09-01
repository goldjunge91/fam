---
id: "test-and-launch/errors"
title: "Error Handling"
description: "This section assumes you've followed our Quickstart section of our Getting Started guide to install and configure our SDK."
permalink: "/docs/test-and-launch/errors"
slug: "errors"
version: "current"
original_source: "docs/test-and-launch/errors.mdx"
---

> **AI agents:** This is the Markdown version of a RevenueCat documentation page. For the complete documentation index, see [llms.txt](https://www.revenuecat.com/docs/llms.txt).

:::success
This section assumes you've followed our [Quickstart](https://www.revenuecat.com/docs/getting-started/quickstart) section of our Getting Started guide to install and configure our SDK.
:::

## Error Handling

If the completion callbacks or listeners on asynchronous methods receive an error argument that is not nil, an error has occurred.

With the exception of `NetworkError`, `PurchaseCancelledError` or `StoreProblemError`, retrying a failed operation with the same arguments won't succeed. For failed purchases, assume the user wasn't charged, unless a `StoreProblemError` occurred - in which case the user may or may not have been charged.

### iOS Errors

On iOS, when an error has occurred the completion callback will receive a `RevenueCat.ErrorCode` object.

When investigating or logging errors, review the `errorUserInfo` dictionary, paying attention to the following keys:

- `rc_code_name` contains a cross-platform error name string that can be used for identifying the error.
- `NSDebugDescriptionErrorKey` contains a description of the error. This description is meant for the developer.

#### Examples

```swift
if let error = error as? RevenueCat.ErrorCode {
  print(error.errorCode)
  print(error.errorUserInfo)

  switch error {
  case .purchaseNotAllowedError:
    showAlert("Purchases not allowed on this device.")
  case .purchaseInvalidError:
    showAlert("Purchase invalid, check payment source.")
  default: break
  }
} else {
  // Error is a different type
}
```

```objectivec
if (error) {

    // log error details
    NSLog(@"RCError: %@", [error.userInfo objectForKey:RCReadableErrorCodeKey]);
    NSLog(@"Message: %@", error.localizedDescription);
    NSLog(@"Underlying Error: %@", [error.userInfo objectForKey:NSUnderlyingErrorKey]);

    switch ([error code]) {
        case RCNetworkError:
            showError(@"Network error, check your connection and try again.");
        case RCPurchaseNotAllowedError:
            showError(@"Purchases not allowed on this device.");
        case RCPurchaseInvalidError:
            showError(@"Purchase invalid, check payment source.");
        default:
            break;
    }

}
```

### Android Errors

On Android, when an error has occurred, the `onError` listener will receive a `PurchasesError` object.

When investigating or logging errors, review the properties of `PurchasesError`:

- `code` contains the `PurchasesErrorCode` that can be used for identifying the error.
- `message` contains a description of the error. This description is meant for the developer.
- `underlyingErrorMessage ` contains a description of the underlying error that caused the error in question, if an underlying error is present.

#### Examples

```kotlin
with(error) {
    // log error details
    print("Error: $code")
    print("Message: $message")
    print("Underlying Error: $underlyingErrorMessage")
    when (code) {
        PurchasesErrorCode.PurchaseNotAllowedError -> {
            showAlert("Purchases not allowed on this device.")
        }
        PurchasesErrorCode.PurchaseInvalidError -> {
            showAlert("Purchase invalid, check payment source.")
        }
        else -> {}
    }
}
```

## Legend

When debugging errors, it's important to consider whether the error was thrown by RevenueCat, Apple, or Google. This can help you pinpoint where to look for a resolution.

| Icon | Description                     |
| ---- | ------------------------------- |
| 😿   | Error generated from RevenueCat |
| 🍎   | Error generated from Apple      |
| 🤖   | Error generated from Google     |
| 📦   | Error generated from Amazon     |

## Error codes common to all methods

#### 😿 `INVALID_APP_USER_ID`

**Problem:**
Indicates the [App User Id](https://www.revenuecat.com/docs/customers/user-ids) is set to an invalid value.

**Resolution:**
Make sure you're not sending a string over 100 characters or a [blocked app user Id](https://www.revenuecat.com/docs/customers/user-ids#blocked-app-user-ids).

***

#### 😿 🍎 🤖 📦 `INVALID_CREDENTIALS`

**Problem:**
Indicates the application has been configured with an invalid credentials.

**Resolution:**
If this error occurs before a purchase, ensure you're using the [correct API Key](https://www.revenuecat.com/docs/projects/authentication) from the RevenueCat dashboard.
If this error happens during the purchase flow, make sure your [Play Store Credentials](https://www.revenuecat.com/docs/service-credentials/creating-play-service-credentials) and/or [App Store Shared Secret](https://www.revenuecat.com/docs/service-credentials/itunesconnect-app-specific-shared-secret) and/or [Amazon Appstore Credentials](https://www.revenuecat.com/docs/service-credentials/amazon-appstore-credentials) are configured correctly in the RevenueCat dashboard.

***

#### 😿 `INVALID_SUBSCRIBER_ATTRIBUTES`

**Problem:**
Indicates attributes for a Customer were unable to be saved.

**Resolution:**
Make sure that there are no formatting issues when [setting attributes](https://www.revenuecat.com/docs/customers/customer-attributes#restrictions).

***

#### 😿 `NETWORK_ERROR`

**Problem:**
Indicates a network error occurred during the operation.

**Resolution:**
Make sure the device has an internet connection and try again. If you are testing in sandbox, make sure your outgoing connections is turned on. You can find this in XCode under signing & capabilities > App Sandbox > Outgoing connections (Client).

***

#### 😿 `OFFLINE_CONNECTION_ERROR`

**Problem:**
Indicates the device was offline when attempting a network request.

**Resolution:**
Make sure the device has an internet connection and try again.

***

#### 😿 `OPERATION_ALREADY_IN_PROGRESS`

**Problem:**\
Indicates an identical operation is already in progress. For example, making two identical purchase attempts at the same time.

**Resolution:**
Wait for the original operation to complete.

***

#### 🍎 🤖 📦 `STORE_PROBLEM`

**Problem:**
This error is forwarded from Apple/Google/Amazon and indicates there was a problem connecting to the App Store, Play Store, or Amazon Appstore.

The problems that will trigger this on iOS:

- Apple server is down (more common in sandbox than production)
- [SKErrorUnknown](https://developer.apple.com/documentation/storekit/skerrorcode/skerrorunknown)
- [SKErrorCloudServiceNetworkConnectionFailed](https://developer.apple.com/documentation/storekit/skerrorcode/skerrorcloudservicenetworkconnectionfailed)
- [SKErrorCloudServiceRevoked](https://developer.apple.com/documentation/storekit/skerrorcode/SKErrorCloudServiceRevoked)
- An [SCA purchase flow](https://developer.apple.com/support/psd2/) was initiated.

The problems that will trigger this on Android:

- Google server is down
- [Google Play Developer API Quota exceeded](https://developers.google.com/android-publisher/quotas)
- Invalid Android package name in the RevenueCat dashboard
- Google Billing Client [SERVICE_TIMEOUT](https://developer.android.com/reference/com/android/billingclient/api/BillingClient.BillingResponseCode#service_timeout) error

**Resolution:**
If everything was working while testing, you shouldn't have to do anything to handle this error in production. RevenueCat will automatically retry any purchase failures so no data is lost.

If this occurs while testing in sandbox you can try:

- Repeating the operation later.
- Create a new sandbox user on iOS.

***

#### 🤷 `SIGNATURE_VERIFICATION_FAILED`

**Problem:**
Indicates that the SDK detected a request was tampered.

**Resolution:**

- Ensure that a proxy is not modifying responses from our API.
- See [the docs](https://www.revenuecat.com/docs/customers/trusted-entitlements) for more information.

***

#### 😿 `UNEXPECTED_BACKEND_RESPONSE_ERROR`

**Problem:**
Indicates the SDK received an unexpected response from the server.

**iOS sub error codes:**

- `loginResponseDecoding`: Unable to decode response returned from login.
- `postOfferIdBadResponse`: Unable to decode response returned from posting offer for signing.
- `postOfferIdMissingOffersInResponse`: Missing offers from response returned from posting offer for signing.
- `postOfferIdSignature`: Signature error encountered in response returned from posting offer for signing.
- `getOfferUnexpectedResponse`: Unknown error encountered while getting offerings.
- `customerInfoNil`: Unable to instantiate a CustomerInfoResponse, CustomerInfo in response was nil.
- `customerInfoResponseParsing`: Unable to instantiate a CustomerInfoResponse due to malformed json.

**Resolution:**
[Report the error](https://www.revenuecat.com/support) with the full error object.

***

#### 😿 `UNKNOWN_BACKEND_ERROR`

**Problem:**
Indicates there was an unknown server error.

**Resolution:**
[Report the error](https://www.revenuecat.com/support) with the full error object.

***

#### 🤷 `UNKNOWN`

**Problem:**
Indicates an unknown error occurred. Possible causes:

- The subscriber has reached the maximum number of Apple receipts allowed. This can be an indication of an implementation error regarding identifying users. Take a look at our [best practices for identifying users](https://www.revenuecat.com/docs/customers/user-ids#aliasing) for common implementation mistakes.

**Resolution:**
Help us [fix it](https://www.revenuecat.com/jobs/).

***

## Purchasing Errors

#### 😿 `RECEIPT_ALREADY_IN_USE`

**Problem:**
Indicates there is an identical receipt already in use by another subscriber.

**Resolution:**
The user will either need to log in as the App User Id that already owns the receipt or [restore purchases](https://www.revenuecat.com/docs/getting-started/restoring-purchases) to re-sync the receipt with their current account. We recommend checking out the ['Transfer purchases'](https://www.revenuecat.com/docs/getting-started/restoring-purchases#transfer-purchases) restore behavior.

***

#### 🍎 🤖 📦 `INVALID_RECEIPT`

**Problem:**
Indicates the receipt is malformed or invalid.

**Resolution:**
This error indicates an error with configuration and usually occurs in the sandbox environment.

If testing with StoreKit Configuration Files:

- Follow [StoreKit test guide](https://www.revenuecat.com/docs/test-and-launch/sandbox/apple-app-store#ios-14-only-testing-on-the-simulator)
- Re-upload the StoreKit certificate after making any changes to products or code-signing
- All products in StoreKit file are listed in the [RevenueCat dashboard](https://www.revenuecat.com/docs/getting-started/entitlements#revenuecat-configuration)

Some other places to check:

- Bundle ID and [shared secret](https://www.revenuecat.com/docs/service-credentials/itunesconnect-app-specific-shared-secret) are set correctly for your app

***

#### 🍎 `INVALID_APPLE_SUBSCRIPTION_KEY`

**Problem:**
Indicates that the Apple Subscription Key is invalid or not present.

**Resolution:**
In order to provide Subscription Offers you must first generate a [subscription key](https://www.revenuecat.com/docs/subscription-guidance/subscription-offers/ios-subscription-offers#subscription-keys).

***

#### 🍎 `MISSING_RECEIPT_FILE`

**Problem:**
Indicates there is no receipt file available on the device. This is more common in sandbox testing.

**Resolution:**
Make sure you're signed into the device with a valid Apple account. In Sandbox, you may have to make a purchase to generate a receipt before attempting the operation. This error can occur fairly often in the sandbox environment. In sandbox a receipt is generated when a user makes a purchase and is saved against the sandbox account. While in production a receipt is generated when a user downloads the app and is saved against the Apple account.

***

#### 🍎 `INELIGIBLE_ERROR`

**Problem:**
Indicates that the user is ineligible for the specific Subscription Offer.

Some possible causes:

- User has already used this Offer
- Offer not available in specific region
- User has no current or previous subscription

**Resolution:**
If a user is not eligible for a Subscription Offer, be sure to update your UI to reflect normal pricing or terms. [`.paymentDiscount(...)`](https://www.revenuecat.com/docs/subscription-guidance/subscription-offers/ios-subscription-offers#fetch-payment-discount) is the best way to check for Subscription Offer eligibility. If you are testing in sandbox and already tested a purchase with that offer, you may want to [create a new sandbox user](https://www.revenuecat.com/docs/test-and-launch/sandbox/apple-app-store#create-a-sandbox-test-account) to try again.

***

#### 🍎 🤖 `INSUFFICIENT_PERMISSIONS_ERROR`

**Problem:**
Indicates the device does not have sufficient permissions to make in-app purchases.

**Resolution:**
Make sure you're signed into a physical device with a valid Apple or Google account that has permissions to make purchases.

***

#### 🍎 🤖 `PAYMENT_PENDING_ERROR`

**Problem:**
Additional action is required by the user before granting entitlement. For example, a user might choose to purchase your in-app product at a physical store using cash, a parental control on a child's device may require approval before purchasing, or the transaction may require [Strong Customer Authentication](https://developer.apple.com/support/sca/) (SCA) to be completed. This error message may include language that the payment is deferred.

**Resolution:**
Confirm to the user that they've started the pending purchase, and to complete it, they should follow instructions that are given to them from Apple or Google.

***

#### 🍎 `PRODUCT_ALREADY_PURCHASED`

#### 🤖 `ITEM_ALREADY_OWNED`

**Problem:**
Indicates that the product is already active for the user.

**Resolution:**
If testing in sandbox:

- Subscription IAP: Wait for the subscription to automatically cancel and try again.
- Non-subscription IAP: Create a new sandbox user.

If this occurs in production, make sure the user [restores purchases](https://www.revenuecat.com/docs/getting-started/restoring-purchases) to re-sync any transactions with their current App User Id.

***

#### 🍎 `PRODUCT_NOT_AVAILABLE_FOR_PURCHASE`

#### 🤖 `ITEM_UNAVAILABLE`

**Problem:**
Indicates the product is not available for purchase by the device or user.

**Resolution:**
Ensure you're attempting to purchase a product that's available for the device / user.

***

#### 🍎 🤖 `PURCHASE_CANCELLED`

**Problem:**
Indicates the user cancelled their purchase and was not charged.

On iOS, this can also mean the Apple account already owns the product. The user can [restore purchases](https://www.revenuecat.com/docs/getting-started/restoring-purchases) to re-sync any transactions with their current App User Id.

**Resolution:**
No action required. The user decided not to proceed with their in-app purchase.

***

#### 🍎 📦 `PURCHASE_INVALID`

#### 🤖 `DEVELOPER_ERROR`

**Problem:**
Indicates one of the provided arguments for the purchase was invalid, including the payment method.

The problems that will trigger this on Android:

- Google Billing Client [DEVELOPER_ERROR](https://developer.android.com/reference/com/android/billingclient/api/BillingClient.BillingResponseCode#developer_error)

The problems that will trigger this on iOS:

- [SKErrorInvalidOfferIdentifier](https://developer.apple.com/documentation/storekit/skerrorcode/skerrorinvalidofferidentifier)

**Resolution:**
Ensure the device payment method is valid and all arguments passed in are correct.

***

#### 🍎 🤖 `PURCHASE_NOT_ALLOWED`

**Problem:**
Indicates the device or user is not allowed to make the purchase.

The problems that will trigger this on Android:

- Google Billing Client [FEATURE_NOT_SUPPORTED](https://developer.android.com/reference/com/android/billingclient/api/BillingClient.BillingResponseCode#feature_not_supported)

The problems that will trigger this on iOS:

- [SKErrorPrivacyAcknowledgementRequired](https://developer.apple.com/documentation/storekit/skerrorcode/skerrorprivacyacknowledgementrequired)
- [SKErrorPaymentNotAllowed](https://developer.apple.com/documentation/storekit/skerror/2330535-paymentnotallowed)
- [SKErrorCloudServicePermissionDenied](https://developer.apple.com/documentation/storekit/skerror/2335083-cloudservicepermissiondenied)
- [SKErrorOverlayInvalidConfiguration](https://developer.apple.com/documentation/storekit/skerror/3656407-overlayinvalidconfiguration)
- [SKErrorUnsupportedPlatform](https://developer.apple.com/documentation/storekit/skerror/3689489-unsupportedplatform)
- [SKErrorIneligibleForOffer](https://developer.apple.com/documentation/storekit/skerror/3663443-ineligibleforoffer)
- [SKErrorClientInvalid](https://developer.apple.com/documentation/storekit/skerror/2330533-clientinvalid)

**Resolution:**
Make sure the device and user are allowed to make in-app purchases. Try the following troubleshooting steps:

- Make sure your device/emulator is completely updated.
- Try running on device. Sometimes the emulator glitches out and it must be restarted. Overall, testing on device is more reliable.
- Restart your device/emulator.
- Make sure you're logged in with a Google account.
- If you're running on an emulator, make sure it has Google Play installed.

***

## Restoring Errors

#### 🍎 🤖 `INVALID_RECEIPT`

**Problem:**
Indicates the receipt is malformed or invalid.

**Resolution:**
Receipt validation failed, no action required.

***

#### 🍎 `MISSING_RECEIPT_FILE`

**Problem:**
Indicates there is no receipt file available on the device. This is more common in sandbox testing.

**Resolution:**
Make sure you're signed into the device with a valid Apple account. For Sandbox testing, you may have to make a purchase to generate a receipt before attempting the operation. In Sandbox a receipt is generated when a user makes a purchase and is saved against the sandbox account. While in production a receipt is generated when a user downloads the app and is saved against the Apple account.

***

#### 📦 `ERROR_FINDING_RECEIPT_SKU`

**Problem:**
Indicates there is no SKU available from the token.

***

#### 📦 `ERROR_FETCHING_RECEIPTS`

**Problem:**
Indicates there was an error fetching receipts.

***

#### 📦 `ERROR_FETCHING_RECEIPT_INFO`

**Problem:**
Indicates there was an error fetching information about the receipt.

## Next Steps

- You're set up to handle errors, time to start [making purchases in sandbox →](https://www.revenuecat.com/docs/test-and-launch/sandbox)
