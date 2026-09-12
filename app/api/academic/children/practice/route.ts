import { NextResponse } from 'next/server';

import { requireRole } from '@/lib/academic/auth';
import { getAcademicDb } from '@/lib/academic/db';
import { listPracticeForParent } from '@/lib/academic/practice';

/**
 * GET /api/academic/children/practice
 *
 * Practice activity and weak topics for the signed-in parent's own children only.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const session = await requireRole('parent');
    const db = await getAcademicDb();
    const children = await listPracticeForParent(db, session.parentId);
    return NextResponse.json({ success: true, children });
  } catch (error) {
    if (error instanceof Error && error.message === 'Not authenticated') {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    console.error('List children practice error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
