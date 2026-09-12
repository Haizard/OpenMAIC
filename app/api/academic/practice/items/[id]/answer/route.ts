import { NextResponse } from 'next/server';

import { requireRole } from '@/lib/academic/auth';
import { getAcademicDb } from '@/lib/academic/db';
import { ValidationError } from '@/lib/academic/register';
import { answerPracticeItem } from '@/lib/academic/practice';

/**
 * POST /api/academic/practice/items/[id]/answer
 *
 * Record a drill answer and return whether it was right, with the explanation. The attempt is
 * appended, so re-drilling adds evidence instead of overwriting the previous answer.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const session = await requireRole('student');
    const { id } = await params;

    const body = (await request.json().catch(() => ({}))) as { choiceIndex?: unknown };
    if (!Number.isInteger(body.choiceIndex)) {
      return NextResponse.json({ success: false, error: 'Choose one of the answers' }, { status: 400 });
    }

    const db = await getAcademicDb();
    const result = await answerPracticeItem(
      db,
      session.studentId,
      id,
      body.choiceIndex as number,
    );

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof Error && error.message === 'Not authenticated') {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    if (error instanceof ValidationError) {
      const status = /not in your class|not available/i.test(error.message) ? 404 : 400;
      return NextResponse.json({ success: false, error: error.message }, { status });
    }
    console.error('Answer practice item error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
