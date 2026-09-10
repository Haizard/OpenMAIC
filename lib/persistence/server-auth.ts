/**
 * DEVELOPMENT-ONLY authentication for the embedded persistence route.
 *
 * The token is NOT a secret: NEXT_PUBLIC_PERSISTENCE_TOKEN is compiled into
 * the public browser bundle, so it is fully visible to every visitor and
 * provides no confidentiality and no user isolation — anyone who can load the
 * page can read and write EVERY learner partition and all documents by
 * supplying an arbitrary x-learner-key. Its only purpose is to keep unrelated
 * network scanners out of a trusted-network endpoint. Suitable only for
 * localhost or trusted-network, single-user deployments. Production must
 * replace this module with real session verification and derive learner
 * identity from server-controlled claims.
 *
 * Slice 0 addition: when a valid academic session cookie is present, the
 * learner key is derived from the server-side session (student -> user:{id})
 * instead of the client-supplied x-learner-key. School/parent sessions do not
 * authenticate as a learner partition.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

import type { AssetPrincipal } from '@openmaic/storage';
import type { RuntimeHttpPrincipal } from '@openmaic/storage/server';

import { createLogger } from '@/lib/logger';
import { getAcademicDb } from '@/lib/academic/db';
import { readSession, SESSION_COOKIE } from '@/lib/academic/session';
import { studentLearnerKey } from '@/lib/academic/learner-principal';

const log = createLogger('PersistenceAuth');

type PersistencePrincipal = RuntimeHttpPrincipal & Partial<Pick<AssetPrincipal, 'key'>>;

/**
 * The single asset partition for this deployment shape. Documents have no
 * ownership partition; assets get the same treatment until real auth lands.
 */
const SHARED_ASSET_PRINCIPAL = 'shared';

/**
 * Whether the operator explicitly opted the development authenticator into
 * production traffic (PERSISTENCE_ALLOW_INSECURE_DEV_AUTH=true/1). Both the
 * startup warning and the runtime gate read the same opt-in through this one
 * helper so the two copies of the parsing cannot drift.
 */
function insecureDevAuthOptInEnabled(): boolean {
  const optIn = process.env.PERSISTENCE_ALLOW_INSECURE_DEV_AUTH;
  return optIn === 'true' || optIn === '1';
}

/**
 * The development authenticator must never serve production traffic unless the
 * operator explicitly accepts the trade-off. This module provides no user
 * isolation, so production defaults to refusing it entirely (returns undefined,
 * which callers turn into a 401); PERSISTENCE_ALLOW_INSECURE_DEV_AUTH=true is
 * the documented opt-in for trusted-network single-user deployments.
 */
function devAuthenticatorAllowedInCurrentEnvironment(): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  return insecureDevAuthOptInEnabled();
}

if (process.env.NODE_ENV === 'production' && insecureDevAuthOptInEnabled()) {
  log.warn(
    'Persistence is running the development authenticator in production: it provides no user ' +
      'isolation, so this endpoint must only be reachable on a trusted network. Replace it with ' +
      'real session verification before serving public traffic.',
  );
}

function singleHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function secureEqual(left: string, right: string): boolean {
  const leftDigest = createHash('sha256').update(left).digest();
  const rightDigest = createHash('sha256').update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

async function learnerKeyFromSession(cookieValue: string): Promise<string | undefined> {
  try {
    const db = await getAcademicDb();
    const session = await readSession(db, cookieValue);
    if (session && session.role === 'student' && session.studentId) {
      return studentLearnerKey(session.studentId);
    }
    // Parent and school sessions do not own a learner partition in v1.
    return undefined;
  } catch {
    // DB unavailable: fall back to client-supplied key below.
    return undefined;
  }
}

function authenticatePersistenceCredentials(
  authorization: string | undefined,
  learnerKey: string | undefined,
  sessionDerivedKey: string | undefined,
): PersistencePrincipal | undefined {
  if (!devAuthenticatorAllowedInCurrentEnvironment()) return undefined;

  const token = process.env.PERSISTENCE_DEV_TOKEN;
  if (!token || !authorization || !secureEqual(authorization, `Bearer ${token}`)) return undefined;

  // A session-derived learner key wins over the client-supplied x-learner-key
  // so a signed-in student cannot be smuggled into another partition.
  const effectiveLearnerKey = sessionDerivedKey ?? learnerKey;

  return {
    key: SHARED_ASSET_PRINCIPAL,
    ...(effectiveLearnerKey ? { learnerKey: effectiveLearnerKey } : {}),
  };
}

export function authenticatePersistenceHeaders(headers: Headers): Promise<PersistencePrincipal | undefined> {
  const authorization = headers.get('authorization') ?? undefined;
  const learnerKey = headers.get('x-learner-key') ?? undefined;
  const sessionCookie = headers.get(SESSION_COOKIE);

  return learnerKeyFromSession(sessionCookie ?? '').then((sessionDerivedKey) =>
    authenticatePersistenceCredentials(authorization, learnerKey, sessionDerivedKey),
  );
}

// Keep the synchronous overload for callers that still pass IncomingMessage
// directly and cannot await the session read.
export async function authenticatePersistenceRequest(
  req: IncomingMessage,
): Promise<PersistencePrincipal | undefined> {
  const authorization = singleHeader(req.headers.authorization);
  const learnerKey = singleHeader(req.headers['x-learner-key']);
  const sessionCookie = singleHeader(req.headers[SESSION_COOKIE.toLowerCase()]);

  const sessionDerivedKey = sessionCookie
    ? await learnerKeyFromSession(sessionCookie)
    : undefined;

  return authenticatePersistenceCredentials(authorization, learnerKey, sessionDerivedKey);
}
