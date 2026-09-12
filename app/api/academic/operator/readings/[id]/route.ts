import { NextResponse } from 'next/server';

import { OperatorAuthError, requireOperator } from '@/lib/academic/operator-auth';
import { getAcademicDb } from '@/lib/academic/db';
import {
  discardGeneratedReading,
  publishGeneratedReading,
  unpublishGeneratedReading,
} from '@/lib/academic/reading-gen';
import { ValidationError } from '@/lib/academic/register';

/**
 * PATCH /api/academic/operator/readings/[id]
 *
 * The review gate for generated passages: `publish`, `unpublish` or `discard`. Publishing is the
 * only path from a generated passage to anything a student can open.
 */

type Action = 'publish' | 'unpublish' | 'discard';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    requireOperator(request);
    const { id } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action ?? '') as Action;

    const db = await getAcademicDb();

    if (action === 'publish') {
      return NextResponse.json({ success: true, reading: await publishGeneratedReading(db, id) });
    }
    if (action === 'unpublish') {
      return NextResponse.json({ success: true, reading: await unpublishGeneratedReading(db, id) });
    }
    if (action === 'discard') {
      return NextResponse.json({ success: true, discarded: await discardGeneratedReading(db, id) });
    }

    return NextResponse.json(
      { success: false, error: 'action must be publish, unpublish or discard' },
      { status: 400 },
    );
  } catch (error) {
    if (error instanceof OperatorAuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    console.error('Update generated reading error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
