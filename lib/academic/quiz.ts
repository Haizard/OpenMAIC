import { randomUUID } from 'node:crypto';

import type { AcademicDb } from '@/lib/academic/register';

// ─── Types ─────────────────────────────────────────────────────────────

export type QuestionType = 'multiple_choice' | 'true_false' | 'fill_blank' | 'essay';
export type SubmissionStatus = 'in_progress' | 'submitted' | 'graded';

export interface Quiz {
  id: string;
  schoolId: string;
  title: string;
  description: string;
  timeLimitMinutes: number | null;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuizQuestion {
  id: string;
  quizId: string;
  questionType: QuestionType;
  questionText: string;
  options: string[] | null;
  correctAnswer: string | null;
  points: number;
  sortOrder: number;
}

export interface QuizSubmission {
  id: string;
  quizId: string;
  studentId: string;
  status: SubmissionStatus;
  score: number | null;
  maxScore: number | null;
  startedAt: Date;
  submittedAt: Date | null;
  gradedAt: Date | null;
}

export interface QuizAnswer {
  id: string;
  submissionId: string;
  questionId: string;
  answerText: string | null;
  isCorrect: boolean | null;
  pointsAwarded: number;
  graderNote: string | null;
}

// Input types
export interface CreateQuizInput {
  title: string;
  description?: string;
  timeLimitMinutes?: number | null;
}

export interface CreateQuestionInput {
  questionType: QuestionType;
  questionText: string;
  options?: string[];
  correctAnswer?: string;
  points?: number;
  sortOrder?: number;
}

export interface SubmitAnswerInput {
  questionId: string;
  answerText: string;
}

// ─── Quiz CRUD ─────────────────────────────────────────────────────────

export async function createQuiz(
  db: AcademicDb,
  schoolId: string,
  input: CreateQuizInput,
): Promise<{ id: string }> {
  const id = randomUUID();
  await db.query(
    `INSERT INTO academic_quizzes (id, school_id, title, description, time_limit_minutes)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, schoolId, input.title.trim(), input.description?.trim() ?? '', input.timeLimitMinutes ?? null],
  );
  return { id };
}

export async function listQuizzes(db: AcademicDb, schoolId: string): Promise<Quiz[]> {
  const result = await db.query<RawQuiz>(
    `SELECT id, school_id, title, description, time_limit_minutes, is_published, created_at, updated_at
     FROM academic_quizzes
     WHERE school_id = $1
     ORDER BY created_at DESC`,
    [schoolId],
  );
  return result.rows.map(mapQuiz);
}

export async function listPublishedQuizzes(db: AcademicDb): Promise<Quiz[]> {
  const result = await db.query<RawQuiz>(
    `SELECT id, school_id, title, description, time_limit_minutes, is_published, created_at, updated_at
     FROM academic_quizzes
     WHERE is_published = true
     ORDER BY created_at DESC`,
  );
  return result.rows.map(mapQuiz);
}

export async function getQuiz(db: AcademicDb, quizId: string): Promise<Quiz | null> {
  const result = await db.query<RawQuiz>(
    `SELECT id, school_id, title, description, time_limit_minutes, is_published, created_at, updated_at
     FROM academic_quizzes
     WHERE id = $1`,
    [quizId],
  );
  return result.rows[0] ? mapQuiz(result.rows[0]) : null;
}

export async function publishQuiz(db: AcademicDb, quizId: string, schoolId: string): Promise<boolean> {
  const result = await db.query(
    `UPDATE academic_quizzes SET is_published = true, updated_at = NOW()
     WHERE id = $1 AND school_id = $2
     RETURNING id`,
    [quizId, schoolId],
  );
  return (result.rows as unknown[]).length > 0;
}

export async function unpublishQuiz(db: AcademicDb, quizId: string, schoolId: string): Promise<boolean> {
  const result = await db.query(
    `UPDATE academic_quizzes SET is_published = false, updated_at = NOW()
     WHERE id = $1 AND school_id = $2
     RETURNING id`,
    [quizId, schoolId],
  );
  return (result.rows as unknown[]).length > 0;
}

export async function deleteQuiz(db: AcademicDb, quizId: string, schoolId: string): Promise<boolean> {
  const result = await db.query(
    `DELETE FROM academic_quizzes WHERE id = $1 AND school_id = $2 RETURNING id`,
    [quizId, schoolId],
  );
  return (result.rows as unknown[]).length > 0;
}

// ─── Question CRUD ─────────────────────────────────────────────────────

export async function addQuestion(
  db: AcademicDb,
  quizId: string,
  input: CreateQuestionInput,
): Promise<{ id: string }> {
  const id = randomUUID();
  await db.query(
    `INSERT INTO academic_quiz_questions (id, quiz_id, question_type, question_text, options, correct_answer, points, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      id,
      quizId,
      input.questionType,
      input.questionText,
      input.options ? JSON.stringify(input.options) : null,
      input.correctAnswer ?? null,
      input.points ?? 1,
      input.sortOrder ?? 0,
    ],
  );
  return { id };
}

export async function listQuestions(db: AcademicDb, quizId: string): Promise<QuizQuestion[]> {
  const result = await db.query<RawQuestion>(
    `SELECT id, quiz_id, question_type, question_text, options, correct_answer, points, sort_order
     FROM academic_quiz_questions
     WHERE quiz_id = $1
     ORDER BY sort_order, created_at`,
    [quizId],
  );
  return result.rows.map(mapQuestion);
}

export async function listQuestionsForGrading(db: AcademicDb, quizId: string): Promise<QuizQuestion[]> {
  // Same as listQuestions but includes correct answers for school review
  return listQuestions(db, quizId);
}

export async function updateQuestion(
  db: AcademicDb,
  questionId: string,
  quizId: string,
  input: Partial<CreateQuestionInput>,
): Promise<boolean> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (input.questionType !== undefined) {
    fields.push(`question_type = $${idx++}`);
    values.push(input.questionType);
  }
  if (input.questionText !== undefined) {
    fields.push(`question_text = $${idx++}`);
    values.push(input.questionText);
  }
  if (input.options !== undefined) {
    fields.push(`options = $${idx++}`);
    values.push(JSON.stringify(input.options));
  }
  if (input.correctAnswer !== undefined) {
    fields.push(`correct_answer = $${idx++}`);
    values.push(input.correctAnswer);
  }
  if (input.points !== undefined) {
    fields.push(`points = $${idx++}`);
    values.push(input.points);
  }
  if (input.sortOrder !== undefined) {
    fields.push(`sort_order = $${idx++}`);
    values.push(input.sortOrder);
  }

  if (fields.length === 0) return false;

  values.push(questionId, quizId);
  const result = await db.query(
    `UPDATE academic_quiz_questions SET ${fields.join(', ')}
     WHERE id = $${idx++} AND quiz_id = $${idx}
     RETURNING id`,
    values,
  );
  return (result.rows as unknown[]).length > 0;
}

export async function deleteQuestion(db: AcademicDb, questionId: string, quizId: string): Promise<boolean> {
  const result = await db.query(
    `DELETE FROM academic_quiz_questions WHERE id = $1 AND quiz_id = $2 RETURNING id`,
    [questionId, quizId],
  );
  return (result.rows as unknown[]).length > 0;
}

// ─── Submission ────────────────────────────────────────────────────────

export async function startSubmission(
  db: AcademicDb,
  quizId: string,
  studentId: string,
): Promise<{ id: string } | null> {
  // Check if already has an in-progress submission
  const existing = await db.query<{ id: string }>(
    `SELECT id FROM academic_quiz_submissions
     WHERE quiz_id = $1 AND student_id = $2 AND status = 'in_progress'`,
    [quizId, studentId],
  );
  if ((existing.rows as unknown[]).length > 0) {
    return existing.rows[0]!;
  }

  // Check if quiz allows new submissions (not already graded)
  const graded = await db.query<{ id: string }>(
    `SELECT id FROM academic_quiz_submissions
     WHERE quiz_id = $1 AND student_id = $2 AND status = 'graded'`,
    [quizId, studentId],
  );
  if ((graded.rows as unknown[]).length > 0) {
    return null; // Already completed and graded
  }

  const id = randomUUID();
  await db.query(
    `INSERT INTO academic_quiz_submissions (id, quiz_id, student_id, status)
     VALUES ($1, $2, $3, 'in_progress')`,
    [id, quizId, studentId],
  );
  return { id };
}

export async function getSubmission(
  db: AcademicDb,
  submissionId: string,
): Promise<QuizSubmission | null> {
  const result = await db.query<RawSubmission>(
    `SELECT id, quiz_id, student_id, status, score, max_score, started_at, submitted_at, graded_at
     FROM academic_quiz_submissions
     WHERE id = $1`,
    [submissionId],
  );
  return result.rows[0] ? mapSubmission(result.rows[0]) : null;
}

export async function getSubmissionByQuizAndStudent(
  db: AcademicDb,
  quizId: string,
  studentId: string,
): Promise<QuizSubmission | null> {
  const result = await db.query<RawSubmission>(
    `SELECT id, quiz_id, student_id, status, score, max_score, started_at, submitted_at, graded_at
     FROM academic_quiz_submissions
     WHERE quiz_id = $1 AND student_id = $2`,
    [quizId, studentId],
  );
  return result.rows[0] ? mapSubmission(result.rows[0]) : null;
}

export async function listSubmissionsForQuiz(
  db: AcademicDb,
  quizId: string,
): Promise<(QuizSubmission & { studentName: string })[]> {
  const result = await db.query(
    `SELECT s.id, s.quiz_id, s.student_id, s.status, s.score, s.max_score,
            s.started_at, s.submitted_at, s.graded_at,
            st.display_name AS student_name
     FROM academic_quiz_submissions s
     JOIN academic_students st ON st.id = s.student_id
     WHERE s.quiz_id = $1
     ORDER BY s.submitted_at DESC NULLS LAST`,
    [quizId],
  );
  return (result.rows as RawSubmissionWithStudent[]).map((row) => ({
    ...mapSubmission(row),
    studentName: row.student_name,
  }));
}

export async function listSubmissionsForStudent(
  db: AcademicDb,
  studentId: string,
): Promise<(QuizSubmission & { quizTitle: string })[]> {
  const result = await db.query(
    `SELECT s.id, s.quiz_id, s.student_id, s.status, s.score, s.max_score,
            s.started_at, s.submitted_at, s.graded_at,
            q.title AS quiz_title
     FROM academic_quiz_submissions s
     JOIN academic_quizzes q ON q.id = s.quiz_id
     WHERE s.student_id = $1
     ORDER BY s.submitted_at DESC NULLS LAST`,
    [studentId],
  );
  return (result.rows as RawSubmissionWithQuiz[]).map((row) => ({
    ...mapSubmission(row),
    quizTitle: row.quiz_title,
  }));
}

// ─── Answers ───────────────────────────────────────────────────────────

export async function saveAnswer(
  db: AcademicDb,
  submissionId: string,
  questionId: string,
  answerText: string,
): Promise<{ id: string }> {
  // Upsert: if answer already exists for this question, update it
  const existing = await db.query<{ id: string }>(
    `SELECT id FROM academic_quiz_answers WHERE submission_id = $1 AND question_id = $2`,
    [submissionId, questionId],
  );

  if ((existing.rows as unknown[]).length > 0) {
    await db.query(
      `UPDATE academic_quiz_answers SET answer_text = $1 WHERE id = $2`,
      [answerText, existing.rows[0]!.id],
    );
    return { id: existing.rows[0]!.id };
  }

  const id = randomUUID();
  await db.query(
    `INSERT INTO academic_quiz_answers (id, submission_id, question_id, answer_text)
     VALUES ($1, $2, $3, $4)`,
    [id, submissionId, questionId, answerText],
  );
  return { id };
}

export async function listAnswers(
  db: AcademicDb,
  submissionId: string,
): Promise<QuizAnswer[]> {
  const result = await db.query<RawAnswer>(
    `SELECT id, submission_id, question_id, answer_text, is_correct, points_awarded, grader_note
     FROM academic_quiz_answers
     WHERE submission_id = $1`,
    [submissionId],
  );
  return result.rows.map(mapAnswer);
}

// ─── Auto-Grading ──────────────────────────────────────────────────────

export async function submitAndGrade(
  db: AcademicDb,
  submissionId: string,
): Promise<{ score: number; maxScore: number }> {
  // Load questions
  const submission = await getSubmission(db, submissionId);
  if (!submission) throw new Error('Submission not found');
  if (submission.status !== 'in_progress') throw new Error('Submission is not in progress');

  const questions = await listQuestions(db, submission.quizId);
  const answers = await listAnswers(db, submissionId);

  let totalScore = 0;
  let maxScore = 0;
  const answersByQuestion = new Map(answers.map((a) => [a.questionId, a]));

  for (const question of questions) {
    maxScore += question.points;
    const answer = answersByQuestion.get(question.id);
    if (!answer || answer.answerText === null || answer.answerText.trim() === '') {
      continue;
    }

    let isCorrect: boolean | null = false;
    let pointsAwarded = 0;

    switch (question.questionType) {
      case 'multiple_choice':
      case 'true_false': {
        const userAnswer = answer.answerText.trim().toLowerCase();
        const correct = question.correctAnswer?.trim().toLowerCase() ?? '';
        isCorrect = userAnswer === correct;
        pointsAwarded = isCorrect ? question.points : 0;
        break;
      }
      case 'fill_blank': {
        const userAnswer = answer.answerText.trim().toLowerCase();
        const correct = question.correctAnswer?.trim().toLowerCase() ?? '';
        isCorrect = userAnswer === correct;
        pointsAwarded = isCorrect ? question.points : 0;
        break;
      }
      case 'essay':
        // Essays need manual grading — mark as not graded yet
        isCorrect = null;
        pointsAwarded = 0;
        break;
    }

    totalScore += pointsAwarded;
    await db.query(
      `UPDATE academic_quiz_answers
       SET is_correct = $1, points_awarded = $2
       WHERE id = $3`,
      [isCorrect, pointsAwarded, answer.id],
    );
  }

  // Essays with a graded answer row (or without any essay answers at all) are done;
  // a pending essay answer row still needs manual grading.
  const essayQuestions = questions.filter((q) => q.questionType === 'essay');
  const hasEssays = essayQuestions.length > 0;
  const allEssaysGraded = essayQuestions.every((q) => {
    const ans = answersByQuestion.get(q.id);
    return !ans || ans.isCorrect !== null;
  });

  const newStatus: SubmissionStatus = hasEssays && !allEssaysGraded ? 'submitted' : 'graded';

  await db.query(
    `UPDATE academic_quiz_submissions
     SET status = $1, score = $2, max_score = $3, submitted_at = NOW(),
         ${newStatus === 'graded' ? 'graded_at = NOW(),' : ''} updated_at = NOW()
     WHERE id = $4`,
    [newStatus, totalScore, maxScore, submissionId],
  );

  return { score: totalScore, maxScore };
}

// ─── Grade Essay ───────────────────────────────────────────────────────

export async function gradeEssayAnswer(
  db: AcademicDb,
  answerId: string,
  pointsAwarded: number,
  graderNote: string,
): Promise<boolean> {
  const result = await db.query<{ id: string; submission_id: string }>(
    `UPDATE academic_quiz_answers
     SET points_awarded = $1, grader_note = $2, is_correct = $3
     WHERE id = $4
     RETURNING id, submission_id`,
    [pointsAwarded, graderNote, pointsAwarded > 0, answerId],
  );
  if (result.rows.length === 0) return false;

  // Recompute the submission score and finalize its status if no essay
  // answers are still awaiting manual grading.
  const submissionId = result.rows[0]!.submission_id;
  const submission = await getSubmission(db, submissionId);
  if (submission && submission.status === 'submitted') {
    const score = await recomputeSubmissionScore(db, submissionId);
    const questions = await listQuestions(db, submission.quizId);
    const answers = await listAnswers(db, submissionId);
    const answersByQuestion = new Map(answers.map((a) => [a.questionId, a]));
    const allEssaysGraded = questions
      .filter((q) => q.questionType === 'essay')
      .every((q) => {
        const ans = answersByQuestion.get(q.id);
        return !ans || ans.isCorrect !== null;
      });

    await db.query(
      `UPDATE academic_quiz_submissions
       SET score = $1, max_score = $2${allEssaysGraded ? ', status = \'graded\', graded_at = NOW()' : ''}
       WHERE id = $3`,
      [score.score, score.maxScore, submissionId],
    );
  }

  return true;
}

async function recomputeSubmissionScore(
  db: AcademicDb,
  submissionId: string,
): Promise<{ score: number; maxScore: number }> {
  const submission = await getSubmission(db, submissionId);
  if (!submission) return { score: 0, maxScore: 0 };

  const questions = await listQuestions(db, submission.quizId);
  const answers = await listAnswers(db, submissionId);
  const answersByQuestion = new Map(answers.map((a) => [a.questionId, a]));

  let score = 0;
  let maxScore = 0;
  for (const question of questions) {
    maxScore += question.points;
    const ans = answersByQuestion.get(question.id);
    if (ans && ans.isCorrect !== null) {
      score += ans.pointsAwarded;
    }
  }
  return { score, maxScore };
}

// ─── Mappers ───────────────────────────────────────────────────────────

interface RawQuiz {
  id: string;
  school_id: string;
  title: string;
  description: string;
  time_limit_minutes: number | null;
  is_published: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

interface RawQuestion {
  id: string;
  quiz_id: string;
  question_type: string;
  question_text: string;
  options: string | string[] | null;
  correct_answer: string | null;
  points: number;
  sort_order: number;
}

interface RawSubmission {
  id: string;
  quiz_id: string;
  student_id: string;
  status: string;
  score: number | null;
  max_score: number | null;
  started_at: Date | string;
  submitted_at: Date | string | null;
  graded_at: Date | string | null;
}

interface RawSubmissionWithStudent extends RawSubmission {
  student_name: string;
}

interface RawSubmissionWithQuiz extends RawSubmission {
  quiz_title: string;
}

interface RawAnswer {
  id: string;
  submission_id: string;
  question_id: string;
  answer_text: string | null;
  is_correct: boolean | null;
  points_awarded: number;
  grader_note: string | null;
}

function toDate(v: Date | string): Date {
  return v instanceof Date ? v : new Date(v);
}

function mapQuiz(row: RawQuiz): Quiz {
  return {
    id: row.id,
    schoolId: row.school_id,
    title: row.title,
    description: row.description,
    timeLimitMinutes: row.time_limit_minutes,
    isPublished: row.is_published,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

function mapQuestion(row: RawQuestion): QuizQuestion {
  let options: string[] | null = null;
  if (row.options) {
    options = typeof row.options === 'string' ? JSON.parse(row.options) : row.options;
  }
  return {
    id: row.id,
    quizId: row.quiz_id,
    questionType: row.question_type as QuestionType,
    questionText: row.question_text,
    options,
    correctAnswer: row.correct_answer,
    points: row.points,
    sortOrder: row.sort_order,
  };
}

function mapSubmission(row: RawSubmission): QuizSubmission {
  return {
    id: row.id,
    quizId: row.quiz_id,
    studentId: row.student_id,
    status: row.status as SubmissionStatus,
    score: row.score,
    maxScore: row.max_score,
    startedAt: toDate(row.started_at),
    submittedAt: row.submitted_at ? toDate(row.submitted_at) : null,
    gradedAt: row.graded_at ? toDate(row.graded_at) : null,
  };
}

function mapAnswer(row: RawAnswer): QuizAnswer {
  return {
    id: row.id,
    submissionId: row.submission_id,
    questionId: row.question_id,
    answerText: row.answer_text,
    isCorrect: row.is_correct,
    pointsAwarded: row.points_awarded,
    graderNote: row.grader_note,
  };
}
