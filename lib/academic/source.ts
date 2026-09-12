import { createHash, randomUUID } from 'node:crypto';

import type { AcademicDb } from '@/lib/academic/register';
import { ValidationError, withTransaction } from '@/lib/academic/register';
import type { SourceChunkDraft, SourcePage } from '@/lib/academic/source-chunk';
import { chunkSourcePages } from '@/lib/academic/source-chunk';

/**
 * Source document ingest — Phase A of the AI content platform.
 *
 * One live document per (form, subject, edition). Uploading a new edition supersedes the old
 * one rather than adding to it, so the active pool a generator reads from never contains two
 * copies of the same textbook.
 */

export const SOURCE_LANGUAGES = ['en', 'sw'] as const;
export type SourceLanguage = (typeof SOURCE_LANGUAGES)[number];

export const SOURCE_STATUSES = ['ready', 'failed'] as const;
export type SourceDocumentStatus = (typeof SOURCE_STATUSES)[number];

export const DEFAULT_EDITION = 'default';
export const MAX_UPLOAD_BYTES = 40 * 1024 * 1024;

export interface SourceDocument {
  id: string;
  formId: string;
  subjectId: string;
  title: string;
  edition: string;
  language: SourceLanguage;
  contentHash: string;
  byteSize: number;
  pageCount: number;
  chunkCount: number;
  charCount: number;
  status: SourceDocumentStatus;
  licenseNote: string | null;
  uploadedAt: string;
  supersededAt: string | null;
}

export interface SourceChunk {
  id: string;
  documentId: string;
  ordinal: number;
  text: string;
  contentHash: string;
  pageNumber: number | null;
  heading: string | null;
  charCount: number;
  documentTitle: string;
  edition: string;
  formId: string;
  subjectId: string;
}

export interface IngestSourceInput {
  readonly formId: string;
  readonly subjectId: string;
  readonly title: string;
  readonly edition?: string;
  readonly language?: SourceLanguage;
  readonly licenseNote?: string | null;
  readonly pages: readonly SourcePage[];
  readonly byteSize?: number;
}

export interface IngestSourceResult {
  readonly document: SourceDocument;
  /** True when the exact same content was already live, so nothing was written. */
  readonly reused: boolean;
  /** The document this upload replaced, if any. */
  readonly supersededDocumentId: string | null;
}

export interface SourceCoverageRow {
  readonly levelId: string;
  readonly levelName: string;
  readonly formId: string;
  readonly formName: string;
  readonly formSlug: string;
  readonly subjectId: string;
  readonly subjectName: string;
  readonly subjectSlug: string;
  readonly documentCount: number;
  readonly chunkCount: number;
  readonly charCount: number;
  readonly edition: string | null;
  readonly language: string | null;
  readonly uploadedAt: string | null;
}

const DOCUMENT_COLUMNS = `id, form_id, subject_id, title, edition, language, content_hash,
  byte_size, page_count, chunk_count, char_count, status, license_note, uploaded_at,
  superseded_at`;

interface DocumentRecord {
  id: string;
  form_id: string;
  subject_id: string;
  title: string;
  edition: string;
  language: string;
  content_hash: string;
  byte_size: number;
  page_count: number;
  chunk_count: number;
  char_count: number;
  status: string;
  license_note: string | null;
  uploaded_at: Date | string;
  superseded_at: Date | string | null;
}

function toIso(value: Date | string | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapDocument(row: DocumentRecord): SourceDocument {
  return {
    id: row.id,
    formId: row.form_id,
    subjectId: row.subject_id,
    title: row.title,
    edition: row.edition,
    language: row.language === 'sw' ? 'sw' : 'en',
    contentHash: row.content_hash,
    byteSize: Number(row.byte_size),
    pageCount: Number(row.page_count),
    chunkCount: Number(row.chunk_count),
    charCount: Number(row.char_count),
    status: row.status === 'failed' ? 'failed' : 'ready',
    licenseNote: row.license_note,
    uploadedAt: toIso(row.uploaded_at) ?? '',
    supersededAt: toIso(row.superseded_at),
  };
}

function hashPages(pages: readonly SourcePage[]): string {
  return createHash('sha256')
    .update(
      JSON.stringify(
        pages.map((page) => [page.pageNumber ?? null, page.text.replace(/\r\n?/g, '\n')]),
      ),
      'utf8',
    )
    .digest('hex');
}

async function assertFormAndSubject(
  db: AcademicDb,
  formId: string,
  subjectId: string,
): Promise<void> {
  const form = await db.query<{ id: string }>('SELECT id FROM curriculum_forms WHERE id = $1', [
    formId,
  ]);
  if (!form.rows[0]) throw new ValidationError(`Unknown form: ${formId}`);

  const subject = await db.query<{ id: string; form_id: string }>(
    'SELECT id, form_id FROM curriculum_subjects WHERE id = $1',
    [subjectId],
  );
  const row = subject.rows[0];
  if (!row) throw new ValidationError(`Unknown subject: ${subjectId}`);
  if (row.form_id !== formId) {
    throw new ValidationError(`Subject ${subjectId} does not belong to form ${formId}`);
  }
}

/**
 * Store a source document and its chunks.
 *
 * Idempotent on content: uploading the identical bytes again returns the existing document
 * untouched. Uploading different bytes under the same (form, subject, edition) supersedes the
 * previous document instead of sitting alongside it.
 */
export async function ingestSourceDocument(
  db: AcademicDb,
  input: IngestSourceInput,
): Promise<IngestSourceResult> {
  const formId = input.formId?.trim();
  const subjectId = input.subjectId?.trim();
  const title = input.title?.trim();
  if (!formId) throw new ValidationError('formId is required');
  if (!subjectId) throw new ValidationError('subjectId is required');
  if (!title) throw new ValidationError('title is required');

  const edition = input.edition?.trim() || DEFAULT_EDITION;
  const language: SourceLanguage = input.language ?? 'en';
  if (!SOURCE_LANGUAGES.includes(language)) {
    throw new ValidationError(`Unsupported language: ${String(input.language)}`);
  }

  const pages = (input.pages ?? []).filter((page) => page.text.trim() !== '');
  if (pages.length === 0) {
    throw new ValidationError('The document has no extractable text');
  }

  await assertFormAndSubject(db, formId, subjectId);

  const contentHash = hashPages(pages);
  const drafts = chunkSourcePages(pages);
  if (drafts.length === 0) {
    throw new ValidationError('The document has no extractable text');
  }

  const existing = await db.query<DocumentRecord>(
    `SELECT ${DOCUMENT_COLUMNS} FROM academic_source_documents
      WHERE form_id = $1 AND subject_id = $2 AND edition = $3 AND superseded_at IS NULL`,
    [formId, subjectId, edition],
  );
  const current = existing.rows[0];

  if (current && current.content_hash === contentHash) {
    return { document: mapDocument(current), reused: true, supersededDocumentId: null };
  }

  const byteSize = input.byteSize ?? 0;
  const charCount = drafts.reduce((total, draft) => total + draft.charCount, 0);
  const documentId = randomUUID();

  const inserted = await withTransaction(db, async (query) => {
    let supersededDocumentId: string | null = null;
    if (current) {
      await query(
        `UPDATE academic_source_documents SET superseded_at = NOW()
          WHERE id = $1 AND superseded_at IS NULL`,
        [current.id],
      );
      supersededDocumentId = current.id;
    }

    await query(
      `INSERT INTO academic_source_documents
        (id, form_id, subject_id, title, edition, language, content_hash, byte_size,
         page_count, chunk_count, char_count, status, license_note)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'ready', $12)`,
      [
        documentId,
        formId,
        subjectId,
        title,
        edition,
        language,
        contentHash,
        byteSize,
        pages.length,
        drafts.length,
        charCount,
        input.licenseNote?.trim() || null,
      ],
    );

    for (const draft of drafts) {
      await query(
        `INSERT INTO academic_document_chunks
          (id, document_id, ordinal, text, content_hash, page_number, heading, char_count)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (document_id, ordinal) DO UPDATE SET
            text = EXCLUDED.text,
            content_hash = EXCLUDED.content_hash,
            page_number = EXCLUDED.page_number,
            heading = EXCLUDED.heading,
            char_count = EXCLUDED.char_count`,
        [
          `${documentId}:${draft.ordinal}`,
          documentId,
          draft.ordinal,
          draft.text,
          draft.contentHash,
          draft.pageNumber,
          draft.heading,
          draft.charCount,
        ],
      );
    }

    return supersededDocumentId;
  });

  const stored = await db.query<DocumentRecord>(
    `SELECT ${DOCUMENT_COLUMNS} FROM academic_source_documents WHERE id = $1`,
    [documentId],
  );
  const row = stored.rows[0];
  if (!row) throw new Error('Source document disappeared during ingest');

  return { document: mapDocument(row), reused: false, supersededDocumentId: inserted };
}

export interface ListSourceDocumentsFilter {
  readonly subjectId?: string;
  readonly formId?: string;
  readonly includeSuperseded?: boolean;
}

export async function listSourceDocuments(
  db: AcademicDb,
  filter: ListSourceDocumentsFilter = {},
): Promise<readonly SourceDocument[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filter.subjectId) {
    params.push(filter.subjectId);
    clauses.push(`subject_id = $${params.length}`);
  }
  if (filter.formId) {
    params.push(filter.formId);
    clauses.push(`form_id = $${params.length}`);
  }
  if (!filter.includeSuperseded) clauses.push('superseded_at IS NULL');

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const result = await db.query<DocumentRecord>(
    `SELECT ${DOCUMENT_COLUMNS} FROM academic_source_documents ${where}
      ORDER BY uploaded_at DESC`,
    params,
  );
  return result.rows.map(mapDocument);
}

const CHUNK_SELECT = `c.id, c.document_id, c.ordinal, c.text, c.content_hash, c.page_number,
  c.heading, c.char_count, d.title AS document_title, d.edition, d.form_id, d.subject_id`;

interface ChunkRecord {
  id: string;
  document_id: string;
  ordinal: number;
  text: string;
  content_hash: string;
  page_number: number | null;
  heading: string | null;
  char_count: number;
  document_title: string;
  edition: string;
  form_id: string;
  subject_id: string;
}

function mapChunk(row: ChunkRecord): SourceChunk {
  return {
    id: row.id,
    documentId: row.document_id,
    ordinal: Number(row.ordinal),
    text: row.text,
    contentHash: row.content_hash,
    pageNumber: row.page_number,
    heading: row.heading,
    charCount: Number(row.char_count),
    documentTitle: row.document_title,
    edition: row.edition,
    formId: row.form_id,
    subjectId: row.subject_id,
  };
}

/** Every chunk of the live document for a subject, in reading order. */
export async function listActiveChunks(
  db: AcademicDb,
  subjectId: string,
  limit = 500,
): Promise<readonly SourceChunk[]> {
  const result = await db.query<ChunkRecord>(
    `SELECT ${CHUNK_SELECT}
      FROM academic_document_chunks c
      JOIN academic_source_documents d ON d.id = c.document_id
      WHERE d.subject_id = $1 AND d.superseded_at IS NULL AND d.status = 'ready'
      ORDER BY c.ordinal
      LIMIT $2`,
    [subjectId, limit],
  );
  return result.rows.map(mapChunk);
}

/**
 * Word-level lexical retrieval over the live chunks of one subject.
 *
 * Every word must appear (AND), so adding words narrows rather than widens. Intentionally not
 * ranked by relevance: generation will read these as context, and a stable, explainable match
 * is worth more here than a clever score.
 */
export async function searchActiveChunks(
  db: AcademicDb,
  subjectId: string,
  query: string,
  limit = 8,
): Promise<readonly SourceChunk[]> {
  const words = Array.from(
    new Set(
      query
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .map((word) => word.trim())
        .filter((word) => word.length >= 2),
    ),
  ).slice(0, 8);

  if (words.length === 0) return [];

  const params: unknown[] = [subjectId];
  const clauses = words.map((word) => {
    params.push(`%${word}%`);
    return `c.text ILIKE $${params.length}`;
  });
  params.push(limit);

  const result = await db.query<ChunkRecord>(
    `SELECT ${CHUNK_SELECT}
      FROM academic_document_chunks c
      JOIN academic_source_documents d ON d.id = c.document_id
      WHERE d.subject_id = $1 AND d.superseded_at IS NULL AND d.status = 'ready'
        AND ${clauses.join(' AND ')}
      ORDER BY c.ordinal
      LIMIT $${params.length}`,
    params,
  );
  return result.rows.map(mapChunk);
}

/**
 * One row per curriculum subject, with or without a document.
 *
 * The gaps are the point: this is the view that answers "what can the AI actually teach from
 * today", and it is what Phase B checks before agreeing to generate anything.
 */
export async function listSourceCoverage(db: AcademicDb): Promise<readonly SourceCoverageRow[]> {
  const result = await db.query<{
    level_id: string;
    level_name: string;
    form_id: string;
    form_name: string;
    form_slug: string;
    subject_id: string;
    subject_name: string;
    subject_slug: string;
    document_count: string | number;
    chunk_count: string | number | null;
    char_count: string | number | null;
    edition: string | null;
    language: string | null;
    uploaded_at: Date | string | null;
  }>(
    `SELECT lv.id AS level_id, lv.name AS level_name,
            fm.id AS form_id, fm.name AS form_name, fm.slug AS form_slug,
            sj.id AS subject_id, sj.name AS subject_name, sj.slug AS subject_slug,
            COUNT(doc.id) AS document_count,
            COALESCE(SUM(doc.chunk_count), 0) AS chunk_count,
            COALESCE(SUM(doc.char_count), 0) AS char_count,
            MAX(doc.edition) AS edition,
            MAX(doc.language) AS language,
            MAX(doc.uploaded_at) AS uploaded_at
      FROM curriculum_subjects sj
      JOIN curriculum_forms fm ON fm.id = sj.form_id
      JOIN curriculum_levels lv ON lv.id = fm.level_id
      LEFT JOIN academic_source_documents doc
        ON doc.subject_id = sj.id AND doc.superseded_at IS NULL AND doc.status = 'ready'
      GROUP BY lv.id, lv.name, fm.id, fm.name, fm.slug, sj.id, sj.name, sj.slug,
               lv.sort_order, fm.sort_order, sj.sort_order
      ORDER BY lv.sort_order, fm.sort_order, sj.sort_order`,
  );

  return result.rows.map((row) => ({
    levelId: row.level_id,
    levelName: row.level_name,
    formId: row.form_id,
    formName: row.form_name,
    formSlug: row.form_slug,
    subjectId: row.subject_id,
    subjectName: row.subject_name,
    subjectSlug: row.subject_slug,
    documentCount: Number(row.document_count),
    chunkCount: Number(row.chunk_count ?? 0),
    charCount: Number(row.char_count ?? 0),
    edition: row.edition,
    language: row.language,
    uploadedAt: toIso(row.uploaded_at),
  }));
}

/**
 * Pull a document out of the active pool without deleting it.
 *
 * Nothing is ever hard-deleted: generated items keep a reference to the chunk they came from,
 * so removing the bytes would leave those items unexplainable.
 */
export async function retireSourceDocument(db: AcademicDb, documentId: string): Promise<boolean> {
  // RETURNING rather than a row count: pg reports `rowCount`, PGlite reports `affectedRows`,
  // and the tests and production must not disagree about whether the retire happened.
  const result = await db.query<{ id: string }>(
    `UPDATE academic_source_documents SET superseded_at = NOW()
      WHERE id = $1 AND superseded_at IS NULL
      RETURNING id`,
    [documentId],
  );
  return result.rows.length === 1;
}

export type { SourceChunkDraft, SourcePage };
