import { createHash } from 'node:crypto';

/**
 * Text chunking for source documents.
 *
 * Deliberately separate from `lib/rag/chunking`. That chunker consumes OpenMAIC's structured
 * `DocumentArtifact` (blocks that already carry a page number and a heading). A parsed textbook
 * arrives as flat text per page, so headings have to be inferred and page boundaries carried
 * through. Different input shape, different job.
 *
 * Pure: no database, no clock, no randomness. Same pages in, same chunks out.
 */

/** Soft target. Packing stops here so chunks stay readable and cheap to put in a prompt. */
export const SOURCE_CHUNK_MAX_CHARS = 1200;

/** Hard ceiling. Only a single oversized sentence is allowed to be split to reach this. */
export const SOURCE_CHUNK_HARD_MAX_CHARS = 2000;

export interface SourcePage {
  readonly pageNumber?: number;
  readonly text: string;
}

export interface SourceChunkDraft {
  readonly ordinal: number;
  readonly text: string;
  readonly charCount: number;
  readonly contentHash: string;
  readonly pageNumber: number | null;
  readonly heading: string | null;
}

export interface ChunkSourceOptions {
  readonly maxChars?: number;
}

const NUMBERED_HEADING = /^\d+(?:\.\d+)*[.)]?\s+\S/;
const NAMED_HEADING =
  /^(?:chapter|unit|lesson|topic|part|section|sura|sehemu|somo|kitengo|mtihani|majaribio)\b[:\s]/i;
const SHOUTING_HEADING = /^[A-Z0-9][A-Z0-9 \t&/'-]{3,}$/;
const SENTENCE_END = /[.?!]$/;

export function hashText(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/**
 * Heading detection is best-effort metadata, not structure. A false positive only means a
 * chunk records an unhelpful `heading`; the text itself is always kept, so nothing is lost
 * from retrieval. Keeping the bar high matters more than catching every heading.
 */
function isHeadingLine(line: string): boolean {
  const text = line.trim();
  if (text === '' || text.length > 80 || text.includes('\n')) return false;
  if (NAMED_HEADING.test(text)) return true;
  if (NUMBERED_HEADING.test(text) && !SENTENCE_END.test(text) && text.split(/\s+/).length <= 8) {
    return true;
  }
  return SHOUTING_HEADING.test(text);
}

function normalizePageText(value: string): string {
  return value.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
}

interface ChunkUnit {
  readonly text: string;
  readonly pageNumber: number | null;
  readonly heading: string | null;
}

/**
 * Turn pages into paragraphs, attaching the nearest preceding heading to the paragraph that
 * follows it. A heading at the foot of a page therefore labels the first paragraph of the next
 * page, which is what a reader sees.
 */
function toUnits(pages: readonly SourcePage[]): ChunkUnit[] {
  const units: ChunkUnit[] = [];
  let pendingHeading: string | null = null;

  for (const page of pages) {
    const pageNumber = typeof page.pageNumber === 'number' ? page.pageNumber : null;
    const blocks = normalizePageText(page.text).split(/\n{2,}/);

    for (const block of blocks) {
      const text = block.trim();
      if (text === '') continue;

      const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
      let heading: string | null = pendingHeading;
      // A heading is recorded as metadata but must also stay in the body: retrieval is
      // lexical, so a chunk about fractions has to contain the word "fractions" even when the
      // heading is the only place it appears. A heading alone in its block is therefore
      // carried forward and prepended to the paragraph it introduces.
      if (isHeadingLine(lines[0])) {
        heading = lines[0];
        if (lines.length === 1) {
          pendingHeading = heading;
          continue;
        }
      }

      const carried = pendingHeading;
      pendingHeading = null;
      const unitText = carried && carried !== lines[0] ? `${carried}\n\n${text}` : text;
      units.push({ text: unitText, pageNumber, heading });
    }
  }

  return units;
}

function splitSentences(value: string): string[] {
  const matches = value.match(/[^.!?\n]+[.!?]?\s*/g);
  if (!matches) return [value];
  return matches.map((part) => part.trim()).filter(Boolean);
}

function splitOversize(value: string, maxChars: number): string[] {
  const parts: string[] = [];
  let current = '';

  for (const sentence of splitSentences(value)) {
    if (sentence.length > maxChars) {
      if (current) {
        parts.push(current);
        current = '';
      }
      // No sentence boundary left to use: fall back to a code-point split so emoji and
      // combining marks cannot be cut in half.
      const chars = Array.from(sentence);
      for (let index = 0; index < chars.length; index += maxChars) {
        parts.push(chars.slice(index, index + maxChars).join(''));
      }
      continue;
    }
    if (current && current.length + 1 + sentence.length > maxChars) {
      parts.push(current);
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }

  if (current) parts.push(current);
  return parts;
}

/**
 * Pack paragraphs into chunks. A paragraph is never split unless it exceeds the hard ceiling
 * on its own, because a chunk that ends mid-explanation is useless as generation context.
 */
export function chunkSourcePages(
  pages: readonly SourcePage[],
  options: ChunkSourceOptions = {},
): readonly SourceChunkDraft[] {
  const maxChars = options.maxChars ?? SOURCE_CHUNK_MAX_CHARS;
  if (!Number.isInteger(maxChars) || maxChars < 1) {
    throw new Error(`Chunk maxChars must be a positive integer, got ${maxChars}`);
  }
  const hardMax = Math.max(maxChars, SOURCE_CHUNK_HARD_MAX_CHARS);

  const drafts: SourceChunkDraft[] = [];
  let buffer: { parts: string[]; length: number; unit: ChunkUnit } | null = null;

  const flush = (): void => {
    if (!buffer) return;
    const text = buffer.parts.join('\n\n').trim();
    if (text !== '') {
      drafts.push({
        ordinal: drafts.length,
        text,
        charCount: Array.from(text).length,
        contentHash: hashText(text),
        pageNumber: buffer.unit.pageNumber,
        heading: buffer.unit.heading,
      });
    }
    buffer = null;
  };

  for (const unit of toUnits(pages)) {
    if (unit.text.length > hardMax) {
      flush();
      for (const part of splitOversize(unit.text, hardMax)) {
        drafts.push({
          ordinal: drafts.length,
          text: part,
          charCount: Array.from(part).length,
          contentHash: hashText(part),
          pageNumber: unit.pageNumber,
          heading: unit.heading,
        });
      }
      continue;
    }

    if (buffer && buffer.length + 2 + unit.text.length > maxChars) flush();
    if (!buffer) {
      buffer = { parts: [], length: 0, unit };
    }
    buffer.parts.push(unit.text);
    buffer.length = buffer.length === 0 ? unit.text.length : buffer.length + 2 + unit.text.length;
  }

  flush();
  return drafts;
}
