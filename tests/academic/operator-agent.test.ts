import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ensureAcademicSchema } from '@/lib/academic/schema';
import { ensureCurriculumSchema } from '@/lib/academic/curriculum-schema';
import { seedCurriculum } from '@/lib/academic/curriculum-seed';
import { ensureSourceSchema } from '@/lib/academic/source-schema';
import { ensureContentSchema } from '@/lib/academic/content-schema';
import { ensureAgentSchema } from '@/lib/academic/agent-schema';
import { ingestSourceDocument } from '@/lib/academic/source';
import type { SourcePage } from '@/lib/academic/source-chunk';
import { listContentItems, publishContentItem } from '@/lib/academic/content-bank';
import {
  AGENT_KINDS,
  AGENT_MAX_TOPICS_PER_RUN,
  AGENT_TARGET_ITEMS_PER_TOPIC,
  listAgentRuns,
  planAgentWork,
  runAgent,
} from '@/lib/academic/agent';

/**
 * Phase F: the agent finds the holes in the bank and fills them without being told which topic,
 * refuses to invent where there is no book, backs off instead of retrying a broken topic, and
 * leaves a log of everything it did.
 */

class PGlitePool {
  constructor(readonly db: PGlite) {}
  query<TRow>(text: string, params?: unknown[]) {
    return this.db.query<TRow>(text, params);
  }
}

let pool: PGlitePool;

const SUBJECT_ID = 'std5-math';

/** Comfortably over MIN_SOURCE_CHARS so generation is allowed. */
const SOURCE_TEXT = 'Fractions name equal parts of a whole and the denominator counts them. '.repeat(
  30,
);

function sourcePages(): SourcePage[] {
  return [{ pageNumber: 1, text: `Chapter 1\n\n${SOURCE_TEXT}` }];
}

function validModelOutput(count = 2): string {
  return JSON.stringify(
    Array.from({ length: count }, (_unused, index) => ({
      prompt: `What does the denominator count? (${index})`,
      choices: ['The parts', 'The whole', 'The sum', 'The remainder'],
      correctIndex: 0,
      explanation: 'The source says the denominator counts the equal parts.',
    })),
  );
}

function llmReturning(raw: string): (prompt: string) => Promise<string> {
  return async () => raw;
}

/** Fails the first `failures` calls, then behaves normally. */
function llmFailingFirst(failures: number, raw = validModelOutput(2)) {
  let calls = 0;
  return async (): Promise<string> => {
    calls += 1;
    if (calls <= failures) throw new Error('model unavailable');
    return raw;
  };
}

async function firstTopicId(): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `SELECT id FROM curriculum_topics WHERE subject_id = $1 ORDER BY sort_order, name LIMIT 1`,
    [SUBJECT_ID],
  );
  return result.rows[0]?.id ?? '';
}

async function topicCount(): Promise<number> {
  const result = await pool.query<{ n: string }>(
    'SELECT COUNT(*) AS n FROM curriculum_topics WHERE subject_id = $1',
    [SUBJECT_ID],
  );
  return Number(result.rows[0]?.n ?? 0);
}

beforeEach(async () => {
  pool = new PGlitePool(new PGlite());
  await ensureAcademicSchema(pool);
  await ensureCurriculumSchema(pool);
  await seedCurriculum(pool);
  await ensureSourceSchema(pool);
  await ensureContentSchema(pool);
  await ensureAgentSchema(pool);
});

afterEach(async () => {
  await pool.db.close();
});

describe('planAgentWork', () => {
  it('plans nothing for a subject with no book uploaded', async () => {
    expect(await planAgentWork(pool)).toEqual([]);
  });

  it('plans the topics of a subject once its book is uploaded', async () => {
    expect(await planAgentWork(pool)).toEqual([]);

    await ingestSourceDocument(pool, {
      formId: 'std5',
      subjectId: SUBJECT_ID,
      title: 'Primary Mathematics 5',
      pages: sourcePages(),
    });

    const plan = await planAgentWork(pool);
    expect(plan.length).toBeGreaterThan(0);
    // Every kind the agent stocks, for every topic in the subject.
    expect(plan.length).toBe((await topicCount()) * AGENT_KINDS.length);
    expect(plan.every((item) => item.subjectId === SUBJECT_ID)).toBe(true);
  });

  it('stops planning a topic once it has enough live items', async () => {
    await ingestSourceDocument(pool, {
      formId: 'std5',
      subjectId: SUBJECT_ID,
      title: 'Primary Mathematics 5',
      pages: sourcePages(),
    });
    const topicId = await firstTopicId();

    await runAgent(pool, {
      llm: llmReturning(validModelOutput(AGENT_TARGET_ITEMS_PER_TOPIC)),
      limit: 1,
      kinds: ['homework'],
    });

    const stillWork = (await planAgentWork(pool, { kinds: ['homework'] })).filter(
      (item) => item.topicId === topicId,
    );
    expect(stillWork).toEqual([]);
  });

  it('counts a draft as coverage, so it does not pile up on unreviewed work', async () => {
    await ingestSourceDocument(pool, {
      formId: 'std5',
      subjectId: SUBJECT_ID,
      title: 'Primary Mathematics 5',
      pages: sourcePages(),
    });

    // Generating drafts for one topic only; the point is that they count.
    await runAgent(pool, { llm: llmReturning(validModelOutput(6)), limit: 1, kinds: ['homework'] });

    const drafts = await listContentItems(pool, { kind: 'homework', status: 'draft' });
    expect(drafts.length).toBeGreaterThan(0);

    const topicId = drafts[0]?.topicId;
    const planned = (await planAgentWork(pool, { kinds: ['homework'] })).filter(
      (item) => item.topicId === topicId,
    );
    expect(planned).toEqual([]);
  });

  it('does not count flagged items, so a reported topic gets topped back up', async () => {
    await ingestSourceDocument(pool, {
      formId: 'std5',
      subjectId: SUBJECT_ID,
      title: 'Primary Mathematics 5',
      pages: sourcePages(),
    });

    await runAgent(pool, { llm: llmReturning(validModelOutput(6)), limit: 1, kinds: ['homework'] });
    const drafts = await listContentItems(pool, { kind: 'homework', status: 'draft' });
    const topicId = drafts[0]?.topicId as string;

    // Students report every question on this topic; the agent should treat it as empty again.
    await pool.query(`UPDATE academic_content_items SET status = 'flagged' WHERE topic_id = $1`, [
      topicId,
    ]);

    const planned = (await planAgentWork(pool, { kinds: ['homework'] })).filter(
      (item) => item.topicId === topicId,
    );
    expect(planned.length).toBeGreaterThan(0);
  });

  it('can be scoped to one subject', async () => {
    await ingestSourceDocument(pool, {
      formId: 'std5',
      subjectId: SUBJECT_ID,
      title: 'Primary Mathematics 5',
      pages: sourcePages(),
    });

    expect((await planAgentWork(pool, { subjectId: SUBJECT_ID })).length).toBeGreaterThan(0);
    expect(await planAgentWork(pool, { subjectId: 'no-such-subject' })).toEqual([]);
  });
});

describe('runAgent', () => {
  it('fills the bank and lands the items as drafts, not as published work', async () => {
    await ingestSourceDocument(pool, {
      formId: 'std5',
      subjectId: SUBJECT_ID,
      title: 'Primary Mathematics 5',
      pages: sourcePages(),
    });

    const summary = await runAgent(pool, { llm: llmReturning(validModelOutput(2)), limit: 3 });

    expect(summary.attempted).toBe(3);
    expect(summary.failed).toBe(0);
    expect(summary.generated).toBeGreaterThan(0);

    expect(await listContentItems(pool, { status: 'draft' })).not.toEqual([]);
    // The agent must not publish: a wrong answer reaching a student before anyone reads it is
    // worse than no answer.
    expect(await listContentItems(pool, { status: 'published' })).toEqual([]);
  });

  it('stops at the run cap so one run cannot spend without bound', async () => {
    await ingestSourceDocument(pool, {
      formId: 'std5',
      subjectId: SUBJECT_ID,
      title: 'Primary Mathematics 5',
      pages: sourcePages(),
    });

    const summary = await runAgent(pool, {
      llm: llmReturning(validModelOutput(2)),
      limit: 1,
    });

    expect(summary.attempted).toBe(1);
    expect(AGENT_MAX_TOPICS_PER_RUN).toBeGreaterThan(1);
  });

  it('logs every attempt', async () => {
    await ingestSourceDocument(pool, {
      formId: 'std5',
      subjectId: SUBJECT_ID,
      title: 'Primary Mathematics 5',
      pages: sourcePages(),
    });

    await runAgent(pool, { llm: llmReturning(validModelOutput(2)), limit: 2 });

    const runs = await listAgentRuns(pool);
    expect(runs).toHaveLength(2);
    expect(runs.every((run) => run.status === 'done')).toBe(true);
    // The log is readable by a human: it names the subject and topic.
    expect(runs[0]?.subjectName).toBeTruthy();
    expect(runs[0]?.topicName).toBeTruthy();
    expect(runs[0]?.itemCount).toBeGreaterThan(0);
  });

  it('keeps going when one topic fails, and logs the failure', async () => {
    await ingestSourceDocument(pool, {
      formId: 'std5',
      subjectId: SUBJECT_ID,
      title: 'Primary Mathematics 5',
      pages: sourcePages(),
    });

    const summary = await runAgent(pool, {
      llm: llmFailingFirst(1),
      limit: 3,
    });

    // A single bad generation must not cost Haitham the other topics.
    expect(summary.attempted).toBe(3);
    expect(summary.failed).toBe(1);
    expect(summary.generated).toBeGreaterThan(0);

    const runs = await listAgentRuns(pool);
    expect(runs.filter((run) => run.status === 'failed')).toHaveLength(1);
    expect(runs.some((run) => run.message?.includes('model unavailable'))).toBe(true);
  });

  it('does not retry a topic that just failed', async () => {
    await ingestSourceDocument(pool, {
      formId: 'std5',
      subjectId: SUBJECT_ID,
      title: 'Primary Mathematics 5',
      pages: sourcePages(),
    });

    await runAgent(pool, { llm: llmFailingFirst(1), limit: 1, kinds: ['homework'] });

    const failedTopic = (await listAgentRuns(pool))[0]?.topicId;
    const planned = (await planAgentWork(pool, { kinds: ['homework'] })).filter(
      (item) => item.topicId === failedTopic,
    );
    expect(planned).toEqual([]);
  });

  it('retries a failed topic once the backoff has passed', async () => {
    await ingestSourceDocument(pool, {
      formId: 'std5',
      subjectId: SUBJECT_ID,
      title: 'Primary Mathematics 5',
      pages: sourcePages(),
    });

    await runAgent(pool, { llm: llmFailingFirst(1), limit: 1, kinds: ['homework'] });
    const failedTopic = (await listAgentRuns(pool))[0]?.topicId as string;

    // Backdate the failure past the cooldown.
    await pool.query(
      `UPDATE academic_agent_runs SET created_at = NOW() - INTERVAL '7 hours'
        WHERE topic_id = $1`,
      [failedTopic],
    );

    const planned = (await planAgentWork(pool, { kinds: ['homework'] })).filter(
      (item) => item.topicId === failedTopic,
    );
    expect(planned.length).toBeGreaterThan(0);
  });

  it('does not cool down a topic that succeeded, so a fresh book takes effect at once', async () => {
    await ingestSourceDocument(pool, {
      formId: 'std5',
      subjectId: SUBJECT_ID,
      title: 'Primary Mathematics 5',
      pages: sourcePages(),
    });

    // Generates fewer than the target, so the topic is still short afterwards.
    await runAgent(pool, { llm: llmReturning(validModelOutput(1)), limit: 1, kinds: ['homework'] });

    const topicId = (await listAgentRuns(pool))[0]?.topicId as string;
    const planned = (await planAgentWork(pool, { kinds: ['homework'] })).filter(
      (item) => item.topicId === topicId,
    );

    // Succeeded, so no backoff: it is immediately available to be topped up again.
    expect(planned.length).toBeGreaterThan(0);
  });

  it('does nothing at all when there is no source', async () => {
    const summary = await runAgent(pool, { llm: llmReturning(validModelOutput(2)) });

    expect(summary.attempted).toBe(0);
    expect(await listContentItems(pool)).toEqual([]);
    expect(await listAgentRuns(pool)).toEqual([]);
  });

  it('leaves published items alone', async () => {
    await ingestSourceDocument(pool, {
      formId: 'std5',
      subjectId: SUBJECT_ID,
      title: 'Primary Mathematics 5',
      pages: sourcePages(),
    });

    await runAgent(pool, { llm: llmReturning(validModelOutput(1)), limit: 1, kinds: ['homework'] });
    const [draft] = await listContentItems(pool, { status: 'draft' });
    await publishContentItem(pool, draft?.id as string);

    const publishedBefore = await listContentItems(pool, { status: 'published' });
    await runAgent(pool, { llm: llmReturning(validModelOutput(1)), limit: 1, kinds: ['homework'] });
    const publishedAfter = await listContentItems(pool, { status: 'published' });

    expect(publishedAfter.map((item) => item.id)).toEqual(publishedBefore.map((item) => item.id));
  });
});
