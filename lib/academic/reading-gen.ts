import { randomUUID } from 'node:crypto';

import type { AcademicDb } from '@/lib/academic/register';
import { ValidationError } from '@/lib/academic/register';
import {
  ContentValidationError,
  MIN_SOURCE_CHARS,
  resolveScope,
  type ContentLlm,
} from '@/lib/academic/content-bank';
import { listActiveChunks, searchActiveChunks, type SourceChunk } from '@/lib/academic/source';
import type { SourceLanguage } from '@/lib/academic/source';
import type { ReadingKind } from '@/lib/academic/reading';

/**
 * Generating the reading library — Phase H.
 *
 * Phase B deliberately refused to force reading passages into the bank's `prompt`/`explanation`
 * shape, because a passage is not a question and pretending otherwise would have been a lie. So
 * the Read pillar stayed hand-seeded while the other three became AI-generated. This closes that.
 *
 * Same grounding rules as the bank: generate only from the uploaded book for that subject, refuse
 * when the source is too thin, and record which chunks taught it.
 */

/** How many chunks to reach for when a topic's own words do appear in the text. */
const CHUNK_COUNT = 8;

/** A passage shorter than this is not worth a student's time; the model is asked again or refused. */
export const MIN_BODY_CHARS = 400;

const WORDS_PER_MINUTE = 180;

export interface GeneratedReadingDraft {
  readonly title: string;
  readonly summary: string;
  readonly body: string;
  readonly readingMinutes: number;
}

export interface ReadingPromptInput {
  readonly formName: string;
  readonly subjectName: string;
  readonly topicName?: string;
  readonly language: SourceLanguage;
  readonly chunks: readonly SourceChunk[];
}

export function buildReadingPrompt(input: ReadingPromptInput): string {
  const language = input.language === 'sw' ? 'Kiswahili' : 'English';
  const source = input.chunks
    .map((chunk) => {
      const where = [chunk.heading, chunk.pageNumber ? `page ${chunk.pageNumber}` : null]
        .filter(Boolean)
        .join(', ');
      return `[${chunk.documentTitle}${where ? ` — ${where}` : ''}]\n${chunk.text}`;
    })
    .join('\n\n');

  return [
    `You are writing a study passage for ${input.formName} ${input.subjectName} in the Tanzanian curriculum.`,
    input.topicName ? `The topic is "${input.topicName}".` : null,
    `Write the passage in ${language}.`,
    '',
    'Use ONLY the source material below. Do not add any fact that is not stated in it.',
    'If the material does not support a passage, say so instead of writing one.',
    '',
    'SOURCE MATERIAL',
    '---',
    source,
    '---',
    '',
    'Return one passage as a JSON object and nothing else:',
    '{"title": "...", "summary": "...", "body": "...", "readingMinutes": 4}',
    '',
    'The title is short and names what the passage covers.',
    'The summary is one or two sentences a student reads before deciding to open it.',
    `The body is at least ${MIN_BODY_CHARS} characters, written for a student of this level, and`,
    'explains the topic in order rather than listing facts.',
    'readingMinutes is how long the body takes to read.',
    'No commentary before or after the JSON.',
  ]
    .filter((line) => line !== null)
    .join('\n');
}

function requireText(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ContentValidationError(`The generated reading has no ${field}`);
  }
  const trimmed = value.trim();
  if (trimmed.length > max) {
    throw new ContentValidationError(`The generated ${field} is too long (${trimmed.length})`);
  }
  return trimmed;
}

/**
 * Parse one generated passage.
 *
 * The model's output is untrusted input: anything that does not validate is rejected whole rather
 * than patched up, because a passage that is half invention is worse than no passage.
 */
export function parseGeneratedReading(raw: string): GeneratedReadingDraft {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) {
    throw new ContentValidationError('The model did not return a passage');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    throw new ContentValidationError('The model returned something that is not JSON');
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new ContentValidationError('The model did not return a passage object');
  }

  const record = parsed as Record<string, unknown>;

  const title = requireText(record.title, 'title', 200);
  const summary = requireText(record.summary, 'summary', 600);
  const body = requireText(record.body, 'body', 20_000);

  if (body.length < MIN_BODY_CHARS) {
    throw new ContentValidationError(
      `The generated passage is only ${body.length} characters; at least ${MIN_BODY_CHARS} are needed`,
    );
  }

  const declared = record.readingMinutes;
  const readingMinutes =
    typeof declared === 'number' && Number.isFinite(declared) && declared > 0
      ? Math.min(60, Math.round(declared))
      : Math.max(1, Math.round(body.split(/\s+/).length / WORDS_PER_MINUTE));

  return { title, summary, body, readingMinutes };
}

export interface GenerateReadingOptions {
  readonly subjectId: string;
  readonly topicId?: string;
  readonly kind?: ReadingKind;
  readonly language?: SourceLanguage;
  readonly llm: ContentLlm;
  readonly model?: string;
}

export interface GeneratedReading {
  readonly id: string;
  readonly topicId: string | null;
  readonly title: string;
  readonly summary: string;
  readonly body: string;
  readonly kind: string;
  readonly readingMinutes: number;
  readonly published: boolean;
  readonly sourceDocumentId: string | null;
  readonly sourceChunkIds: readonly string[];
  readonly model: string | null;
  readonly generatedAt: string | null;
  readonly createdAt: string;
}

export type GenerateReadingResult =
  | { readonly ok: true; readonly reading: GeneratedReading }
  | {
      readonly ok: false;
      readonly reason: 'no_source' | 'thin_source';
      readonly availableChars: number;
      readonly message: string;
    };

/**
 * Write a passage for a topic from the live source for its subject.
 *
 * Returns rather than throws when the source is too thin: a missing book is Haitham's problem to
 * fix, not a server error, and he needs to be told which subject to upload.
 *
 * The passage lands **unpublished**. It goes through the same review gate as bank items, because a
 * passage that confidently teaches the wrong thing is the worst thing this platform could serve.
 */
export async function generateReadingForTopic(
  db: AcademicDb,
  options: GenerateReadingOptions,
): Promise<GenerateReadingResult> {
  const scope = await resolveScope(db, options.subjectId, options.topicId);

  let chunks = options.topicId
    ? await searchActiveChunks(db, options.subjectId, scope.topicName ?? '', CHUNK_COUNT)
    : [];
  if (chunks.length === 0) {
    // The topic's own words did not appear in the text, but the book still covers it, so fall
    // back to its opening chunks rather than refusing a subject that has real source.
    chunks = await listActiveChunks(db, options.subjectId, CHUNK_COUNT);
  }

  if (chunks.length === 0) {
    return {
      ok: false,
      reason: 'no_source',
      availableChars: 0,
      message: `No source document has been uploaded for ${scope.subjectName} yet`,
    };
  }

  const availableChars = chunks.reduce((total, chunk) => total + chunk.charCount, 0);
  if (availableChars < MIN_SOURCE_CHARS) {
    return {
      ok: false,
      reason: 'thin_source',
      availableChars,
      message: `${scope.subjectName} has only ${availableChars} characters of source; at least ${MIN_SOURCE_CHARS} are needed`,
    };
  }

  const prompt = buildReadingPrompt({
    formName: scope.formName,
    subjectName: scope.subjectName,
    ...(scope.topicName ? { topicName: scope.topicName } : {}),
    language: options.language ?? 'en',
    chunks,
  });

  const raw = await options.llm(prompt);
  const draft = parseGeneratedReading(raw);

  const id = randomUUID();
  const generatedAt = new Date();

  await db.query(
    `INSERT INTO academic_readings
       (id, topic_id, title, summary, body, kind, source, reading_minutes, sort_order, published,
        source_document_id, source_chunk_ids, model, generated_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'generated', $7, 0, FALSE, $8, $9, $10, $11)`,
    [
      id,
      options.topicId ?? null,
      draft.title,
      draft.summary,
      draft.body,
      options.kind ?? 'lesson_note',
      draft.readingMinutes,
      chunks[0]?.documentId ?? null,
      JSON.stringify(chunks.map((chunk) => chunk.id)),
      options.model ?? null,
      generatedAt,
    ],
  );

  const stored = await db.query<GeneratedReadingRecord>(
    `SELECT ${GENERATED_COLUMNS} FROM academic_readings WHERE id = $1`,
    [id],
  );

  const row = stored.rows[0];
  if (!row) throw new ValidationError('The generated reading could not be read back');

  return { ok: true, reading: mapGeneratedReading(row) };
}

// ─── Review ───────────────────────────────────────────────────────────

const GENERATED_COLUMNS = `id, topic_id, title, summary, body, kind, source, reading_minutes,
  sort_order, published, source_document_id, source_chunk_ids, model, generated_at, created_at`;

interface GeneratedReadingRecord {
  id: string;
  topic_id: string | null;
  title: string;
  summary: string;
  body: string;
  kind: string;
  reading_minutes: number;
  published: boolean;
  source_document_id: string | null;
  source_chunk_ids: unknown;
  model: string | null;
  generated_at: Date | string | null;
  created_at: Date | string;
}

function mapGeneratedReading(row: GeneratedReadingRecord): GeneratedReading {
  const chunkIds = row.source_chunk_ids;
  return {
    id: row.id,
    topicId: row.topic_id,
    title: row.title,
    summary: row.summary,
    body: row.body,
    kind: row.kind,
    readingMinutes: Number(row.reading_minutes),
    published: row.published,
    sourceDocumentId: row.source_document_id,
    sourceChunkIds: Array.isArray(chunkIds) ? (chunkIds as string[]) : [],
    model: row.model,
    generatedAt:
      row.generated_at === null
        ? null
        : row.generated_at instanceof Date
          ? row.generated_at.toISOString()
          : String(row.generated_at),
    createdAt:
      row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

/** Generated passages awaiting review, newest first. */
export async function listGeneratedReadings(
  db: AcademicDb,
  options: { published?: boolean } = {},
): Promise<readonly GeneratedReading[]> {
  const result = await db.query<GeneratedReadingRecord>(
    `SELECT ${GENERATED_COLUMNS} FROM academic_readings
      WHERE source = 'generated' AND ($1::boolean IS NULL OR published = $1)
      ORDER BY created_at DESC, title`,
    [options.published ?? null],
  );
  return result.rows.map(mapGeneratedReading);
}

/** Publish a generated passage so students can read it. */
export async function publishGeneratedReading(
  db: AcademicDb,
  id: string,
): Promise<GeneratedReading> {
  return setPublished(db, id, true);
}

/** Unpublish a generated passage. It is kept, not deleted — it may simply need another look. */
export async function unpublishGeneratedReading(
  db: AcademicDb,
  id: string,
): Promise<GeneratedReading> {
  return setPublished(db, id, false);
}

async function setPublished(
  db: AcademicDb,
  id: string,
  published: boolean,
): Promise<GeneratedReading> {
  const result = await db.query<GeneratedReadingRecord>(
    `UPDATE academic_readings SET published = $2, updated_at = NOW()
      WHERE id = $1 AND source = 'generated'
      RETURNING ${GENERATED_COLUMNS}`,
    [id, published],
  );
  const row = result.rows[0];
  if (!row) throw new ValidationError('That generated reading does not exist');
  return mapGeneratedReading(row);
}

/** Throw a generated passage away. Only ever applies to generated ones. */
export async function discardGeneratedReading(db: AcademicDb, id: string): Promise<boolean> {
  const result = await db.query<{ id: string }>(
    `DELETE FROM academic_readings WHERE id = $1 AND source = 'generated' RETURNING id`,
    [id],
  );
  return Boolean(result.rows[0]);
}
