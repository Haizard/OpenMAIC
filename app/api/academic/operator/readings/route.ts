import { NextResponse } from 'next/server';

import { OperatorAuthError, requireOperator } from '@/lib/academic/operator-auth';
import { getAcademicDb } from '@/lib/academic/db';
import { createContentLlm } from '@/lib/academic/content-llm';
import { ContentValidationError } from '@/lib/academic/content-bank';
import {
  generateReadingForTopic,
  listGeneratedReadings,
} from '@/lib/academic/reading-gen';
import { ValidationError } from '@/lib/academic/register';

/**
 * Operator reading routes — Phase H.
 *
 * GET lists generated passages; POST writes one from the uploaded book for a subject or topic.
 * When the source is too thin it answers 422 with the reason rather than inventing a passage.
 */

export async function GET(request: Request): Promise<NextResponse> {
  try {
    requireOperator(request);
    const params = new URL(request.url).searchParams;
    const db = await getAcademicDb();

    const published = params.get('published');
    const readings = await listGeneratedReadings(db, {
      ...(published === 'true' ? { published: true } : {}),
      ...(published === 'false' ? { published: false } : {}),
    });

    return NextResponse.json({ success: true, readings });
  } catch (error) {
    if (error instanceof OperatorAuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('List generated readings error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    requireOperator(request);

    const body = (await request.json()) as Record<string, unknown>;
    const subjectId = String(body.subjectId ?? '').trim();
    const topicId = String(body.topicId ?? '').trim();
    if (!subjectId) {
      return NextResponse.json({ success: false, error: 'subjectId is required' }, { status: 400 });
    }

    const db = await getAcademicDb();
    const { llm, model } = await createContentLlm();

    const result = await generateReadingForTopic(db, {
      subjectId,
      llm,
      model,
      ...(topicId ? { topicId } : {}),
      ...(body.language === 'sw' || body.language === 'en' ? { language: body.language } : {}),
    });

    if (!result.ok) {
      // Not a server error: the fix is to upload a book, and Haitham needs to be told which.
      return NextResponse.json(
        { success: false, reason: result.reason, message: result.message },
        { status: 422 },
      );
    }

    return NextResponse.json({ success: true, reading: result.reading });
  } catch (error) {
    if (error instanceof OperatorAuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    if (error instanceof ContentValidationError) {
      return NextResponse.json(
        { success: false, error: `The generated passage was rejected: ${error.message}` },
        { status: 502 },
      );
    }
    console.error('Generate reading error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
