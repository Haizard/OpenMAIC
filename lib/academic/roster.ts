import { randomUUID } from 'node:crypto';

import type { AcademicDb } from '@/lib/academic/register';

export interface RosterEntry {
  id: string;
  studentName: string;
  grade: string;
}

export async function listRoster(
  db: AcademicDb,
  schoolId: string,
): Promise<RosterEntry[]> {
  const result = await db.query<{ id: string; student_name: string; grade: string }>(
    `SELECT id, student_name, grade
       FROM academic_school_roster
       WHERE school_id = $1
       ORDER BY student_name`,
    [schoolId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    studentName: row.student_name,
    grade: row.grade,
  }));
}

export async function addRosterEntry(
  db: AcademicDb,
  schoolId: string,
  studentName: string,
  grade: string,
): Promise<{ id: string }> {
  const id = randomUUID();
  await db.query(
    `INSERT INTO academic_school_roster (id, school_id, student_name, grade)
       VALUES ($1, $2, $3, $4)`,
    [id, schoolId, studentName, grade],
  );
  return { id };
}

export async function deleteRosterEntry(
  db: AcademicDb,
  schoolId: string,
  entryId: string,
): Promise<boolean> {
  const result = await db.query<{ id: string }>(
    `DELETE FROM academic_school_roster
       WHERE id = $1 AND school_id = $2
       RETURNING id`,
    [entryId, schoolId],
  );
  return result.rows.length > 0;
}
