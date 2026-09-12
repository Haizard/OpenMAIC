import { NextResponse } from 'next/server';

import { OperatorAuthError, requireOperator } from '@/lib/academic/operator-auth';
import { extractPdfPages } from '@/lib/academic/pdf-extract';
import { getAcademicDb } from '@/lib/academic/db';
import { ValidationError } from '@/lib/academic/register';
import {
  ingestSourceDocument,
  listSourceDocuments,
  MAX_UPLOAD_BYTES,
  type SourceLanguage,
} from '@/lib/academic/source';
import type { SourcePage } from '@/lib/academic/source-chunk';

/**
 * Operator source-document endpoints.
 *
 * These are the only endpoints on the platform that accept human-authored content. They are
 * guarded by the operator token rather than a user session, so the student and parent worlds
 * have no path here at all.
 */

const PDF_EXTENSION = /\.pdf$/i;

function asLanguage(value: FormDataEntryValue | null): SourceLanguage | undefined {
  const text = typeof value === 'string' ? value.trim() : '';
  return text === 'sw' || text === 'en' ? text : undefined;
}

async function pagesFromUpload(file: File): Promise<SourcePage[]> {
  const bytes = Buffer.from(await file.arrayBuffer());
  if (PDF_EXTENSION.test(file.name) || file.type === 'application/pdf') {
    return extractPdfPages(bytes, file.name);
  }
  // Plain text or markdown: accepted so an operator can paste or script content without
  // waiting on a PDF parser.
  return [{ pageNumber: 1, text: bytes.toString('utf8') }];
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    requireOperator(request);

    const form = await request.formData();
    const formId = String(form.get('formId') ?? '').trim();
    const subjectId = String(form.get('subjectId') ?? '').trim();
    const title = String(form.get('title') ?? '').trim();
    const edition = String(form.get('edition') ?? '').trim();
    const licenseNote = String(form.get('licenseNote') ?? '').trim();

    const file = form.get('file');
    const pasted = form.get('text');
    let pages: SourcePage[] = [];
    let byteSize = 0;

    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json(
          { success: false, error: `File is larger than ${MAX_UPLOAD_BYTES} bytes` },
          { status: 413 },
        );
      }
      byteSize = file.size;
      pages = await pagesFromUpload(file);
    } else if (typeof pasted === 'string' && pasted.trim() !== '') {
      byteSize = Buffer.byteLength(pasted, 'utf8');
      pages = [{ pageNumber: 1, text: pasted }];
    }

    if (pages.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Provide a file or text to upload' },
        { status: 400 },
      );
    }

    const db = await getAcademicDb();
    const result = await ingestSourceDocument(db, {
      formId,
      subjectId,
      title,
      ...(edition ? { edition } : {}),
      ...(asLanguage(form.get('language')) ? { language: asLanguage(form.get('language')) } : {}),
      ...(licenseNote ? { licenseNote } : {}),
      pages,
      byteSize,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof OperatorAuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    console.error('Upload source document error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    requireOperator(request);

    const params = new URL(request.url).searchParams;
    const db = await getAcademicDb();
    const documents = await listSourceDocuments(db, {
      ...(params.get('subjectId') ? { subjectId: params.get('subjectId') as string } : {}),
      ...(params.get('formId') ? { formId: params.get('formId') as string } : {}),
      includeSuperseded: params.get('includeSuperseded') === 'true',
    });

    return NextResponse.json({ success: true, documents });
  } catch (error) {
    if (error instanceof OperatorAuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('List source documents error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
