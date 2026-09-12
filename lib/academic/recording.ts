import { createHash, randomUUID } from 'node:crypto';

import type { AcademicDb } from '@/lib/academic/register';
import { ValidationError } from '@/lib/academic/register';

/**
 * Home recordings — Slice 4.
 *
 * Bytes are stored in academic-owned tables rather than the OpenMAIC asset store. That call is
 * argued in full in the slice spec (Decision 2); the short version is that `PgAssetStore`
 * partitions on `principal.key` alone and this deployment's authenticator maps every caller to
 * one shared key, so it cannot express "a parent may not watch another family's recordings" —
 * which is this slice's own acceptance test.
 *
 * The design keeps the asset layer's discipline without its shared partition: bytes are
 * content-addressed in their own table, request paths never delete bytes, and an unauthorised
 * read is indistinguishable from a missing one.
 */

/** Media types a student may upload. Anything else is refused before a byte is stored. */
export const RECORDING_MIME_ALLOWLIST: readonly string[] = [
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'video/webm',
  'video/mp4',
];

/** Ceiling for a single upload. Recordings are short by construction. */
export const MAX_RECORDING_BYTES = 25 * 1024 * 1024;

export type RecordingKind = 'audio' | 'video';

export interface Recording {
  id: string;
  assignmentId: string;
  studentId: string;
  mime: string;
  byteLength: number;
  kind: RecordingKind;
  createdAt: Date;
}

export interface RecordingBytes {
  mime: string;
  bytes: Uint8Array;
}

/** Who is asking to read a recording. Resolved from the session, never from the request. */
export type RecordingViewer =
  | { role: 'student'; studentId: string }
  | { role: 'parent'; parentId: string };

export interface SaveRecordingInput {
  assignmentId: string;
  studentId: string;
  mime: string;
  bytes: Uint8Array;
}

function kindFor(mime: string): RecordingKind {
  return mime.startsWith('video/') ? 'video' : 'audio';
}

export function isAllowedMime(mime: string): boolean {
  return RECORDING_MIME_ALLOWLIST.includes(mime);
}

/**
 * Store a recording, replacing any take already attached to the item.
 *
 * The old byte row is intentionally left in place. Deleting bytes on a request path is what
 * makes reclamation racy; the asset layer solves this with an offline collector and so does
 * this one, eventually. Orphaned rows cost disk, never correctness.
 */
export async function saveRecording(db: AcademicDb, input: SaveRecordingInput): Promise<Recording> {
  const mime = input.mime.split(';')[0].trim().toLowerCase();

  if (!isAllowedMime(mime)) {
    throw new ValidationError(`Unsupported recording type: ${mime || 'unknown'}`);
  }
  if (input.bytes.byteLength === 0) {
    throw new ValidationError('Recording is empty');
  }
  if (input.bytes.byteLength > MAX_RECORDING_BYTES) {
    throw new ValidationError('Recording is too large');
  }

  // The item must belong to this student before anything is written, and it must still be
  // open: a submitted item is finished work, not something to attach a new take to.
  const owned = await db.query<{ id: string }>(
    `SELECT id FROM academic_assignments
     WHERE id = $1 AND student_id = $2 AND status = 'pending'`,
    [input.assignmentId, input.studentId],
  );
  if (!owned.rows[0]) {
    throw new ValidationError('That item cannot take a recording');
  }

  const hash = createHash('sha256').update(input.bytes).digest('hex');
  const id = randomUUID();

  // Content-addressed: identical bytes already stored are referenced, not duplicated. A
  // conflict here is the normal case for a re-upload of the same take, not an error.
  await db.query(
    `INSERT INTO academic_recording_bytes (hash, mime, bytes, byte_length)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (hash) DO NOTHING`,
    [hash, mime, Buffer.from(input.bytes), input.bytes.byteLength],
  );

  const result = await db.query<RawRecording>(
    `INSERT INTO academic_recordings
       (id, assignment_id, student_id, byte_hash, mime, byte_length, kind)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (assignment_id) DO UPDATE
       SET byte_hash = EXCLUDED.byte_hash,
           mime = EXCLUDED.mime,
           byte_length = EXCLUDED.byte_length,
           kind = EXCLUDED.kind,
           created_at = NOW()
     RETURNING id, assignment_id, student_id, mime, byte_length, kind, created_at`,
    [id, input.assignmentId, input.studentId, hash, mime, input.bytes.byteLength, kindFor(mime)],
  );

  return mapRecording(result.rows[0]);
}

/** Whether an item already has a take attached. */
export async function hasRecording(db: AcademicDb, assignmentId: string): Promise<boolean> {
  const result = await db.query<{ id: string }>(
    'SELECT id FROM academic_recordings WHERE assignment_id = $1',
    [assignmentId],
  );
  return result.rows.length > 0;
}

/**
 * Read a recording's bytes on behalf of a viewer.
 *
 * A student reads their own recording; a parent reads a recording belonging to their child.
 * Every other case returns `null` — including "no such recording" and "belongs to someone
 * else", which are deliberately indistinguishable so the route is not an existence oracle.
 */
export async function getRecordingForViewer(
  db: AcademicDb,
  recordingId: string,
  viewer: RecordingViewer,
): Promise<RecordingBytes | null> {
  const ownership =
    viewer.role === 'student'
      ? 'r.student_id = $2'
      : 'EXISTS (SELECT 1 FROM academic_students s WHERE s.id = r.student_id AND s.parent_id = $2)';

  const result = await db.query<{ mime: string; bytes: Uint8Array | Buffer }>(
    `SELECT b.mime, b.bytes
     FROM academic_recordings r
     JOIN academic_recording_bytes b ON b.hash = r.byte_hash
     WHERE r.id = $1 AND ${ownership}`,
    [recordingId, viewer.role === 'student' ? viewer.studentId : viewer.parentId],
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    mime: row.mime,
    bytes: row.bytes instanceof Uint8Array ? row.bytes : new Uint8Array(row.bytes),
  };
}

/** Metadata for one recording, ownership-checked the same way as the bytes. */
export async function getRecordingMetaForViewer(
  db: AcademicDb,
  recordingId: string,
  viewer: RecordingViewer,
): Promise<Recording | null> {
  const ownership =
    viewer.role === 'student'
      ? 'r.student_id = $2'
      : 'EXISTS (SELECT 1 FROM academic_students s WHERE s.id = r.student_id AND s.parent_id = $2)';

  const result = await db.query<RawRecording>(
    `SELECT r.id, r.assignment_id, r.student_id, r.mime, r.byte_length, r.kind, r.created_at
     FROM academic_recordings r
     WHERE r.id = $1 AND ${ownership}`,
    [recordingId, viewer.role === 'student' ? viewer.studentId : viewer.parentId],
  );

  return result.rows[0] ? mapRecording(result.rows[0]) : null;
}

/** The recordings attached to a set of items, keyed by assignment id. */
export async function listRecordingsForAssignments(
  db: AcademicDb,
  assignmentIds: string[],
): Promise<Map<string, Recording>> {
  if (assignmentIds.length === 0) return new Map();

  const result = await db.query<RawRecording>(
    `SELECT id, assignment_id, student_id, mime, byte_length, kind, created_at
     FROM academic_recordings
     WHERE assignment_id = ANY($1::text[])`,
    [assignmentIds],
  );

  return new Map(result.rows.map((row) => [row.assignment_id, mapRecording(row)]));
}

// ─── Mappers ──────────────────────────────────────────────────────────

interface RawRecording {
  id: string;
  assignment_id: string;
  student_id: string;
  mime: string;
  byte_length: number | string;
  kind: string;
  created_at: Date | string;
}

function mapRecording(row: RawRecording): Recording {
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    studentId: row.student_id,
    mime: row.mime,
    byteLength: Number(row.byte_length),
    kind: row.kind as RecordingKind,
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
  };
}
