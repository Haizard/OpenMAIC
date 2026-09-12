import { randomUUID } from 'node:crypto';

import type { AcademicDb } from '@/lib/academic/register';
import { ValidationError } from '@/lib/academic/register';
import { listActiveChunks, searchActiveChunks, type SourceChunk } from '@/lib/academic/source';
import type { SourceLanguage } from '@/lib/academic/source';

/**
 * The shared content bank and grounded generation — Phase B.
 *
 * The rule that makes this safe: the model sees textbook chunks and nothing else. It is told to
 * omit anything the source does not support, and when the source is too thin we refuse rather
 * than let it invent. An ungrounded question that reaches a child is worse than no question.
 */

export const CONTENT_KINDS = ['homework', 'quiz', 'practice'] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];

export const CONTENT_STATUSES = ['draft', 'published', 'flagged', 'retired'] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

/** Below this much source text, generation is refused rather than attempted. */
export const MIN_SOURCE_CHARS = 400;

export const MAX_ITEMS_PER_REQUEST = 20;
export const DEFAULT_ITEMS_PER_REQUEST = 8;

/** How many chunks to fall back to when a topic's own words do not match any chunk. */
const FALLBACK_CHUNK_COUNT = 8;

const CHOICES_PER_ITEM = 4;

export interface ContentItem {
  id: string;
  subjectId: string;
  topicId: string | null;
  kind: ContentKind;
  language: SourceLanguage;
  prompt: string;
  choices: readonly string[] | null;
  correctIndex: number | null;
  explanation: string;
  status: ContentStatus;
  sourceDocumentId: string | null;
  sourceChunkIds: readonly string[];
  model: string | null;
  generatedAt: string | null;
  createdAt: string;
  publishedAt: string | null;
  flagCount: number;
}

export interface GeneratedItemDraft {
  readonly prompt: string;
  readonly choices?: readonly string[];
  readonly correctIndex?: number;
  readonly explanation: string;
}

export type ContentLlm = (prompt: string) => Promise<string>;

export interface GenerateContentOptions {
  readonly subjectId: string;
  readonly topicId?: string;
  readonly kind: ContentKind;
  readonly language?: SourceLanguage;
  readonly count?: number;
  readonly llm: ContentLlm;
  readonly model?: string;
}

export type GenerateContentResult =
  | { readonly ok: true; readonly items: readonly ContentItem[] }
  | {
      readonly ok: false;
      readonly reason: 'no_source' | 'thin_source';
      readonly availableChars: number;
      readonly message: string;
    };

interface ItemRecord {
  id: string;
  subject_id: string;
  topic_id: string | null;
  kind: string;
  language: string;
  prompt: string;
  choices: unknown;
  correct_index: number | null;
  explanation: string;
  status: string;
  source_document_id: string | null;
  source_chunk_ids: unknown;
  model: string | null;
  generated_at: Date | string | null;
  created_at: Date | string;
  published_at: Date | string | null;
  flag_count: number;
}

const ITEM_COLUMNS = `id, subject_id, topic_id, kind, language, prompt, choices, correct_index,
  explanation, status, source_document_id, source_chunk_ids, model, generated_at, created_at,
  published_at, flag_count`;

function toIso(value: Date | string | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function asStringArray(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function mapItem(row: ItemRecord): ContentItem {
  return {
    id: row.id,
    subjectId: row.subject_id,
    topicId: row.topic_id,
    kind: CONTENT_KINDS.includes(row.kind as ContentKind) ? (row.kind as ContentKind) : 'practice',
    language: row.language === 'sw' ? 'sw' : 'en',
    prompt: row.prompt,
    choices: Array.isArray(row.choices) ? asStringArray(row.choices) : null,
    correctIndex: row.correct_index,
    explanation: row.explanation,
    status: CONTENT_STATUSES.includes(row.status as ContentStatus)
      ? (row.status as ContentStatus)
      : 'draft',
    sourceDocumentId: row.source_document_id,
    sourceChunkIds: asStringArray(row.source_chunk_ids),
    model: row.model,
    generatedAt: toIso(row.generated_at),
    createdAt: toIso(row.created_at) ?? '',
    publishedAt: toIso(row.published_at),
    flagCount: Number(row.flag_count),
  };
}

export class ContentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContentValidationError';
  }
}

/**
 * Strict validation of model output.
 *
 * Model output is untrusted input. Anything that is not a well-formed item with a real answer
 * is rejected wholesale rather than patched up — a silently repaired question is a question
 * nobody checks.
 */
export function parseGeneratedItems(raw: string): readonly GeneratedItemDraft[] {
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start === -1 || end <= start) {
    throw new ContentValidationError('The model did not return a JSON array');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    throw new ContentValidationError('The model returned malformed JSON');
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new ContentValidationError('The model returned no items');
  }

  return parsed.map((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new ContentValidationError(`Item ${index} is not an object`);
    }
    const candidate = entry as Record<string, unknown>;

    const prompt = typeof candidate.prompt === 'string' ? candidate.prompt.trim() : '';
    if (prompt === '') throw new ContentValidationError(`Item ${index} has no prompt`);

    const explanation =
      typeof candidate.explanation === 'string' ? candidate.explanation.trim() : '';
    if (explanation === '') throw new ContentValidationError(`Item ${index} has no explanation`);

    const choices = candidate.choices;
    if (choices === undefined || choices === null) {
      return { prompt, explanation };
    }
    if (!Array.isArray(choices) || choices.length < 2) {
      throw new ContentValidationError(`Item ${index} needs at least two choices`);
    }
    const cleaned = choices.map((choice) => (typeof choice === 'string' ? choice.trim() : ''));
    if (cleaned.some((choice) => choice === '')) {
      throw new ContentValidationError(`Item ${index} has an empty choice`);
    }

    const correctIndex = candidate.correctIndex;
    if (
      typeof correctIndex !== 'number' ||
      !Number.isInteger(correctIndex) ||
      correctIndex < 0 ||
      correctIndex >= cleaned.length
    ) {
      throw new ContentValidationError(`Item ${index} has an out-of-range correctIndex`);
    }

    return { prompt, choices: cleaned, correctIndex, explanation };
  });
}

export interface GenerationPromptInput {
  readonly formName: string;
  readonly subjectName: string;
  readonly topicName?: string;
  readonly kind: ContentKind;
  readonly language: SourceLanguage;
  readonly count: number;
  readonly chunks: readonly SourceChunk[];
}

export function buildGenerationPrompt(input: GenerationPromptInput): string {
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
    `You are writing ${input.kind} questions for ${input.formName} ${input.subjectName} in the Tanzanian curriculum.`,
    input.topicName ? `The topic is "${input.topicName}".` : null,
    `Write the questions in ${language}.`,
    '',
    'Use ONLY the source material below. Do not add any fact that is not stated in it.',
    'If the material does not support a question, leave that question out entirely.',
    '',
    'SOURCE MATERIAL',
    '---',
    source,
    '---',
    '',
    `Return exactly ${input.count} multiple-choice questions as a JSON array and nothing else:`,
    `[{"prompt": "...", "choices": ["...", "...", "...", "..."], "correctIndex": 0, "explanation": "..."}]`,
    '',
    `Every question must have exactly ${CHOICES_PER_ITEM} choices.`,
    'correctIndex is the position of the correct answer in choices.',
    'The explanation must explain the answer using the source material.',
    'No commentary before or after the JSON.',
  ]
    .filter((line) => line !== null)
    .join('\n');
}

export async function resolveScope(
  db: AcademicDb,
  subjectId: string,
  topicId: string | undefined,
): Promise<{ formName: string; subjectName: string; topicName: string | null }> {
  const subject = await db.query<{ name: string; form_id: string }>(
    'SELECT name, form_id FROM curriculum_subjects WHERE id = $1',
    [subjectId],
  );
  const subjectRow = subject.rows[0];
  if (!subjectRow) throw new ValidationError(`Unknown subject: ${subjectId}`);

  const form = await db.query<{ name: string }>('SELECT name FROM curriculum_forms WHERE id = $1', [
    subjectRow.form_id,
  ]);

  let topicName: string | null = null;
  if (topicId) {
    const topic = await db.query<{ name: string; description: string; subject_id: string }>(
      'SELECT name, description, subject_id FROM curriculum_topics WHERE id = $1',
      [topicId],
    );
    const topicRow = topic.rows[0];
    if (!topicRow) throw new ValidationError(`Unknown topic: ${topicId}`);
    if (topicRow.subject_id !== subjectId) {
      throw new ValidationError(`Topic ${topicId} does not belong to subject ${subjectId}`);
    }
    topicName = `${topicRow.name} ${topicRow.description}`.trim();
  }

  return {
    formName: form.rows[0]?.name ?? subjectRow.form_id,
    subjectName: subjectRow.name,
    topicName,
  };
}

/**
 * Generate items for a subject or topic, grounded in the live source chunks for it.
 *
 * Returns rather than throws when there is not enough source: a missing book is Haitham's
 * problem to fix, not a server error, and the caller needs to tell him which subject to upload.
 */
export async function generateContentForTopic(
  db: AcademicDb,
  options: GenerateContentOptions,
): Promise<GenerateContentResult> {
  const kind = options.kind;
  if (!CONTENT_KINDS.includes(kind)) throw new ValidationError(`Unknown content kind: ${kind}`);

  const count = options.count ?? DEFAULT_ITEMS_PER_REQUEST;
  if (!Number.isInteger(count) || count < 1 || count > MAX_ITEMS_PER_REQUEST) {
    throw new ValidationError(`count must be between 1 and ${MAX_ITEMS_PER_REQUEST}`);
  }

  const scope = await resolveScope(db, options.subjectId, options.topicId);

  let chunks = options.topicId
    ? await searchActiveChunks(db, options.subjectId, scope.topicName ?? '', 8)
    : [];
  if (chunks.length === 0) {
    // The topic's own words did not appear in the text. The book still covers the topic, so
    // fall back to its opening chunks rather than refusing a subject that has real source.
    chunks = await listActiveChunks(db, options.subjectId, FALLBACK_CHUNK_COUNT);
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

  const prompt = buildGenerationPrompt({
    formName: scope.formName,
    subjectName: scope.subjectName,
    ...(scope.topicName ? { topicName: scope.topicName } : {}),
    kind,
    language: options.language ?? 'en',
    count,
    chunks,
  });

  const raw = await options.llm(prompt);
  const drafts = parseGeneratedItems(raw);

  const generatedAt = new Date();
  const ids: string[] = [];

  for (const draft of drafts) {
    const id = randomUUID();
    ids.push(id);
    await db.query(
      `INSERT INTO academic_content_items
        (id, subject_id, topic_id, kind, language, prompt, choices, correct_index, explanation,
         status, source_document_id, source_chunk_ids, model, generated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft', $10, $11, $12, $13)`,
      [
        id,
        options.subjectId,
        options.topicId ?? null,
        kind,
        options.language ?? 'en',
        draft.prompt,
        draft.choices ? JSON.stringify(draft.choices) : null,
        draft.correctIndex ?? null,
        draft.explanation,
        chunks[0]?.documentId ?? null,
        JSON.stringify(chunks.map((chunk) => chunk.id)),
        options.model ?? null,
        generatedAt,
      ],
    );
  }

  if (ids.length === 0) {
    throw new ContentValidationError('No items were generated');
  }

  const stored = await db.query<ItemRecord>(
    `SELECT ${ITEM_COLUMNS} FROM academic_content_items WHERE id = ANY($1) ORDER BY created_at`,
    [ids],
  );

  return { ok: true, items: stored.rows.map(mapItem) };
}

export interface ListContentFilter {
  readonly subjectId?: string;
  readonly topicId?: string;
  readonly kind?: ContentKind;
  readonly status?: ContentStatus;
}

export async function listContentItems(
  db: AcademicDb,
  filter: ListContentFilter = {},
): Promise<readonly ContentItem[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filter.subjectId) {
    params.push(filter.subjectId);
    clauses.push(`subject_id = $${params.length}`);
  }
  if (filter.topicId) {
    params.push(filter.topicId);
    clauses.push(`topic_id = $${params.length}`);
  }
  if (filter.kind) {
    params.push(filter.kind);
    clauses.push(`kind = $${params.length}`);
  }
  if (filter.status) {
    params.push(filter.status);
    clauses.push(`status = $${params.length}`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const result = await db.query<ItemRecord>(
    `SELECT ${ITEM_COLUMNS} FROM academic_content_items ${where} ORDER BY created_at`,
    params,
  );
  return result.rows.map(mapItem);
}

/** Publish a draft. Publishing is the gate: nothing unpublished is ever served to a student. */
export async function publishContentItem(db: AcademicDb, id: string): Promise<ContentItem> {
  const result = await db.query<ItemRecord>(
    `UPDATE academic_content_items SET status = 'published', published_at = NOW()
      WHERE id = $1 AND status IN ('draft', 'flagged')
      RETURNING ${ITEM_COLUMNS}`,
    [id],
  );
  const row = result.rows[0];
  if (!row) throw new ValidationError('Only a draft or flagged item can be published');
  return mapItem(row);
}

/** Throw away an unpublished draft. Published items are retired instead, never deleted. */
export async function discardContentItem(db: AcademicDb, id: string): Promise<boolean> {
  const result = await db.query<{ id: string }>(
    `DELETE FROM academic_content_items WHERE id = $1 AND status = 'draft' RETURNING id`,
    [id],
  );
  return result.rows.length === 1;
}

export async function retireContentItem(db: AcademicDb, id: string): Promise<ContentItem> {
  const result = await db.query<ItemRecord>(
    `UPDATE academic_content_items SET status = 'retired' WHERE id = $1 RETURNING ${ITEM_COLUMNS}`,
    [id],
  );
  const row = result.rows[0];
  if (!row) throw new ValidationError(`Unknown content item: ${id}`);
  return mapItem(row);
}

export interface ContentItemPatch {
  readonly prompt?: string;
  readonly explanation?: string;
  readonly choices?: readonly string[];
  readonly correctIndex?: number;
}

export async function updateContentItem(
  db: AcademicDb,
  id: string,
  patch: ContentItemPatch,
): Promise<ContentItem> {
  const current = await db.query<ItemRecord>(
    `SELECT ${ITEM_COLUMNS} FROM academic_content_items WHERE id = $1`,
    [id],
  );
  const existing = current.rows[0];
  if (!existing) throw new ValidationError(`Unknown content item: ${id}`);

  const choices = patch.choices ?? (Array.isArray(existing.choices) ? asStringArray(existing.choices) : null);
  const correctIndex = patch.correctIndex ?? existing.correct_index;
  if (choices && choices.length >= 2) {
    if (correctIndex === null || correctIndex < 0 || correctIndex >= choices.length) {
      throw new ValidationError('correctIndex is outside the choices');
    }
  }

  const result = await db.query<ItemRecord>(
    `UPDATE academic_content_items SET
      prompt = $2, explanation = $3, choices = $4, correct_index = $5
      WHERE id = $1 RETURNING ${ITEM_COLUMNS}`,
    [
      id,
      patch.prompt?.trim() || existing.prompt,
      patch.explanation?.trim() || existing.explanation,
      choices ? JSON.stringify(choices) : null,
      correctIndex,
    ],
  );
  return mapItem(result.rows[0]);
}

export interface ContentCoverageRow {
  readonly levelId: string;
  readonly levelName: string;
  readonly formId: string;
  readonly formName: string;
  readonly subjectId: string;
  readonly subjectName: string;
  readonly draft: number;
  readonly published: number;
  readonly flagged: number;
  readonly retired: number;
  readonly total: number;
}

/**
 * Items per curriculum subject, split by status.
 *
 * Published is the only column that reaches a student. The gap between published and draft is
 * how much work is sitting unreviewed, which is the number Haitham actually needs to see.
 */
export async function listContentCoverage(db: AcademicDb): Promise<readonly ContentCoverageRow[]> {
  const result = await db.query<{
    level_id: string;
    level_name: string;
    form_id: string;
    form_name: string;
    subject_id: string;
    subject_name: string;
    draft: string | number;
    published: string | number;
    flagged: string | number;
    retired: string | number;
  }>(
    `SELECT lv.id AS level_id, lv.name AS level_name,
            fm.id AS form_id, fm.name AS form_name,
            sj.id AS subject_id, sj.name AS subject_name,
            COALESCE(SUM(CASE WHEN ci.status = 'draft' THEN 1 ELSE 0 END), 0) AS draft,
            COALESCE(SUM(CASE WHEN ci.status = 'published' THEN 1 ELSE 0 END), 0) AS published,
            COALESCE(SUM(CASE WHEN ci.status = 'flagged' THEN 1 ELSE 0 END), 0) AS flagged,
            COALESCE(SUM(CASE WHEN ci.status = 'retired' THEN 1 ELSE 0 END), 0) AS retired
      FROM curriculum_subjects sj
      JOIN curriculum_forms fm ON fm.id = sj.form_id
      JOIN curriculum_levels lv ON lv.id = fm.level_id
      LEFT JOIN academic_content_items ci ON ci.subject_id = sj.id
      GROUP BY lv.id, lv.name, fm.id, fm.name, sj.id, sj.name,
               lv.sort_order, fm.sort_order, sj.sort_order
      ORDER BY lv.sort_order, fm.sort_order, sj.sort_order`,
  );

  return result.rows.map((row) => {
    const draft = Number(row.draft);
    const published = Number(row.published);
    const flagged = Number(row.flagged);
    const retired = Number(row.retired);
    return {
      levelId: row.level_id,
      levelName: row.level_name,
      formId: row.form_id,
      formName: row.form_name,
      subjectId: row.subject_id,
      subjectName: row.subject_name,
      draft,
      published,
      flagged,
      retired,
      total: draft + published + flagged + retired,
    };
  });
}

export interface CurriculumTopicRef {
  readonly id: string;
  readonly name: string;
}

/** Topics of a subject, in curriculum order. Used to pick a generation scope. */
export async function listCurriculumTopics(
  db: AcademicDb,
  subjectId: string,
): Promise<readonly CurriculumTopicRef[]> {
  const result = await db.query<{ id: string; name: string }>(
    'SELECT id, name FROM curriculum_topics WHERE subject_id = $1 ORDER BY sort_order, name',
    [subjectId],
  );
  return result.rows.map((row) => ({ id: row.id, name: row.name }));
}

export interface GenerationBlocker {
  readonly subjectId: string;
  readonly subjectName: string;
  readonly topicId: string;
  readonly topicName: string;
  readonly availableChars: number;
}

/**
 * Topics that cannot be generated from yet, because their subject has too little source.
 *
 * Computed rather than stored: a stored "blocked" row goes stale the moment Haitham uploads
 * the book, and a dashboard that says "no source" after an upload is worse than no dashboard.
 */
export async function listGenerationBlockers(db: AcademicDb): Promise<readonly GenerationBlocker[]> {
  const result = await db.query<{
    subject_id: string;
    subject_name: string;
    topic_id: string;
    topic_name: string;
    available_chars: string | number;
  }>(
    `SELECT sj.id AS subject_id, sj.name AS subject_name,
            t.id AS topic_id, t.name AS topic_name,
            COALESCE(SUM(doc.char_count), 0) AS available_chars
      FROM curriculum_topics t
      JOIN curriculum_subjects sj ON sj.id = t.subject_id
      LEFT JOIN academic_source_documents doc
        ON doc.subject_id = sj.id AND doc.superseded_at IS NULL AND doc.status = 'ready'
      GROUP BY sj.id, sj.name, t.id, t.name, t.sort_order
      HAVING COALESCE(SUM(doc.char_count), 0) < $1
      ORDER BY sj.name, t.sort_order`,
    [MIN_SOURCE_CHARS],
  );

  return result.rows.map((row) => ({
    subjectId: row.subject_id,
    subjectName: row.subject_name,
    topicId: row.topic_id,
    topicName: row.topic_name,
    availableChars: Number(row.available_chars),
  }));
}
