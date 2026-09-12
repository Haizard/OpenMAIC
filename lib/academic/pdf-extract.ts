import { parsePDF } from '@/lib/pdf/pdf-providers';
import type { PDFProviderId } from '@/lib/pdf/types';

import type { SourcePage } from '@/lib/academic/source-chunk';

/**
 * PDF to pages, for the source ingest pipeline.
 *
 * A thin adapter over OpenMAIC's existing PDF providers. Per-page fidelity depends on the
 * provider: MinerU returns a `layout` array that carries real page numbers, while the built-in
 * unpdf provider returns one concatenated string. We recover pages from form feeds where we
 * can and fall back to a single page, which degrades gracefully — the chunker only uses page
 * numbers for provenance, never for correctness.
 */

const PROVIDERS: readonly PDFProviderId[] = ['unpdf', 'mineru', 'mineru-cloud', 'alidocmind'];

function resolveProviderId(): PDFProviderId {
  const configured = (process.env.ACADEMIC_PDF_PROVIDER ?? '').trim() as PDFProviderId;
  return PROVIDERS.includes(configured) ? configured : 'unpdf';
}

function groupByLayout(
  layout: NonNullable<Awaited<ReturnType<typeof parsePDF>>['layout']>,
): SourcePage[] {
  const byPage = new Map<number, string[]>();
  for (const block of layout) {
    if (block.type === 'image' || block.type === 'formula') continue;
    const content = (block.content ?? '').trim();
    if (!content) continue;
    const bucket = byPage.get(block.page) ?? [];
    bucket.push(content);
    byPage.set(block.page, bucket);
  }
  return Array.from(byPage.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([page, parts]) => ({ pageNumber: page, text: parts.join('\n\n') }))
    .filter((page) => page.text.trim() !== '');
}

function splitOnFormFeeds(text: string): SourcePage[] {
  const parts = text.split('\f');
  if (parts.length < 2) return [];
  return parts
    .map((part, index) => ({ pageNumber: index + 1, text: part.replace(/\f/g, '').trim() }))
    .filter((page) => page.text !== '');
}

export async function extractPdfPages(bytes: Buffer, fileName?: string): Promise<SourcePage[]> {
  const parsed = await parsePDF(
    { providerId: resolveProviderId(), textOnly: true },
    bytes,
    fileName ? { fileName } : undefined,
  );

  const fromLayout = parsed.layout ? groupByLayout(parsed.layout) : [];
  if (fromLayout.length > 0) return fromLayout;

  const fromFeeds = splitOnFormFeeds(parsed.text ?? '');
  if (fromFeeds.length > 0) return fromFeeds;

  const text = (parsed.text ?? '').trim();
  if (text === '') return [];
  return [{ pageNumber: 1, text }];
}
