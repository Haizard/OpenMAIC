import { NextResponse } from 'next/server';

import { requireRole } from '@/lib/academic/auth';
import { getAcademicDb } from '@/lib/academic/db';
import { addQuestion, getQuiz, listQuestions } from '@/lib/academic/quiz';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const session = await requireRole('school');
    const { id } = await params;
    const db = await getAcademicDb();

    const quiz = await getQuiz(db, id);
    if (!quiz || quiz.schoolId !== session.schoolId) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    const questions = await listQuestions(db, id);
    return NextResponse.json({ success: true, questions });
  } catch (error) {
    if (error instanceof Error && error.message === 'Not authenticated') {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    console.error('List questions error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const session = await requireRole('school');
    const { id } = await params;
    const body = await request.json();
    const db = await getAcademicDb();

    const quiz = await getQuiz(db, id);
    if (!quiz || quiz.schoolId !== session.schoolId) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    if (!body.questionText?.trim()) {
      return NextResponse.json({ success: false, error: 'Question text is required' }, { status: 400 });
    }
    if (!body.questionType) {
      return NextResponse.json({ success: false, error: 'Question type is required' }, { status: 400 });
    }

    const result = await addQuestion(db, id, {
      questionType: body.questionType,
      questionText: body.questionText,
      options: body.options,
      correctAnswer: body.correctAnswer,
      points: body.points,
      sortOrder: body.sortOrder,
    });

    return NextResponse.json({ success: true, id: result.id }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Not authenticated') {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    console.error('Add question error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
