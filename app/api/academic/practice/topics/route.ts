import { NextResponse } from 'next/server';

import { requireRole } from '@/lib/academic/auth';
import { getAcademicDb } from '@/lib/academic/db';
import { listTopicMastery } from '@/lib/academic/practice';

/**
 * GET /api/academic/practice/topics
 *
 * Topics in the student's own form that the bank covers, with their mastery. Topics the bank
 * does not cover are absent rather than shown as empty — the UI must never imply a topic has
 * been completed when there was nothing to do.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const session = await requireRole('student');
    const db = await getAcademicDb();
    const topics = await listTopicMastery(db, session.studentId);
    return NextResponse.json({ success: true, topics });
  } catch (error) {
    if (error instanceof Error && error.message === 'Not authenticated') {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    console.error('List practice topics error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
