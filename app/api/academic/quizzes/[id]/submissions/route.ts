import { NextResponse } from 'next/server';

import { requireRole } from '@/lib/academic/auth';
import { getAcademicDb } from '@/lib/academic/db';
import { listSubmissionsForQuiz, listSubmissionsForStudent, getQuiz } from '@/lib/academic/quiz';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const session = await requireRole('school');
    const { id } = await params;
    const db = await getAcademicDb();

    const quiz = await getQuiz(db, id);
    if (!quiz || quiz.schoolId !== session.schoolId) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    const submissions = await listSubmissionsForQuiz(db, id);
    return NextResponse.json({ success: true, submissions });
  } catch (error) {
    if (error instanceof Error && error.message === 'Not authenticated') {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    console.error('List submissions error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
