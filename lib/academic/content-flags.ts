import { randomUUID } from 'node:crypto';

import type { AcademicDb } from '@/lib/academic/register';
import { ValidationError } from '@/lib/academic/register';
import { getStudentScope } from '@/lib/academic/reading';
import type { ContentItem } from '@/lib/academic/content-bank';
import { listContentItems } from '@/lib/academic/content-bank';

/**
 * The quality loop — Phase E.
 *
 * A student can say a question is wrong, and enough students saying so takes it out of
 * circulation automatically. This matters more here than on a normal platform: the content is
 * written by a model, so "somebody will have checked it" is not a guarantee we actually have.
 *
 * Flagging never deletes. A flagged item goes back to the review queue with its flags intact,
 * because "three students said this was wrong" is the most useful thing an operator can read.
 */

/** How many distinct students must flag an item before it stops being served. */
export const FLAG_AUTO_UNPUBLISH_THRESHOLD = 2;

export interface ContentFlag {
  id: string;
  itemId: string;
  studentId: string;
  reason: string | null;
  createdAt: string;
}

export interface FlagContentResult {
  readonly flag: ContentFlag;
  readonly item: ContentItem;
  /** True when this flag was the one that pushed the item out of circulation. */
  readonly autoUnpublished: boolean;
}

interface FlagRecord {
  id: string;
  item_id: string;
  student_id: string;
  reason: string | null;
  created_at: Date | string;
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapFlag(row: FlagRecord): ContentFlag {
  return {
    id: row.id,
    itemId: row.item_id,
    studentId: row.student_id,
    reason: row.reason,
    createdAt: toIso(row.created_at),
  };
}

/**
 * A student may only flag content their own curriculum can reach.
 *
 * Without this the flag endpoint is an oracle: any signed-in student could probe item ids from
 * another level and learn what they say.
 */
async function assertStudentMayFlag(
  db: AcademicDb,
  studentId: string,
  itemId: string,
): Promise<ContentItem> {
  const scope = await getStudentScope(db, studentId);
  if (!scope) throw new ValidationError('Not authenticated');

  const item = await db.query<{ id: string; subject_id: string; status: string }>(
    'SELECT id, subject_id, status FROM academic_content_items WHERE id = $1',
    [itemId],
  );
  const row = item.rows[0];
  if (!row) throw new ValidationError('Unknown item');

  const inScope = await db.query<{ id: string }>(
    `SELECT s.id FROM curriculum_subjects s
      JOIN curriculum_forms f ON f.id = s.form_id
      WHERE s.id = $1 AND (
        ($2::text IS NOT NULL AND f.id = $2)
        OR ($2::text IS NULL AND f.level_id = $3)
      )`,
    [row.subject_id, scope.formId, scope.levelId],
  );
  if (!inScope.rows[0]) throw new ValidationError('That item is not in your class');

  const loaded = await listContentItems(db, { subjectId: row.subject_id });
  const full = loaded.find((entry) => entry.id === itemId);
  if (!full) throw new ValidationError('Unknown item');
  return full;
}

export async function flagContentItem(
  db: AcademicDb,
  input: { itemId: string; studentId: string; reason?: string },
): Promise<FlagContentResult> {
  const item = await assertStudentMayFlag(db, input.studentId, input.itemId);
  const reason = input.reason?.trim() || null;

  const inserted = await db.query<FlagRecord>(
    `INSERT INTO academic_content_flags (id, item_id, student_id, reason)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (item_id, student_id) DO UPDATE SET reason = EXCLUDED.reason
      RETURNING id, item_id, student_id, reason, created_at`,
    [randomUUID(), input.itemId, input.studentId, reason],
  );
  const flagRow = inserted.rows[0];
  if (!flagRow) throw new Error('Flag insert returned nothing');

  const count = await db.query<{ total: string | number }>(
    'SELECT COUNT(*) AS total FROM academic_content_flags WHERE item_id = $1',
    [input.itemId],
  );
  const total = Number(count.rows[0]?.total ?? 0);

  let autoUnpublished = false;
  if (item.status === 'published' && total >= FLAG_AUTO_UNPUBLISH_THRESHOLD) {
    const result = await db.query<{ id: string }>(
      `UPDATE academic_content_items
        SET status = 'flagged', flag_count = $2
        WHERE id = $1 AND status = 'published'
        RETURNING id`,
      [input.itemId, total],
    );
    autoUnpublished = result.rows.length === 1;
  } else {
    await db.query('UPDATE academic_content_items SET flag_count = $2 WHERE id = $1', [
      input.itemId,
      total,
    ]);
  }

  // Reload rather than patching the copy in memory: the caller needs the item as it now is,
  // including the flag count and whatever the threshold did to its status.
  const reloaded = await listContentItems(db, { subjectId: item.subjectId });
  const updated = reloaded.find((entry) => entry.id === input.itemId) ?? item;

  return { flag: mapFlag(flagRow), item: updated, autoUnpublished };
}

export async function listFlagsForItem(
  db: AcademicDb,
  itemId: string,
): Promise<readonly ContentFlag[]> {
  const result = await db.query<FlagRecord>(
    `SELECT id, item_id, student_id, reason, created_at
      FROM academic_content_flags WHERE item_id = $1 ORDER BY created_at`,
    [itemId],
  );
  return result.rows.map(mapFlag);
}

/** Everything a student has complained about, for the operator's review queue. */
export async function listFlaggedItems(db: AcademicDb): Promise<readonly ContentItem[]> {
  return listContentItems(db, { status: 'flagged' });
}
