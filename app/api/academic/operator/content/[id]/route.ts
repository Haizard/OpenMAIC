import { NextResponse } from 'next/server';

import { OperatorAuthError, requireOperator } from '@/lib/academic/operator-auth';
import { getAcademicDb } from '@/lib/academic/db';
import {
  discardContentItem,
  publishContentItem,
  retireContentItem,
  updateContentItem,
  type ContentItemPatch,
} from '@/lib/academic/content-bank';
import { ValidationError } from '@/lib/academic/register';

/**
 * PATCH /api/academic/operator/content/[id]
 *
 * The review gate. Actions: `publish`, `discard`, `retire`, or `edit` with fields to correct.
 * Publishing is the only path from draft to anything a student can see.
 */

type Action = 'publish' | 'discard' | 'retire' | 'edit';

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
      return NextResponse.json({ success: true, item: await publishContentItem(db, id) });
    }
    if (action === 'discard') {
      return NextResponse.json({ success: true, discarded: await discardContentItem(db, id) });
    }
    if (action === 'retire') {
      return NextResponse.json({ success: true, item: await retireContentItem(db, id) });
    }
    if (action === 'edit') {
      const patch: ContentItemPatch = {
        ...(typeof body.prompt === 'string' ? { prompt: body.prompt } : {}),
        ...(typeof body.explanation === 'string' ? { explanation: body.explanation } : {}),
        ...(Array.isArray(body.choices)
          ? { choices: body.choices.filter((c): c is string => typeof c === 'string') }
          : {}),
        ...(typeof body.correctIndex === 'number' ? { correctIndex: body.correctIndex } : {}),
      };
      return NextResponse.json({ success: true, item: await updateContentItem(db, id, patch) });
    }

    return NextResponse.json(
      { success: false, error: 'action must be publish, discard, retire or edit' },
      { status: 400 },
    );
  } catch (error) {
    if (error instanceof OperatorAuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    console.error('Update content item error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
