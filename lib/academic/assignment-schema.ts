import type { AcademicQueryable } from './schema';

export const ASSIGNMENT_SCHEMA = `
-- Self-assigned assignments, auto-created from a student's curriculum topics.
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS academic_assignments_student_idx ON academic_assignments (student_id);
CREATE INDEX IF NOT EXISTS academic_assignments_parent_idx ON academic_assignments (due_at);
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
