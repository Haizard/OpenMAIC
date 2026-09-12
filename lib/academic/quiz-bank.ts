import { randomUUID } from 'node:crypto';

import type { AcademicDb } from '@/lib/academic/register';
import { ValidationError } from '@/lib/academic/register';
import { displayChoices, selectContentSet, trueIndexFor } from '@/lib/academic/delivery';
import { assertTopicInScope } from '@/lib/academic/practice';

/**
 * Bank-backed quizzes — Phase G.
 *
 * `/learn/quizzes` used to read `academic_quizzes`, whose rows were created by a school and whose
 * questions were written by a teacher. Rule 9 removed the teacher, so nothing could ever fill that
 * table again: the surface was live code with no possible content, while the bank already knew how
 * to generate `quiz` items that nobody served.
 *
 * So a quiz is now a topic that has published `quiz` items in the bank. There is no author and no
 * quiz row — the bank is the quiz.
 *
 * Same rule as everywhere else: the bank is consulted, and whatever the surface did before is the
 * fallback. School quizzes are still listed; they just are not the only thing any more.
 */

/** How many questions a quiz has. */
export const QUIZ_LENGTH = 10;

/**
 * How many published items a topic needs before it is offered as a quiz.
 *
 * Below this the same questions would come round too often to be worth sitting: a topic with three
 * published items cannot make a ten-question quiz that feels like a test.
 */
export const MIN_ITEMS_FOR_QUIZ = 5;

export interface BankQuiz {
  readonly topicId: string;
  readonly topicName: string;
  readonly subjectId: string;
  readonly subjectName: string;
  /** Questions the student will actually get: the available items, capped at `QUIZ_LENGTH`. */
  readonly questionCount: number;
  readonly attemptCount: number;
  readonly bestScore: number | null;
  readonly bestMaxScore: number | null;
  readonly lastScore: number | null;
  readonly lastMaxScore: number | null;
}

/**
 * The quizzes available to one student: every topic in their own form that has enough published
 * quiz items, with how they have done on each so far.
 */
export async function listBankQuizzes(
  db: AcademicDb,
  studentId: string,
): Promise<readonly BankQuiz[]> {
  const topics = await db.query<{
    topic_id: string;
    topic_name: string;
    subject_id: string;
    subject_name: string;
    question_count: string | number;
  }>(
    `SELECT t.id AS topic_id, t.name AS topic_name,
            sub.id AS subject_id, sub.name AS subject_name,
            LEAST(COUNT(ci.id), $2) AS question_count
       FROM academic_students s
       JOIN curriculum_subjects sub ON sub.form_id = s.curriculum_form_id
       JOIN curriculum_topics t ON t.subject_id = sub.id
       LEFT JOIN academic_content_items ci
         ON ci.topic_id = t.id AND ci.kind = 'quiz' AND ci.status = 'published'
      WHERE s.id = $1
      GROUP BY t.id, t.name, sub.id, sub.name, sub.sort_order, t.sort_order
     HAVING COUNT(ci.id) >= $3
      ORDER BY sub.name, t.sort_order, t.name`,
    [studentId, QUIZ_LENGTH, MIN_ITEMS_FOR_QUIZ],
  );

  const history = await quizHistory(db, studentId);

  return topics.rows.map((row) => {
    const past = history.get(row.topic_id);
    return {
      topicId: row.topic_id,
      topicName: row.topic_name,
      subjectId: row.subject_id,
      subjectName: row.subject_name,
      questionCount: Number(row.question_count),
      attemptCount: past?.attemptCount ?? 0,
      bestScore: past?.best.score ?? null,
      bestMaxScore: past?.best.maxScore ?? null,
      lastScore: past?.last.score ?? null,
      lastMaxScore: past?.last.maxScore ?? null,
    };
  });
}

interface TopicHistory {
  attemptCount: number;
  best: { score: number; maxScore: number };
  last: { score: number; maxScore: number };
}

/**
 * Best and most recent attempt per topic.
 *
 * Best is by proportion, not by raw score: a later upload can change how many questions a quiz
 * has, and 6/10 is a better result than 5/5 only if you ignore that they are not the same test.
 */
async function quizHistory(
  db: AcademicDb,
  studentId: string,
): Promise<ReadonlyMap<string, TopicHistory>> {
  const result = await db.query<{
    topic_id: string;
    score: number;
    max_score: number;
    started_at: Date | string;
  }>(
    `SELECT topic_id, score, max_score, started_at
       FROM academic_bank_quiz_attempts
      WHERE student_id = $1
      ORDER BY started_at`,
    [studentId],
  );

  const byTopic = new Map<string, TopicHistory>();
  for (const row of result.rows) {
    const attempt = { score: Number(row.score), maxScore: Number(row.max_score) };
    const existing = byTopic.get(row.topic_id);
    if (!existing) {
      byTopic.set(row.topic_id, { attemptCount: 1, best: attempt, last: attempt });
      continue;
    }
    existing.attemptCount += 1;
    existing.last = attempt;
    if (attempt.score / attempt.maxScore > existing.best.score / existing.best.maxScore) {
      existing.best = attempt;
    }
  }
  return byTopic;
}

export interface BankQuizQuestion {
  readonly itemId: string;
  readonly prompt: string;
  /** In this student's own order. The correct one is not marked — this is the quiz, not the mark scheme. */
  readonly choices: readonly string[];
}

/**
 * The questions for one sitting.
 *
 * The set and the choice order both come from the student's id, so two students in the same class
 * sit the same topic in a different order without anything being stored.
 */
export async function startBankQuiz(
  db: AcademicDb,
  studentId: string,
  topicId: string,
): Promise<readonly BankQuizQuestion[]> {
  await assertTopicInScope(db, studentId, topicId);

  const items = await quizSet(db, studentId, topicId);
  if (items.length === 0) {
    throw new ValidationError('No quiz is ready for this topic yet');
  }

  return items.map((item) => ({
    itemId: item.id,
    prompt: item.prompt,
    choices: displayChoices(item, studentId).choices,
  }));
}

async function quizSet(db: AcademicDb, studentId: string, topicId: string) {
  return selectContentSet(db, {
    studentId,
    kind: 'quiz',
    setKey: topicId,
    topicId,
    count: QUIZ_LENGTH,
  });
}

export interface BankQuizAnswerInput {
  readonly itemId: string;
  /** The position the student clicked in the order they were shown. */
  readonly choiceIndex: number;
}

export interface BankQuizReview {
  readonly itemId: string;
  readonly prompt: string;
  readonly choices: readonly string[];
  readonly yourIndex: number | null;
  /** Where the right answer sits in `choices` — only meaningful after submitting. */
  readonly correctIndex: number | null;
  readonly explanation: string;
  readonly correct: boolean;
}

export interface BankQuizResult {
  readonly attemptId: string;
  readonly score: number;
  readonly maxScore: number;
  readonly review: readonly BankQuizReview[];
}

/**
 * Grade a sitting.
 *
 * The client sends the position it clicked and nothing else: the order is rebuilt from the seed and
 * the position is resolved back to a real answer, so a student cannot grade themselves by posting
 * the right index. Items that are not part of this student's set are ignored, which also means a
 * crafted payload cannot pull in questions from another topic.
 *
 * `maxScore` is the length of the quiz, not the number answered — otherwise leaving questions blank
 * would be indistinguishable from getting them right.
 */
export async function submitBankQuiz(
  db: AcademicDb,
  studentId: string,
  topicId: string,
  answers: readonly BankQuizAnswerInput[],
): Promise<BankQuizResult> {
  await assertTopicInScope(db, studentId, topicId);

  const items = await quizSet(db, studentId, topicId);
  if (items.length === 0) {
    throw new ValidationError('No quiz is ready for this topic yet');
  }

  const review: BankQuizReview[] = [];
  const stored: { itemId: string; choiceIndex: number; correct: boolean }[] = [];

  for (const item of items) {
    const display = displayChoices(item, studentId);
    const given = answers.find((answer) => answer.itemId === item.id);

    let correct = false;
    let yourIndex: number | null = null;

    if (given && Number.isInteger(given.choiceIndex)) {
      const clicked = given.choiceIndex;
      if (clicked >= 0 && clicked < display.choices.length) {
        yourIndex = clicked;
        const trueIndex = trueIndexFor(display.order, clicked);
        correct = trueIndex !== null && trueIndex === item.correctIndex;
        stored.push({ itemId: item.id, choiceIndex: clicked, correct });
      }
    }

    review.push({
      itemId: item.id,
      prompt: item.prompt,
      choices: display.choices,
      yourIndex,
      correctIndex: display.correctDisplayIndex,
      explanation: item.explanation,
      correct,
    });
  }

  const score = review.filter((entry) => entry.correct).length;
  const attemptId = randomUUID();

  await db.query(
    `INSERT INTO academic_bank_quiz_attempts
       (id, student_id, topic_id, score, max_score, answers, finished_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [attemptId, studentId, topicId, score, items.length, JSON.stringify(stored)],
  );

  return { attemptId, score, maxScore: items.length, review };
}

export interface BankQuizAttempt {
  readonly id: string;
  readonly topicId: string;
  readonly score: number;
  readonly maxScore: number;
  readonly startedAt: string;
}

/** A student's past sittings, most recent first. */
export async function listBankQuizAttempts(
  db: AcademicDb,
  studentId: string,
  topicId?: string,
): Promise<readonly BankQuizAttempt[]> {
  const result = await db.query<{
    id: string;
    topic_id: string;
    score: number;
    max_score: number;
    started_at: Date | string;
  }>(
    `SELECT id, topic_id, score, max_score, started_at
       FROM academic_bank_quiz_attempts
      WHERE student_id = $1 AND ($2::text IS NULL OR topic_id = $2)
      ORDER BY started_at DESC`,
    [studentId, topicId ?? null],
  );

  return result.rows.map((row) => ({
    id: row.id,
    topicId: row.topic_id,
    score: Number(row.score),
    maxScore: Number(row.max_score),
    startedAt:
      row.started_at instanceof Date ? row.started_at.toISOString() : String(row.started_at),
  }));
}
