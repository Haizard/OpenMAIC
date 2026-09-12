import type { AcademicQueryable } from './schema';

/**
 * Attempts at a bank-backed quiz — Phase G.
 *
 * Why a new table rather than one of the two that already exist:
 *
 * - `academic_quiz_submissions` cannot hold them. It references `academic_quizzes`, whose rows are
 *   owned by a school (`school_id NOT NULL`), and rule 9 removed the only role that made one. A
 *   bank quiz has no author, so there is no row to point at.
 * - `academic_practice_attempts` must not hold them. Every row there feeds topic mastery, and a
 *   quiz is a test, not training: folding test scores into mastery would tell the guidance engine
 *   a student has practised a topic when all they did was sit an assessment.
 *
 * Answers are stored as one JSONB blob rather than a child table. An attempt is read whole or not
 * at all — the review screen shows every question — so a join would buy nothing but more rows.
 *
 * No foreign keys, for the same reason as the rest of the academic schema: these rows are never
 * deleted, and a constraint would only force ordering on every schema pass and test pool.
 */
export const QUIZ_BANK_SCHEMA = `
CREATE TABLE IF NOT EXISTS academic_bank_quiz_attempts (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  topic_id TEXT NOT NULL,
  score INTEGER NOT NULL,
  max_score INTEGER NOT NULL,
  answers JSONB NOT NULL DEFAULT '[]',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

-- Best and most recent attempt per topic, which is what the quiz list shows.
CREATE INDEX IF NOT EXISTS academic_bank_quiz_attempts_topic_idx
  ON academic_bank_quiz_attempts (student_id, topic_id, started_at DESC);
`;

function splitSqlStatements(sql: string): string[] {
  return sql
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement !== '');
}

export async function ensureQuizBankSchema(queryable: AcademicQueryable): Promise<void> {
  for (const statement of splitSqlStatements(QUIZ_BANK_SCHEMA)) {
    await queryable.query(statement);
  }
}
