import { NextResponse } from 'next/server';

import { requireRole } from '@/lib/academic/auth';
import { addChild, ValidationError, DuplicateEmailError } from '@/lib/academic/register';
import { getAcademicDb } from '@/lib/academic/db';

export async function GET(): Promise<NextResponse> {
  try {
    const session = await requireRole('parent');
    const db = getAcademicDb();

    const result = await db.query(
      `SELECT s.id, s.display_name, s.academic_level, u.email
       FROM academic_students s
       JOIN academic_users u ON u.id = s.user_id
       WHERE s.parent_id = $1
       ORDER BY s.display_name`,
      [session.parentId],
    );

    return NextResponse.json({
      success: true,
      children: result.rows,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Not authenticated') {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 },
      );
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 },
      );
    }
    console.error('Fetch children error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await requireRole('parent');
    const body = await request.json();
    const db = getAcademicDb();

    await addChild(db, {
      parentId: session.parentId!,
      studentEmail: body.studentEmail,
      studentPassword: body.studentPassword,
      studentDisplayName: body.studentDisplayName,
      academicLevel: body.academicLevel,
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Not authenticated') {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 },
      );
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 },
      );
    }
    if (error instanceof DuplicateEmailError) {
      return NextResponse.json(
        { success: false, error: `Email already registered: ${error.email}` },
        { status: 409 },
      );
    }
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 },
      );
    }
    console.error('Add child error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
