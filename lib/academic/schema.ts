export interface AcademicQueryable {
  query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
}

export const ACADEMIC_SCHEMA = `
CREATE TABLE IF NOT EXISTS academic_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS academic_parents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES academic_users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS academic_students (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES academic_users(id) ON DELETE CASCADE,
  parent_id TEXT NOT NULL REFERENCES academic_parents(id) ON DELETE RESTRICT,
  academic_level TEXT NOT NULL,
  display_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS academic_schools (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES academic_users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS academic_school_roster (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL REFERENCES academic_schools(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  grade TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS academic_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES academic_users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS academic_students_parent_idx ON academic_students (parent_id);
CREATE INDEX IF NOT EXISTS academic_roster_school_idx ON academic_school_roster (school_id);
CREATE INDEX IF NOT EXISTS academic_sessions_user_idx ON academic_sessions (user_id);
`;

function splitSqlStatements(sql: string): string[] {
  return sql
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement !== '');
}

export async function ensureAcademicSchema(queryable: AcademicQueryable): Promise<void> {
  for (const statement of splitSqlStatements(ACADEMIC_SCHEMA)) {
    await queryable.query(statement);
  }
}
