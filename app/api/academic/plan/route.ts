import { NextResponse } from 'next/server';

import { requireRole } from '@/lib/academic/auth';
import { getAcademicDb } from '@/lib/academic/db';
import { buildStudyPlan } from '@/lib/academic/guidance';

/**
 * GET /api/academic/plan
 *
 * The signed-in student's ranked study plan. Derived on every call — see the slice spec,
 * Decision 2. The top step is the "what next" recommendation; the full list is the plan.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const session = await requireRole('student');
    const db = await getAcademicDb();
    const plan = await buildStudyPlan(db, session.studentId);
    return NextResponse.json({ success: true, ...plan });
  } catch (error) {
    if (error instanceof Error && error.message === 'Not authenticated') {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    console.error('Build study plan error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
