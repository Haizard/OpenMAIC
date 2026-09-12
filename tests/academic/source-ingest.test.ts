import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ValidationError } from '@/lib/academic/register';
import { ensureAcademicSchema } from '@/lib/academic/schema';
import { ensureCurriculumSchema } from '@/lib/academic/curriculum-schema';
import { seedCurriculum } from '@/lib/academic/curriculum-seed';
import { ensureSourceSchema } from '@/lib/academic/source-schema';
import {
  chunkSourcePages,
  SOURCE_CHUNK_HARD_MAX_CHARS,
  type SourcePage,
} from '@/lib/academic/source-chunk';
import {
  ingestSourceDocument,
  listActiveChunks,
  listSourceCoverage,
  listSourceDocuments,
  retireSourceDocument,
  searchActiveChunks,
} from '@/lib/academic/source';

/**
 * Phase A of the AI content platform: an upload becomes chunks, and a new edition replaces the
 * old one instead of piling up next to it.
 */

class PGlitePool {
  constructor(readonly db: PGlite) {}
  query<TRow>(text: string, params?: unknown[]) {
    return this.db.query<TRow>(text, params);
  }
}

let pool: PGlitePool;

async function makePool(): Promise<PGlitePool> {
  const next = new PGlitePool(new PGlite());
  await ensureAcademicSchema(next);
  await ensureCurriculumSchema(next);
  await seedCurriculum(next);
  await ensureSourceSchema(next);
  return next;
}

function page(text: string, pageNumber = 1): SourcePage {
  return { pageNumber, text };
}

/** Long enough that a page cannot be packed with its neighbour, so each page is its own chunk. */
const FILLER =
  'Pupils revise this idea using everyday objects from the classroom and explain the rule aloud. '.repeat(
    14,
  );

function book(pages: number): SourcePage[] {
  return Array.from({ length: pages }, (_unused, index) =>
    page(
      `Chapter ${index + 1}\n\nFractions describe parts of a whole. The denominator counts how many equal parts the unit was divided into.\n\n${FILLER}`,
      index + 1,
    ),
  );
}

function longPage(pageNumber: number, heading: string, body: string): SourcePage {
  return { pageNumber, text: `${heading}\n\n${body}\n\n${FILLER}` };
}

beforeEach(async () => {
  pool = await makePool();
});

afterEach(async () => {
  await pool.db.close();
});

describe('chunkSourcePages', () => {
  it('splits a long document into more than one chunk', () => {
    const chunks = chunkSourcePages(book(6));
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('numbers chunks in reading order starting at zero', () => {
    const chunks = chunkSourcePages(book(6));
    expect(chunks.map((chunk) => chunk.ordinal)).toEqual(chunks.map((_c, index) => index));
  });

  it('keeps each chunk under the hard ceiling', () => {
    for (const chunk of chunkSourcePages(book(10))) {
      expect(chunk.charCount).toBeLessThanOrEqual(SOURCE_CHUNK_HARD_MAX_CHARS);
    }
  });

  it('is deterministic, so re-ingesting the same pages produces identical chunks', () => {
    const pages = book(4);
    expect(chunkSourcePages(pages)).toEqual(chunkSourcePages(pages));
  });

  it('carries the page number through for provenance', () => {
    const chunks = chunkSourcePages(book(3));
    expect(chunks[0]?.pageNumber).toBe(1);
    expect(chunks.some((chunk) => chunk.pageNumber === 2)).toBe(true);
    expect(chunks.some((chunk) => chunk.pageNumber === 3)).toBe(true);
  });

  it('labels a chunk with the heading that introduces it', () => {
    const chunks = chunkSourcePages([page('5.3 Fractions\n\nA fraction names part of a whole.')]);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.heading).toBe('5.3 Fractions');
  });

  it('keeps the heading in the text, so lexical retrieval can find it', () => {
    const chunks = chunkSourcePages([page('Unit 4: Algebra\n\nLetters stand for numbers.')]);
    expect(chunks[0]?.text).toContain('Unit 4: Algebra');
  });

  it('splits an oversized paragraph at a sentence boundary rather than mid-word', () => {
    const sentence = 'The denominator counts the equal parts of the whole. ';
    const chunks = chunkSourcePages([page(sentence.repeat(120))]);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.text.endsWith('.')).toBe(true);
    }
  });

  it('returns nothing for an empty document', () => {
    expect(chunkSourcePages([page('   \n\n  ')])).toEqual([]);
  });

  it('rejects a non-positive chunk size', () => {
    expect(() => chunkSourcePages(book(1), { maxChars: 0 })).toThrow(/positive integer/);
  });
});

describe('ingestSourceDocument', () => {
  it('stores the document and every chunk', async () => {
    const result = await ingestSourceDocument(pool, {
      formId: 'std5',
      subjectId: 'std5-math',
      title: 'Primary Mathematics 5',
      pages: book(6),
    });

    expect(result.reused).toBe(false);
    expect(result.document.chunkCount).toBeGreaterThan(1);
    expect(result.document.charCount).toBeGreaterThan(0);

    const chunks = await listActiveChunks(pool, 'std5-math');
    expect(chunks).toHaveLength(result.document.chunkCount);
  });

  it('is a no-op when the identical content is uploaded again', async () => {
    const pages = book(3);
    const first = await ingestSourceDocument(pool, {
      formId: 'std5',
      subjectId: 'std5-math',
      title: 'Primary Mathematics 5',
      pages,
    });
    const second = await ingestSourceDocument(pool, {
      formId: 'std5',
      subjectId: 'std5-math',
      title: 'Primary Mathematics 5',
      pages,
    });

    expect(second.reused).toBe(true);
    expect(second.document.id).toBe(first.document.id);
    const all = await listSourceDocuments(pool, {
      subjectId: 'std5-math',
      includeSuperseded: true,
    });
    expect(all).toHaveLength(1);
  });

  it('supersedes the previous edition instead of duplicating the pool', async () => {
    const first = await ingestSourceDocument(pool, {
      formId: 'std5',
      subjectId: 'std5-math',
      title: 'Primary Mathematics 5',
      pages: book(3),
    });

    const second = await ingestSourceDocument(pool, {
      formId: 'std5',
      subjectId: 'std5-math',
      title: 'Primary Mathematics 5',
      pages: [page('Chapter 1\n\nDecimals extend the place value table to the right.')],
    });

    expect(second.reused).toBe(false);
    expect(second.supersededDocumentId).toBe(first.document.id);

    const chunks = await listActiveChunks(pool, 'std5-math');
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.documentId).toBe(second.document.id);
    expect(chunks[0]?.text).toContain('Decimals');

    const superseded = await listSourceDocuments(pool, {
      subjectId: 'std5-math',
      includeSuperseded: true,
    });
    expect(superseded).toHaveLength(2);
  });

  it('keeps a superseded document out of the live list', async () => {
    await ingestSourceDocument(pool, {
      formId: 'std5',
      subjectId: 'std5-math',
      title: 'First edition',
      pages: book(2),
    });
    await ingestSourceDocument(pool, {
      formId: 'std5',
      subjectId: 'std5-math',
      title: 'Second edition',
      pages: [page('New content entirely.')],
    });

    const live = await listSourceDocuments(pool, { subjectId: 'std5-math' });
    expect(live).toHaveLength(1);
    expect(live[0]?.title).toBe('Second edition');
  });

  it('treats a different edition as a separate live document', async () => {
    await ingestSourceDocument(pool, {
      formId: 'std5',
      subjectId: 'std5-math',
      title: 'Pupil book',
      edition: '2022',
      pages: book(2),
    });
    await ingestSourceDocument(pool, {
      formId: 'std5',
      subjectId: 'std5-math',
      title: 'Pupil book',
      edition: '2026',
      pages: book(2),
    });

    const live = await listSourceDocuments(pool, { subjectId: 'std5-math' });
    expect(live.map((doc) => doc.edition).sort()).toEqual(['2022', '2026']);
  });

  it('rejects a form that does not exist', async () => {
    await expect(
      ingestSourceDocument(pool, {
        formId: 'std99',
        subjectId: 'std5-math',
        title: 'Ghost',
        pages: book(1),
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects a subject that belongs to another form', async () => {
    await expect(
      ingestSourceDocument(pool, {
        formId: 'std5',
        subjectId: 'f1-math',
        title: 'Wrong shelf',
        pages: book(1),
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('refuses a document with no extractable text', async () => {
    await expect(
      ingestSourceDocument(pool, {
        formId: 'std5',
        subjectId: 'std5-math',
        title: 'Scanned images only',
        pages: [page('   ')],
      }),
    ).rejects.toThrow(/no extractable text/);
  });

  it('records the licence note the operator supplied', async () => {
    const result = await ingestSourceDocument(pool, {
      formId: 'std5',
      subjectId: 'std5-math',
      title: 'Licensed book',
      licenseNote: 'Purchased copy, internal use only',
      pages: book(1),
    });
    expect(result.document.licenseNote).toBe('Purchased copy, internal use only');
  });
});

describe('searchActiveChunks', () => {
  beforeEach(async () => {
    await ingestSourceDocument(pool, {
      formId: 'std5',
      subjectId: 'std5-math',
      title: 'Primary Mathematics 5',
      pages: [
        longPage(1, 'Chapter 1', 'Fractions name equal parts of a whole.'),
        longPage(2, 'Chapter 2', 'Decimals extend place value to the right.'),
      ],
    });
    await ingestSourceDocument(pool, {
      formId: 'std5',
      subjectId: 'std5-geography',
      title: 'Primary Geography 5',
      pages: [longPage(1, 'Chapter 1', 'Land use across the region.')],
    });
  });

  it('finds a chunk by a word it contains', async () => {
    const hits = await searchActiveChunks(pool, 'std5-math', 'decimals');
    expect(hits).toHaveLength(1);
    expect(hits[0]?.text).toContain('Decimals');
  });

  it('narrows when several words are given', async () => {
    expect(await searchActiveChunks(pool, 'std5-math', 'fractions decimals')).toEqual([]);
    expect(await searchActiveChunks(pool, 'std5-math', 'place value')).toHaveLength(1);
  });

  it('never crosses subjects, even when the text matches', async () => {
    const hits = await searchActiveChunks(pool, 'std5-math', 'fractions');
    expect(hits).toHaveLength(1);
    expect(hits[0]?.subjectId).toBe('std5-math');
  });

  it('returns provenance with the chunk', async () => {
    const hits = await searchActiveChunks(pool, 'std5-math', 'decimals');
    expect(hits[0]?.documentTitle).toBe('Primary Mathematics 5');
    expect(hits[0]?.heading).toBe('Chapter 2');
    expect(hits[0]?.pageNumber).toBe(2);
  });

  it('ignores superseded content', async () => {
    await ingestSourceDocument(pool, {
      formId: 'std5',
      subjectId: 'std5-math',
      title: 'Primary Mathematics 5',
      pages: [page('Chapter 1\n\nRatios compare two quantities.')],
    });

    expect(await searchActiveChunks(pool, 'std5-math', 'decimals')).toEqual([]);
    expect(await searchActiveChunks(pool, 'std5-math', 'ratios')).toHaveLength(1);
  });

  it('returns nothing for an empty or punctuation-only query', async () => {
    expect(await searchActiveChunks(pool, 'std5-math', '')).toEqual([]);
    expect(await searchActiveChunks(pool, 'std5-math', '!!!')).toEqual([]);
  });
});

describe('listSourceCoverage', () => {
  it('lists every curriculum subject, including the ones with nothing uploaded', async () => {
    const before = await listSourceCoverage(pool);
    const gap = before.find((row) => row.subjectId === 'std5-math');
    expect(gap?.documentCount).toBe(0);
    expect(gap?.chunkCount).toBe(0);
    expect(before.some((row) => row.subjectId === 'f1-math')).toBe(true);
  });

  it('fills in the numbers once a document lands', async () => {
    const result = await ingestSourceDocument(pool, {
      formId: 'std5',
      subjectId: 'std5-math',
      title: 'Primary Mathematics 5',
      pages: book(3),
    });

    const after = await listSourceCoverage(pool);
    const row = after.find((entry) => entry.subjectId === 'std5-math');
    expect(row?.documentCount).toBe(1);
    expect(row?.chunkCount).toBe(result.document.chunkCount);
    expect(row?.charCount).toBe(result.document.charCount);
    expect(row?.edition).toBe('default');
  });

  it('does not count a superseded edition', async () => {
    await ingestSourceDocument(pool, {
      formId: 'std5',
      subjectId: 'std5-math',
      title: 'Old',
      pages: book(3),
    });
    await ingestSourceDocument(pool, {
      formId: 'std5',
      subjectId: 'std5-math',
      title: 'New',
      pages: [page('Chapter 1\n\nDecimals.')],
    });

    const row = (await listSourceCoverage(pool)).find((entry) => entry.subjectId === 'std5-math');
    expect(row?.documentCount).toBe(1);
  });
});

describe('retireSourceDocument', () => {
  it('pulls a document out of the active pool without deleting it', async () => {
    const result = await ingestSourceDocument(pool, {
      formId: 'std5',
      subjectId: 'std5-math',
      title: 'Withdrawn book',
      pages: book(2),
    });

    expect(await retireSourceDocument(pool, result.document.id)).toBe(true);
    expect(await listActiveChunks(pool, 'std5-math')).toEqual([]);

    const all = await listSourceDocuments(pool, {
      subjectId: 'std5-math',
      includeSuperseded: true,
    });
    expect(all).toHaveLength(1);
  });

  it('reports false when the document was already retired', async () => {
    const result = await ingestSourceDocument(pool, {
      formId: 'std5',
      subjectId: 'std5-math',
      title: 'Withdrawn book',
      pages: book(1),
    });
    expect(await retireSourceDocument(pool, result.document.id)).toBe(true);
    expect(await retireSourceDocument(pool, result.document.id)).toBe(false);
  });
});
