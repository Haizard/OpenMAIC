import { NextResponse } from 'next/server';

import { OperatorAuthError, requireOperator } from '@/lib/academic/operator-auth';
import { getAcademicDb } from '@/lib/academic/db';
import { listSourceCoverage } from '@/lib/academic/source';

/**
 * GET /api/academic/operator/coverage
 *
 * What the AI can actually teach from today, subject by subject. Subjects with no upload are
 * included with zero counts, because the gaps are the useful part of this view.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    requireOperator(request);
    const db = await getAcademicDb();
    const coverage = await listSourceCoverage(db);
    return NextResponse.json({ success: true, coverage });
  } catch (error) {
    if (error instanceof OperatorAuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('List source coverage error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
