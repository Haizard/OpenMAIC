import { NextResponse } from 'next/server';

import { getCurrentSession } from '@/lib/academic/auth';
import { getAcademicDb } from '@/lib/academic/db';

export async function GET(): Promise<NextResponse> {
  try {
    const session = await getCurrentSession();
    
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 },
      );
    }

    const db = await getAcademicDb();

    // Get user info based on role
    let userInfo: Record<string, unknown> = { role: session.role };

    if (session.role === 'student' && session.studentId) {
      const result = await db.query(
        `SELECT s.display_name, s.academic_level, u.email,
                f.name AS form_name, f.slug AS form_slug
         FROM academic_students s
         JOIN academic_users u ON u.id = s.user_id
         LEFT JOIN curriculum_forms f ON f.id = s.curriculum_form_id
         WHERE s.id = $1`,
        [session.studentId],
      );
      if (result.rows.length > 0) {
        userInfo = { ...userInfo, student: result.rows[0] };
      }
    } else if (session.role === 'parent' && session.parentId) {
      const result = await db.query(
        `SELECT p.display_name, u.email
         FROM academic_parents p
         JOIN academic_users u ON u.id = p.user_id
         WHERE p.id = $1`,
        [session.parentId],
      );
      if (result.rows.length > 0) {
        userInfo = { ...userInfo, parent: result.rows[0] };
      }
    } else if (session.role === 'school' && session.schoolId) {
      const result = await db.query(
        `SELECT s.name, s.contact, u.email
         FROM academic_schools s
         JOIN academic_users u ON u.id = s.user_id
         WHERE s.id = $1`,
        [session.schoolId],
      );
      if (result.rows.length > 0) {
        userInfo = { ...userInfo, school: result.rows[0] };
      }
    }

    return NextResponse.json({
      success: true,
      ...userInfo,
    });
  } catch (error) {
    console.error('Get user info error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
