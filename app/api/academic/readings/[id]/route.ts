import { NextResponse } from 'next/server';

import { requireRole } from '@/lib/academic/auth';
import { getAcademicDb } from '@/lib/academic/db';
import { getReadingForStudent, setReadingStatus } from '@/lib/academic/reading';

/**
 * GET /api/academic/readings/[id]
 *
 * One reading for the signed-in student, with the body. Opening a reading for the first
 * time advances it from `unread` to `reading` — but never overwrites `read`.
 *
 * Returns 404 for readings that are unpublished or outside the student's curriculum level,
 * so the caller cannot distinguish "does not exist" from "not yours".
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const session = await requireRole('student');
    const { id } = await params;
    const db = await getAcademicDb();

    const reading = await getReadingForStudent(db, session.studentId, id);
    if (!reading) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    if (reading.status === 'unread') {
      const next = await setReadingStatus(db, session.studentId, id, 'reading');
      if (next) reading.status = next;
    }

    return NextResponse.json({ success: true, reading });
  } catch (error) {
    if (error instanceof Error && error.message === 'Not authenticated') {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    console.error('Get reading error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
