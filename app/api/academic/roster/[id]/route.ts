import { NextResponse } from 'next/server';

import { requireRole } from '@/lib/academic/auth';
import { deleteRosterEntry, listRoster } from '@/lib/academic/roster';
import { getAcademicDb } from '@/lib/academic/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const session = await requireRole('school');
    const { id } = await params;
    const db = await getAcademicDb();

    const roster = await listRoster(db, session.schoolId);
    const entry = roster.find((r: { id: string }) => r.id === id);

    if (!entry) {
      return NextResponse.json(
        { success: false, error: 'Not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, entry });
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
    console.error('Get roster entry error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const session = await requireRole('school');
    const { id } = await params;
    const db = await getAcademicDb();

    const removed = await deleteRosterEntry(db, session.schoolId, id);
    if (!removed) {
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
