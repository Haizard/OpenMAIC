import type { AcademicQueryable } from '@/lib/academic/schema';

export const QUIZ_SCHEMA = `
CREATE TABLE IF NOT EXISTS academic_quizzes (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL REFERENCES academic_schools(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  time_limit_minutes INTEGER,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS academic_quiz_questions (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL REFERENCES academic_quizzes(id) ON DELETE CASCADE,
  question_type TEXT NOT NULL CHECK (question_type IN ('multiple_choice', 'true_false', 'fill_blank', 'essay')),
  question_text TEXT NOT NULL,
  options JSONB,
  correct_answer TEXT,
  points INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS academic_quiz_submissions (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL REFERENCES academic_quizzes(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES academic_students(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'graded')),
  score INTEGER,
  max_score INTEGER,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  graded_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (quiz_id, student_id)
);

CREATE TABLE IF NOT EXISTS academic_quiz_answers (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES academic_quiz_submissions(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES academic_quiz_questions(id) ON DELETE CASCADE,
  answer_text TEXT,
  is_correct BOOLEAN,
  points_awarded INTEGER DEFAULT 0,
  grader_note TEXT
);

-- Columns added after the tables first shipped, kept as idempotent ALTERs so
-- databases created by an earlier revision are upgraded in place.
ALTER TABLE academic_quiz_questions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE academic_quiz_submissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS academic_quizzes_school_idx ON academic_quizzes (school_id);
CREATE INDEX IF NOT EXISTS academic_quiz_questions_quiz_idx ON academic_quiz_questions (quiz_id);
CREATE INDEX IF NOT EXISTS academic_quiz_submissions_quiz_idx ON academic_quiz_submissions (quiz_id);
CREATE INDEX IF NOT EXISTS academic_quiz_submissions_student_idx ON academic_quiz_submissions (student_id);
CREATE INDEX IF NOT EXISTS academic_quiz_answers_submission_idx ON academic_quiz_answers (submission_id);
`;

function splitSqlStatements(sql: string): string[] {
  return sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

export async function ensureQuizSchema(queryable: AcademicQueryable): Promise<void> {
  for (const statement of splitSqlStatements(QUIZ_SCHEMA)) {
    await queryable.query(statement);
  }
}
