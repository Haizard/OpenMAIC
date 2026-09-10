import { NextResponse } from 'next/server';

import { requireRole } from '@/lib/academic/auth';
import { getAcademicDb } from '@/lib/academic/db';
import { randomUUID } from 'node:crypto';

export async function GET(): Promise<NextResponse> {
  try {
    const session = await requireRole('school');
    const db = getAcademicDb();

    const result = await db.query(
      `SELECT id, student_name, grade
       FROM academic_school_roster
       WHERE school_id = $1
       ORDER BY student_name`,
      [session.schoolId],
    );

    return NextResponse.json({
      success: true,
      roster: result.rows,
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
    console.error('Fetch roster error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await requireRole('school');
    const body = await request.json();
    const db = getAcademicDb();

    const studentName = body.studentName?.trim();
    const grade = body.grade?.trim();

    if (!studentName || !grade) {
      return NextResponse.json(
        { success: false, error: 'Student name and grade are required' },
        { status: 400 },
      );
    }

    await db.query(
      `INSERT INTO academic_school_roster (id, school_id, student_name, grade)
       VALUES ($1, $2, $3, $4)`,
      [randomUUID(), session.schoolId, studentName, grade],
    );

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
    console.error('Add roster entry error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  try {
    const session = await requireRole('school');
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID is required' },
        { status: 400 },
      );
    }

    const db = getAcademicDb();

    // Verify the entry belongs to this school
    const result = await db.query(
      `DELETE FROM academic_school_roster
       WHERE id = $1 AND school_id = $2
       RETURNING id`,
      [id, session.schoolId],
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
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
    console.error('Delete roster entry error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
