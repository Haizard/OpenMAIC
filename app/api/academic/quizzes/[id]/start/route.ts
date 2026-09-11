import { NextResponse } from 'next/server';

import { requireRole } from '@/lib/academic/auth';
import { getAcademicDb } from '@/lib/academic/db';
import { getQuiz, listQuestions, startSubmission } from '@/lib/academic/quiz';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const session = await requireRole('student');
    const { id } = await params;
    const db = await getAcademicDb();

    const quiz = await getQuiz(db, id);
    if (!quiz || !quiz.isPublished) {
      return NextResponse.json({ success: false, error: 'Quiz not found or not published' }, { status: 404 });
    }

    const submission = await startSubmission(db, id, session.studentId);
    if (!submission) {
      return NextResponse.json(
        { success: false, error: 'You have already completed this quiz' },
        { status: 409 },
      );
    }

    // Return questions without correct answers
    const questions = await listQuestions(db, id);
    const safeQuestions = questions.map((q) => ({
      id: q.id,
      questionType: q.questionType,
      questionText: q.questionText,
      options: q.options,
      points: q.points,
      sortOrder: q.sortOrder,
      // Don't send correctAnswer to the client
    }));

    return NextResponse.json({
      success: true,
      submissionId: submission.id,
      quiz: {
        title: quiz.title,
        description: quiz.description,
        timeLimitMinutes: quiz.timeLimitMinutes,
      },
      questions: safeQuestions,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Not authenticated') {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    console.error('Start quiz error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
