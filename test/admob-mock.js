const React = require('react');
const { View } = require('react-native');

const BannerAd = (props) => {
  return React.createElement(View, { testID: 'admob-banner-ad', ...props });
};

const TestIds = {
  BANNER: 'ca-app-pub-3940256099942544/6300978111',
  INTERSTITIAL: 'ca-app-pub-3940256099942544/1033173712',
  REWARDED: 'ca-app-pub-3940256099942544/5224354917',
  REWARDED_INTERSTITIAL: 'ca-app-pub-3940256099942544/6978759866',
  APP_OPEN: 'ca-app-pub-3940256099942544/9257395921',
};

const BannerAdSize = {
  BANNER: 'BANNER',
  FULL_BANNER: 'FULL_BANNER',
  LARGE_BANNER: 'LARGE_BANNER',
  LEADERBOARD: 'LEADERBOARD',
  MEDIUM_RECTANGLE: 'MEDIUM_RECTANGLE',
  ADAPTIVE_BANNER: 'ADAPTIVE_BANNER',
  ANCHORED_ADAPTIVE_BANNER: 'ANCHORED_ADAPTIVE_BANNER',
  INLINE_ADAPTIVE_BANNER: 'INLINE_ADAPTIVE_BANNER',
  WIDE_SKYSCRAPER: 'WIDE_SKYSCRAPER',
};

const RevenuePrecisions = {
  UNKNOWN: 0,
  ESTIMATED: 1,
  PUBLISHER_PROVIDED: 2,
  PRECISE: 3,
};

const AdEventType = {
  LOADED: 'loaded',
  ERROR: 'error',
  OPENED: 'opened',
  CLICKED: 'clicked',
  CLOSED: 'closed',
};

const RewardedAdEventType = {
  LOADED: 'loaded',
  EARNED_REWARD: 'earned_reward',
};

const mockAdInstance = {
  load: jest.fn(),
  show: jest.fn().mockResolvedValue(undefined),
  addAdEventListener: jest.fn(() => jest.fn()),
  removeAllListeners: jest.fn(),
};

const InterstitialAd = {
  createForAdRequest: jest.fn(() => mockAdInstance),
};

const RewardedAd = {
  createForAdRequest: jest.fn(() => mockAdInstance),
};

const RewardedInterstitialAd = {
  createForAdRequest: jest.fn(() => mockAdInstance),
};

const AppOpenAd = {
  createForAdRequest: jest.fn(() => mockAdInstance),
};

const useInterstitialAd = jest.fn((adUnitId) => ({
  isLoaded: Boolean(adUnitId),
  isOpened: false,
  isClosed: false,
  error: undefined,
  load: jest.fn(),
  show: jest.fn(),
}));

const mobileAds = jest.fn(() => ({
  initialize: jest.fn().mockResolvedValue([{ state: 1, description: 'Google Mobile Ads SDK is initialized.' }]),
  setRequestConfiguration: jest.fn().mockResolvedValue(undefined),
}));

module.exports = {
  __esModule: true,
  default: mobileAds,
  BannerAd,
  BannerAdSize,
  RevenuePrecisions,
  TestIds,
  AdEventType,
  RewardedAdEventType,
  InterstitialAd,
  RewardedAd,
  RewardedInterstitialAd,
  AppOpenAd,
  useInterstitialAd,
  useRewardedAd: jest.fn(),
  useRewardedInterstitialAd: jest.fn(),
  useAppOpenAd: jest.fn(),
  useForeground: jest.fn(),
};
