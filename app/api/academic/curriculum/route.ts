import { NextResponse } from 'next/server';
import { getAcademicDb } from '@/lib/academic/db';
import { requireSession } from '@/lib/academic/auth';

export async function GET() {
  try {
    const session = await requireSession();
    if (session.role !== 'student') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const db = await getAcademicDb();

    const student = await db.query<{ academic_level: string }>(
      'SELECT academic_level FROM academic_students WHERE id = $1',
      [session.studentId],
    );

    const levels = await db.query<{
      id: string;
      name: string;
      slug: string;
      description: string;
      sort_order: number;
    }>('SELECT * FROM curriculum_levels ORDER BY sort_order');

    const forms = await db.query<{
      id: string;
      level_id: string;
      name: string;
      slug: string;
      sort_order: number;
    }>('SELECT * FROM curriculum_forms ORDER BY sort_order');

    const subjects = await db.query<{
      id: string;
      form_id: string;
      name: string;
      slug: string;
      description: string;
      sort_order: number;
    }>('SELECT * FROM curriculum_subjects ORDER BY sort_order');

    const topics = await db.query<{
      id: string;
      subject_id: string;
      name: string;
      slug: string;
      description: string;
      sort_order: number;
    }>('SELECT * FROM curriculum_topics ORDER BY sort_order');

    // Build hierarchical structure
    const curriculum = levels.rows.map((level) => ({
      ...level,
      forms: forms.rows
        .filter((form) => form.level_id === level.id)
        .map((form) => ({
          ...form,
          subjects: subjects.rows
            .filter((subject) => subject.form_id === form.id)
            .map((subject) => ({
              ...subject,
              topics: topics.rows.filter((topic) => topic.subject_id === subject.id),
            })),
        })),
    }));

    return NextResponse.json({
      success: true,
      curriculum,
      studentLevel: student.rows[0]?.academic_level ?? null,
    });
  } catch (error) {
    console.error('Failed to fetch curriculum:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch curriculum' },
      { status: 500 },
    );
  }
}
