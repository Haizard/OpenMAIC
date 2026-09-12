import type { AcademicDb } from '@/lib/academic/register';
import { attachContentToHomework, choiceOrderFor, seedFor } from '@/lib/academic/delivery';
import { ValidationError } from '@/lib/academic/register';
import type { AssignmentStatus } from '@/lib/academic/assignment';

/**
 * Homework — Slice 3.
 *
 * Homework is work that was **set for** the student, as opposed to an assignment they started
 * themselves. It lives in `academic_assignments` with `kind = 'homework'` and shares the one
 * submission lifecycle. See docs/superpowers/specs/2026-09-12-academic-hub-slice-3-homework.md.
 *
 * v1 has no teacher role, so the platform sets the work: one homework item per topic in the
 * student's own curriculum form. The student did not choose it and cannot delete it.
 */

/** How long a freshly materialised homework item is given. */
export const HOMEWORK_DUE_DAYS = 7;
/** A pending item due within this window counts as "due soon". */
export const DUE_SOON_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export type HomeworkBucket = 'overdue' | 'due_soon' | 'later';

/**
 * A bank-backed question as one student sees it.
 *
 * `correctIndex` is null until they answer. Revealing it in the list would hand every student
 * the answer key along with the homework.
 */
export interface HomeworkQuestion {
  prompt: string;
  choices: string[];
  /** Where the correct answer sits in `choices` — only set once answered. */
  correctIndex: number | null;
  explanation: string;
  answeredIndex: number | null;
  wasCorrect: boolean | null;
}

export interface HomeworkItem {
  id: string;
  title: string;
  description: string;
  topicId: string | null;
  topicName: string | null;
  subjectName: string | null;
  /** Phase D: the bank item this work was drawn from, or null when none was published. */
  contentItemId: string | null;
  /**
   * The question, with the choices in this student's own order. Null for homework that is not
   * bank-backed. The correct answer is deliberately absent until the student has answered.
   */
  content: HomeworkQuestion | null;
  status: AssignmentStatus;
  dueAt: Date | null;
  submittedAt: Date | null;
  bucket: HomeworkBucket;
}

export interface HomeworkCounts {
  overdue: number;
  dueSoon: number;
  later: number;
}

export interface StudentHomework {
  overdue: HomeworkItem[];
  dueSoon: HomeworkItem[];
  later: HomeworkItem[];
  counts: HomeworkCounts;
  total: number;
  /** `no_form` when homework could not be materialised because no grade is stored. */
  reason: 'no_form' | null;
}

export interface ChildHomework extends StudentHomework {
  studentId: string;
  studentName: string;
}

/** Which bucket a due date falls into, relative to `now`. */
export function bucketFor(dueAt: Date | null, now: Date = new Date()): HomeworkBucket {
  if (!dueAt) return 'later';
  const remaining = dueAt.getTime() - now.getTime();
  if (remaining < 0) return 'overdue';
  if (remaining <= DUE_SOON_DAYS * DAY_MS) return 'due_soon';
  return 'later';
}

function emptyBuckets(): StudentHomework {
  return {
    overdue: [],
    dueSoon: [],
    later: [],
    counts: { overdue: 0, dueSoon: 0, later: 0 },
    total: 0,
    reason: null,
  };
}

function bucketItems(items: HomeworkItem[], now: Date): StudentHomework {
  const result = emptyBuckets();
  for (const item of items) {
    const bucket = bucketFor(item.dueAt, now);
    const withBucket = { ...item, bucket };
    if (bucket === 'overdue') result.overdue.push(withBucket);
    else if (bucket === 'due_soon') result.dueSoon.push(withBucket);
    else result.later.push(withBucket);
  }
  result.counts = {
    overdue: result.overdue.length,
    dueSoon: result.dueSoon.length,
    later: result.later.length,
  };
  result.total = items.length;
  return result;
}

/**
 * Create this student's homework from their curriculum form.
 *
 * Idempotent: a partial unique index on `(student_id, topic_id) WHERE kind = 'homework'`
 * means re-running adds nothing. Returns the number of rows actually inserted.
 *
 * A student with no stored form yields zero rows rather than an error — see
 * `listHomeworkForStudent`, which reports that as `reason: 'no_form'`.
 */
export async function materializeHomework(
  db: AcademicDb,
  studentId: string,
  now: Date = new Date(),
): Promise<number> {
  const dueAt = new Date(now.getTime() + HOMEWORK_DUE_DAYS * DAY_MS);

  const result = await db.query<{ id: string }>(
    `INSERT INTO academic_assignments
       (id, student_id, topic_id, title, description, status, due_at, kind, assigned_by)
     SELECT gen_random_uuid()::text,
            a.id,
            t.id,
            t.name,
            COALESCE(t.description, ''),
            'pending',
            $2::timestamptz,
            'homework',
            'platform'
     FROM academic_students a
     JOIN curriculum_subjects sub ON sub.form_id = a.curriculum_form_id
     JOIN curriculum_topics t ON t.subject_id = sub.id
     WHERE a.id = $1
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [studentId, dueAt],
  );

  return result.rows.length;
}

/** Whether the student has a curriculum form, which homework depends on. */
export async function studentHasForm(db: AcademicDb, studentId: string): Promise<boolean> {
  const result = await db.query<{ curriculum_form_id: string | null }>(
    'SELECT curriculum_form_id FROM academic_students WHERE id = $1',
    [studentId],
  );
  return Boolean(result.rows[0]?.curriculum_form_id);
}

/** The signed-in student's homework, materialised on demand and bucketed by urgency. */
export async function listHomeworkForStudent(
  db: AcademicDb,
  studentId: string,
  now: Date = new Date(),
): Promise<StudentHomework> {
  if (!(await studentHasForm(db, studentId))) {
    return { ...emptyBuckets(), reason: 'no_form' };
  }

  await materializeHomework(db, studentId, now);
  // Phase D: swap the topic blurb for the question the bank chose for this student, where the
  // bank has one. Idempotent and gap-filling, so a topic with nothing published is untouched.
  await attachContentToHomework(db, studentId);

  const result = await db.query<RawHomework>(
    `SELECT h.id, h.title, h.description, h.topic_id, h.content_item_id, h.status, h.due_at,
            h.submitted_at, h.content_choice_index, h.content_answer_correct,
            ci.prompt AS question_prompt, ci.choices AS question_choices,
            ci.correct_index AS question_correct_index, ci.explanation AS question_explanation,
            t.name AS topic_name, sub.name AS subject_name
     FROM academic_assignments h
     LEFT JOIN academic_content_items ci ON ci.id = h.content_item_id
     LEFT JOIN curriculum_topics t ON t.id = h.topic_id
     LEFT JOIN curriculum_subjects sub ON sub.id = t.subject_id
     WHERE h.student_id = $1 AND h.kind = 'homework'
     ORDER BY h.due_at NULLS LAST, h.title`,
    [studentId],
  );

  return bucketItems(result.rows.map((row) => mapHomeworkItem(row, studentId)), now);
}

/**
 * Pending homework for a parent's own children, bucketed the same way.
 *
 * Only `pending` work is returned — this view answers "what does my child still owe?".
 * Submitted and late work is excluded; the parent has the Slice 1 assignment list for history.
 * Children with nothing pending are omitted entirely.
 */
export async function listPendingHomeworkForParent(
  db: AcademicDb,
  parentId: string,
  now: Date = new Date(),
): Promise<ChildHomework[]> {
  const result = await db.query<RawHomeworkWithStudent>(
    `SELECT h.id, h.title, h.description, h.topic_id, h.status, h.due_at, h.submitted_at,
            t.name AS topic_name, sub.name AS subject_name,
            s.id AS student_id, s.display_name AS student_name
     FROM academic_assignments h
     JOIN academic_students s ON s.id = h.student_id
     LEFT JOIN curriculum_topics t ON t.id = h.topic_id
     LEFT JOIN curriculum_subjects sub ON sub.id = t.subject_id
     WHERE s.parent_id = $1 AND h.kind = 'homework' AND h.status = 'pending'
     ORDER BY s.display_name, h.due_at NULLS LAST, h.title`,
    [parentId],
  );

  const byStudent = new Map<string, { studentName: string; items: HomeworkItem[] }>();
  for (const row of result.rows) {
    const entry = byStudent.get(row.student_id) ?? {
      studentName: row.student_name,
      items: [],
    };
    entry.items.push(mapHomeworkItem(row, row.student_id));
    byStudent.set(row.student_id, entry);
  }

  return [...byStudent.entries()].map(([studentId, entry]) => ({
    ...bucketItems(entry.items, now),
    studentId,
    studentName: entry.studentName,
  }));
}


// ─── Answering a generated question ───────────────────────────────────

export interface HomeworkAnswerResult {
  readonly correct: boolean;
  /** Where the right answer sits in the choices this student was shown. */
  readonly correctIndex: number;
  readonly explanation: string;
}

/**
 * Answer a bank-backed homework question.
 *
 * The index is the position the student clicked, not the position the answer is stored in — the
 * choices were shuffled for them, so it is resolved back through the seed before it is graded.
 * Answering does not submit the homework: submission stays the student's own action, because a
 * homework item can also require a recording before it can be handed in.
 */
export async function answerHomework(
  db: AcademicDb,
  studentId: string,
  assignmentId: string,
  choiceIndex: number,
): Promise<HomeworkAnswerResult> {
  const result = await db.query<{
    choices: string[] | string | null;
    correct_index: number | null;
    explanation: string | null;
    content_item_id: string;
  }>(
    `SELECT ci.choices, ci.correct_index, ci.explanation, ci.id AS content_item_id
     FROM academic_assignments h
     JOIN academic_content_items ci ON ci.id = h.content_item_id
     WHERE h.id = $1 AND h.student_id = $2 AND h.kind = 'homework'`,
    [assignmentId, studentId],
  );

  const row = result.rows[0];
  if (!row) throw new ValidationError('That homework has no question to answer');

  if (!Number.isInteger(choiceIndex) || choiceIndex < 0) {
    throw new ValidationError('Choose one of the answers');
  }

  const choices = parseChoices(row.choices);
  if (choiceIndex >= choices.length) {
    throw new ValidationError('Choose one of the answers');
  }

  const order = choiceOrderFor(choices.length, seedFor(studentId, row.content_item_id));
  const trueIndex = order[choiceIndex] ?? -1;
  const correct = trueIndex === row.correct_index;

  await db.query(
    `UPDATE academic_assignments
      SET content_choice_index = $2, content_answer_correct = $3, updated_at = NOW()
      WHERE id = $1`,
    [assignmentId, choiceIndex, correct],
  );

  return {
    correct,
    correctIndex: row.correct_index === null ? -1 : order.indexOf(row.correct_index),
    explanation: row.explanation ?? '',
  };
}

// ─── Mappers ───────────────────────────────────────────────────────────

interface RawHomework {
  id: string;
  title: string;
  description: string;
  topic_id: string | null;
  content_item_id: string | null;
  content_choice_index: number | null;
  content_answer_correct: boolean | null;
  question_prompt: string | null;
  question_choices: string[] | string | null;
  question_correct_index: number | null;
  question_explanation: string | null;
  status: string;
  due_at: Date | string | null;
  submitted_at: Date | string | null;
  topic_name: string | null;
  subject_name: string | null;
}

interface RawHomeworkWithStudent extends RawHomework {
  student_id: string;
  student_name: string;
}

function toDate(v: Date | string): Date {
  return v instanceof Date ? v : new Date(v);
}

function parseChoices(value: string[] | string | null): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Rebuild the question the way this student saw it.
 *
 * The choices are reshuffled from the same seed used when the drill was served, so the position
 * the student clicked can be resolved back to a real answer. Until they answer, `correctIndex`
 * and `explanation` stay empty: a list payload is not a place for an answer key.
 */
function questionFor(row: RawHomework, studentId: string): HomeworkQuestion | null {
  if (!row.content_item_id || row.question_prompt === null) return null;

  const stored = parseChoices(row.question_choices);
  if (stored.length === 0) return null;

  const order = choiceOrderFor(stored.length, seedFor(studentId, row.content_item_id));
  const answered = row.content_choice_index;
  const hasAnswered = answered !== null;

  return {
    prompt: row.question_prompt,
    choices: order.map((index) => stored[index] ?? ''),
    correctIndex:
      hasAnswered && row.question_correct_index !== null
        ? order.indexOf(row.question_correct_index)
        : null,
    explanation: hasAnswered ? (row.question_explanation ?? '') : '',
    answeredIndex: answered,
    wasCorrect: row.content_answer_correct,
  };
}

function mapHomeworkItem(row: RawHomework, studentId: string): HomeworkItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    topicId: row.topic_id,
    contentItemId: row.content_item_id,
    content: questionFor(row, studentId),
    topicName: row.topic_name,
    subjectName: row.subject_name,
    status: row.status as AssignmentStatus,
    dueAt: row.due_at ? toDate(row.due_at) : null,
    submittedAt: row.submitted_at ? toDate(row.submitted_at) : null,
    bucket: 'later',
  };
}
