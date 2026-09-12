import { NextResponse } from 'next/server';

import { requireRole } from '@/lib/academic/auth';
import { getAcademicDb } from '@/lib/academic/db';
import { flagContentItem } from '@/lib/academic/content-flags';
import { ValidationError } from '@/lib/academic/register';

/**
 * POST /api/academic/content/[itemId]/flag
 *
 * A student says a question is wrong. Enough students saying so takes it out of circulation
 * straight away — see `FLAG_AUTO_UNPUBLISH_THRESHOLD`.
 *
 * Scoped to the student's own curriculum: without that check this endpoint would let any
 * signed-in student probe item ids from other levels.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ itemId: string }> },
): Promise<NextResponse> {
  try {
    const session = await requireRole('student');
    const { itemId } = await context.params;

    const body = (await request.json().catch(() => ({}))) as { reason?: unknown };
    const reason = typeof body.reason === 'string' ? body.reason.slice(0, 500) : undefined;

    const db = await getAcademicDb();
    const result = await flagContentItem(db, {
      itemId,
      studentId: session.studentId,
      ...(reason ? { reason } : {}),
    });

    return NextResponse.json({
      success: true,
      autoUnpublished: result.autoUnpublished,
      status: result.item.status,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Not authenticated') {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 404 });
    }
    console.error('Flag content item error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
