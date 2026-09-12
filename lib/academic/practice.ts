import { randomUUID } from 'node:crypto';

import type { AcademicDb } from '@/lib/academic/register';
import { ValidationError } from '@/lib/academic/register';
import { choiceOrderFor, selectContentSet, seedFor } from '@/lib/academic/delivery';

/**
 * Practice drills and topic mastery — Slice 6.
 *
 * The whole point of this module is that an attempt names a curriculum topic. That link is what
 * turns a right/wrong answer into a mastery signal, and it is the thing Slice 5 said it could
 * not do.
 *
 * See docs/superpowers/specs/2026-09-12-academic-hub-slice-6-practice-mastery.md.
 */

/** Attempts a topic needs before any mastery claim is made about it. */
export const MIN_ATTEMPTS_FOR_MASTERY = 4;
/** How many recent attempts mastery is computed over. */
export const MASTERY_WINDOW = 10;
/** Cap on how many items a single drill hands out from the bank. */
export const MAX_PRACTICE_ITEMS = 10;

export type MasteryLabel = 'unknown' | 'weak' | 'developing' | 'strong';

export interface PracticeItem {
  id: string;
  topicId: string;
  prompt: string;
  choices: string[];
  sortOrder: number;
}

export interface PracticeItemWithAnswer extends PracticeItem {
  correctIndex: number;
  explanation: string;
}

export interface AnswerResult {
  correct: boolean;
  correctIndex: number;
  explanation: string;
}

export interface TopicMastery {
  topicId: string;
  topicName: string;
  subjectName: string;
  attempts: number;
  correct: number;
  accuracy: number;
  label: MasteryLabel;
  itemCount: number;
}

export interface PracticeTopic extends TopicMastery {
  /** False when the bank has no items for this topic — the UI must say so honestly. */
  hasItems: boolean;
}

// ─── Drill ────────────────────────────────────────────────────────────

/**
 * The drill for one topic: prompts and choices, with the answer stripped.
 *
 * Scoped to the student's own curriculum form, so a student is never handed another level's
 * questions (rule 8).
 */
export async function listPracticeItems(
  db: AcademicDb,
  studentId: string,
  topicId: string,
): Promise<PracticeItem[]> {
  await assertTopicInScope(db, studentId, topicId);

  // Phase D: the shared bank first. Each student gets the items in their own order and the
  // choices in their own order, both derived from their id, so the same drill looks different
  // to every student in the class without storing a permutation anywhere.
  const fromBank = await selectContentSet(db, {
    studentId,
    kind: 'practice',
    setKey: topicId,
    topicId,
    count: MAX_PRACTICE_ITEMS,
  });

  if (fromBank.length > 0) {
    return fromBank.map((item, index) => {
      const order = choiceOrderFor(item.choices?.length ?? 0, seedFor(studentId, item.id));
      return {
        id: item.id,
        topicId: item.topicId ?? topicId,
        prompt: item.prompt,
        choices: order.map((trueIndex) => item.choices?.[trueIndex] ?? ''),
        sortOrder: index,
      };
    });
  }

  // Nothing published for this topic: fall back to the hand-authored bank, which is what this
  // function has always served.
  const result = await db.query<RawItem>(
    `SELECT id, topic_id, prompt, choices, sort_order
     FROM academic_practice_items
     WHERE topic_id = $1 AND published = TRUE
     ORDER BY sort_order, id`,
    [topicId],
  );

  return result.rows.map(mapItem);
}

/**
 * Grade an answer to a generated bank item.
 *
 * The index the student clicked is a *display* index: the choices were reshuffled for them, so
 * it has to be mapped back through the same seed before it means anything. Returns null when
 * the id is not a published practice item, so the caller can fall through to the other bank.
 */
async function answerBankItem(
  db: AcademicDb,
  studentId: string,
  itemId: string,
  choiceIndex: number,
): Promise<AnswerResult | null> {
  const result = await db.query<{
    id: string;
    topic_id: string | null;
    choices: string[] | string;
    correct_index: number | null;
    explanation: string;
  }>(
    `SELECT id, topic_id, choices, correct_index, explanation
     FROM academic_content_items
     WHERE id = $1 AND kind = 'practice' AND status = 'published'`,
    [itemId],
  );

  const row = result.rows[0];
  if (!row || !row.topic_id) return null;

  await assertTopicInScope(db, studentId, row.topic_id);

  if (!Number.isInteger(choiceIndex) || choiceIndex < 0) {
    throw new ValidationError('Choose one of the answers');
  }

  const choices = parseChoices(row.choices);
  if (choiceIndex >= choices.length) {
    throw new ValidationError('Choose one of the answers');
  }

  const order = choiceOrderFor(choices.length, seedFor(studentId, itemId));
  const trueIndex = order[choiceIndex] ?? null;
  const correct = trueIndex !== null && trueIndex === row.correct_index;

  await db.query(
    `INSERT INTO academic_practice_attempts (id, student_id, content_item_id, correct)
     VALUES ($1, $2, $3, $4)`,
    [randomUUID(), studentId, itemId, correct],
  );

  return {
    correct,
    correctIndex: row.correct_index === null ? -1 : order.indexOf(row.correct_index),
    explanation: row.explanation,
  };
}

/**
 * Record an answer and return whether it was right.
 *
 * The attempt is appended, never updated: a re-drill adds evidence instead of erasing the
 * previous answer, and a wrong answer stays visible as a wrong answer.
 */
export async function answerPracticeItem(
  db: AcademicDb,
  studentId: string,
  itemId: string,
  choiceIndex: number,
): Promise<AnswerResult> {
  const item = await db.query<RawItemWithAnswer>(
    `SELECT i.id, i.topic_id, i.prompt, i.choices, i.correct_index, i.explanation, i.sort_order
     FROM academic_practice_items i
     WHERE i.id = $1 AND i.published = TRUE`,
    [itemId],
  );

  const row = item.rows[0];
  if (!row) {
    const fromBank = await answerBankItem(db, studentId, itemId, choiceIndex);
    if (fromBank) return fromBank;
    throw new ValidationError('That practice item is not available');
  }

  // The item must be in the student's own curriculum before any attempt is recorded, so a
  // guessed id from another level is refused rather than silently scored.
  await assertTopicInScope(db, studentId, row.topic_id);

  if (!Number.isInteger(choiceIndex) || choiceIndex < 0) {
    throw new ValidationError('Choose one of the answers');
  }

  const choices = parseChoices(row.choices);
  if (choiceIndex >= choices.length) {
    throw new ValidationError('Choose one of the answers');
  }

  const correct = choiceIndex === row.correct_index;

  await db.query(
    `INSERT INTO academic_practice_attempts (id, student_id, item_id, correct)
     VALUES ($1, $2, $3, $4)`,
    [randomUUID(), studentId, itemId, correct],
  );

  return {
    correct,
    correctIndex: row.correct_index,
    explanation: row.explanation,
  };
}

// ─── Mastery ──────────────────────────────────────────────────────────

/**
 * Label a topic from its recent accuracy.
 *
 * Below `MIN_ATTEMPTS_FOR_MASTERY` the answer is `unknown`, never `weak`: one wrong answer is
 * not evidence of anything, and claiming weakness from it is the same overreach Slice 5 refused
 * when it renamed "weak" to "untouched".
 */
export function labelForAccuracy(attempts: number, accuracy: number): MasteryLabel {
  if (attempts < MIN_ATTEMPTS_FOR_MASTERY) return 'unknown';
  if (accuracy < 0.6) return 'weak';
  if (accuracy < 0.8) return 'developing';
  return 'strong';
}

/**
 * Mastery for every topic in the student's form that has bank items.
 *
 * Only the most recent `MASTERY_WINDOW` attempts per topic count, so a topic the student has
 * since improved recovers instead of being permanently marked down by an early bad session.
 */
export async function listTopicMastery(
  db: AcademicDb,
  studentId: string,
): Promise<TopicMastery[]> {
  // An attempt names a topic through whichever bank the item came from. Both are resolved to a
  // topic id here, so mastery does not care where the question was authored.
  const result = await db.query<RawMastery>(
    `WITH resolved AS (
       SELECT COALESCE(pi.topic_id, ci.topic_id) AS topic_id,
              a.correct,
              ROW_NUMBER() OVER (
                PARTITION BY COALESCE(pi.topic_id, ci.topic_id)
                ORDER BY a.answered_at DESC
              ) AS recency
       FROM academic_practice_attempts a
       LEFT JOIN academic_practice_items pi ON pi.id = a.item_id
       LEFT JOIN academic_content_items ci ON ci.id = a.content_item_id
       WHERE a.student_id = $1
     ),
     recent AS (
       SELECT topic_id, correct FROM resolved WHERE recency <= $2
     ),
     counts AS (
       SELECT topic_id,
              COUNT(*)::int AS attempts,
              COUNT(*) FILTER (WHERE correct)::int AS correct
       FROM recent
       GROUP BY topic_id
     ),
     available AS (
       SELECT topic_id, COUNT(*)::int AS item_count FROM (
         SELECT topic_id FROM academic_practice_items WHERE published = TRUE
         UNION ALL
         SELECT topic_id FROM academic_content_items
           WHERE status = 'published' AND kind = 'practice' AND topic_id IS NOT NULL
       ) both_banks
       GROUP BY topic_id
     )
     SELECT t.id AS topic_id, t.name AS topic_name, sub.name AS subject_name,
            COALESCE(c.attempts, 0)::int AS attempts,
            COALESCE(c.correct, 0)::int AS correct,
            COALESCE(av.item_count, 0)::int AS item_count
     FROM academic_students s
     JOIN curriculum_subjects sub ON sub.form_id = s.curriculum_form_id
     JOIN curriculum_topics t ON t.subject_id = sub.id
     LEFT JOIN counts c ON c.topic_id = t.id
     LEFT JOIN available av ON av.topic_id = t.id
     WHERE s.id = $1 AND COALESCE(av.item_count, 0) > 0
     ORDER BY sub.sort_order, sub.name, t.sort_order, t.name`,
    [studentId, MASTERY_WINDOW],
  );

  return result.rows.map((row) => {
    const attempts = Number(row.attempts);
    const correct = Number(row.correct);
    const accuracy = attempts === 0 ? 0 : correct / attempts;
    return {
      topicId: row.topic_id,
      topicName: row.topic_name,
      subjectName: row.subject_name,
      attempts,
      correct,
      accuracy,
      label: labelForAccuracy(attempts, accuracy),
      itemCount: Number(row.item_count),
    };
  });
}

/** Topics the student has actually been scored weak on, worst first. */
export async function listWeakTopics(db: AcademicDb, studentId: string): Promise<TopicMastery[]> {
  const all = await listTopicMastery(db, studentId);
  return all
    .filter((topic) => topic.label === 'weak')
    .sort((left, right) => left.accuracy - right.accuracy);
}

// ─── Parent (mentor) visibility ───────────────────────────────────────

export interface ChildPractice {
  studentId: string;
  studentName: string;
  attempts: number;
  correct: number;
  accuracy: number;
  weakTopics: TopicMastery[];
}

export async function listPracticeForParent(
  db: AcademicDb,
  parentId: string,
): Promise<ChildPractice[]> {
  const children = await db.query<{ id: string; display_name: string }>(
    'SELECT id, display_name FROM academic_students WHERE parent_id = $1 ORDER BY display_name',
    [parentId],
  );

  const result: ChildPractice[] = [];

  for (const child of children.rows) {
    const mastery = await listTopicMastery(db, child.id);
    const attempts = mastery.reduce((sum, topic) => sum + topic.attempts, 0);
    const correct = mastery.reduce((sum, topic) => sum + topic.correct, 0);

    result.push({
      studentId: child.id,
      studentName: child.display_name,
      attempts,
      correct,
      accuracy: attempts === 0 ? 0 : correct / attempts,
      weakTopics: mastery.filter((topic) => topic.label === 'weak'),
    });
  }

  return result;
}

// ─── Scope ────────────────────────────────────────────────────────────

/**
 * Refuse a topic outside the student's own curriculum form.
 *
 * Rule 8: content is curriculum-scoped. A practice id from another level must be refused, not
 * merely filtered out of a list.
 */
export async function assertTopicInScope(
  db: AcademicDb,
  studentId: string,
  topicId: string,
): Promise<void> {
  const result = await db.query<{ id: string }>(
    `SELECT t.id
     FROM academic_students s
     JOIN curriculum_subjects sub ON sub.form_id = s.curriculum_form_id
     JOIN curriculum_topics t ON t.subject_id = sub.id
     WHERE s.id = $1 AND t.id = $2`,
    [studentId, topicId],
  );
  if (!result.rows[0]) {
    throw new ValidationError('That topic is not in your class');
  }
}

// ─── Mappers ──────────────────────────────────────────────────────────

interface RawItem {
  id: string;
  topic_id: string;
  prompt: string;
  choices: string[] | string;
  sort_order: number;
}

interface RawItemWithAnswer extends RawItem {
  correct_index: number;
  explanation: string;
}

interface RawMastery {
  topic_id: string;
  topic_name: string;
  subject_name: string;
  attempts: number | string;
  correct: number | string;
  item_count: number | string;
}

function parseChoices(value: string[] | string): string[] {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mapItem(row: RawItem): PracticeItem {
  return {
    id: row.id,
    topicId: row.topic_id,
    prompt: row.prompt,
    choices: parseChoices(row.choices),
    sortOrder: Number(row.sort_order),
  };
}
