import { NextResponse } from 'next/server';

import { requireRole } from '@/lib/academic/auth';
import { getAcademicDb } from '@/lib/academic/db';
import { startBankQuiz } from '@/lib/academic/quiz-bank';
import { ValidationError } from '@/lib/academic/register';

/**
 * POST /api/academic/quizzes/bank/[topicId]/start
 *
 * The questions for one sitting, in this student's own order. The correct answer is not part of
 * the response — this is the quiz, not the mark scheme.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ topicId: string }> },
): Promise<NextResponse> {
  try {
    const session = await requireRole('student');
    const { topicId } = await context.params;
    const db = await getAcademicDb();
    const questions = await startBankQuiz(db, session.studentId, topicId);
    return NextResponse.json({ success: true, questions });
  } catch (error) {
    if (error instanceof Error && error.message === 'Not authenticated') {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    console.error('Start bank quiz error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
