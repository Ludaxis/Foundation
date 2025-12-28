import type { Config } from 'drizzle-kit';

export default {
  schema: './src/__generated__/db/schema.ts',
  out: './drizzle',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/foundation',
  },
} satisfies Config;
