import type { AcademicQueryable } from './schema';

/**
 * Holiday packages and home recordings — Slice 4.
 *
 * See docs/superpowers/specs/2026-09-12-academic-hub-slice-4-holiday-packages.md.
 */
export const HOLIDAY_SCHEMA = `
-- A holiday package is a named block of work over a date range. It claims existing homework
-- rows through academic_assignments.package_id rather than creating its own items, because
-- Slice 3 already guarantees one homework row per (student, topic).
CREATE TABLE IF NOT EXISTS academic_holiday_packages (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES academic_students(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS academic_holiday_packages_student_slug_idx
  ON academic_holiday_packages (student_id, slug);

CREATE INDEX IF NOT EXISTS academic_holiday_packages_student_idx
  ON academic_holiday_packages (student_id);

-- The two columns a package needs live in assignment-schema.ts, not here. They hang off
-- academic_assignments, and every caller that ensures the assignment schema must end up with
-- them, or plain assignment queries start selecting columns that were never added.

-- Recording bytes are content-addressed and kept out of the row the list queries read, so
-- listing a package never pulls megabytes of bytea through the driver.
CREATE TABLE IF NOT EXISTS academic_recording_bytes (
  hash TEXT PRIMARY KEY,
  mime TEXT NOT NULL,
  bytes BYTEA NOT NULL,
  byte_length INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The ownership-bearing reference row. Every read goes through this table, never through the
-- byte table directly, which is what keeps one family's audio out of another family's session.
CREATE TABLE IF NOT EXISTS academic_recordings (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL REFERENCES academic_assignments(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES academic_students(id) ON DELETE CASCADE,
  byte_hash TEXT NOT NULL REFERENCES academic_recording_bytes(hash) ON DELETE RESTRICT,
  mime TEXT NOT NULL,
  byte_length INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'audio' CHECK (kind IN ('audio', 'video')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One current take per item: re-recording replaces rather than accumulates.
CREATE UNIQUE INDEX IF NOT EXISTS academic_recordings_assignment_idx
  ON academic_recordings (assignment_id);

CREATE INDEX IF NOT EXISTS academic_recordings_student_idx ON academic_recordings (student_id);
`;

function splitSqlStatements(sql: string): string[] {
  return sql
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement !== '');
}

export async function ensureHolidaySchema(queryable: AcademicQueryable): Promise<void> {
  for (const statement of splitSqlStatements(HOLIDAY_SCHEMA)) {
    await queryable.query(statement);
  }
}
