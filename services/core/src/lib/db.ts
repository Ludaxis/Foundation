import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { logger } from './logger.js';

export type Database = ReturnType<typeof drizzle>;

let db: Database | null = null;
let client: ReturnType<typeof postgres> | null = null;

export async function createDb(): Promise<Database> {
  if (db) return db;

  const connectionString = process.env.DATABASE_URL ||
    'postgres://postgres:postgres@localhost:5432/foundation';

  client = postgres(connectionString, {
    max: 10,
    onnotice: (notice) => {
      logger.debug({ notice }, 'Database notice');
    },
  });

  db = drizzle(client);

  // Test connection
  try {
    await client`SELECT 1`;
    logger.info('Database connection established');
  } catch (error) {
    logger.error(error, 'Failed to connect to database');
    throw error;
  }

  return db;
}

export function getDb(): Database {
  if (!db) {
    throw new Error('Database not initialized. Call createDb() first.');
  }
  return db;
}

export async function closeDb(): Promise<void> {
  if (client) {
    await client.end();
    client = null;
    db = null;
  }
}
