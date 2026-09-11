import { NextResponse } from 'next/server';

import { requireRole } from '@/lib/academic/auth';
import { getAcademicDb } from '@/lib/academic/db';
import {
  createAssignment,
  listAssignmentsForStudent,
  getAssignmentSummary,
} from '@/lib/academic/assignment';

export async function GET(): Promise<NextResponse> {
  try {
    const session = await requireRole('student');
    const db = await getAcademicDb();
    const [assignments, summary] = await Promise.all([
      listAssignmentsForStudent(db, session.studentId),
      getAssignmentSummary(db, session.studentId),
    ]);
    return NextResponse.json({ success: true, assignments, summary });
  } catch (error) {
    if (error instanceof Error && error.message === 'Not authenticated') {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    console.error('List assignments error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

interface CreateAssignmentBody {
  title?: string;
  description?: string;
  topicId?: string;
  dueAt?: string;
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await requireRole('student');
    const body = (await request.json()) as CreateAssignmentBody;
    const db = await getAcademicDb();

    const title = body.title?.trim();
    if (!title) {
      return NextResponse.json({ success: false, error: 'Title is required' }, { status: 400 });
    }

    let dueAt: Date | null = null;
    if (body.dueAt) {
      dueAt = new Date(body.dueAt);
      if (Number.isNaN(dueAt.getTime())) {
        return NextResponse.json({ success: false, error: 'Invalid due date' }, { status: 400 });
      }
    }

    const result = await createAssignment(db, {
      studentId: session.studentId,
      topicId: body.topicId ?? null,
      title,
      description: body.description,
      dueAt,
    });

    return NextResponse.json({ success: true, id: result.id }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Not authenticated') {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    console.error('Create assignment error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
