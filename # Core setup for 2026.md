# Core setup for 2026
https://github.com/xavia-io/xavia-ota
https://github.com/TanayK07/expo-react-native-cicd
## Local data persistence (offline/local state)

Expo SQLite for local database.
Drizzle (TypeScript-first schema, generates SQL via CLI) for easier SQL with Expo SQLite; includes Drizzle Studio for debugging. https://orm.drizzle.team/docs/get-started/expo-new#get-started-with-drizzle-and-expo
React Native MMKV for simple, fast key-value storage https://raw.githubusercontent.com/mrousavy/react-native-mmkv/refs/heads/main/README_V3.md

## Local app state and server state

State Management: Zustand https://raw.githubusercontent.com/pmndrs/zustand/refs/heads/main/README.md
Server/state (HTTP data): TanStack Query (React Query) for robust data fetching, caching, and synchronization. https://tanstack.com/ai/latest/docs/getting-started/quick-start-react-native#expo-prints-android-sdk-or-adb-warnings

## Must-have packages four core picks

FlashList for better lists/performance.
React Hook Form with Zod for form handling, validation, and type safety.
Expo core UI stack: React Native Reanimated.
React Native Gesture Handler (for gestures and interactions).
These two (Reanimated + Gesture Handler) pair nicely with performance- and animation-focused flows.

Back-end and services (easier shipping and monitoring)

Clerk for authentication/user management 
Sentry for app monitoring, error tracking, session replays, etc.
RevenueCat for cross-platform in-app purchases/subscriptions and paywalls.
Code Rabbit for AI-assisted code reviews and improvements.
PostHog for analytics, session replay, product analytics, and more (works with React Native).

Backend options (opinionated picks)

Supabase as the main backend (Postgres-based, relational database).
Instant DB as a Firebase-like alternative with strong client/server tooling.
Expo API Routes as lightweight server-side logic inside the app (for secrets, OpenAI calls, etc.); can run with EAS hosting if you want serverless hosting.

UI and styling approaches

Start with StyleSheet for simple, native-like styling (works well and keeps things lightweight).
Uni Styles as a richer styling layer (StyleSheet on steroids: breakpoints, variants, performance overhead minimal).
If you prefer Tailwind-like styling from web, Uniwind is the fastest Tailwind bindings for React Native (from the same creator as Uni Styles).
Expo UI as a bridge to native components (SwiftUI/Jetpack Compose) for a more native feel and potential perf benefits.

Overall philosophy

Be pragmatic: start simple with StyleSheet, upgrade to Uni Styles/Uniwind if you need more sophisticated styling, and consider Expo UI for native component access.
Expo Router 
The stack aims to be opinionated but practical, reducing time spent evaluating dozens of state libraries and random GitHub issues.

