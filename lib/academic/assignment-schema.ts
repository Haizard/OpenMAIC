import type { AcademicQueryable } from './schema';

export const ASSIGNMENT_SCHEMA = `
-- Assignments are self-started by the student. Homework is the same shape of work but
-- prescribed by the platform from the student's curriculum form — see
-- docs/superpowers/specs/2026-09-12-academic-hub-slice-3-homework.md.
-- Per ROADMAP.md Slice 1 open decision: "auto from the student's generated
-- courses" with student self-starts as the v1 source of assignments.
CREATE TABLE IF NOT EXISTS academic_assignments (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES academic_students(id) ON DELETE CASCADE,
  topic_id TEXT REFERENCES curriculum_topics(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'late')),
  due_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  kind TEXT NOT NULL DEFAULT 'assignment' CHECK (kind IN ('assignment', 'homework')),
  assigned_by TEXT NOT NULL DEFAULT 'student' CHECK (assigned_by IN ('student', 'platform')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS academic_assignments_student_idx ON academic_assignments (student_id);
CREATE INDEX IF NOT EXISTS academic_assignments_parent_idx ON academic_assignments (due_at);

-- Additive migration for databases created before Slice 3. Defaults keep every existing row
-- valid and reading as a plain assignment, so no backfill is needed.
ALTER TABLE academic_assignments
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'assignment'
    CHECK (kind IN ('assignment', 'homework'));

ALTER TABLE academic_assignments
  ADD COLUMN IF NOT EXISTS assigned_by TEXT NOT NULL DEFAULT 'student'
    CHECK (assigned_by IN ('student', 'platform'));

CREATE INDEX IF NOT EXISTS academic_assignments_kind_idx ON academic_assignments (kind);

-- One homework item per student per topic. This is what makes materialisation idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS academic_assignments_homework_unique
  ON academic_assignments (student_id, topic_id)
  WHERE kind = 'homework';

-- Slice 4: the holiday package that claimed this item, and whether it must be answered by
-- recording. These live here rather than in holiday-schema.ts because they hang off this table
-- and every caller that ensures this schema must end up with them — otherwise plain assignment
-- queries select columns that were never added. No foreign key to academic_holiday_packages:
-- the migration runner splits on a semicolon, so a REFERENCES cannot be added idempotently.
ALTER TABLE academic_assignments ADD COLUMN IF NOT EXISTS package_id TEXT;

ALTER TABLE academic_assignments
  ADD COLUMN IF NOT EXISTS requires_recording BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS academic_assignments_package_idx ON academic_assignments (package_id);

-- Phase D: which published bank item this work was drawn from. Deliberately nullable and
-- deliberately without a foreign key: homework materialised before anything was published, or
-- for a topic with nothing published yet, has to keep working exactly as it did.
ALTER TABLE academic_assignments ADD COLUMN IF NOT EXISTS content_item_id TEXT;

CREATE INDEX IF NOT EXISTS academic_assignments_content_item_idx
  ON academic_assignments (content_item_id);
`;

function splitSqlStatements(sql: string): string[] {
  return sql
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement !== '');
}

export async function ensureAssignmentSchema(queryable: AcademicQueryable): Promise<void> {
  for (const statement of splitSqlStatements(ASSIGNMENT_SCHEMA)) {
    await queryable.query(statement);
  }
}
