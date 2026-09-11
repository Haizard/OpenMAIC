import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/academic/auth';
import { getAcademicDb } from '@/lib/academic/db';

interface GenerateQuizRequest {
  topicId: string;
  topicName: string;
  subjectName: string;
  formName: string;
  levelName: string;
  questionCount?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
}

interface GeneratedQuestion {
  questionText: string;
  questionType: 'multiple_choice' | 'true_false' | 'fill_blank';
  options: string[] | null;
  correctAnswer: string;
  points: number;
  explanation: string;
}

async function generateQuestionsWithAI(
  topicName: string,
  subjectName: string,
  formName: string,
  levelName: string,
  questionCount: number,
  difficulty: string,
): Promise<GeneratedQuestion[]> {
  // For now, generate structured questions based on the topic
  // In production, this would call an AI API (OpenAI, Claude, etc.)

  const questions: GeneratedQuestion[] = [];

  // Generate multiple choice questions
  for (let i = 0; i < Math.ceil(questionCount * 0.6); i++) {
    questions.push({
      questionText: `Question ${i + 1}: What is a key concept related to ${topicName} in ${subjectName}?`,
      questionType: 'multiple_choice',
      options: [
        `Definition of ${topicName}`,
        `History of ${subjectName}`,
        `Application of ${topicName}`,
        `Related to ${formName} curriculum`,
      ],
      correctAnswer: `Definition of ${topicName}`,
      points: difficulty === 'hard' ? 3 : difficulty === 'medium' ? 2 : 1,
      explanation: `This question tests understanding of the fundamental concept of ${topicName}.`,
    });
  }

  // Generate true/false questions
  for (let i = 0; i < Math.ceil(questionCount * 0.2); i++) {
    questions.push({
      questionText: `True or False: ${topicName} is an important topic in ${subjectName} for ${levelName} students.`,
      questionType: 'true_false',
      options: ['True', 'False'],
      correctAnswer: 'True',
      points: difficulty === 'hard' ? 2 : 1,
      explanation: `${topicName} is indeed a key topic in the ${levelName} ${subjectName} curriculum.`,
    });
  }

  // Generate fill-in-the-blank questions
  for (let i = 0; i < Math.ceil(questionCount * 0.2); i++) {
    questions.push({
      questionText: `Complete: The study of ${topicName} involves understanding ______.`,
      questionType: 'fill_blank',
      options: null,
      correctAnswer: 'fundamental principles',
      points: difficulty === 'hard' ? 3 : 2,
      explanation: `This question tests recall of key terminology related to ${topicName}.`,
    });
  }

  return questions.slice(0, questionCount);
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    if (session.role !== 'student') {
      return NextResponse.json(
        { success: false, error: 'Only students can generate quizzes' },
        { status: 403 },
      );
    }

    const body: GenerateQuizRequest = await req.json();
    const {
      topicId,
      topicName,
      subjectName,
      formName,
      levelName,
      questionCount = 10,
      difficulty = 'medium',
    } = body;

    if (!topicId || !topicName || !subjectName) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 },
      );
    }

    // Generate questions using AI
    const generatedQuestions = await generateQuestionsWithAI(
      topicName,
      subjectName,
      formName,
      levelName,
      Math.min(questionCount, 20), // Cap at 20 questions
      difficulty,
    );

    // Create a quiz from generated questions
    const db = await getAcademicDb();
    const quizId = `quiz_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // Insert quiz
    await db.query(
      `INSERT INTO academic_quizzes (id, title, description, time_limit_minutes, created_by, is_published)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        quizId,
        `${topicName} - Self Quiz`,
        `Auto-generated quiz on ${topicName} from ${subjectName} (${levelName} - ${formName})`,
        Math.max(10, questionCount * 2), // 2 minutes per question
        session.userId,
        true,
      ],
    );

    // Insert questions
    for (let i = 0; i < generatedQuestions.length; i++) {
      const q = generatedQuestions[i];
      await db.query(
        `INSERT INTO academic_quiz_questions (id, quiz_id, question_type, question_text, options, correct_answer, points, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          `q_${Date.now()}_${i}`,
          quizId,
          q.questionType,
          q.questionText,
          q.options ? JSON.stringify(q.options) : null,
          q.correctAnswer,
          q.points,
          i + 1,
        ],
      );
    }

    return NextResponse.json({
      success: true,
      quizId,
      questionCount: generatedQuestions.length,
      message: `Generated ${generatedQuestions.length} questions on ${topicName}`,
    });
  } catch (error) {
    console.error('Failed to generate quiz:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate quiz' }, { status: 500 });
  }
}
