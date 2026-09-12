import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ensureAcademicSchema } from '@/lib/academic/schema';
import { ensureCurriculumSchema } from '@/lib/academic/curriculum-schema';
import { seedCurriculum } from '@/lib/academic/curriculum-seed';
import { ensureSourceSchema } from '@/lib/academic/source-schema';
import { ensureContentSchema } from '@/lib/academic/content-schema';
import { ingestSourceDocument } from '@/lib/academic/source';
import type { SourcePage } from '@/lib/academic/source-chunk';
import {
  buildGenerationPrompt,
  ContentValidationError,
  generateContentForTopic,
  listContentItems,
  listGenerationBlockers,
  MIN_SOURCE_CHARS,
  parseGeneratedItems,
  discardContentItem,
  publishContentItem,
  retireContentItem,
  updateContentItem,
} from '@/lib/academic/content-bank';
import { ValidationError } from '@/lib/academic/register';

/**
 * Phase B: generation is grounded in uploaded source, refuses when the source is thin, and
 * records where every item came from.
 */

class PGlitePool {
  constructor(readonly db: PGlite) {}
  query<TRow>(text: string, params?: unknown[]) {
    return this.db.query<TRow>(text, params);
  }
}

let pool: PGlitePool;

/** Comfortably over MIN_SOURCE_CHARS so generation is allowed. */
const SOURCE_TEXT = 'Fractions name equal parts of a whole and the denominator counts them. '.repeat(
  30,
);

function sourcePages(): SourcePage[] {
  return [{ pageNumber: 1, text: `Chapter 1\n\n${SOURCE_TEXT}` }];
}

function thinPages(): SourcePage[] {
  return [{ pageNumber: 1, text: 'Fractions are useful.' }];
}

function validModelOutput(count = 2): string {
  return JSON.stringify(
    Array.from({ length: count }, (_unused, index) => ({
      prompt: `What does the denominator count? (${index})`,
      choices: ['The parts', 'The whole', 'The sum', 'The remainder'],
      correctIndex: 0,
      explanation: 'The source says the denominator counts the equal parts.',
    })),
  );
}

function llmReturning(raw: string): (prompt: string) => Promise<string> {
  return async () => raw;
}

beforeEach(async () => {
  pool = new PGlitePool(new PGlite());
  await ensureAcademicSchema(pool);
  await ensureCurriculumSchema(pool);
  await seedCurriculum(pool);
  await ensureSourceSchema(pool);
  await ensureContentSchema(pool);
});

afterEach(async () => {
  await pool.db.close();
});

describe('parseGeneratedItems', () => {
  it('accepts a well-formed array', () => {
    const items = parseGeneratedItems(validModelOutput(2));
    expect(items).toHaveLength(2);
    expect(items[0]?.correctIndex).toBe(0);
  });

  it('ignores prose around the JSON', () => {
    const items = parseGeneratedItems(`Here you go:\n${validModelOutput(1)}\nHope that helps.`);
    expect(items).toHaveLength(1);
  });

  it('rejects output that is not JSON', () => {
    expect(() => parseGeneratedItems('I cannot help with that.')).toThrow(ContentValidationError);
  });

  it('rejects an empty array', () => {
    expect(() => parseGeneratedItems('[]')).toThrow(/no items/);
  });

  it('rejects an item with no prompt', () => {
    const raw = JSON.stringify([{ choices: ['a', 'b'], correctIndex: 0, explanation: 'x' }]);
    expect(() => parseGeneratedItems(raw)).toThrow(/no prompt/);
  });

  it('rejects an item with no explanation', () => {
    const raw = JSON.stringify([{ prompt: 'Why?', choices: ['a', 'b'], correctIndex: 0 }]);
    expect(() => parseGeneratedItems(raw)).toThrow(/no explanation/);
  });

  it('rejects fewer than two choices', () => {
    const raw = JSON.stringify([
      { prompt: 'Why?', choices: ['only one'], correctIndex: 0, explanation: 'x' },
    ]);
    expect(() => parseGeneratedItems(raw)).toThrow(/at least two choices/);
  });

  it('rejects a correctIndex outside the choices', () => {
    const raw = JSON.stringify([
      { prompt: 'Why?', choices: ['a', 'b'], correctIndex: 5, explanation: 'x' },
    ]);
    expect(() => parseGeneratedItems(raw)).toThrow(/out-of-range/);
  });

  it('accepts an open item with no choices at all', () => {
    const items = parseGeneratedItems(
      JSON.stringify([{ prompt: 'Explain the denominator.', explanation: 'It counts parts.' }]),
    );
    expect(items[0]?.choices).toBeUndefined();
  });
});

describe('buildGenerationPrompt', () => {
  it('embeds the source text it must ground itself in', () => {
    const prompt = buildGenerationPrompt({
      formName: 'Standard 5',
      subjectName: 'Mathematics',
      kind: 'homework',
      language: 'en',
      count: 5,
      chunks: [
        {
          id: 'c1',
          documentId: 'd1',
          ordinal: 0,
          text: 'A fraction names part of a whole.',
          contentHash: 'h',
          pageNumber: 12,
          heading: '5.3 Fractions',
          charCount: 33,
          documentTitle: 'Primary Mathematics 5',
          edition: '2026',
          formId: 'std5',
          subjectId: 'std5-math',
        },
      ],
    });
    expect(prompt).toContain('A fraction names part of a whole.');
    expect(prompt).toContain('5.3 Fractions');
    expect(prompt).toContain('Primary Mathematics 5');
  });

  it('forbids inventing facts that are not in the source', () => {
    const prompt = buildGenerationPrompt({
      formName: 'Standard 5',
      subjectName: 'Mathematics',
      kind: 'quiz',
      language: 'en',
      count: 3,
      chunks: [],
    });
    expect(prompt).toMatch(/ONLY the source material/i);
    expect(prompt).toMatch(/leave that question out/i);
  });

  it('asks for the requested count and language', () => {
    const prompt = buildGenerationPrompt({
      formName: 'Form 1',
      subjectName: 'Physics',
      kind: 'quiz',
      language: 'sw',
      count: 7,
      chunks: [],
    });
    expect(prompt).toContain('exactly 7');
    expect(prompt).toContain('Kiswahili');
  });
});

describe('generateContentForTopic', () => {
  it('stores generated items with full provenance', async () => {
    await ingestSourceDocument(pool, {
      formId: 'std5',
      subjectId: 'std5-math',
      title: 'Primary Mathematics 5',
      pages: sourcePages(),
    });

    const result = await generateContentForTopic(pool, {
      subjectId: 'std5-math',
      kind: 'homework',
      llm: llmReturning(validModelOutput(2)),
      model: 'test-model',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items).toHaveLength(2);

    const item = result.items[0];
    expect(item?.sourceDocumentId).not.toBeNull();
    expect(item?.sourceChunkIds.length).toBeGreaterThan(0);
    expect(item?.model).toBe('test-model');
    expect(item?.generatedAt).not.toBeNull();
  });

  it('lands as a draft, so a student cannot see it yet', async () => {
    await ingestSourceDocument(pool, {
      formId: 'std5',
      subjectId: 'std5-math',
      title: 'Primary Mathematics 5',
      pages: sourcePages(),
    });
    await generateContentForTopic(pool, {
      subjectId: 'std5-math',
      kind: 'homework',
      llm: llmReturning(validModelOutput(1)),
    });

    const items = await listContentItems(pool, { subjectId: 'std5-math' });
    expect(items).toHaveLength(1);
    expect(items[0]?.status).toBe('draft');
    expect(items[0]?.publishedAt).toBeNull();
  });

  it('grounds the prompt in the real source chunks', async () => {
    await ingestSourceDocument(pool, {
      formId: 'std5',
      subjectId: 'std5-math',
      title: 'Primary Mathematics 5',
      pages: sourcePages(),
    });

    let seen = '';
    await generateContentForTopic(pool, {
      subjectId: 'std5-math',
      kind: 'homework',
      llm: async (prompt) => {
        seen = prompt;
        return validModelOutput(1);
      },
    });

    expect(seen).toContain('denominator counts them');
    expect(seen).toContain('Standard 5 Mathematics');
  });

  it('refuses when no source has been uploaded at all', async () => {
    const result = await generateContentForTopic(pool, {
      subjectId: 'std5-math',
      kind: 'homework',
      llm: llmReturning(validModelOutput(1)),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('no_source');
    expect(await listContentItems(pool, { subjectId: 'std5-math' })).toEqual([]);
  });

  it('refuses to invent when the source is too thin', async () => {
    await ingestSourceDocument(pool, {
      formId: 'std5',
      subjectId: 'std5-math',
      title: 'Thin book',
      pages: thinPages(),
    });

    const result = await generateContentForTopic(pool, {
      subjectId: 'std5-math',
      kind: 'homework',
      llm: llmReturning(validModelOutput(1)),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('thin_source');
    expect(result.availableChars).toBeLessThan(MIN_SOURCE_CHARS);
    expect(await listContentItems(pool, { subjectId: 'std5-math' })).toEqual([]);
  });

  it('writes nothing when the model returns junk', async () => {
    await ingestSourceDocument(pool, {
      formId: 'std5',
      subjectId: 'std5-math',
      title: 'Primary Mathematics 5',
      pages: sourcePages(),
    });

    await expect(
      generateContentForTopic(pool, {
        subjectId: 'std5-math',
        kind: 'homework',
        llm: llmReturning('Sorry, I cannot do that.'),
      }),
    ).rejects.toBeInstanceOf(ContentValidationError);

    expect(await listContentItems(pool, { subjectId: 'std5-math' })).toEqual([]);
  });

  it('scopes generation to the topic when one is given', async () => {
    await ingestSourceDocument(pool, {
      formId: 'std5',
      subjectId: 'std5-math',
      title: 'Primary Mathematics 5',
      pages: sourcePages(),
    });

    const result = await generateContentForTopic(pool, {
      subjectId: 'std5-math',
      topicId: 'std5-math-1',
      kind: 'quiz',
      llm: llmReturning(validModelOutput(1)),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items[0]?.topicId).toBe('std5-math-1');
    expect(result.items[0]?.kind).toBe('quiz');
  });

  it('rejects a topic from another subject', async () => {
    await ingestSourceDocument(pool, {
      formId: 'std5',
      subjectId: 'std5-math',
      title: 'Primary Mathematics 5',
      pages: sourcePages(),
    });

    await expect(
      generateContentForTopic(pool, {
        subjectId: 'std5-math',
        topicId: 'std5-geo-1',
        kind: 'quiz',
        llm: llmReturning(validModelOutput(1)),
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects a count outside the allowed range', async () => {
    await expect(
      generateContentForTopic(pool, {
        subjectId: 'std5-math',
        kind: 'homework',
        count: 500,
        llm: llmReturning(validModelOutput(1)),
      }),
    ).rejects.toThrow(/count must be/);
  });

  it('ignores a superseded edition when grounding', async () => {
    await ingestSourceDocument(pool, {
      formId: 'std5',
      subjectId: 'std5-math',
      title: 'Old book',
      pages: sourcePages(),
    });
    await ingestSourceDocument(pool, {
      formId: 'std5',
      subjectId: 'std5-math',
      title: 'New book',
      pages: [{ pageNumber: 1, text: `Chapter 1\n\n${'Ratios compare two quantities. '.repeat(30)}` }],
    });

    let seen = '';
    await generateContentForTopic(pool, {
      subjectId: 'std5-math',
      kind: 'homework',
      llm: async (prompt) => {
        seen = prompt;
        return validModelOutput(1);
      },
    });

    expect(seen).toContain('Ratios compare two quantities.');
    expect(seen).not.toContain('denominator counts them');
  });
});

describe('review gate', () => {
  async function makeDraft() {
    await ingestSourceDocument(pool, {
      formId: 'std5',
      subjectId: 'std5-math',
      title: 'Primary Mathematics 5',
      pages: sourcePages(),
    });
    const result = await generateContentForTopic(pool, {
      subjectId: 'std5-math',
      kind: 'homework',
      llm: llmReturning(validModelOutput(1)),
    });
    if (!result.ok) throw new Error('expected generation to succeed');
    return result.items[0]!.id;
  }

  it('publishes a draft and stamps the time', async () => {
    const id = await makeDraft();
    const published = await publishContentItem(pool, id);
    expect(published.status).toBe('published');
    expect(published.publishedAt).not.toBeNull();
  });

  it('cannot publish twice', async () => {
    const id = await makeDraft();
    await publishContentItem(pool, id);
    await expect(publishContentItem(pool, id)).rejects.toBeInstanceOf(ValidationError);
  });

  it('discards a draft', async () => {
    const id = await makeDraft();
    expect(await discardContentItem(pool, id)).toBe(true);
    expect(await listContentItems(pool, { subjectId: 'std5-math' })).toEqual([]);
  });

  it('refuses to delete a published item — it can only be retired', async () => {
    const id = await makeDraft();
    await publishContentItem(pool, id);
    expect(await discardContentItem(pool, id)).toBe(false);

    const retired = await retireContentItem(pool, id);
    expect(retired.status).toBe('retired');
    expect(await listContentItems(pool, { subjectId: 'std5-math' })).toHaveLength(1);
  });

  it('rejects an edit that moves the answer outside the choices', async () => {
    const id = await makeDraft();
    await expect(updateContentItem(pool, id, { correctIndex: 9 })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('accepts an edit that corrects the prompt', async () => {
    const id = await makeDraft();
    const updated = await updateContentItem(pool, id, { prompt: 'What counts the parts?' });
    expect(updated.prompt).toBe('What counts the parts?');
    expect(updated.correctIndex).toBe(0);
  });
});

describe('listGenerationBlockers', () => {
  it('lists topics whose subject has no source yet', async () => {
    const blockers = await listGenerationBlockers(pool);
    expect(blockers.some((entry) => entry.subjectId === 'std5-math')).toBe(true);
    expect(blockers.some((entry) => entry.availableChars > 0)).toBe(false);
  });

  it('clears once enough source is uploaded', async () => {
    await ingestSourceDocument(pool, {
      formId: 'std5',
      subjectId: 'std5-math',
      title: 'Primary Mathematics 5',
      pages: sourcePages(),
    });

    const blockers = await listGenerationBlockers(pool);
    expect(blockers.some((entry) => entry.subjectId === 'std5-math')).toBe(false);
  });

  it('keeps a topic blocked while its source stays too thin', async () => {
    await ingestSourceDocument(pool, {
      formId: 'std5',
      subjectId: 'std5-math',
      title: 'Thin book',
      pages: thinPages(),
    });

    const blockers = await listGenerationBlockers(pool);
    expect(blockers.some((entry) => entry.subjectId === 'std5-math')).toBe(true);
  });
});
