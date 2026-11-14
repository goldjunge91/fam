// Entry point for Expo Router + Unistyles v3.
// Unistyles must be initialized before any StyleSheet.create call.
// The background task must be defined before Expo Router evaluates the app tree.
// StyleSheet.configure lives in src/components/theme/index.ts (fam-978.7).
// This file ensures the import order is correct for Expo Router's static rendering.
import './components/theme/index';
import './lib/sync/remote-background-sync';
import 'expo-router/entry';
