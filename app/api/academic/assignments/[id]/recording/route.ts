import { NextResponse } from 'next/server';

import { requireRole } from '@/lib/academic/auth';
import { getAcademicDb } from '@/lib/academic/db';
import { ValidationError } from '@/lib/academic/register';
import { MAX_RECORDING_BYTES, saveRecording } from '@/lib/academic/recording';

/**
 * POST /api/academic/assignments/[id]/recording
 *
 * Attach a take to a holiday package item. The request body is the raw bytes and
 * `Content-Type` is the media type, which is what a `MediaRecorder` blob uploads natively.
 *
 * Re-recording replaces the previous take: one current recording per item.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const session = await requireRole('student');
    const { id } = await params;

    // Reject an oversized body from the declared length before buffering it.
    const declaredLength = Number(request.headers.get('content-length') ?? '0');
    if (declaredLength > MAX_RECORDING_BYTES) {
      return NextResponse.json({ success: false, error: 'Recording is too large' }, { status: 413 });
    }

    const mime = (request.headers.get('content-type') ?? '').split(';')[0].trim();
    const buffer = new Uint8Array(await request.arrayBuffer());

    const db = await getAcademicDb();
    const recording = await saveRecording(db, {
      assignmentId: id,
      studentId: session.studentId,
      mime,
      bytes: buffer,
    });

    return NextResponse.json({ success: true, recording });
  } catch (error) {
    if (error instanceof Error && error.message === 'Not authenticated') {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    if (error instanceof ValidationError) {
      const status = /too large/i.test(error.message) ? 413 : 415;
      return NextResponse.json({ success: false, error: error.message }, { status });
    }
    console.error('Save recording error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
