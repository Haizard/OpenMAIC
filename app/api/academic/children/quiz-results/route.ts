import { NextResponse } from 'next/server';

import { requireRole } from '@/lib/academic/auth';
import { getAcademicDb } from '@/lib/academic/db';

export async function GET(): Promise<NextResponse> {
  try {
    const session = await requireRole('parent');
    const db = await getAcademicDb();

    // Get all children's quiz results
    const result = await db.query(
      `SELECT
         st.display_name AS student_name,
         st.id AS student_id,
         q.title AS quiz_title,
         q.id AS quiz_id,
         qs.status,
         qs.score,
         qs.max_score,
         qs.submitted_at,
         qs.graded_at
       FROM academic_quiz_submissions qs
       JOIN academic_students st ON st.id = qs.student_id
       JOIN academic_quizzes q ON q.id = qs.quiz_id
       WHERE st.parent_id = $1
       ORDER BY qs.submitted_at DESC NULLS LAST`,
      [session.parentId],
    );

    return NextResponse.json({ success: true, results: result.rows });
  } catch (error) {
    if (error instanceof Error && error.message === 'Not authenticated') {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    console.error('Fetch quiz results error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
