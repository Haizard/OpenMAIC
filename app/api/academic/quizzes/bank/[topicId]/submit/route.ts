import { NextResponse } from 'next/server';

import { requireRole } from '@/lib/academic/auth';
import { getAcademicDb } from '@/lib/academic/db';
import { submitBankQuiz, type BankQuizAnswerInput } from '@/lib/academic/quiz-bank';
import { ValidationError } from '@/lib/academic/register';

/**
 * POST /api/academic/quizzes/bank/[topicId]/submit
 *
 * Grades one sitting. The body carries only the position the student clicked on each question;
 * the server rebuilds the order from their seed and resolves it back to a real answer, so a
 * student cannot mark their own quiz by posting the right index.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ topicId: string }> },
): Promise<NextResponse> {
  try {
    const session = await requireRole('student');
    const { topicId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { answers?: unknown };

    const raw = Array.isArray(body.answers) ? body.answers : [];
    const answers: BankQuizAnswerInput[] = [];
    for (const entry of raw) {
      const answer = entry as { itemId?: unknown; choiceIndex?: unknown };
      if (typeof answer.itemId !== 'string' || typeof answer.choiceIndex !== 'number') continue;
      answers.push({ itemId: answer.itemId, choiceIndex: answer.choiceIndex });
    }

    const db = await getAcademicDb();
    const result = await submitBankQuiz(db, session.studentId, topicId, answers);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof Error && error.message === 'Not authenticated') {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    console.error('Submit bank quiz error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
