import { NextResponse } from 'next/server';

import { requireRole } from '@/lib/academic/auth';
import { getAcademicDb } from '@/lib/academic/db';
import { listReadingsForStudent, getReadingSummary } from '@/lib/academic/reading';

/**
 * GET /api/academic/readings
 *
 * The signed-in student's reading library, scoped to their own curriculum level,
 * with their own progress attached. Optional `?topicId=` narrows to one topic.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const session = await requireRole('student');
    const { searchParams } = new URL(request.url);
    const topicId = searchParams.get('topicId') ?? undefined;

    const db = await getAcademicDb();
    const [readings, summary] = await Promise.all([
      listReadingsForStudent(db, session.studentId, { topicId }),
      getReadingSummary(db, session.studentId),
    ]);

    return NextResponse.json({ success: true, readings, summary });
  } catch (error) {
    if (error instanceof Error && error.message === 'Not authenticated') {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    console.error('List readings error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
