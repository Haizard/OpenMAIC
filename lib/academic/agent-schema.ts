import type { AcademicQueryable } from './schema';

/**
 * What the operator agent has done.
 *
 * This is a log, not a queue. Phase F computes what needs generating from the bank's current
 * coverage instead of storing a to-do list, so this table exists for one reason: Haitham should
 * be able to ask what the AI did while he was away, and get a real answer rather than a guess.
 *
 * Attempts are never deleted and never overwritten. A topic that failed yesterday and succeeded
 * today has both rows, because "this subject keeps failing" is the kind of pattern only a history
 * shows.
 *
 * No foreign keys, for the same reason as everywhere else in the academic schema: nothing here is
 * ever deleted, and a constraint would only force every schema pass and test pool to create
 * tables in a particular order.
 */
export const AGENT_SCHEMA = `
CREATE TABLE IF NOT EXISTS academic_agent_runs (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  topic_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  -- done | failed. There is no 'blocked' here: work is only planned for subjects that already
  -- have enough source, so a thin subject is never attempted and has nothing to log. The list of
  -- subjects waiting on a book is listGenerationBlockers, which computes it fresh.
  status TEXT NOT NULL,
  item_count INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The operator console reads the most recent attempts first.
CREATE INDEX IF NOT EXISTS academic_agent_runs_recent_idx
  ON academic_agent_runs (created_at DESC);

-- The retry cooldown asks for the latest attempt on one topic and kind.
CREATE INDEX IF NOT EXISTS academic_agent_runs_topic_idx
  ON academic_agent_runs (topic_id, kind, created_at DESC);
`;

function splitSqlStatements(sql: string): string[] {
  return sql
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement !== '');
}

export async function ensureAgentSchema(queryable: AcademicQueryable): Promise<void> {
  for (const statement of splitSqlStatements(AGENT_SCHEMA)) {
    await queryable.query(statement);
  }
}
