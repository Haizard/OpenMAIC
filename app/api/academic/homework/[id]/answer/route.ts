import { NextResponse } from 'next/server';

import { requireRole } from '@/lib/academic/auth';
import { getAcademicDb } from '@/lib/academic/db';
import { answerHomework } from '@/lib/academic/homework';
import { ValidationError } from '@/lib/academic/register';

/**
 * POST /api/academic/homework/[id]/answer
 *
 * Answer the generated question attached to a homework item. Separate from submission: a
 * homework item can require a recording before it can be handed in, so answering must not
 * silently mark it done.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const session = await requireRole('student');
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { choiceIndex?: unknown };

    if (typeof body.choiceIndex !== 'number') {
      return NextResponse.json(
        { success: false, error: 'choiceIndex is required' },
        { status: 400 },
      );
    }

    const db = await getAcademicDb();
    const result = await answerHomework(db, session.studentId, id, body.choiceIndex);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof Error && error.message === 'Not authenticated') {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    console.error('Answer homework error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
