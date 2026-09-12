import { createHash } from 'node:crypto';

import type { AcademicDb } from '@/lib/academic/register';
import { listContentItems, type ContentItem, type ContentKind } from '@/lib/academic/content-bank';

/**
 * Per-student mixing — Phase D.
 *
 * Every student on a level draws from the same published bank, but each one gets a different
 * set and a different choice order. Both are derived from a seed rather than stored: seed =
 * hash(studentId, key). That means a reload reproduces the same set for the same student with
 * no extra state to keep in sync, and two students reliably diverge.
 *
 * Grading works because the order is recomputable: given the student and the item, we get the
 * same permutation back and can map the displayed index to the true answer.
 */

/** A stable 32-bit seed from a student id and whatever varies the set (topic, subject, day). */
export function seedFor(studentId: string, key: string): number {
  const digest = createHash('sha256').update(`${studentId}|${key}`, 'utf8').digest('hex');
  return parseInt(digest.slice(0, 8), 16) >>> 0;
}

/** mulberry32: small, fast, and good enough to shuffle a question set. */
function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates driven by a seeded PRNG. Same input, same output, forever. */
export function deterministicShuffle<T>(items: readonly T[], seed: number): readonly T[] {
  const result = [...items];
  const random = makeRandom(seed);
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const swap = result[i]!;
    result[i] = result[j]!;
    result[j] = swap;
  }
  return result;
}

/**
 * The permutation a student sees: `order[displayedIndex]` is the true choice index.
 *
 * Reversing it is the whole point — the browser sends back what the student clicked, and we
 * must not grade against the position that was displayed.
 */
export function choiceOrderFor(choiceCount: number, seed: number): readonly number[] {
  return deterministicShuffle(
    Array.from({ length: choiceCount }, (_unused, index) => index),
    seed,
  );
}

export interface DisplayedChoices {
  /** The choices in the order this student should see them. */
  readonly choices: readonly string[];
  /** `order[displayedIndex]` is the index in the stored item. */
  readonly order: readonly number[];
  /** Where the correct answer landed after shuffling. */
  readonly correctDisplayIndex: number | null;
}

export function displayChoices(item: ContentItem, studentId: string): DisplayedChoices {
  const stored = item.choices ?? [];
  if (stored.length === 0) return { choices: [], order: [], correctDisplayIndex: null };

  const order = choiceOrderFor(stored.length, seedFor(studentId, item.id));
  const choices = order.map((trueIndex) => stored[trueIndex]!);
  const correctDisplayIndex =
    item.correctIndex === null ? null : order.indexOf(item.correctIndex);

  return { choices, order, correctDisplayIndex };
}

/** Map the index a student clicked back to the answer recorded on the item. */
export function trueIndexFor(order: readonly number[], displayedIndex: number): number | null {
  return order[displayedIndex] ?? null;
}

export interface SelectContentOptions {
  readonly studentId: string;
  readonly kind: ContentKind;
  /** What the set varies by. Use the topic for homework, the subject for a mixed drill. */
  readonly setKey: string;
  readonly count: number;
  readonly subjectId?: string;
  readonly topicId?: string;
  /** Already-answered items, so a student is not handed the same question twice in a row. */
  readonly excludeItemIds?: readonly string[];
}

/**
 * Pick a set for one student from the published bank.
 *
 * Empty result is normal, not an error: it means nothing has been published for this scope yet
 * and the caller should fall back to whatever it was already doing.
 */
export async function selectContentSet(
  db: AcademicDb,
  options: SelectContentOptions,
): Promise<readonly ContentItem[]> {
  const exclude = new Set(options.excludeItemIds ?? []);
  const pool = (
    await listContentItems(db, {
      kind: options.kind,
      status: 'published',
      ...(options.subjectId ? { subjectId: options.subjectId } : {}),
      ...(options.topicId ? { topicId: options.topicId } : {}),
    })
  ).filter((item) => !exclude.has(item.id));

  if (pool.length === 0) return [];
  return deterministicShuffle(pool, seedFor(options.studentId, options.setKey)).slice(
    0,
    options.count,
  );
}

/**
 * Point each of a student's homework items at the bank item chosen for its topic.
 *
 * Runs after materialisation and only fills gaps, so it is safe to call on every read and it
 * never rewrites a question a student has already been given. Homework for a topic with
 * nothing published keeps its original topic text — which is what it had before Phase D.
 *
 * Returns how many were attached.
 */
export async function attachContentToHomework(
  db: AcademicDb,
  studentId: string,
): Promise<number> {
  const pending = await db.query<{ id: string; topic_id: string | null }>(
    `SELECT id, topic_id FROM academic_assignments
      WHERE student_id = $1 AND kind = 'homework' AND content_item_id IS NULL`,
    [studentId],
  );

  let attached = 0;
  for (const row of pending.rows) {
    if (!row.topic_id) continue;
    const item = await selectContentItemForTopic(db, studentId, row.topic_id, 'homework');
    if (!item) continue;

    const updated = await db.query<{ id: string }>(
      `UPDATE academic_assignments
        SET content_item_id = $2, description = $3, updated_at = NOW()
        WHERE id = $1 AND content_item_id IS NULL
        RETURNING id`,
      [row.id, item.id, item.prompt],
    );
    if (updated.rows[0]) attached += 1;
  }

  return attached;
}

/** The single item a student should get for a topic, or null when none is published. */
export async function selectContentItemForTopic(
  db: AcademicDb,
  studentId: string,
  topicId: string,
  kind: ContentKind,
): Promise<ContentItem | null> {
  const [item] = await selectContentSet(db, {
    studentId,
    kind,
    setKey: topicId,
    count: 1,
    topicId,
  });
  return item ?? null;
}
