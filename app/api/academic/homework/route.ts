import { NextResponse } from 'next/server';

import { requireRole } from '@/lib/academic/auth';
import { getAcademicDb } from '@/lib/academic/db';
import { listHomeworkForStudent } from '@/lib/academic/homework';

/**
 * GET /api/academic/homework
 *
 * The signed-in student's homework, materialised from their curriculum form on first call
 * and bucketed into overdue / dueSoon / later.
 *
 * A student with no stored grade gets an empty list and `reason: 'no_form'` — that is not an
 * error, and they are deliberately not given homework for a grade they are not in.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const session = await requireRole('student');
    const db = await getAcademicDb();
    const homework = await listHomeworkForStudent(db, session.studentId);
    return NextResponse.json({ success: true, homework });
  } catch (error) {
    if (error instanceof Error && error.message === 'Not authenticated') {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    console.error('List homework error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
