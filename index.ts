// Entry point for Expo Router + Unistyles v3.
// Unistyles must be initialized before any StyleSheet.create call.
// StyleSheet.configure lives in src/components/theme/index.ts (fam-978.7).
// This file ensures the import order is correct for Expo Router's static rendering.
import './src/components/theme/index';
import 'expo-router/entry';
