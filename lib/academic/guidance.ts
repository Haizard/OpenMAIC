import { getStudentScope, scopePredicate } from '@/lib/academic/reading';
import { listWeakTopics } from '@/lib/academic/practice';
import type { AcademicDb } from '@/lib/academic/register';

/**
 * Guidance engine — Slice 5.
 *
 * Turns four rooms into a map: a ranked plan for today, built from work that already exists.
 *
 * Two rules shape everything here:
 *
 * 1. **The plan is derived, never stored.** A stored plan is a cache of four other tables and
 *    every write path would have to invalidate it. One miss tells a student to do work they
 *    already handed in, which is the one failure a study planner cannot survive.
 * 2. **"Untouched", never "weak".** No per-topic score exists anywhere in the schema — quiz
 *    questions carry no `topic_id`. Coverage is derivable; mastery is not. See the slice spec,
 *    Decision 1.
 *
 * See docs/superpowers/specs/2026-09-12-academic-hub-slice-5-guidance-engine.md.
 */

export type PlanStepKind = 'homework' | 'assignment' | 'holiday' | 'reading' | 'practice';

export type PlanReason =
  | 'overdue'
  | 'due_soon'
  | 'missing_recording'
  | 'weak_topic'
  | 'in_progress'
  | 'untouched'
  | 'no_recent_practice';

export interface PlanStep {
  kind: PlanStepKind;
  title: string;
  detail: string;
  topicId: string | null;
  topicName: string | null;
  subjectName: string | null;
  reason: PlanReason;
  priority: number;
  minutes: number;
  href: string;
}

export interface ProgressSummary {
  /** Work handed in, on time or late. */
  submitted: number;
  /** Work still owed. */
  outstanding: number;
  /** Outstanding work whose deadline has passed. */
  overdue: number;
  readingsRead: number;
  readingsTotal: number;
  /** Topics in the student's form with no finished work of any kind. */
  untouchedTopics: number;
  /** Days since the last finished thing, or null when nothing has ever been finished. */
  daysSinceActivity: number | null;
}

export interface StudyPlan {
  steps: PlanStep[];
  summary: ProgressSummary;
  /** `no_form` when the student has no stored grade, so no curriculum work exists. */
  reason: 'no_form' | null;
}

export interface ChildNudge extends ProgressSummary {
  studentId: string;
  studentName: string;
  /** Human-readable nudges, most urgent first, capped at three. */
  nudges: string[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Estimated minutes for a step with no stored duration. */
const DEFAULT_MINUTES: Record<PlanStepKind, number> = {
  homework: 20,
  assignment: 20,
  holiday: 20,
  reading: 10,
  practice: 15,
};

/** Days without finished work after which practice is suggested. */
export const STALE_ACTIVITY_DAYS = 5;

/**
 * Ranking order.
 *
 * `missing_recording` outranks `due_soon` on purpose, not by accident: an item that needs a
 * take cannot be submitted at all until it is recorded, so it is strictly more blocked than
 * ordinary due-soon work and deserves to be surfaced first even when it is due later.
 */
const REASON_PRIORITY: Record<PlanReason, number> = {
  overdue: 0,
  missing_recording: 1,
  due_soon: 2,
  // Below deadlines, because a deadline resolves itself while a weak topic persists until
  // someone does something about it. Capped in `buildStudyPlan` so drills never bury homework.
  weak_topic: 3,
  in_progress: 4,
  untouched: 5,
  no_recent_practice: 6,
};

/** How many weak-topic steps may appear in one plan. */
export const MAX_WEAK_TOPIC_STEPS = 2;

/**
 * A step before ranking. `dueAt` is carried only to break ties and never reaches the client.
 */
interface StepDraft {
  kind: PlanStepKind;
  title: string;
  detail: string;
  topicId: string | null;
  topicName: string | null;
  subjectName: string | null;
  reason: PlanReason;
  minutes: number;
  href: string;
  dueAt: Date | null;
}

interface RawWorkItem {
  id: string;
  title: string;
  topic_id: string | null;
  status: string;
  due_at: Date | string | null;
  kind: string;
  package_id: string | null;
  requires_recording: boolean;
  has_recording: boolean;
  topic_name: string | null;
  subject_name: string | null;
}

interface RawReadingItem {
  id: string;
  title: string;
  topic_id: string;
  status: string;
  reading_minutes: number;
  topic_name: string | null;
  subject_name: string | null;
}

interface RawTopic {
  id: string;
  name: string;
  subject_name: string;
}

function toDate(v: Date | string): Date {
  return v instanceof Date ? v : new Date(v);
}

// ─── Plan ─────────────────────────────────────────────────────────────

/**
 * Build the ranked plan for one student.
 *
 * Every read is scoped by `student_id`. This is the function the roadmap's test targets: the
 * plan must reflect only the signed-in student's own data.
 */
export async function buildStudyPlan(
  db: AcademicDb,
  studentId: string,
  now: Date = new Date(),
): Promise<StudyPlan> {
  const scope = await getStudentScope(db, studentId);
  if (!scope?.formId) {
    return { steps: [], summary: emptySummary(), reason: 'no_form' };
  }

  const [work, readings, untouched, activity, totals] = await Promise.all([
    loadWork(db, studentId),
    loadReadings(db, studentId, scope.formId, scope.levelId),
    loadUntouchedTopics(db, studentId),
    loadLastActivity(db, studentId),
    loadTotals(db, studentId, scope.formId, scope.levelId),
  ]);

  const drafts: StepDraft[] = [];

  for (const item of work) {
    if (item.status !== 'pending') continue;

    const dueAt = item.due_at ? toDate(item.due_at) : null;
    const overdue = dueAt !== null && dueAt.getTime() < now.getTime();
    const needsRecording = item.requires_recording && !item.has_recording;

    let reason: PlanReason = 'due_soon';
    if (overdue) reason = 'overdue';
    else if (needsRecording) reason = 'missing_recording';

    drafts.push({
      kind: item.package_id ? 'holiday' : item.kind === 'homework' ? 'homework' : 'assignment',
      title: item.title,
      detail: needsRecording
        ? 'This one has to be answered out loud before it can be handed in.'
        : overdue
          ? 'Past its deadline.'
          : 'Due soon.',
      topicId: item.topic_id,
      topicName: item.topic_name,
      subjectName: item.subject_name,
      reason,
      minutes: DEFAULT_MINUTES[item.kind === 'homework' ? 'homework' : 'assignment'],
      href: item.package_id ? '/learn/holiday' : '/learn/homework',
      dueAt,
    });
  }

  for (const reading of readings) {
    const inProgress = reading.status === 'reading';
    drafts.push({
      kind: 'reading',
      title: reading.title,
      detail: inProgress ? 'You started this one.' : 'Not read yet.',
      topicId: reading.topic_id,
      topicName: reading.topic_name,
      subjectName: reading.subject_name,
      reason: inProgress ? 'in_progress' : 'untouched',
      minutes: reading.reading_minutes || DEFAULT_MINUTES.reading,
      href: `/learn/read/${reading.id}`,
      dueAt: null,
    });
  }

  // Slice 6: real weak topics, once the practice bank has enough evidence to name one. This is
  // the upgrade Slice 5 documented as impossible — an attempt now names a topic, so a score
  // means something. Topics with no attempts are simply absent here.
  for (const topic of (await listWeakTopics(db, studentId)).slice(0, MAX_WEAK_TOPIC_STEPS)) {
    drafts.push({
      kind: 'practice',
      title: topic.topicName,
      detail: `You are getting about ${Math.round(topic.accuracy * 100)}% right on this. Worth another drill.`,
      topicId: topic.topicId,
      topicName: topic.topicName,
      subjectName: topic.subjectName,
      reason: 'weak_topic',
      minutes: DEFAULT_MINUTES.practice,
      href: `/learn/practice?topic=${encodeURIComponent(topic.topicId)}`,
      dueAt: null,
    });
  }

  // Coverage gaps: topics with no finished work of any kind. Deliberately not called "weak" — a
  // topic with practice evidence gets a `weak_topic` step above, and this one only ever reports
  // absence.
  for (const topic of untouched) {
    drafts.push({
      kind: 'reading',
      title: topic.name,
      detail: 'Nothing finished on this topic yet.',
      topicId: topic.id,
      topicName: topic.name,
      subjectName: topic.subject_name,
      reason: 'untouched',
      minutes: DEFAULT_MINUTES.reading,
      href: '/learn/read',
      dueAt: null,
    });
  }

  const daysSinceActivity = activity
    ? Math.floor((now.getTime() - activity.getTime()) / DAY_MS)
    : null;

  // Practice fills an otherwise empty plan. A student who has caught up and opens the app to a
  // blank page has been told nothing, so the plan always offers something; how long they have
  // been away changes the wording, not whether the step exists.
  if (drafts.length === 0) {
    const stale = daysSinceActivity !== null && daysSinceActivity >= STALE_ACTIVITY_DAYS;
    drafts.push({
      kind: 'practice',
      title: 'Practise a topic you have covered',
      detail:
        daysSinceActivity === null
          ? 'Nothing is due. A short quiz is a good way to start.'
          : stale
            ? `Nothing is due, and it has been ${daysSinceActivity} days since you finished something.`
            : 'Nothing is due right now. A short quiz keeps it fresh.',
      topicId: null,
      topicName: null,
      subjectName: null,
      reason: 'no_recent_practice',
      minutes: DEFAULT_MINUTES.practice,
      href: '/learn/quizzes',
      dueAt: null,
    });
  }

  drafts.sort(compareDrafts);

  const steps: PlanStep[] = drafts.map(({ dueAt: _dueAt, ...rest }) => ({
    ...rest,
    priority: REASON_PRIORITY[rest.reason],
  }));

  return {
    steps,
    summary: {
      submitted: totals.submitted + totals.late,
      outstanding: totals.pending,
      overdue: steps.filter((step) => step.reason === 'overdue').length,
      readingsRead: totals.readingsRead,
      readingsTotal: totals.readingsTotal,
      untouchedTopics: untouched.length,
      daysSinceActivity,
    },
    reason: null,
  };
}

/**
 * Per-child nudge summary for a parent.
 *
 * A nudge is a sentence a mentor can act on, not a score. It calls the same builder as the
 * student plan, so the two views cannot disagree about what is outstanding.
 */
export async function listNudgesForParent(
  db: AcademicDb,
  parentId: string,
  now: Date = new Date(),
): Promise<ChildNudge[]> {
  const children = await db.query<{ id: string; display_name: string }>(
    'SELECT id, display_name FROM academic_students WHERE parent_id = $1 ORDER BY display_name',
    [parentId],
  );

  const result: ChildNudge[] = [];

  for (const child of children.rows) {
    const plan = await buildStudyPlan(db, child.id, now);
    const nudges: string[] = [];

    if (plan.summary.overdue > 0) {
      nudges.push(
        `${plan.summary.overdue} item${plan.summary.overdue === 1 ? '' : 's'} past the deadline.`,
      );
    }
    if (plan.summary.outstanding > 0) {
      nudges.push(
        `${plan.summary.outstanding} piece${plan.summary.outstanding === 1 ? '' : 's'} of work still to hand in.`,
      );
    }

    const missingRecordings = plan.steps.filter((s) => s.reason === 'missing_recording').length;
    if (missingRecordings > 0) {
      nudges.push(
        `${missingRecordings} answer${missingRecordings === 1 ? '' : 's'} still need to be recorded.`,
      );
    }
    if (plan.summary.untouchedTopics > 0) {
      nudges.push(
        `${plan.summary.untouchedTopics} topic${plan.summary.untouchedTopics === 1 ? ' has' : 's have'} not been started.`,
      );
    }
    if (
      plan.summary.daysSinceActivity !== null &&
      plan.summary.daysSinceActivity >= STALE_ACTIVITY_DAYS
    ) {
      nudges.push(`Nothing finished for ${plan.summary.daysSinceActivity} days.`);
    }

    result.push({
      studentId: child.id,
      studentName: child.display_name,
      ...plan.summary,
      nudges: nudges.slice(0, 3),
    });
  }

  return result;
}

// ─── Queries ──────────────────────────────────────────────────────────

async function loadWork(db: AcademicDb, studentId: string): Promise<RawWorkItem[]> {
  const result = await db.query<RawWorkItem>(
    `SELECT h.id, h.title, h.topic_id, h.status, h.due_at, h.kind, h.package_id,
            h.requires_recording,
            EXISTS (SELECT 1 FROM academic_recordings r WHERE r.assignment_id = h.id) AS has_recording,
            t.name AS topic_name, sub.name AS subject_name
     FROM academic_assignments h
     LEFT JOIN curriculum_topics t ON t.id = h.topic_id
     LEFT JOIN curriculum_subjects sub ON sub.id = t.subject_id
     WHERE h.student_id = $1
     ORDER BY h.due_at NULLS LAST, h.title`,
    [studentId],
  );
  return result.rows;
}

async function loadReadings(
  db: AcademicDb,
  studentId: string,
  formId: string,
  levelId: string,
): Promise<RawReadingItem[]> {
  const result = await db.query<RawReadingItem>(
    `SELECT r.id, r.title, r.topic_id, r.reading_minutes,
            COALESCE(p.status, 'unread') AS status,
            t.name AS topic_name, sub.name AS subject_name
     FROM academic_readings r
     JOIN curriculum_topics t ON t.id = r.topic_id
     JOIN curriculum_subjects sub ON sub.id = t.subject_id
     JOIN curriculum_forms f ON f.id = sub.form_id
     LEFT JOIN academic_reading_progress p ON p.reading_id = r.id AND p.student_id = $1
     WHERE r.published = TRUE AND ${scopePredicate('$2', '$3')}
       AND COALESCE(p.status, 'unread') <> 'read'
     ORDER BY sub.sort_order, sub.name, t.sort_order, t.name, r.sort_order`,
    [studentId, formId, levelId],
  );
  return result.rows;
}

/**
 * Topics in the student's form with no finished work of any kind.
 *
 * "Finished" is deliberately generous — a handed-in assignment, a reading marked read, or a
 * single practice attempt all count. Slice 6 added practice to this list: a topic the student
 * has drilled is not untouched, whatever their score, and listing it as both untouched and weak
 * would be noise.
 *
 * This measures coverage, not quality.
 */
async function loadUntouchedTopics(db: AcademicDb, studentId: string): Promise<RawTopic[]> {
  const result = await db.query<RawTopic>(
    `SELECT t.id, t.name, sub.name AS subject_name
     FROM academic_students a
     JOIN curriculum_subjects sub ON sub.form_id = a.curriculum_form_id
     JOIN curriculum_topics t ON t.subject_id = sub.id
     WHERE a.id = $1
       AND NOT EXISTS (
         SELECT 1 FROM academic_assignments w
         WHERE w.topic_id = t.id AND w.student_id = a.id AND w.status IN ('submitted', 'late')
       )
       AND NOT EXISTS (
         SELECT 1 FROM academic_readings r
         JOIN academic_reading_progress p ON p.reading_id = r.id
         WHERE r.topic_id = t.id AND p.student_id = a.id AND p.status = 'read'
       )
       AND NOT EXISTS (
         SELECT 1 FROM academic_practice_attempts pa
         JOIN academic_practice_items pi ON pi.id = pa.item_id
         WHERE pi.topic_id = t.id AND pa.student_id = a.id
       )
     ORDER BY sub.sort_order, sub.name, t.sort_order, t.name`,
    [studentId],
  );
  return result.rows;
}

/** The most recent finished thing, across work, reading and practice. */
async function loadLastActivity(db: AcademicDb, studentId: string): Promise<Date | null> {
  const result = await db.query<{ latest: Date | string | null }>(
    `SELECT MAX(activity) AS latest FROM (
       SELECT MAX(submitted_at) AS activity FROM academic_assignments WHERE student_id = $1
       UNION ALL
       SELECT MAX(completed_at) FROM academic_reading_progress WHERE student_id = $1
       UNION ALL
       SELECT MAX(submitted_at) FROM academic_quiz_submissions WHERE student_id = $1
     ) events`,
    [studentId],
  );
  const latest = result.rows[0]?.latest;
  return latest ? toDate(latest) : null;
}

interface Totals {
  pending: number;
  submitted: number;
  late: number;
  readingsRead: number;
  readingsTotal: number;
}

async function loadTotals(
  db: AcademicDb,
  studentId: string,
  formId: string,
  levelId: string,
): Promise<Totals> {
  const result = await db.query<{ key: string; value: string | number }>(
    `SELECT 'pending' AS key, COUNT(*) AS value FROM academic_assignments
       WHERE student_id = $1 AND status = 'pending'
     UNION ALL
     SELECT 'submitted', COUNT(*) FROM academic_assignments
       WHERE student_id = $1 AND status = 'submitted'
     UNION ALL
     SELECT 'late', COUNT(*) FROM academic_assignments
       WHERE student_id = $1 AND status = 'late'
     UNION ALL
     SELECT 'readings_read', COUNT(*) FROM academic_reading_progress
       WHERE student_id = $1 AND status = 'read'
     UNION ALL
     SELECT 'readings_total', COUNT(*) FROM academic_readings r
       JOIN curriculum_topics t ON t.id = r.topic_id
       JOIN curriculum_subjects sub ON sub.id = t.subject_id
       JOIN curriculum_forms f ON f.id = sub.form_id
       WHERE r.published = TRUE AND ${scopePredicate('$2', '$3')}`,
    [studentId, formId, levelId],
  );

  const byKey = new Map(result.rows.map((row) => [row.key, Number(row.value)]));
  return {
    pending: byKey.get('pending') ?? 0,
    submitted: byKey.get('submitted') ?? 0,
    late: byKey.get('late') ?? 0,
    readingsRead: byKey.get('readings_read') ?? 0,
    readingsTotal: byKey.get('readings_total') ?? 0,
  };
}

// ─── Sorting ──────────────────────────────────────────────────────────

function compareDrafts(left: StepDraft, right: StepDraft): number {
  const byPriority = REASON_PRIORITY[left.reason] - REASON_PRIORITY[right.reason];
  if (byPriority !== 0) return byPriority;

  // Within a priority, closer deadlines first. Undated work sorts last so it never jumps ahead
  // of something that is actually due.
  const a = left.dueAt?.getTime();
  const b = right.dueAt?.getTime();
  if (a == null) return b == null ? 0 : 1;
  if (b == null) return -1;
  return a - b;
}

function emptySummary(): ProgressSummary {
  return {
    submitted: 0,
    outstanding: 0,
    overdue: 0,
    readingsRead: 0,
    readingsTotal: 0,
    untouchedTopics: 0,
    daysSinceActivity: null,
  };
}
