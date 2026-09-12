import { NextResponse } from 'next/server';

import { OperatorAuthError, requireOperator } from '@/lib/academic/operator-auth';
import { getAcademicDb } from '@/lib/academic/db';
import { listCurriculumTopics } from '@/lib/academic/content-bank';

/**
 * GET /api/academic/operator/topics?subjectId=…
 *
 * Curriculum topics for the operator console's generation scope picker. Reference data only.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    requireOperator(request);
    const subjectId = new URL(request.url).searchParams.get('subjectId');
    if (!subjectId) {
      return NextResponse.json({ success: false, error: 'subjectId is required' }, { status: 400 });
    }
    const db = await getAcademicDb();
    return NextResponse.json({ success: true, topics: await listCurriculumTopics(db, subjectId) });
  } catch (error) {
    if (error instanceof OperatorAuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('List curriculum topics error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
