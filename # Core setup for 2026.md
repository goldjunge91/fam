# Core setup for 2026
https://github.com/xavia-io/xavia-ota
https://github.com/TanayK07/expo-react-native-cicd
## Local data persistence (offline/local state)

Expo SQLite for local database.
Drizzle (TypeScript-first schema, generates SQL via CLI) for easier SQL with Expo SQLite; includes Drizzle Studio for debugging.
React Native MMKV for simple, fast key-value storage (not compatible with Expo Go).

## Local app state and server state

Local state: React Context is fine for simple cases (e.g., theme).
State library for app state: Zustand is recommended.
Server/state (HTTP data): TanStack Query (React Query) for robust data fetching, caching, and synchronization.

## Must-have packages four core picks

FlashList for better lists/performance.
React Hook Form with Zod for form handling, validation, and type safety.
Expo core UI stack: React Native Reanimated.
React Native Gesture Handler (for gestures and interactions).
These two (Reanimated + Gesture Handler) pair nicely with performance- and animation-focused flows.

Back-end and services (easier shipping and monitoring)

Expo Application Services (EAS): Build, Submit, Updates, hosting—essential for a smooth dev-to-deploy flow.
Clerk for authentication/user management (has improved React Native integration in 2026).
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
Expo Router + mature ecosystem makes 2026 a stable, confident time to start new RN apps.
The stack aims to be opinionated but practical, reducing time spent evaluating dozens of state libraries and random GitHub issues.
If you want more hands-on depth

The video promotes the zero-to-her mission on galaxies.dev as a practical path to learn RN in 2026 and ship an app.
If you have a favorite library you think was missed, you can share it in comments to compare notes.

