import { Pool } from 'pg';

import type { AcademicDb } from '@/lib/academic/register';

let cachedPool: Pool | null = null;
let schemaEnsured = false;

async function ensureSchemaIfNeeded(pool: Pool): Promise<void> {
  if (schemaEnsured) return;
  try {
    const { ensureAcademicSchema } = await import('@/lib/academic/schema');
    await ensureAcademicSchema(pool as unknown as import('@/lib/academic/schema').AcademicQueryable);
    schemaEnsured = true;
  } catch (error) {
    console.error('Failed to ensure academic schema:', error);
    throw error;
  }
}

function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }
  if (!cachedPool) {
    cachedPool = new Pool({ connectionString });
  }
  return cachedPool;
}

/** Get an AcademicDb-compatible handle backed by the shared Postgres pool. */
export async function getAcademicDb(): Promise<AcademicDb> {
  const pool = getPool();
  await ensureSchemaIfNeeded(pool);
  return {
    query: (text, params) => pool.query(text, params),
    connect: async () => {
      const client = await pool.connect();
      return {
        query: (text: string, params?: unknown[]) => client.query(text, params),
        release: () => client.release(),
      };
    },
  };
}
