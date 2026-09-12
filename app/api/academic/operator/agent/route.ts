import { NextResponse } from 'next/server';

import { OperatorAuthError, requireOperator } from '@/lib/academic/operator-auth';
import { getAcademicDb } from '@/lib/academic/db';
import { createContentLlm } from '@/lib/academic/content-llm';
import {
  AGENT_MAX_TOPICS_PER_RUN,
  listAgentRuns,
  planAgentWork,
  runAgent,
} from '@/lib/academic/agent';
import { CONTENT_KINDS, type ContentKind } from '@/lib/academic/content-bank';
import { ValidationError } from '@/lib/academic/register';

/**
 * Operator agent routes — Phase F.
 *
 * GET shows what the agent would do next and what it last did, without spending anything.
 * POST does the work. They are separate on purpose: a run calls the model once per topic, so it
 * must be an action Haitham takes rather than something that happens on page load.
 */

export async function GET(request: Request): Promise<NextResponse> {
  try {
    requireOperator(request);
    const params = new URL(request.url).searchParams;
    const db = await getAcademicDb();

    const limitParam = Number(params.get('limit'));
    const plan = await planAgentWork(db, {
      ...(params.get('subjectId') ? { subjectId: params.get('subjectId') as string } : {}),
      ...(Number.isInteger(limitParam) && limitParam > 0 ? { limit: limitParam } : {}),
    });

    const runsLimit = Number(params.get('runs'));
    const runs = await listAgentRuns(
      db,
      Number.isInteger(runsLimit) && runsLimit > 0 ? runsLimit : 20,
    );

    return NextResponse.json({ success: true, plan, runs });
  } catch (error) {
    if (error instanceof OperatorAuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Read agent plan error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    requireOperator(request);

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const limitParam = Number(body.limit);

    const kinds = Array.isArray(body.kinds)
      ? (body.kinds.filter((kind): kind is ContentKind =>
          CONTENT_KINDS.includes(kind as ContentKind),
        ) as ContentKind[])
      : undefined;

    const db = await getAcademicDb();
    const { llm, model } = await createContentLlm();

    const summary = await runAgent(db, {
      llm,
      model,
      limit:
        Number.isInteger(limitParam) && limitParam > 0 ? limitParam : AGENT_MAX_TOPICS_PER_RUN,
      ...(typeof body.subjectId === 'string' && body.subjectId ? { subjectId: body.subjectId } : {}),
      ...(kinds && kinds.length > 0 ? { kinds } : {}),
      ...(body.language === 'sw' || body.language === 'en' ? { language: body.language } : {}),
    });

    return NextResponse.json({ success: true, ...summary });
  } catch (error) {
    if (error instanceof OperatorAuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    console.error('Run agent error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
