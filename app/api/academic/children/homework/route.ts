import { NextResponse } from 'next/server';

import { requireRole } from '@/lib/academic/auth';
import { getAcademicDb } from '@/lib/academic/db';
import { listPendingHomeworkForParent } from '@/lib/academic/homework';

/**
 * GET /api/academic/children/homework
 *
 * Parent mentor view: what each of this parent's own children still owes, bucketed into
 * overdue / dueSoon / later. Submitted work is excluded by design.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const session = await requireRole('parent');
    const db = await getAcademicDb();
    const children = await listPendingHomeworkForParent(db, session.parentId);
    return NextResponse.json({ success: true, children });
  } catch (error) {
    if (error instanceof Error && error.message === 'Not authenticated') {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    console.error('Fetch children homework error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
