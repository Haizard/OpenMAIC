import { NextResponse } from 'next/server';

import { requireRole } from '@/lib/academic/auth';
import { getAcademicDb } from '@/lib/academic/db';
import {
  READING_STATUSES,
  setReadingStatus,
  type ReadingStatus,
} from '@/lib/academic/reading';

interface ProgressBody {
  status?: string;
}

function isReadingStatus(value: string): value is ReadingStatus {
  return (READING_STATUSES as readonly string[]).includes(value);
}

/**
 * POST /api/academic/readings/[id]/progress
 *
 * Set the signed-in student's own reading status. Body: { status: 'unread' | 'reading' | 'read' }.
 *
 * 404 when the reading is outside the student's curriculum level, so a student cannot write
 * progress rows for content they should not see.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const session = await requireRole('student');
    const { id } = await params;

    const body = (await request.json()) as ProgressBody;
    const status = body.status?.trim() ?? '';
    if (!isReadingStatus(status)) {
      return NextResponse.json(
        { success: false, error: `status must be one of: ${READING_STATUSES.join(', ')}` },
        { status: 400 },
      );
    }

    const db = await getAcademicDb();
    const saved = await setReadingStatus(db, session.studentId, id, status);
    if (!saved) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, status: saved });
  } catch (error) {
    if (error instanceof Error && error.message === 'Not authenticated') {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    console.error('Update reading progress error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
