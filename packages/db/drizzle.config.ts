import { defineConfig } from 'drizzle-kit';

// `npm run generate -w @botbad/db` writes SQL migrations to ./drizzle.
// They are applied by the API (`npm run db:migrate -w @botbad/api`), so production never needs drizzle-kit.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './drizzle',
});
