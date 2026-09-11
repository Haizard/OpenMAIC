import { NextResponse } from 'next/server';

import { requireRole } from '@/lib/academic/auth';
import { getAcademicDb } from '@/lib/academic/db';
import { listPublishedQuizzes } from '@/lib/academic/quiz';

export async function GET(): Promise<NextResponse> {
  try {
    await requireRole('student');
    const db = await getAcademicDb();
    const quizzes = await listPublishedQuizzes(db);
    return NextResponse.json({ success: true, quizzes });
  } catch (error) {
    if (error instanceof Error && error.message === 'Not authenticated') {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    console.error('List published quizzes error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
