import { randomUUID } from 'node:crypto';

import type { AcademicDb } from '@/lib/academic/register';

// ─── Types ─────────────────────────────────────────────────────────────

export type AssignmentStatus = 'pending' | 'submitted' | 'late';

export interface Assignment {
  id: string;
  studentId: string;
  topicId: string | null;
  title: string;
  description: string;
  status: AssignmentStatus;
  dueAt: Date | null;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssignmentWithStudent extends Assignment {
  studentName: string;
}

export interface AssignmentSummary {
  pending: number;
  submitted: number;
  late: number;
  total: number;
}

export interface CreateAssignmentInput {
  studentId: string;
  topicId?: string | null;
  title: string;
  description?: string;
  dueAt?: Date | null;
}

// ─── CRUD ──────────────────────────────────────────────────────────────

export async function createAssignment(
  db: AcademicDb,
  input: CreateAssignmentInput,
): Promise<{ id: string }> {
  const id = randomUUID();
  await db.query(
    `INSERT INTO academic_assignments (id, student_id, topic_id, title, description, due_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      id,
      input.studentId,
      input.topicId ?? null,
      input.title.trim(),
      input.description?.trim() ?? '',
      input.dueAt ?? null,
    ],
  );
  return { id };
}

export async function listAssignmentsForStudent(
  db: AcademicDb,
  studentId: string,
): Promise<Assignment[]> {
  const result = await db.query<RawAssignment>(
    `SELECT id, student_id, topic_id, title, description, status, due_at, submitted_at, created_at, updated_at
     FROM academic_assignments
     WHERE student_id = $1
     ORDER BY due_at NULLS LAST, created_at DESC`,
    [studentId],
  );
  return result.rows.map(mapAssignment);
}

export async function getAssignment(
  db: AcademicDb,
  assignmentId: string,
  studentId: string,
): Promise<Assignment | null> {
  const result = await db.query<RawAssignment>(
    `SELECT id, student_id, topic_id, title, description, status, due_at, submitted_at, created_at, updated_at
     FROM academic_assignments
     WHERE id = $1 AND student_id = $2`,
    [assignmentId, studentId],
  );
  return result.rows[0] ? mapAssignment(result.rows[0]) : null;
}

export async function deleteAssignment(
  db: AcademicDb,
  assignmentId: string,
  studentId: string,
): Promise<boolean> {
  const result = await db.query(
    `DELETE FROM academic_assignments WHERE id = $1 AND student_id = $2 RETURNING id`,
    [assignmentId, studentId],
  );
  return (result.rows as unknown[]).length > 0;
}

// ─── Submission (late handling lives here) ────────────────────────────

export async function submitAssignment(
  db: AcademicDb,
  assignmentId: string,
  studentId: string,
  submittedAt: Date = new Date(),
): Promise<Assignment | null> {
  // status is derived at submit time: on time → 'submitted', past due → 'late'.
  const result = await db.query<RawAssignment>(
    `UPDATE academic_assignments
     SET status = CASE WHEN due_at IS NOT NULL AND submitted_at_base > due_at THEN 'late' ELSE 'submitted' END,
         submitted_at = submitted_at_base,
         updated_at = NOW()
     FROM (SELECT $3::timestamptz AS submitted_at_base) base
     WHERE id = $1 AND student_id = $2 AND status = 'pending'
     RETURNING id, student_id, topic_id, title, description, status, due_at, submitted_at, created_at, updated_at`,
    [assignmentId, studentId, submittedAt],
  );
  return result.rows[0] ? mapAssignment(result.rows[0]) : null;
}

// ─── Parent (mentor) visibility ───────────────────────────────────────

export async function listAssignmentsForParent(
  db: AcademicDb,
  parentId: string,
): Promise<AssignmentWithStudent[]> {
  const result = await db.query<RawAssignmentWithStudent>(
    `SELECT a.id, a.student_id, a.topic_id, a.title, a.description, a.status,
            a.due_at, a.submitted_at, a.created_at, a.updated_at,
            s.display_name AS student_name
     FROM academic_assignments a
     JOIN academic_students s ON s.id = a.student_id
     WHERE s.parent_id = $1
     ORDER BY s.display_name, a.due_at NULLS LAST, a.created_at DESC`,
    [parentId],
  );
  return result.rows.map((row) => ({
    ...mapAssignment(row),
    studentName: row.student_name,
  }));
}

export async function getAssignmentSummary(
  db: AcademicDb,
  studentId: string,
): Promise<AssignmentSummary> {
  const result = await db.query<{ status: string; cnt: string | number }>(
    `SELECT status, COUNT(*) AS cnt
     FROM academic_assignments
     WHERE student_id = $1
     GROUP BY status`,
    [studentId],
  );
  const byStatus = new Map(result.rows.map((row) => [row.status, Number(row.cnt)]));
  const pending = byStatus.get('pending') ?? 0;
  const submitted = byStatus.get('submitted') ?? 0;
  const late = byStatus.get('late') ?? 0;
  return { pending, submitted, late, total: pending + submitted + late };
}

// ─── Mappers ──────────────────────────────────────────────────────────

interface RawAssignment {
  id: string;
  student_id: string;
  topic_id: string | null;
  title: string;
  description: string;
  status: string;
  due_at: Date | string | null;
  submitted_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface RawAssignmentWithStudent extends RawAssignment {
  student_name: string;
}

function toDate(v: Date | string): Date {
  return v instanceof Date ? v : new Date(v);
}

function mapAssignment(row: RawAssignment): Assignment {
  return {
    id: row.id,
    studentId: row.student_id,
    topicId: row.topic_id,
    title: row.title,
    description: row.description,
    status: row.status as AssignmentStatus,
    dueAt: row.due_at ? toDate(row.due_at) : null,
    submittedAt: row.submitted_at ? toDate(row.submitted_at) : null,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}
