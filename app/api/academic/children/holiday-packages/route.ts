import { NextResponse } from 'next/server';

import { requireRole } from '@/lib/academic/auth';
import { getAcademicDb } from '@/lib/academic/db';
import { listHolidayPackagesForParent } from '@/lib/academic/holiday';

/**
 * GET /api/academic/children/holiday-packages
 *
 * Outstanding holiday packages for the signed-in parent's own children. Finished packages are
 * omitted — this view exists to answer "what does my child still owe over the break?".
 */
export async function GET(): Promise<NextResponse> {
  try {
    const session = await requireRole('parent');
    const db = await getAcademicDb();
    const children = await listHolidayPackagesForParent(db, session.parentId);
    return NextResponse.json({ success: true, children });
  } catch (error) {
    if (error instanceof Error && error.message === 'Not authenticated') {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    console.error('List children holiday packages error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
