import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Operator access for the content pipeline.
 *
 * There is no teacher role on this platform (locked rule 9) and there is no admin role in the
 * sign-up flow either. The one human who uploads source material authenticates with a token
 * from the environment instead of an account, which keeps the operator out of the student and
 * parent worlds entirely — the same session cookie cannot reach these routes.
 *
 * Fails closed: if `ACADEMIC_OPERATOR_TOKEN` is not set, every operator route is forbidden.
 */

export const OPERATOR_HEADER = 'x-academic-operator-token';
export const OPERATOR_COOKIE = 'academic_operator';

export class OperatorAuthError extends Error {
  readonly status: number;

  constructor(message: string, status: 401 | 403) {
    super(message);
    this.name = 'OperatorAuthError';
    this.status = status;
  }
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

function constantTimeEquals(left: string, right: string): boolean {
  return timingSafeEqual(digest(left), digest(right));
}

export function isOperatorConfigured(): boolean {
  return (process.env.ACADEMIC_OPERATOR_TOKEN ?? '').trim() !== '';
}

export function verifyOperatorToken(candidate: string | null | undefined): boolean {
  const expected = (process.env.ACADEMIC_OPERATOR_TOKEN ?? '').trim();
  if (!expected) return false;
  if (typeof candidate !== 'string' || candidate.trim() === '') return false;
  return constantTimeEquals(candidate.trim(), expected);
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) {
      return decodeURIComponent(part.slice(index + 1).trim());
    }
  }
  return null;
}

/** Throws `OperatorAuthError` unless the request carries the operator token. */
export function requireOperator(request: Request): void {
  if (!isOperatorConfigured()) {
    throw new OperatorAuthError('Operator access is not configured', 403);
  }
  const fromHeader = request.headers.get(OPERATOR_HEADER);
  const fromCookie = readCookie(request, OPERATOR_COOKIE);
  if (verifyOperatorToken(fromHeader) || verifyOperatorToken(fromCookie)) return;
  throw new OperatorAuthError('Operator token is missing or invalid', 401);
}
