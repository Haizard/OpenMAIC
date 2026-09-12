import type { AcademicQueryable } from './schema';

/**
 * Read pillar — Slice 2.
 *
 * `academic_readings` holds self-study content attached to a curriculum topic.
 * `academic_reading_progress` holds per-student reading state for that content.
 *
 * Content is curriculum-scoped (locked rule 8): a reading is reachable by a student only
 * when its topic belongs to that student's own curriculum level.
 */
export const READING_SCHEMA = `
CREATE TABLE IF NOT EXISTS academic_readings (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL REFERENCES curriculum_topics(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'lesson_note'
    CHECK (kind IN ('lesson_note', 'explainer', 'reference', 'past_paper', 'glossary')),
  source TEXT NOT NULL DEFAULT 'authored'
    CHECK (source IN ('authored', 'generated', 'imported')),
  reading_minutes INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS academic_reading_progress (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES academic_students(id) ON DELETE CASCADE,
  reading_id TEXT NOT NULL REFERENCES academic_readings(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'unread'
    CHECK (status IN ('unread', 'reading', 'read')),
  last_read_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, reading_id)
);

CREATE INDEX IF NOT EXISTS academic_readings_topic_idx ON academic_readings (topic_id);
CREATE INDEX IF NOT EXISTS academic_reading_progress_student_idx
  ON academic_reading_progress (student_id);
CREATE INDEX IF NOT EXISTS academic_reading_progress_reading_idx
  ON academic_reading_progress (reading_id);
`;

function splitSqlStatements(sql: string): string[] {
  return sql
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement !== '');
}

export async function ensureReadingSchema(queryable: AcademicQueryable): Promise<void> {
  for (const statement of splitSqlStatements(READING_SCHEMA)) {
    await queryable.query(statement);
  }
}
