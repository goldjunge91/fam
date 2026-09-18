type WebPaidEvent = {
  currency: string;
  precision: unknown;
  value: number;
};

/** Native AdMob initialization is intentionally a no-op on web. */
export async function initMobileAds(): Promise<void> {}

/** RevenueCat ad revenue tracking is intentionally a no-op on web. */
export async function trackAdRevenueToRevenueCat(_params: {
  adUnitId: string;
  adFormat?: string;
  paidEvent: WebPaidEvent;
  placement?: string;
}): Promise<void> {}
