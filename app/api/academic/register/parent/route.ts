import { NextResponse } from 'next/server';

import { registerParentFirst, DuplicateEmailError, ValidationError } from '@/lib/academic/register';
import { getAcademicDb } from '@/lib/academic/db';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json();
    const db = await getAcademicDb();

    await registerParentFirst(db, {
      parentEmail: body.parentEmail,
      parentPassword: body.parentPassword,
      parentDisplayName: body.parentDisplayName,
      studentEmail: body.studentEmail,
      studentPassword: body.studentPassword,
      studentDisplayName: body.studentDisplayName,
      academicLevel: body.academicLevel,
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
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
    console.error('Registration error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
