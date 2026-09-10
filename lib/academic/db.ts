import { Pool } from 'pg';

import type { AcademicDb } from '@/lib/academic/register';

let cachedPool: Pool | null = null;

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
export function getAcademicDb(): AcademicDb {
  const pool = getPool();
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
