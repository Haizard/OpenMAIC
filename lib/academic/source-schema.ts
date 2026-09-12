import type { AcademicQueryable } from './schema';

/**
 * Source documents and chunks — Phase A of the AI content platform.
 *
 * These rows are the only human-authored content on the platform. The operator uploads a
 * textbook for a form and subject, we extract the text and store it as chunks, and every
 * homework, quiz or holiday package is later generated from those chunks.
 *
 * Because generation is grounded in these rows, "which book did this question come from" is
 * answerable at any time — a generated item keeps a reference to the chunk it was built from.
 */
export const SOURCE_SCHEMA = `
CREATE TABLE IF NOT EXISTS academic_source_documents (
  id TEXT PRIMARY KEY,
  form_id TEXT NOT NULL REFERENCES curriculum_forms(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL REFERENCES curriculum_subjects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  edition TEXT NOT NULL DEFAULT 'default',
  language TEXT NOT NULL DEFAULT 'en',
  content_hash TEXT NOT NULL,
  byte_size INTEGER NOT NULL DEFAULT 0,
  page_count INTEGER NOT NULL DEFAULT 0,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  char_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ready',
  license_note TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  superseded_at TIMESTAMPTZ
);

-- One live document per (form, subject, edition). Superseded rows stay for provenance but fall
-- out of this index, which is what stops a new edition from doubling the active pool that
-- generation reads from.
CREATE UNIQUE INDEX IF NOT EXISTS academic_source_documents_live_idx
  ON academic_source_documents (form_id, subject_id, edition)
  WHERE superseded_at IS NULL;

CREATE INDEX IF NOT EXISTS academic_source_documents_subject_idx
  ON academic_source_documents (subject_id);

CREATE TABLE IF NOT EXISTS academic_document_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES academic_source_documents(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL,
  text TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  page_number INTEGER,
  heading TEXT,
  char_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, ordinal)
);

CREATE INDEX IF NOT EXISTS academic_document_chunks_document_idx
  ON academic_document_chunks (document_id);
`;

function splitSqlStatements(sql: string): string[] {
  return sql
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement !== '');
}

export async function ensureSourceSchema(queryable: AcademicQueryable): Promise<void> {
  for (const statement of splitSqlStatements(SOURCE_SCHEMA)) {
    await queryable.query(statement);
  }
}
