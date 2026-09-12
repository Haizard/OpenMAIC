import { randomUUID } from 'node:crypto';

import type { AcademicDb } from '@/lib/academic/register';
import {
  generateContentForTopic,
  MIN_SOURCE_CHARS,
  type ContentKind,
  type ContentLlm,
} from '@/lib/academic/content-bank';
import type { SourceLanguage } from '@/lib/academic/source';

/**
 * The operator agent — Phase F.
 *
 * Phases A–E built a bank and a console, but the bank only grew when Haitham clicked generate
 * for one topic at a time. This is the part that makes the AI the operator: point it at nothing
 * in particular and it finds the holes in the bank and fills them, one topic at a time, until it
 * runs out of budget.
 *
 * Two things it deliberately does not do:
 *
 * - **It does not publish.** Everything it writes is a draft, because a wrong answer that reaches
 *   a student before anyone reads it is worse than no answer. Publishing is Haitham's click.
 * - **It does not queue.** What needs generating is computed from the bank's current coverage,
 *   so uploading a book changes the plan on the next run instead of waiting for a queue to drain.
 */

/** How many live items a topic should have before the agent stops topping it up. */
export const AGENT_TARGET_ITEMS_PER_TOPIC = 6;

/** How many (topic, kind) attempts one run will make. Bounds the cost of a run. */
export const AGENT_MAX_TOPICS_PER_RUN = 10;

/**
 * How long a topic rests after a failed attempt.
 *
 * Only failures are cooled down. A topic that generated successfully is gated by coverage
 * instead, so uploading a book for a subject that was previously too thin takes effect on the
 * next run rather than after a wait.
 */
export const AGENT_RETRY_COOLDOWN_MS = 6 * 60 * 60 * 1000;

/**
 * The kinds the agent stocks by default: the ones students actually pull.
 *
 * `quiz` joined this list in Phase G, once `/learn/quizzes` started serving bank quizzes. Before
 * that, stocking it would have been spending on questions nobody was ever asked.
 */
export const AGENT_KINDS = ['homework', 'practice', 'quiz'] as const;

export interface AgentWorkItem {
  readonly subjectId: string;
  readonly subjectName: string;
  readonly topicId: string;
  readonly topicName: string;
  readonly kind: ContentKind;
  readonly haveItems: number;
  readonly wantItems: number;
}

export interface PlanAgentWorkOptions {
  readonly subjectId?: string;
  readonly kinds?: readonly ContentKind[];
  readonly targetItems?: number;
  readonly limit?: number;
}

/**
 * What the agent would generate if it ran now.
 *
 * A topic is work when its live bank (drafts awaiting review plus published items) is below
 * target, its subject has enough source to generate from, and its last attempt was not a recent
 * failure. Flagged and retired items do not count as coverage, so a topic whose questions
 * students kept reporting gets topped back up.
 */
export async function planAgentWork(
  db: AcademicDb,
  options: PlanAgentWorkOptions = {},
): Promise<readonly AgentWorkItem[]> {
  const kinds = options.kinds?.length ? options.kinds : AGENT_KINDS;
  const target = options.targetItems ?? AGENT_TARGET_ITEMS_PER_TOPIC;
  const limit = options.limit ?? AGENT_MAX_TOPICS_PER_RUN;

  const work: AgentWorkItem[] = [];
  for (const kind of kinds) {
    const result = await db.query<{
      subject_id: string;
      subject_name: string;
      topic_id: string;
      topic_name: string;
      item_count: string | number;
    }>(
      `SELECT sj.id AS subject_id, sj.name AS subject_name,
              t.id AS topic_id, t.name AS topic_name,
              COALESCE(live.item_count, 0) AS item_count
         FROM curriculum_topics t
         JOIN curriculum_subjects sj ON sj.id = t.subject_id
         LEFT JOIN LATERAL (
           SELECT COUNT(*) AS item_count
             FROM academic_content_items ci
            WHERE ci.topic_id = t.id AND ci.kind = $3 AND ci.status IN ('draft', 'published')
         ) live ON true
         WHERE COALESCE(live.item_count, 0) < $2
           AND COALESCE((
                 SELECT SUM(doc.char_count)
                   FROM academic_source_documents doc
                  WHERE doc.subject_id = sj.id
                    AND doc.superseded_at IS NULL
                    AND doc.status = 'ready'
               ), 0) >= $1
           AND ($4::text IS NULL OR sj.id = $4)
         ORDER BY COALESCE(live.item_count, 0), sj.name, t.sort_order, t.name`,
      [MIN_SOURCE_CHARS, target, kind, options.subjectId ?? null],
    );

    for (const row of result.rows) {
      work.push({
        subjectId: row.subject_id,
        subjectName: row.subject_name,
        topicId: row.topic_id,
        topicName: row.topic_name,
        kind,
        haveItems: Number(row.item_count),
        wantItems: target - Number(row.item_count),
      });
    }
  }

  const cooled = await coolingDown(db);
  // Worst holes first: a topic with nothing in it is more urgent than one a few items short.
  work.sort((a, b) => a.haveItems - b.haveItems || a.subjectName.localeCompare(b.subjectName));

  return work.filter((item) => !cooled.has(`${item.topicId}:${item.kind}`)).slice(0, limit);
}

/**
 * (topic, kind) pairs whose most recent attempt failed recently.
 *
 * Only the latest attempt matters: a topic that failed last week and succeeded yesterday is not
 * cooling down, it is done.
 */
async function coolingDown(db: AcademicDb): Promise<ReadonlySet<string>> {
  const result = await db.query<{
    topic_id: string;
    kind: string;
    status: string;
    created_at: Date | string;
  }>(
    `SELECT DISTINCT ON (topic_id, kind) topic_id, kind, status, created_at
       FROM academic_agent_runs
      ORDER BY topic_id, kind, created_at DESC, id DESC`,
  );

  const cutoff = Date.now() - AGENT_RETRY_COOLDOWN_MS;
  const cooled = new Set<string>();
  for (const row of result.rows) {
    if (row.status !== 'failed') continue;
    if (toMillis(row.created_at) > cutoff) cooled.add(`${row.topic_id}:${row.kind}`);
  }
  return cooled;
}

function toMillis(value: Date | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

export interface AgentAttempt {
  readonly subjectId: string;
  readonly subjectName: string;
  readonly topicId: string;
  readonly topicName: string;
  readonly kind: ContentKind;
  readonly status: 'done' | 'failed';
  readonly itemCount: number;
  readonly message: string;
}

export interface AgentRunSummary {
  readonly attempted: number;
  readonly generated: number;
  readonly failed: number;
  readonly attempts: readonly AgentAttempt[];
}

export interface RunAgentOptions {
  readonly llm: ContentLlm;
  readonly model?: string;
  readonly limit?: number;
  readonly subjectId?: string;
  readonly kinds?: readonly ContentKind[];
  readonly language?: SourceLanguage;
}

/**
 * Fill the holes in the bank.
 *
 * Every attempt is logged, and a failing topic does not stop the run: one bad generation should
 * not cost Haitham the other nine. The summary is what the operator console shows him.
 */
export async function runAgent(
  db: AcademicDb,
  options: RunAgentOptions,
): Promise<AgentRunSummary> {
  const work = await planAgentWork(db, {
    ...(options.subjectId ? { subjectId: options.subjectId } : {}),
    ...(options.kinds?.length ? { kinds: options.kinds } : {}),
    limit: options.limit ?? AGENT_MAX_TOPICS_PER_RUN,
  });

  const attempts: AgentAttempt[] = [];

  for (const item of work) {
    try {
      const result = await generateContentForTopic(db, {
        subjectId: item.subjectId,
        topicId: item.topicId,
        kind: item.kind,
        count: item.wantItems,
        llm: options.llm,
        ...(options.model ? { model: options.model } : {}),
        ...(options.language ? { language: options.language } : {}),
      });

      if (!result.ok) {
        // Planning already filtered on source, so this is a race rather than the normal path:
        // the book was retired between the plan and the run. Recorded as a failure so it shows
        // up as "this subject needs looking at" instead of vanishing.
        attempts.push(
          await recordAttempt(db, {
            ...item,
            status: 'failed',
            itemCount: 0,
            message: result.message,
          }),
        );
        continue;
      }

      attempts.push(
        await recordAttempt(db, {
          ...item,
          status: 'done',
          itemCount: result.items.length,
          message: `Generated ${result.items.length} draft${result.items.length === 1 ? '' : 's'}`,
        }),
      );
    } catch (error) {
      // A model that returned junk, a vendor that timed out. Backoff applies, the run continues.
      attempts.push(
        await recordAttempt(db, {
          ...item,
          status: 'failed',
          itemCount: 0,
          message: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  return {
    attempted: attempts.length,
    generated: attempts.reduce((total, attempt) => total + attempt.itemCount, 0),
    failed: attempts.filter((attempt) => attempt.status === 'failed').length,
    attempts,
  };
}

async function recordAttempt(db: AcademicDb, attempt: AgentAttempt): Promise<AgentAttempt> {
  await db.query(
    `INSERT INTO academic_agent_runs
       (id, subject_id, topic_id, kind, status, item_count, message)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      randomUUID(),
      attempt.subjectId,
      attempt.topicId,
      attempt.kind,
      attempt.status,
      attempt.itemCount,
      attempt.message,
    ],
  );
  return attempt;
}

export interface AgentRunRecord {
  readonly id: string;
  readonly subjectId: string;
  readonly subjectName: string | null;
  readonly topicId: string;
  readonly topicName: string | null;
  readonly kind: string;
  readonly status: string;
  readonly itemCount: number;
  readonly message: string | null;
  readonly createdAt: string;
}

/** What the agent did, most recent first — the answer to "what happened while I was away". */
export async function listAgentRuns(
  db: AcademicDb,
  limit = 20,
): Promise<readonly AgentRunRecord[]> {
  const result = await db.query<{
    id: string;
    subject_id: string;
    subject_name: string | null;
    topic_id: string;
    topic_name: string | null;
    kind: string;
    status: string;
    item_count: number;
    message: string | null;
    created_at: Date | string;
  }>(
    `SELECT r.id, r.subject_id, sj.name AS subject_name,
            r.topic_id, t.name AS topic_name,
            r.kind, r.status, r.item_count, r.message, r.created_at
       FROM academic_agent_runs r
       LEFT JOIN curriculum_subjects sj ON sj.id = r.subject_id
       LEFT JOIN curriculum_topics t ON t.id = r.topic_id
      ORDER BY r.created_at DESC, r.id DESC
      LIMIT $1`,
    [limit],
  );

  return result.rows.map((row) => ({
    id: row.id,
    subjectId: row.subject_id,
    subjectName: row.subject_name,
    topicId: row.topic_id,
    topicName: row.topic_name,
    kind: row.kind,
    status: row.status,
    itemCount: Number(row.item_count),
    message: row.message,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  }));
}
