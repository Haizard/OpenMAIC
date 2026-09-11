import { NextResponse } from 'next/server';

import { requireRole } from '@/lib/academic/auth';
import { getAcademicDb } from '@/lib/academic/db';
import { getSubmission, listAnswers, getQuiz } from '@/lib/academic/quiz';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; sid: string }> },
): Promise<NextResponse> {
  try {
    const session = await requireRole('school');
    const { id, sid } = await params;
    const db = await getAcademicDb();

    const quiz = await getQuiz(db, id);
    if (!quiz || quiz.schoolId !== session.schoolId) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    const submission = await getSubmission(db, sid);
    if (!submission || submission.quizId !== id) {
      return NextResponse.json({ success: false, error: 'Submission not found' }, { status: 404 });
    }

    const answers = await listAnswers(db, sid);
    return NextResponse.json({ success: true, submission, answers });
  } catch (error) {
    if (error instanceof Error && error.message === 'Not authenticated') {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    console.error('Get submission error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
