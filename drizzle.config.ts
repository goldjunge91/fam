import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  driver: 'expo',
  schema: './src/lib/db/drizzle-schema.ts',
  out: './drizzle/local',
});
