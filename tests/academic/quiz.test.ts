import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { registerSchool, registerStudentFirst } from '@/lib/academic/register';
import { ensureAcademicSchema } from '@/lib/academic/schema';
import { ensureQuizSchema } from '@/lib/academic/quiz-schema';
import {
  createQuiz,
  listQuizzes,
  getQuiz,
  deleteQuiz,
  publishQuiz,
  unpublishQuiz,
  addQuestion,
  listQuestions,
  deleteQuestion,
  startSubmission,
  getSubmission,
  saveAnswer,
  submitAndGrade,
  gradeEssayAnswer,
  listSubmissionsForStudent,
} from '@/lib/academic/quiz';

class PGlitePool {
  constructor(readonly db: PGlite) {}
  query<TRow>(text: string, params?: unknown[]) {
    return this.db.query<TRow>(text, params);
  }
}

describe('academic quiz system', () => {
  let db: PGlite;
  let pool: PGlitePool;
  let schoolId: string;
  let schoolUserId: string;

  beforeEach(async () => {
    db = new PGlite();
    pool = new PGlitePool(db);
    await ensureAcademicSchema(pool);
    await ensureQuizSchema(pool);

    const school = await registerSchool(pool, {
      email: 'office@school.test',
      password: 'password12',
      name: 'North High',
      contact: 'principal@school.test',
    });
    schoolId = school.schoolId;
    schoolUserId = school.schoolUserId;
  });

  afterEach(async () => {
    await db.close();
  });

  // ─── Quiz CRUD ─────────────────────────────────────────────────────

  describe('quiz CRUD', () => {
    it('creates and retrieves a quiz', async () => {
      const { id } = await createQuiz(pool, schoolId, {
        title: 'Math Quiz 1',
        description: 'Basic algebra',
        timeLimitMinutes: 30,
      });

      const quiz = await getQuiz(pool, id);
      expect(quiz).not.toBeNull();
      expect(quiz!.title).toBe('Math Quiz 1');
      expect(quiz!.description).toBe('Basic algebra');
      expect(quiz!.timeLimitMinutes).toBe(30);
      expect(quiz!.isPublished).toBe(false);
      expect(quiz!.schoolId).toBe(schoolId);
    });

    it('lists quizzes for a school', async () => {
      await createQuiz(pool, schoolId, { title: 'Quiz A' });
      await createQuiz(pool, schoolId, { title: 'Quiz B' });

      const quizzes = await listQuizzes(pool, schoolId);
      expect(quizzes).toHaveLength(2);
      expect(quizzes.map((q) => q.title).sort()).toEqual(['Quiz A', 'Quiz B']);
    });

    it('publishes and unpublishes a quiz', async () => {
      const { id } = await createQuiz(pool, schoolId, { title: 'Quiz' });

      expect(await publishQuiz(pool, id, schoolId)).toBe(true);
      let quiz = await getQuiz(pool, id);
      expect(quiz!.isPublished).toBe(true);

      expect(await unpublishQuiz(pool, id, schoolId)).toBe(true);
      quiz = await getQuiz(pool, id);
      expect(quiz!.isPublished).toBe(false);
    });

    it('lists only published quizzes', async () => {
      const { id: id1 } = await createQuiz(pool, schoolId, { title: 'Draft' });
      const { id: id2 } = await createQuiz(pool, schoolId, { title: 'Published' });
      await publishQuiz(pool, id2, schoolId);

      const published = await listQuizzes(pool, schoolId);
      expect(published).toHaveLength(2); // school sees all its quizzes
    });

    it('deletes a quiz', async () => {
      const { id } = await createQuiz(pool, schoolId, { title: 'To Delete' });
      expect(await deleteQuiz(pool, id, schoolId)).toBe(true);
      expect(await getQuiz(pool, id)).toBeNull();
    });

    it('cannot delete another school\'s quiz', async () => {
      const other = await registerSchool(pool, {
        email: 'other@school.test',
        password: 'password12',
        name: 'Other',
        contact: 'other@school.test',
      });
      const { id } = await createQuiz(pool, schoolId, { title: 'My Quiz' });
      expect(await deleteQuiz(pool, id, other.schoolId)).toBe(false);
      expect(await getQuiz(pool, id)).not.toBeNull();
    });
  });

  // ─── Question CRUD ──────────────────────────────────────────────────

  describe('question CRUD', () => {
    it('adds and lists questions', async () => {
      const { id: quizId } = await createQuiz(pool, schoolId, { title: 'Quiz' });

      await addQuestion(pool, quizId, {
        questionType: 'multiple_choice',
        questionText: 'What is 2+2?',
        options: ['3', '4', '5', '6'],
        correctAnswer: '4',
        points: 2,
        sortOrder: 1,
      });

      await addQuestion(pool, quizId, {
        questionType: 'true_false',
        questionText: 'The sky is blue.',
        correctAnswer: 'true',
        points: 1,
        sortOrder: 2,
      });

      const questions = await listQuestions(pool, quizId);
      expect(questions).toHaveLength(2);
      expect(questions[0]!.questionText).toBe('What is 2+2?');
      expect(questions[0]!.questionType).toBe('multiple_choice');
      expect(questions[0]!.options).toEqual(['3', '4', '5', '6']);
      expect(questions[0]!.correctAnswer).toBe('4');
      expect(questions[0]!.points).toBe(2);
      expect(questions[1]!.questionType).toBe('true_false');
    });

    it('deletes a question', async () => {
      const { id: quizId } = await createQuiz(pool, schoolId, { title: 'Quiz' });
      const { id: qId } = await addQuestion(pool, quizId, {
        questionType: 'fill_blank',
        questionText: 'The capital of France is ____',
        correctAnswer: 'Paris',
      });

      expect(await deleteQuestion(pool, qId, quizId)).toBe(true);
      const questions = await listQuestions(pool, quizId);
      expect(questions).toHaveLength(0);
    });
  });

  // ─── Submission and auto-grading ────────────────────────────────────

  describe('submission and auto-grading', () => {
    let quizId: string;
    let studentId: string;

    beforeEach(async () => {
      const { id } = await createQuiz(pool, schoolId, { title: 'Test Quiz' });
      quizId = id;

      await addQuestion(pool, quizId, {
        questionType: 'multiple_choice',
        questionText: 'What is 2+2?',
        options: ['3', '4', '5'],
        correctAnswer: '4',
        points: 2,
        sortOrder: 1,
      });
      await addQuestion(pool, quizId, {
        questionType: 'true_false',
        questionText: 'The sky is blue.',
        correctAnswer: 'true',
        points: 1,
        sortOrder: 2,
      });
      await addQuestion(pool, quizId, {
        questionType: 'fill_blank',
        questionText: 'Capital of France: ____',
        correctAnswer: 'paris',
        points: 3,
        sortOrder: 3,
      });

      const family = await registerStudentFirst(pool, {
        studentEmail: 'student@test.com',
        studentPassword: 'password12',
        studentDisplayName: 'Test Student',
        academicLevel: 'primary',
        parentEmail: 'parent@test.com',
        parentPassword: 'password34',
        parentDisplayName: 'Test Parent',
      });
      const student = await pool.query<{ id: string }>(
        'SELECT id FROM academic_students WHERE user_id = $1',
        [family.studentUserId],
      );
      studentId = student.rows[0]!.id;
    });

    it('starts a submission', async () => {
      const result = await startSubmission(pool, quizId, studentId);
      expect(result).not.toBeNull();
      expect(result!.id).toBeDefined();

      const submission = await getSubmission(pool, result!.id);
      expect(submission).not.toBeNull();
      expect(submission!.status).toBe('in_progress');
    });

    it('returns existing in-progress submission on retry', async () => {
      const first = await startSubmission(pool, quizId, studentId);
      const second = await startSubmission(pool, quizId, studentId);
      expect(second!.id).toBe(first!.id);
    });

    it('saves answers and auto-grades correctly', async () => {
      const { id: subId } = await startSubmission(pool, quizId, studentId);
      const questions = await listQuestions(pool, quizId);

      // Answer all three questions correctly
      await saveAnswer(pool, subId, questions[0]!.id, '4');
      await saveAnswer(pool, subId, questions[1]!.id, 'true');
      await saveAnswer(pool, subId, questions[2]!.id, 'paris');

      const result = await submitAndGrade(pool, subId);
      expect(result.score).toBe(6); // 2 + 1 + 3
      expect(result.maxScore).toBe(6);

      const submission = await getSubmission(pool, subId);
      expect(submission!.status).toBe('graded');
      expect(submission!.score).toBe(6);
    });

    it('scores partial credit for wrong answers', async () => {
      const { id: subId } = await startSubmission(pool, quizId, studentId);
      const questions = await listQuestions(pool, quizId);

      // Answer first correctly, second and third wrong
      await saveAnswer(pool, subId, questions[0]!.id, '4');
      await saveAnswer(pool, subId, questions[1]!.id, 'false');
      await saveAnswer(pool, subId, questions[2]!.id, 'london');

      const result = await submitAndGrade(pool, subId);
      expect(result.score).toBe(2); // only first correct (2 points)
      expect(result.maxScore).toBe(6);
    });

    it('case-insensitive for fill_blank and MC answers', async () => {
      const { id: subId } = await startSubmission(pool, quizId, studentId);
      const questions = await listQuestions(pool, quizId);

      await saveAnswer(pool, subId, questions[0]!.id, '4');
      await saveAnswer(pool, subId, questions[1]!.id, 'True');
      await saveAnswer(pool, subId, questions[2]!.id, 'PARIS');

      const result = await submitAndGrade(pool, subId);
      expect(result.score).toBe(6);
    });

    it('lists submissions for a student', async () => {
      await startSubmission(pool, quizId, studentId);
      const subs = await listSubmissionsForStudent(pool, studentId);
      expect(subs).toHaveLength(1);
      expect(subs[0]!.quizTitle).toBe('Test Quiz');
    });
  });

  // ─── Essay grading ──────────────────────────────────────────────────

  describe('essay grading', () => {
    it('essay questions need manual grading', async () => {
      const { id: quizId } = await createQuiz(pool, schoolId, { title: 'Essay Quiz' });
      await addQuestion(pool, quizId, {
        questionType: 'essay',
        questionText: 'Explain photosynthesis.',
        points: 5,
      });

      const family = await registerStudentFirst(pool, {
        studentEmail: 'student@test.com',
        studentPassword: 'password12',
        studentDisplayName: 'Student',
        academicLevel: 'primary',
        parentEmail: 'parent@test.com',
        parentPassword: 'password34',
        parentDisplayName: 'Parent',
      });
      const student = await pool.query<{ id: string }>(
        'SELECT id FROM academic_students WHERE user_id = $1',
        [family.studentUserId],
      );
      const studentId = student.rows[0]!.id;

      const { id: subId } = await startSubmission(pool, quizId, studentId);
      const questions = await listQuestions(pool, quizId);
      await saveAnswer(pool, subId, questions[0]!.id, 'Photosynthesis converts light to energy...');

      const result = await submitAndGrade(pool, subId);
      // Essay not auto-graded — status should be 'submitted' (needs review)
      expect(result.score).toBe(0);
      const submission = await getSubmission(pool, subId);
      expect(submission!.status).toBe('submitted');
    });

    it('school can grade an essay answer', async () => {
      const { id: quizId } = await createQuiz(pool, schoolId, { title: 'Essay Quiz' });
      const { id: qId } = await addQuestion(pool, quizId, {
        questionType: 'essay',
        questionText: 'Explain photosynthesis.',
        points: 5,
      });

      const family = await registerStudentFirst(pool, {
        studentEmail: 'student@test.com',
        studentPassword: 'password12',
        studentDisplayName: 'Student',
        academicLevel: 'primary',
        parentEmail: 'parent@test.com',
        parentPassword: 'password34',
        parentDisplayName: 'Parent',
      });
      const student = await pool.query<{ id: string }>(
        'SELECT id FROM academic_students WHERE user_id = $1',
        [family.studentUserId],
      );
      const studentId = student.rows[0]!.id;

      const { id: subId } = await startSubmission(pool, quizId, studentId);
      await saveAnswer(pool, subId, qId, 'Photosynthesis converts light to energy...');
      await submitAndGrade(pool, subId);

      // Find the answer ID
      const answers = await pool.query<{ id: string }>(
        'SELECT id FROM academic_quiz_answers WHERE submission_id = $1',
        [subId],
      );
      const answerId = answers.rows[0]!.id;

      // School grades the essay
      const graded = await gradeEssayAnswer(pool, answerId, 4, 'Good explanation but missing detail on chlorophyll');
      expect(graded).toBe(true);

      // Verify the answer was graded
      const answer = await pool.query<{ points_awarded: number; grader_note: string }>(
        'SELECT points_awarded, grader_note FROM academic_quiz_answers WHERE id = $1',
        [answerId],
      );
      expect(answer.rows[0]!.points_awarded).toBe(4);
      expect(answer.rows[0]!.grader_note).toContain('chlorophyll');
    });

    it('finalizes submission status and score after the last essay is graded', async () => {
      const { id: quizId } = await createQuiz(pool, schoolId, { title: 'Mixed Quiz' });
      await addQuestion(pool, quizId, {
        questionType: 'multiple_choice',
        questionText: 'What is 2+2?',
        options: ['3', '4', '5'],
        correctAnswer: '4',
        points: 2,
      });
      await addQuestion(pool, quizId, {
        questionType: 'essay',
        questionText: 'Explain gravity.',
        points: 5,
      });

      const family = await registerStudentFirst(pool, {
        studentEmail: 'student@test.com',
        studentPassword: 'password12',
        studentDisplayName: 'Student',
        academicLevel: 'primary',
        parentEmail: 'parent@test.com',
        parentPassword: 'password34',
        parentDisplayName: 'Parent',
      });
      const student = await pool.query<{ id: string }>(
        'SELECT id FROM academic_students WHERE user_id = $1',
        [family.studentUserId],
      );
      const studentId = student.rows[0]!.id;

      const { id: subId } = await startSubmission(pool, quizId, studentId);
      const questions = await listQuestions(pool, quizId);
      await saveAnswer(pool, subId, questions[0]!.id, '4');
      await saveAnswer(pool, subId, questions[1]!.id, 'Mass attracts mass...');
      await submitAndGrade(pool, subId);

      // While the essay awaits grading the submission stays 'submitted' with partial score
      let submission = await getSubmission(pool, subId);
      expect(submission!.status).toBe('submitted');
      expect(submission!.score).toBe(2);

      const answers = await pool.query<{ id: string }>(
        'SELECT id FROM academic_quiz_answers WHERE submission_id = $1 AND question_id = $2',
        [subId, questions[1]!.id],
      );
      await gradeEssayAnswer(pool, answers.rows[0]!.id, 4, 'Solid answer');

      // Grading the last essay finalizes the submission with the full score
      submission = await getSubmission(pool, subId);
      expect(submission!.status).toBe('graded');
      expect(submission!.score).toBe(6);
      expect(submission!.maxScore).toBe(7);
      expect(submission!.gradedAt).not.toBeNull();
    });
  });
});
