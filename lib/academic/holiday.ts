import { randomUUID } from 'node:crypto';

import type { AcademicDb } from '@/lib/academic/register';
import {
  activeWindow,
  HOLIDAY_PACKAGES,
  type HolidayPackageDefinition,
} from '@/lib/academic/holiday-catalogue';
import { listRecordingsForAssignments, type Recording } from '@/lib/academic/recording';
import { materializeHomework, studentHasForm } from '@/lib/academic/homework';

/**
 * Holiday packages — Slice 4.
 *
 * A package is a named block of work over a date range. It does not create new homework: it
 * claims the items Slice 3 already materialised for the student's form, moves their due date
 * to the end of the break, and marks some of them as needing a recording.
 *
 * See docs/superpowers/specs/2026-09-12-academic-hub-slice-4-holiday-packages.md.
 */

export interface HolidayPackageItem {
  id: string;
  title: string;
  description: string;
  topicId: string | null;
  topicName: string | null;
  subjectName: string | null;
  status: 'pending' | 'submitted' | 'late';
  dueAt: Date | null;
  submittedAt: Date | null;
  requiresRecording: boolean;
  recording: Recording | null;
}

export interface HolidayPackage {
  id: string;
  slug: string;
  title: string;
  description: string;
  startsOn: string;
  endsOn: string;
  items: HolidayPackageItem[];
  /** Items still outstanding. */
  outstanding: number;
  /** Items that must be answered with a recording. */
  recordingsRequired: number;
  /** Of those, how many have a take attached. */
  recordingsDone: number;
  /** Ids of required-recording items that still have no take. */
  missingItemIds: string[];
  /** True when every claimed item is submitted. */
  complete: boolean;
}

export interface HolidayPackageList {
  packages: HolidayPackage[];
  /** `no_form` when the student has no stored grade, so no curriculum work exists. */
  reason: 'no_form' | null;
}

export interface ChildHolidayPackage extends HolidayPackageList {
  studentId: string;
  studentName: string;
}

interface RawPackageItem {
  id: string;
  title: string;
  description: string;
  topic_id: string | null;
  status: string;
  due_at: Date | string | null;
  submitted_at: Date | string | null;
  requires_recording: boolean;
  topic_name: string | null;
  subject_name: string | null;
}

interface RawPackage extends RawPackageItem {
  package_id: string;
  package_slug: string;
  package_title: string;
  package_description: string;
  starts_on: Date | string;
  ends_on: Date | string;
}

function toDate(v: Date | string): Date {
  return v instanceof Date ? v : new Date(v);
}

/** `DATE` columns arrive as `YYYY-MM-DD` from both drivers; keep that shape for the UI. */
function toDateString(v: Date | string): string {
  if (typeof v === 'string') return v.slice(0, 10);
  return v.toISOString().slice(0, 10);
}

/**
 * Materialise the packages whose window is currently open for this student.
 *
 * Idempotent on two levels: `UNIQUE (student_id, slug)` means a package row is created once,
 * and claiming is a no-op on a second run because the rows already carry a package id.
 */
export async function materializeHolidayPackages(
  db: AcademicDb,
  studentId: string,
  now: Date = new Date(),
): Promise<void> {
  if (!(await studentHasForm(db, studentId))) return;

  // Homework must exist before a package can claim it.
  await materializeHomework(db, studentId, now);

  for (const definition of HOLIDAY_PACKAGES) {
    const window = activeWindow(definition, now);
    if (!window) continue;

    const packageId = await upsertPackage(db, studentId, definition, window);
    if (!packageId) continue;

    await claimItems(db, packageId, studentId, definition, window.endsOn);
  }
}

/**
 * Create the package row if it is not there yet, returning its id.
 *
 * Returns `null` when the package would hold nothing, which happens when the student's form
 * has fewer topics than this package's offset. An empty package is a confusing thing to show,
 * so it is not created at all.
 */
async function upsertPackage(
  db: AcademicDb,
  studentId: string,
  definition: HolidayPackageDefinition,
  window: { startsOn: string; endsOn: string },
): Promise<string | null> {
  const available = await db.query<{ cnt: string | number }>(
    `SELECT COUNT(*) AS cnt
     FROM academic_students a
     JOIN curriculum_subjects sub ON sub.form_id = a.curriculum_form_id
     JOIN curriculum_topics t ON t.subject_id = sub.id
     WHERE a.id = $1`,
    [studentId],
  );
  if (Number(available.rows[0]?.cnt ?? 0) <= definition.topicOffset) return null;

  const result = await db.query<{ id: string }>(
    `INSERT INTO academic_holiday_packages
       (id, student_id, slug, title, description, starts_on, ends_on)
     VALUES ($1, $2, $3, $4, $5, $6::date, $7::date)
     ON CONFLICT (student_id, slug) DO UPDATE
       SET title = EXCLUDED.title,
           description = EXCLUDED.description,
           starts_on = EXCLUDED.starts_on,
           ends_on = EXCLUDED.ends_on
     RETURNING id`,
    [
      randomUUID(),
      studentId,
      definition.slug,
      definition.title,
      definition.description,
      window.startsOn,
      window.endsOn,
    ],
  );

  return result.rows[0]?.id ?? null;
}

/**
 * Attach this package's slice of the student's topics and mark the front of the slice as
 * needing a recording.
 *
 * The ordering matches Slice 3's materialisation (subject, then topic sort order) so the slice
 * is stable across runs. Only `pending` items are claimed: pulling an item the student already
 * submitted back into a package would silently undo finished work.
 */
async function claimItems(
  db: AcademicDb,
  packageId: string,
  studentId: string,
  definition: HolidayPackageDefinition,
  endsOn: string,
): Promise<void> {
  await db.query(
    `WITH ordered AS (
       SELECT t.id,
              ROW_NUMBER() OVER (ORDER BY sub.sort_order, sub.name, t.sort_order, t.name) AS position
       FROM academic_students a
       JOIN curriculum_subjects sub ON sub.form_id = a.curriculum_form_id
       JOIN curriculum_topics t ON t.subject_id = sub.id
       WHERE a.id = $1
     ),
     claimed AS (
       SELECT o.id, o.position FROM ordered o
       WHERE o.position > $3::int AND o.position <= $4::int
     )
     UPDATE academic_assignments h
     SET package_id = $2,
         requires_recording = ((c.position - $3::int) <= $5::int),
         due_at = ($6::date + TIME '23:59:59') AT TIME ZONE 'UTC',
         updated_at = NOW()
     FROM claimed c
     WHERE h.topic_id = c.id
       AND h.student_id = $1
       AND h.kind = 'homework'
       AND h.status = 'pending'
       AND h.package_id IS NULL`,
    [
      studentId,
      packageId,
      definition.topicOffset,
      definition.topicOffset + definition.topicCount,
      definition.recordingCount,
      endsOn,
    ],
  );
}

/** The signed-in student's holiday packages, materialised on demand. */
export async function listHolidayPackagesForStudent(
  db: AcademicDb,
  studentId: string,
  now: Date = new Date(),
): Promise<HolidayPackageList> {
  if (!(await studentHasForm(db, studentId))) {
    return { packages: [], reason: 'no_form' };
  }

  await materializeHolidayPackages(db, studentId, now);

  const result = await db.query<RawPackage>(
    PACKAGE_ITEM_SELECT + 'WHERE h.student_id = $1 ' + PACKAGE_ITEM_ORDER,
    [studentId],
  );

  return { packages: await assemble(db, result.rows), reason: null };
}

/**
 * Holiday packages for a parent's own children.
 *
 * Packages that are already complete are omitted: this view answers "what does my child still
 * owe over the break?", and a finished package has nothing to nudge about.
 */
export async function listHolidayPackagesForParent(
  db: AcademicDb,
  parentId: string,
  now: Date = new Date(),
): Promise<ChildHolidayPackage[]> {
  const children = await db.query<{ id: string; display_name: string }>(
    'SELECT id, display_name FROM academic_students WHERE parent_id = $1 ORDER BY display_name',
    [parentId],
  );

  const result: ChildHolidayPackage[] = [];

  for (const child of children.rows) {
    await materializeHolidayPackages(db, child.id, now);

    const rows = await db.query<RawPackage>(
      PACKAGE_ITEM_SELECT + 'WHERE h.student_id = $1 ' + PACKAGE_ITEM_ORDER,
      [child.id],
    );
    if (rows.rows.length === 0) continue;

    const packages = (await assemble(db, rows.rows)).filter((entry) => !entry.complete);
    if (packages.length === 0) continue;

    result.push({
      studentId: child.id,
      studentName: child.display_name,
      packages,
      reason: null,
    });
  }

  return result;
}

// Shared by both list paths so the two views can never drift in what they select or the order
// they return it in. The order matches the one claiming uses, so the item that requires a
// recording is always the first in the slice.
const PACKAGE_ITEM_SELECT = `SELECT h.id, h.title, h.description, h.topic_id, h.status,
            h.due_at, h.submitted_at, h.requires_recording, h.package_id,
            p.slug AS package_slug, p.title AS package_title,
            p.description AS package_description, p.starts_on, p.ends_on,
            t.name AS topic_name, sub.name AS subject_name
     FROM academic_assignments h
     JOIN academic_holiday_packages p ON p.id = h.package_id
     LEFT JOIN curriculum_topics t ON t.id = h.topic_id
     LEFT JOIN curriculum_subjects sub ON sub.id = t.subject_id
     `;

const PACKAGE_ITEM_ORDER =
  'ORDER BY p.starts_on, sub.sort_order, sub.name, t.sort_order, t.name';

async function assemble(db: AcademicDb, rows: RawPackage[]): Promise<HolidayPackage[]> {
  const recordings = await listRecordingsForAssignments(
    db,
    rows.map((row) => row.id),
  );

  const byPackage = new Map<string, HolidayPackage>();

  for (const row of rows) {
    let entry = byPackage.get(row.package_id);
    if (!entry) {
      entry = {
        id: row.package_id,
        slug: row.package_slug,
        title: row.package_title,
        description: row.package_description,
        startsOn: toDateString(row.starts_on),
        endsOn: toDateString(row.ends_on),
        items: [],
        outstanding: 0,
        recordingsRequired: 0,
        recordingsDone: 0,
        missingItemIds: [],
        complete: true,
      };
      byPackage.set(row.package_id, entry);
    }

    const requiresRecording = Boolean(row.requires_recording);
    const recording = recordings.get(row.id) ?? null;
    const status = row.status as HolidayPackageItem['status'];

    entry.items.push({
      id: row.id,
      title: row.title,
      description: row.description,
      topicId: row.topic_id,
      topicName: row.topic_name,
      subjectName: row.subject_name,
      status,
      dueAt: row.due_at ? toDate(row.due_at) : null,
      submittedAt: row.submitted_at ? toDate(row.submitted_at) : null,
      requiresRecording,
      recording,
    });

    if (status === 'pending') {
      entry.outstanding += 1;
      entry.complete = false;
    }
    if (requiresRecording) {
      entry.recordingsRequired += 1;
      if (recording) entry.recordingsDone += 1;
      else entry.missingItemIds.push(row.id);
    }
  }

  return [...byPackage.values()];
}
