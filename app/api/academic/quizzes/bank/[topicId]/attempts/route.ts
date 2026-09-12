import { NextResponse } from 'next/server';

import { requireRole } from '@/lib/academic/auth';
import { getAcademicDb } from '@/lib/academic/db';
import { listBankQuizAttempts } from '@/lib/academic/quiz-bank';

/**
 * GET /api/academic/quizzes/bank/[topicId]/attempts
 *
 * The signed-in student's past sittings of one topic, most recent first.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ topicId: string }> },
): Promise<NextResponse> {
  try {
    const session = await requireRole('student');
    const { topicId } = await context.params;
    const db = await getAcademicDb();
    const attempts = await listBankQuizAttempts(db, session.studentId, topicId);
    return NextResponse.json({ success: true, attempts });
  } catch (error) {
    if (error instanceof Error && error.message === 'Not authenticated') {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    console.error('List bank quiz attempts error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
