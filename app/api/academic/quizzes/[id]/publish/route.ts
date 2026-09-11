import { NextResponse } from 'next/server';

import { requireRole } from '@/lib/academic/auth';
import { getAcademicDb } from '@/lib/academic/db';
import { publishQuiz, unpublishQuiz } from '@/lib/academic/quiz';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const session = await requireRole('school');
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const db = await getAcademicDb();

    const action = body.action === 'unpublish' ? 'unpublish' : 'publish';
    const success = action === 'publish'
      ? await publishQuiz(db, id, session.schoolId)
      : await unpublishQuiz(db, id, session.schoolId);

    if (!success) {
      return NextResponse.json({ success: false, error: 'Quiz not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, published: action === 'publish' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Not authenticated') {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    console.error('Publish quiz error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
