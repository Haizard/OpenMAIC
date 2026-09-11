import { NextResponse } from 'next/server';

import { requireRole } from '@/lib/academic/auth';
import { getAcademicDb } from '@/lib/academic/db';
import { getQuiz, gradeEssayAnswer } from '@/lib/academic/quiz';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; sid: string; aid: string }> },
): Promise<NextResponse> {
  try {
    const session = await requireRole('school');
    const { id, aid } = await params;
    const body = await request.json();
    const db = await getAcademicDb();

    const quiz = await getQuiz(db, id);
    if (!quiz || quiz.schoolId !== session.schoolId) {
      return NextResponse.json({ success: false, error: 'Quiz not found' }, { status: 404 });
    }

    if (body.pointsAwarded === undefined) {
      return NextResponse.json(
        { success: false, error: 'pointsAwarded is required' },
        { status: 400 },
      );
    }

    const graded = await gradeEssayAnswer(db, aid, body.pointsAwarded, body.graderNote ?? '');
    if (!graded) {
      return NextResponse.json({ success: false, error: 'Answer not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Not authenticated') {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    console.error('Grade answer error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
