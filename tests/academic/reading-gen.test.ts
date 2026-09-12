import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ensureAcademicSchema } from '@/lib/academic/schema';
import { ensureCurriculumSchema } from '@/lib/academic/curriculum-schema';
import { seedCurriculum } from '@/lib/academic/curriculum-seed';
import { ensureReadingSchema } from '@/lib/academic/reading-schema';
import { ensureSourceSchema } from '@/lib/academic/source-schema';
import { ContentValidationError } from '@/lib/academic/content-bank';
import { ingestSourceDocument } from '@/lib/academic/source';
import { registerStudentFirst, ValidationError } from '@/lib/academic/register';
import { listReadingsForStudent } from '@/lib/academic/reading';
import {
  buildReadingPrompt,
  discardGeneratedReading,
  generateReadingForTopic,
  listGeneratedReadings,
  MIN_BODY_CHARS,
  parseGeneratedReading,
  publishGeneratedReading,
  unpublishGeneratedReading,
} from '@/lib/academic/reading-gen';

/**
 * Phase H: reading passages are generated from the uploaded book, carry their provenance, and
 * land unpublished so a passage is never taught before someone has read it.
 */

class PGlitePool {
  constructor(readonly db: PGlite) {}
  query<TRow>(text: string, params?: unknown[]) {
    return this.db.query<TRow>(text, params);
  }
}

let pool: PGlitePool;

const SUBJECT_ID = 'std5-math';
const TOPIC_ID = 'std5-math-1';
const SOURCE_TEXT = 'Fractions name equal parts of a whole and the denominator counts them. '.repeat(
  30,
);

const BODY = 'A fraction names equal parts of a whole, and the denominator counts them. '.repeat(
  12,
);

function llmReturning(raw: string): (prompt: string) => Promise<string> {
  return async () => raw;
}

function validReading(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    title: 'Fractions',
    summary: 'What a fraction names and how to read one.',
    body: BODY,
    readingMinutes: 4,
    ...overrides,
  });
}

async function ingest(): Promise<void> {
  await ingestSourceDocument(pool, {
    formId: 'std5',
    subjectId: SUBJECT_ID,
    title: 'Primary Mathematics 5',
    pages: [{ pageNumber: 1, text: `Chapter 1\n\n${SOURCE_TEXT}` }],
  });
}

beforeEach(async () => {
  pool = new PGlitePool(new PGlite());
  await ensureAcademicSchema(pool);
  await ensureCurriculumSchema(pool);
  await seedCurriculum(pool);
  await ensureReadingSchema(pool);
  await ensureSourceSchema(pool);
});

afterEach(async () => {
  await pool.db.close();
});

describe('parseGeneratedReading', () => {
  it('accepts a well-formed passage', () => {
    const draft = parseGeneratedReading(validReading());
    expect(draft.title).toBe('Fractions');
    expect(draft.body.length).toBeGreaterThanOrEqual(MIN_BODY_CHARS);
    expect(draft.readingMinutes).toBe(4);
  });

  it('ignores prose around the JSON', () => {
    const draft = parseGeneratedReading(`Here you go:\n${validReading()}\nHope that helps.`);
    expect(draft.title).toBe('Fractions');
  });

  it('rejects output that is not JSON', () => {
    expect(() => parseGeneratedReading('I cannot help with that.')).toThrow(
      ContentValidationError,
    );
  });

  it('rejects a passage with no title', () => {
    expect(() => parseGeneratedReading(validReading({ title: '' }))).toThrow(/no title/);
  });

  it('rejects a passage with no summary', () => {
    expect(() => parseGeneratedReading(validReading({ summary: '  ' }))).toThrow(/no summary/);
  });

  it('rejects a passage too short to be worth reading', () => {
    expect(() => parseGeneratedReading(validReading({ body: 'Fractions are useful.' }))).toThrow(
      /at least/i,
    );
  });

  it('works out the reading time when the model does not say', () => {
    const draft = parseGeneratedReading(validReading({ readingMinutes: undefined }));
    expect(draft.readingMinutes).toBeGreaterThanOrEqual(1);
  });

  it('keeps an absurd reading time within reason', () => {
    const draft = parseGeneratedReading(validReading({ readingMinutes: 9000 }));
    expect(draft.readingMinutes).toBeLessThanOrEqual(60);
  });
});

describe('buildReadingPrompt', () => {
  it('forbids inventing facts that are not in the source', () => {
    const prompt = buildReadingPrompt({
      formName: 'Standard 5',
      subjectName: 'Mathematics',
      language: 'en',
      chunks: [],
    });
    expect(prompt).toMatch(/ONLY the source material/i);
  });

  it('names the topic and the language', () => {
    const prompt = buildReadingPrompt({
      formName: 'Form 1',
      subjectName: 'Physics',
      topicName: 'Forces',
      language: 'sw',
      chunks: [],
    });
    expect(prompt).toContain('Forces');
    expect(prompt).toContain('Kiswahili');
  });
});

describe('generateReadingForTopic', () => {
  it('stores the passage with its provenance', async () => {
    await ingest();

    const result = await generateReadingForTopic(pool, {
      subjectId: SUBJECT_ID,
      topicId: TOPIC_ID,
      llm: llmReturning(validReading()),
      model: 'test-model',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.reading.sourceDocumentId).not.toBeNull();
    expect(result.reading.sourceChunkIds.length).toBeGreaterThan(0);
    expect(result.reading.model).toBe('test-model');
    expect(result.reading.generatedAt).not.toBeNull();
  });

  it('lands unpublished, so a student cannot read it yet', async () => {
    await ingest();

    const result = await generateReadingForTopic(pool, {
      subjectId: SUBJECT_ID,
      topicId: TOPIC_ID,
      llm: llmReturning(validReading()),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.reading.published).toBe(false);
  });

  it('refuses to invent a passage when there is no book', async () => {
    const result = await generateReadingForTopic(pool, {
      subjectId: SUBJECT_ID,
      topicId: TOPIC_ID,
      llm: llmReturning(validReading()),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('no_source');
    expect(result.message).toContain('Mathematics');
  });

  it('refuses when the book is too thin to ground a passage', async () => {
    await ingestSourceDocument(pool, {
      formId: 'std5',
      subjectId: SUBJECT_ID,
      title: 'Primary Mathematics 5',
      pages: [{ pageNumber: 1, text: 'Fractions are useful.' }],
    });

    const result = await generateReadingForTopic(pool, {
      subjectId: SUBJECT_ID,
      topicId: TOPIC_ID,
      llm: llmReturning(validReading()),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('thin_source');
  });

  it('rejects the whole passage when the model returns junk', async () => {
    await ingest();

    await expect(
      generateReadingForTopic(pool, {
        subjectId: SUBJECT_ID,
        topicId: TOPIC_ID,
        llm: llmReturning('Fractions are neat, are they not?'),
      }),
    ).rejects.toThrow(ContentValidationError);

    expect(await listGeneratedReadings(pool)).toEqual([]);
  });
});

describe('reaching the student', () => {
  let studentId = '';

  beforeEach(async () => {
    await registerStudentFirst(pool, {
      studentEmail: 'reader@test.dev',
      studentPassword: 'password12',
      studentDisplayName: 'Reader',
      academicLevel: 'primary',
      formLevel: 'standard-5',
      parentEmail: 'reader-parent@test.dev',
      parentPassword: 'password12',
      parentDisplayName: 'Reader Parent',
    });
    const row = await pool.query<{ id: string }>(
      `SELECT s.id FROM academic_students s JOIN academic_users u ON u.id = s.user_id
        WHERE u.email = 'reader@test.dev'`,
    );
    studentId = row.rows[0]?.id ?? '';

    await ingest();
    await generateReadingForTopic(pool, {
      subjectId: SUBJECT_ID,
      topicId: TOPIC_ID,
      llm: llmReturning(validReading()),
    });
  });

  it('stays out of the library until someone has published it', async () => {
    expect(await listReadingsForStudent(pool, studentId)).toEqual([]);
  });

  it('reaches the library once published', async () => {
    const [draft] = await listGeneratedReadings(pool, { published: false });
    await publishGeneratedReading(pool, draft?.id as string);

    const library = await listReadingsForStudent(pool, studentId);
    expect(library.map((entry) => entry.id)).toContain(draft?.id);
    expect(library[0]?.title).toBe('Fractions');
  });
});

describe('reviewing generated passages', () => {
  beforeEach(async () => {
    await ingest();
    await generateReadingForTopic(pool, {
      subjectId: SUBJECT_ID,
      topicId: TOPIC_ID,
      llm: llmReturning(validReading()),
    });
  });

  it('lists generated passages awaiting review', async () => {
    const drafts = await listGeneratedReadings(pool, { published: false });
    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.title).toBe('Fractions');
  });

  it('publishes a passage once it has been read', async () => {
    const [draft] = await listGeneratedReadings(pool, { published: false });
    const published = await publishGeneratedReading(pool, draft?.id as string);

    expect(published.published).toBe(true);
    expect(await listGeneratedReadings(pool, { published: true })).toHaveLength(1);
  });

  it('can be taken back off the shelf without being thrown away', async () => {
    const [draft] = await listGeneratedReadings(pool, { published: false });
    await publishGeneratedReading(pool, draft?.id as string);
    const back = await unpublishGeneratedReading(pool, draft?.id as string);

    expect(back.published).toBe(false);
    expect(await listGeneratedReadings(pool)).toHaveLength(1);
  });

  it('refuses to publish a passage that is not there', async () => {
    await expect(publishGeneratedReading(pool, 'no-such-reading')).rejects.toThrow(ValidationError);
  });

  it('discards a generated passage', async () => {
    const [draft] = await listGeneratedReadings(pool);
    expect(await discardGeneratedReading(pool, draft?.id as string)).toBe(true);
    expect(await listGeneratedReadings(pool)).toEqual([]);
  });

  it('will not discard a hand-written passage', async () => {
    await pool.query(
      `INSERT INTO academic_readings (id, topic_id, title, summary, body, kind, source, published)
       VALUES ('seeded-1', $1, 'Written by hand', 'A hand-written note.', $2, 'lesson_note', 'authored', TRUE)`,
      [TOPIC_ID, BODY],
    );

    expect(await discardGeneratedReading(pool, 'seeded-1')).toBe(false);
    // And it is still there.
    const remaining = await pool.query<{ id: string }>(
      `SELECT id FROM academic_readings WHERE id = 'seeded-1'`,
    );
    expect(remaining.rows).toHaveLength(1);
  });
});
