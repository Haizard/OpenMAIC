import { NextResponse } from 'next/server';

import { requireRole } from '@/lib/academic/auth';
import { getAcademicDb } from '@/lib/academic/db';
import { listNudgesForParent } from '@/lib/academic/guidance';

/**
 * GET /api/academic/children/nudges
 *
 * Mentor nudges for the signed-in parent's own children, built by the same function that
 * produces the student's plan so the two views cannot disagree about what is outstanding.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const session = await requireRole('parent');
    const db = await getAcademicDb();
    const children = await listNudgesForParent(db, session.parentId);
    return NextResponse.json({ success: true, children });
  } catch (error) {
    if (error instanceof Error && error.message === 'Not authenticated') {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    console.error('List nudges error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
