import { callLLM } from '@/lib/ai/llm';
import { resolveModel } from '@/lib/server/resolve-model';

import type { ContentLlm } from '@/lib/academic/content-bank';

/**
 * The real model call behind content generation.
 *
 * Kept separate from the bank so the bank stays testable: tests inject their own `ContentLlm`
 * and never touch a vendor.
 */

export const CONTENT_LLM_SOURCE = 'academic-content-generation';

export interface ContentLlmHandle {
  readonly llm: ContentLlm;
  /** Recorded on every generated item so a bad question can be traced to the model that wrote it. */
  readonly model: string;
}

export async function createContentLlm(): Promise<ContentLlmHandle> {
  const resolved = await resolveModel({});
  return {
    model: resolved.modelString,
    llm: async (prompt: string) => {
      const result = await callLLM({ model: resolved.model, prompt }, CONTENT_LLM_SOURCE);
      const text = typeof result?.text === 'string' ? result.text : '';
      return text;
    },
  };
}
