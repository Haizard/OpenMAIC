import { randomUUID } from 'node:crypto';

import type { AcademicDb } from '@/lib/academic/register';
import { ValidationError } from '@/lib/academic/register';

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
  const result = await db.query<RawMastery>(
    `SELECT t.id AS topic_id, t.name AS topic_name, sub.name AS subject_name,
            COUNT(a.id)::int AS attempts,
            COALESCE(SUM(CASE WHEN a.correct THEN 1 ELSE 0 END), 0)::int AS correct,
            COUNT(i.id) AS item_count
     FROM academic_students s
     JOIN curriculum_subjects sub ON sub.form_id = s.curriculum_form_id
     JOIN curriculum_topics t ON t.subject_id = sub.id
     JOIN academic_practice_items i ON i.topic_id = t.id AND i.published = TRUE
     LEFT JOIN LATERAL (
       SELECT a.id, a.correct
       FROM academic_practice_attempts a
       WHERE a.student_id = s.id AND a.item_id = i.id
       ORDER BY a.answered_at DESC
       LIMIT ${MASTERY_WINDOW}
     ) a ON TRUE
     WHERE s.id = $1
     GROUP BY t.id, t.name, t.sort_order, sub.name, sub.sort_order
     ORDER BY sub.sort_order, sub.name, t.sort_order, t.name`,
    [studentId],
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
async function assertTopicInScope(
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
