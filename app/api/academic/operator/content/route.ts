import { NextResponse } from 'next/server';

import { OperatorAuthError, requireOperator } from '@/lib/academic/operator-auth';
import { getAcademicDb } from '@/lib/academic/db';
import { createContentLlm } from '@/lib/academic/content-llm';
import {
  CONTENT_KINDS,
  ContentValidationError,
  generateContentForTopic,
  listContentItems,
  listGenerationBlockers,
  type ContentKind,
} from '@/lib/academic/content-bank';
import { ValidationError } from '@/lib/academic/register';

/**
 * Operator content-bank routes — Phase B.
 *
 * POST generates items grounded in the uploaded source for a subject or topic. When there is
 * not enough source it returns 422 with the reason rather than generating from nothing.
 */

export async function GET(request: Request): Promise<NextResponse> {
  try {
    requireOperator(request);
    const params = new URL(request.url).searchParams;
    const db = await getAcademicDb();

    if (params.get('blockers') === 'true') {
      return NextResponse.json({ success: true, blockers: await listGenerationBlockers(db) });
    }

    const kind = params.get('kind');
    const status = params.get('status');
    const items = await listContentItems(db, {
      ...(params.get('subjectId') ? { subjectId: params.get('subjectId') as string } : {}),
      ...(params.get('topicId') ? { topicId: params.get('topicId') as string } : {}),
      ...(kind && CONTENT_KINDS.includes(kind as ContentKind) ? { kind: kind as ContentKind } : {}),
      ...(status ? { status: status as never } : {}),
    });
    return NextResponse.json({ success: true, items });
  } catch (error) {
    if (error instanceof OperatorAuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('List content items error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    requireOperator(request);

    const body = (await request.json()) as Record<string, unknown>;
    const subjectId = String(body.subjectId ?? '').trim();
    const topicId = String(body.topicId ?? '').trim();
    const kind = String(body.kind ?? 'homework') as ContentKind;
    if (!subjectId) {
      return NextResponse.json({ success: false, error: 'subjectId is required' }, { status: 400 });
    }

    const db = await getAcademicDb();
    const { llm, model } = await createContentLlm();

    const result = await generateContentForTopic(db, {
      subjectId,
      kind,
      llm,
      model,
      ...(topicId ? { topicId } : {}),
      ...(body.language === 'sw' || body.language === 'en' ? { language: body.language } : {}),
      ...(typeof body.count === 'number' ? { count: body.count } : {}),
    });

    if (!result.ok) {
      // Not a server error: the fix is to upload a book, and Haitham needs to be told which.
      return NextResponse.json(
        { success: false, reason: result.reason, message: result.message },
        { status: 422 },
      );
    }

    return NextResponse.json({ success: true, items: result.items });
  } catch (error) {
    if (error instanceof OperatorAuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    if (error instanceof ContentValidationError) {
      return NextResponse.json(
        { success: false, error: `The generated content was rejected: ${error.message}` },
        { status: 502 },
      );
    }
    console.error('Generate content error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
