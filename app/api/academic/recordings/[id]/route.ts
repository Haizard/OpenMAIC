import { NextResponse } from 'next/server';

import { requireRole } from '@/lib/academic/auth';
import { getAcademicDb } from '@/lib/academic/db';
import {
  getRecordingForViewer,
  RECORDING_MIME_ALLOWLIST,
  type RecordingViewer,
} from '@/lib/academic/recording';

/**
 * GET /api/academic/recordings/[id]
 *
 * Stream one recording's bytes. A student reads their own recording; a parent reads a
 * recording belonging to their child. Anything else is a `404` — deliberately the same answer
 * as "no such recording", so the route cannot be used to test which ids exist.
 *
 * A school session is refused outright: rule 1 keeps the two worlds separate.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse | Response> {
  try {
    const { id } = await params;

    // A school session never reaches this route: rule 1 keeps the two worlds apart, and a
    // wrong-role answer is what requireRole raises for it.
    let viewer: RecordingViewer;
    try {
      const student = await requireRole('student');
      viewer = { role: 'student', studentId: student.studentId };
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'Forbidden') throw error;
      const parent = await requireRole('parent');
      viewer = { role: 'parent', parentId: parent.parentId };
    }

    const db = await getAcademicDb();
    const recording = await getRecordingForViewer(db, id, viewer);
    if (!recording) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    // Only allowlisted types are rendered inline. A stored type outside the list is still
    // served, but as an attachment, so it can never be interpreted as active content.
    const inline = RECORDING_MIME_ALLOWLIST.includes(recording.mime);

    return new Response(recording.bytes as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': inline ? recording.mime : 'application/octet-stream',
        'Content-Length': String(recording.bytes.byteLength),
        'Content-Disposition': inline ? 'inline' : 'attachment',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Not authenticated') {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    console.error('Get recording error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
