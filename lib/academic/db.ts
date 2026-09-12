import { Pool } from 'pg';

import type { AcademicDb } from '@/lib/academic/register';

let cachedPool: Pool | null = null;
let schemaEnsured = false;

async function ensureSchemaIfNeeded(pool: Pool): Promise<void> {
  if (schemaEnsured) return;
  try {
    const [
      { ensureAcademicSchema },
      { ensureQuizSchema },
      { ensureCurriculumSchema },
      { ensureAssignmentSchema },
      { ensureReadingSchema },
      { ensureHolidaySchema },
      { ensureSourceSchema },
      { ensureContentSchema },
      { ensureAgentSchema },
      { ensurePracticeSchema },
      { seedCurriculum },
      { seedReadings },
      { seedPracticeItems },
    ] = await Promise.all([
      import('@/lib/academic/schema'),
      import('@/lib/academic/quiz-schema'),
      import('@/lib/academic/curriculum-schema'),
      import('@/lib/academic/assignment-schema'),
      import('@/lib/academic/reading-schema'),
      import('@/lib/academic/holiday-schema'),
      import('@/lib/academic/source-schema'),
      import('@/lib/academic/content-schema'),
      import('@/lib/academic/agent-schema'),
      import('@/lib/academic/practice-schema'),
      import('@/lib/academic/curriculum-seed'),
      import('@/lib/academic/reading-seed'),
      import('@/lib/academic/practice-seed'),
    ]);
    const queryable = pool as unknown as import('@/lib/academic/schema').AcademicQueryable;
    await ensureAcademicSchema(queryable);
    await ensureQuizSchema(queryable);
    await ensureCurriculumSchema(queryable);
    await ensureAssignmentSchema(queryable);
    await seedCurriculum(queryable);
    // Readings reference curriculum_topics, so the curriculum must be seeded first.
    await ensureReadingSchema(queryable);
    await seedReadings(queryable);
    // Holiday columns attach to academic_assignments, so they come after it exists.
    await ensureHolidaySchema(queryable);
    // Source documents reference curriculum forms and subjects, so they come after the seed.
    await ensureSourceSchema(queryable);
    // Content items reference curriculum subjects, topics and source documents, so they come
    // after all three.
    await ensureContentSchema(queryable);
    // The agent log only records attempts against existing subjects and topics, so it comes
    // after the content bank it tops up.
    await ensureAgentSchema(queryable);
    // Practice items reference curriculum_topics, so the curriculum must be seeded first.
    await ensurePracticeSchema(queryable);
    await seedPracticeItems(queryable);
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
    query: <TRow>(text: string, params?: unknown[]) =>
      pool.query(text, params) as unknown as Promise<{ rows: TRow[] }>,
    connect: async () => {
      const client = await pool.connect();
      return {
        query: <TRow>(text: string, params?: unknown[]) =>
          client.query(text, params) as unknown as Promise<{ rows: TRow[] }>,
        release: () => client.release(),
      };
    },
  };
}
