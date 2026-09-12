import type { AcademicQueryable } from './schema';

/**
 * The shared content bank — where AI-generated items live.
 *
 * Every item carries where it came from: the source document, the chunks it was generated
 * from, the model, and when. That is not bookkeeping for its own sake. If a question is wrong,
 * the only way to answer "which book taught it that" is to have kept the reference.
 *
 * Nothing with status `draft` is ever served to a student.
 */
export const CONTENT_SCHEMA = `
CREATE TABLE IF NOT EXISTS academic_content_items (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES curriculum_subjects(id) ON DELETE CASCADE,
  topic_id TEXT REFERENCES curriculum_topics(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  prompt TEXT NOT NULL,
  choices JSONB,
  correct_index INTEGER,
  explanation TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  source_document_id TEXT REFERENCES academic_source_documents(id) ON DELETE SET NULL,
  source_chunk_ids JSONB NOT NULL DEFAULT '[]',
  model TEXT,
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  flag_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS academic_content_items_subject_idx
  ON academic_content_items (subject_id);

CREATE INDEX IF NOT EXISTS academic_content_items_topic_idx
  ON academic_content_items (topic_id);

-- The query every delivery path will run: live items of a kind for a subject.
CREATE INDEX IF NOT EXISTS academic_content_items_pool_idx
  ON academic_content_items (subject_id, kind, status);
`;

function splitSqlStatements(sql: string): string[] {
  return sql
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement !== '');
}

export async function ensureContentSchema(queryable: AcademicQueryable): Promise<void> {
  for (const statement of splitSqlStatements(CONTENT_SCHEMA)) {
    await queryable.query(statement);
  }
}
