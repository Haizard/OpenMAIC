import { NextResponse } from 'next/server';

import { requireRole } from '@/lib/academic/auth';
import { getAcademicDb } from '@/lib/academic/db';
import { listPracticeItems } from '@/lib/academic/practice';

/**
 * GET /api/academic/practice/items?topicId=…
 *
 * The drill for one topic. The correct answer is stripped — the client grades by posting the
 * choice back, so the answer never sits in a page payload.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const session = await requireRole('student');
    const topicId = new URL(request.url).searchParams.get('topicId');
    if (!topicId) {
      return NextResponse.json({ success: false, error: 'topicId is required' }, { status: 400 });
    }

    const db = await getAcademicDb();
    const items = await listPracticeItems(db, session.studentId, topicId);
    return NextResponse.json({ success: true, items });
  } catch (error) {
    if (error instanceof Error && error.message === 'Not authenticated') {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    if (error instanceof Error && /not in your class/i.test(error.message)) {
      return NextResponse.json({ success: false, error: error.message }, { status: 404 });
    }
    console.error('List practice items error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
