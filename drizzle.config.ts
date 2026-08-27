import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  driver: 'expo',
  schema: './src/lib/db/schemas/index.ts',
  out: './drizzle/local',
});
