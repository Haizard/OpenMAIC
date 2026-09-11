import type { AcademicQueryable } from './schema';

export const CURRICULUM_SCHEMA = `
-- Education levels: primary, secondary, a_level
CREATE TABLE IF NOT EXISTS curriculum_levels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Forms/grades within each level: e.g., Standard 1-7, Form 1-4, Form 5-6
CREATE TABLE IF NOT EXISTS curriculum_forms (
  id TEXT PRIMARY KEY,
  level_id TEXT NOT NULL REFERENCES curriculum_levels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(level_id, slug)
);

-- Subjects offered at each form level
CREATE TABLE IF NOT EXISTS curriculum_subjects (
  id TEXT PRIMARY KEY,
  form_id TEXT NOT NULL REFERENCES curriculum_forms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(form_id, slug)
);

-- Topics within each subject
CREATE TABLE IF NOT EXISTS curriculum_topics (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES curriculum_subjects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(subject_id, slug)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS curriculum_forms_level_idx ON curriculum_forms (level_id);
CREATE INDEX IF NOT EXISTS curriculum_subjects_form_idx ON curriculum_subjects (form_id);
CREATE INDEX IF NOT EXISTS curriculum_topics_subject_idx ON curriculum_topics (subject_id);
`;

function splitSqlStatements(sql: string): string[] {
  return sql
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement !== '');
}

export async function ensureCurriculumSchema(queryable: AcademicQueryable): Promise<void> {
  for (const statement of splitSqlStatements(CURRICULUM_SCHEMA)) {
    await queryable.query(statement);
  }
}
