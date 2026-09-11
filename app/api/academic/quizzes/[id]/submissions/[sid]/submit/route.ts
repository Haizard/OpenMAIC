import { NextResponse } from 'next/server';

import { requireRole } from '@/lib/academic/auth';
import { getAcademicDb } from '@/lib/academic/db';
import { getSubmission, submitAndGrade } from '@/lib/academic/quiz';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; sid: string }> },
): Promise<NextResponse> {
  try {
    const session = await requireRole('student');
    const { id, sid } = await params;
    const db = await getAcademicDb();

    const submission = await getSubmission(db, sid);
    if (!submission || submission.quizId !== id || submission.studentId !== session.studentId) {
      return NextResponse.json({ success: false, error: 'Submission not found' }, { status: 404 });
    }
    if (submission.status !== 'in_progress') {
      return NextResponse.json({ success: false, error: 'Quiz already submitted' }, { status: 400 });
    }

    const result = await submitAndGrade(db, sid);
    return NextResponse.json({
      success: true,
      score: result.score,
      maxScore: result.maxScore,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Not authenticated') {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    console.error('Submit quiz error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
