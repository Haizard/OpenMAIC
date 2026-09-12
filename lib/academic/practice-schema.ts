import type { AcademicQueryable } from './schema';

/**
 * Practice drills and topic mastery — Slice 6.
 *
 * The point of this schema is the `topic_id` on `academic_practice_items`. Without it a score
 * cannot be attributed to anything the student is supposed to be learning, which is exactly why
 * Slice 5 could report coverage but not mastery.
 */
export const PRACTICE_SCHEMA = `
CREATE TABLE IF NOT EXISTS academic_practice_items (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL REFERENCES curriculum_topics(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  choices JSONB NOT NULL,
  correct_index INTEGER NOT NULL,
  explanation TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS academic_practice_items_topic_idx ON academic_practice_items (topic_id);

-- Append-only: a re-drill adds evidence rather than overwriting it, and a wrong answer stays
-- visible as a wrong answer. Mastery is computed over a recent window of these rows.
CREATE TABLE IF NOT EXISTS academic_practice_attempts (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES academic_students(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES academic_practice_items(id) ON DELETE CASCADE,
  correct BOOLEAN NOT NULL,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS academic_practice_attempts_student_idx
  ON academic_practice_attempts (student_id);

CREATE INDEX IF NOT EXISTS academic_practice_attempts_item_idx
  ON academic_practice_attempts (item_id);
`;

function splitSqlStatements(sql: string): string[] {
  return sql
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement !== '');
}

export async function ensurePracticeSchema(queryable: AcademicQueryable): Promise<void> {
  for (const statement of splitSqlStatements(PRACTICE_SCHEMA)) {
    await queryable.query(statement);
  }
}
