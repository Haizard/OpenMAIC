import { BrowserKVStore, HttpDocumentStore, type HttpDocumentHeadersHook } from '@openmaic/storage';
import { HttpRuntimeStore, type HttpRuntimeHeadersHook } from '@openmaic/storage/runtime/http';

import {
  assertDocumentStorageConfigurable,
  configureDocumentStorage,
  type DocumentStorageOptions,
} from '@/lib/document-store/config';
import { assertRuntimeStorageConfigurable, configureRuntimeStorage } from '@/lib/runtime/config';
import { getLearnerKey } from '@/lib/runtime/learner-key';
import { studentLearnerKey } from '@/lib/academic/learner-principal';

let deviceKv: BrowserKVStore | undefined;
let learnerKeyPromise: Promise<string> | undefined;

/**
 * The anonymous device key, minted once per device. Kept so we can call
 * mergeLearner(anon, account) the first time a signed-in student appears on
 * this device.
 */
let anonymousLearnerKey: string | undefined;

/**
 * Whether we have already attempted the account-learner merge for this device.
 * Merge is idempotent; this flag just avoids a pointless round-trip.
 */
let mergeAttempted = false;

export function isBrowserPersistenceEnabled(): boolean {
  return typeof window !== 'undefined' && process.env.NEXT_PUBLIC_PERSISTENCE === '1';
}

/**
 * Resolve the learner partition key for the current browser session.
 *
 * Priority:
 *   1. A signed-in student account key: `user:{studentId}` from /api/academic/me.
 *   2. The existing anonymous device key `anon:{uuid}`.
 *
 * When a signed-in student appears on a device that previously used an anonymous
 * key, mergeLearner(anon, account) is called once so the device's existing
 * runtime sessions are re-keyed to the account partition.
 */
export async function getPersistenceLearnerKey(): Promise<string> {
  if (!isBrowserPersistenceEnabled()) {
    return Promise.reject(new Error('Browser persistence is not enabled'));
  }

  // Try the account key first. If the user is not signed in as a student, this
  // returns null and we fall back to the anonymous device key.
  const accountKey = await accountLearnerKey();
  if (accountKey) {
    await tryMergeAnonymousToAccount(accountKey);
    return accountKey;
  }

  return (learnerKeyPromise ??= getLearnerKey((deviceKv ??= new BrowserKVStore())).catch(
    (error) => {
      learnerKeyPromise = undefined;
      throw error;
    },
  ));
}

/**
 * Fetch /api/academic/me and, if the signed-in user is a student, return
 * user:{studentId} as the account learner key. Otherwise return undefined.
 */
async function accountLearnerKey(): Promise<string | undefined> {
  try {
    const response = await fetch('/api/academic/me');
    if (!response.ok) return undefined;
    const data = await response.json();
    if (data.success && data.role === 'student' && data.student?.id) {
      return studentLearnerKey(data.student.id as string);
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * If this device previously used an anonymous learner key and the user is now
 * signed in as a student, call mergeLearner(anon, account) once so existing
 * runtime sessions are re-keyed to the account partition.
 */
async function tryMergeAnonymousToAccount(accountKey: string): Promise<void> {
  if (mergeAttempted) return;
  mergeAttempted = true;

  const anonKey = anonymousLearnerKey ?? (deviceKv ? getLearnerKey(deviceKv).catch(() => undefined) : undefined);
  if (!anonKey) return;

  // Only merge when the anonymous key is actually an anonymous device key.
  if (!String(anonKey).startsWith('anon:')) return;
  if (accountKey === anonKey) return;

  try {
    const token = process.env.NEXT_PUBLIC_PERSISTENCE_TOKEN;
    const headers: Record<string, string> = {
      'x-learner-key': anonKey,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    };
    const response = await fetch('/api/persistence/runtime/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ fromLearnerKey: anonKey, toLearnerKey: accountKey }),
    });
    // mergeLearner is idempotent: a 409 or any non-ok response is acceptable
    // here because the one-shot merge may have already happened or the route
    // may be unavailable. We never block sign-in on it.
    if (!response.ok) {
      console.warn('mergeLearner from anonymous to account key failed:', response.status);
    }
  } catch (error) {
    console.warn('mergeLearner from anonymous to account key failed:', error);
  }
}

export async function getPersistenceRequestHeaders(): Promise<Record<string, string>> {
  if (!isBrowserPersistenceEnabled()) return {};
  const resolvedLearnerKey = await getPersistenceLearnerKey();
  const token = process.env.NEXT_PUBLIC_PERSISTENCE_TOKEN;
  return {
    'x-learner-key': resolvedLearnerKey,
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

if (isBrowserPersistenceEnabled()) {
  const learnerKey = getPersistenceLearnerKey;
  const headers = getPersistenceRequestHeaders;

  const runtimeOptions = {
    store: () =>
      new HttpRuntimeStore({
        baseUrl: '/api/persistence',
        headers: headers satisfies HttpRuntimeHeadersHook,
      }),
    learnerKey,
  };
  const documentOptions: DocumentStorageOptions = {
    store: ({ validateScene, validateStage }) =>
      new HttpDocumentStore({
        baseUrl: '/api/persistence',
        headers: headers satisfies HttpDocumentHeadersHook,
        validateScene,
        validateStage,
      }),
  };
  try {
    // All checks are mutation-free. Once they pass, the synchronous configure
    // calls cannot leave only a subset of the persistence seams configured.
    assertRuntimeStorageConfigurable();
    assertDocumentStorageConfigurable();
    configureRuntimeStorage(runtimeOptions);
    configureDocumentStorage(documentOptions);
  } catch (error) {
    console.error(
      'FATAL: server-backed persistence bootstrap failed; no storage seam changes were applied',
      error,
    );
  }
}
