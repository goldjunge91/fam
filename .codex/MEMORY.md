# Project Environment

- Expo SDK 57 managed React Native app using Expo Router; web preview is supported.
- Use Bun. Key verification commands: `bun run check`, `bun run typecheck`, and `bun run test`.
- Start Metro with `bun start`; start web with `bun run web`.
- Native work needs a development client, not Expo Go. Preferred iOS workflow: `bash scripts/ios-dev.sh --reuse-last`.
- Declarative Supabase schemas live in `supabase/schemas`; generate migrations only with `bun run db:diff`.
- App uses React Native 0.86.2, React 19.2.3, Expo Router ~57.0.12, and Expo SQLite.
