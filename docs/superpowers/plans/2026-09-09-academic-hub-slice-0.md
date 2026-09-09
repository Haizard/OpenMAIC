# Academic Hub Slice 0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real email/password accounts, family and school registration, role-gated `/learn`, `/parent`, and `/school` panels, and bind a signed-in student to the learner partition.

**Architecture:** New academic tables on the existing `DATABASE_URL` Postgres pool (`CREATE TABLE IF NOT EXISTS`, same pattern as `lib/persistence/stage-meta.ts`). Auth is httpOnly session cookies plus server-side `academic_sessions` rows. Route gates live in Node layouts (DB-backed `getSession`); middleware only redirects when the cookie is missing. Hub students never see `/school`; schools never see `/learn` or `/parent`.

**Tech Stack:** Next.js 16 App Router, `pg` Pool, PGlite in Vitest, `node:crypto` scrypt (no new password library), existing `apiSuccess` / `apiError`, existing shadcn UI.

## Global Constraints

- Two worlds, no overlap: hub learners never see debate; schools never see hub homework.
- Whoever registers first (student or parent) creates the other on the same form, one transaction.
- One parent, many students. Not many parents per child.
- School roster is names/grades only — no login for debate students.
- Stay in this repo. Use `DATABASE_URL`. No Express service.
- `ACCESS_CODE` remains an optional site gate, not identity.
- Academic levels: `primary` | `junior_secondary` | `senior_secondary` | `undergraduate` | `postgraduate` | `other`.
- Cookie name: `openmaic_session` (must not collide with `openmaic_access`).
- Learner partition for a signed-in student: `user:{studentId}`.
- After each shipped feature: commit, mark the matching `docs/academic-hub/ROADMAP.md` checkbox `[x]` only when tests pass, push to `main`.
- Do not implement assignments, homework, holiday packages, or Zoom.

## File map

Create:

- `lib/academic/types.ts` — roles, levels, public DTOs
- `lib/academic/schema.ts` — SQL + `ensureAcademicSchema`
- `lib/academic/password.ts` — scrypt hash/verify
- `lib/academic/session.ts` — create/read/destroy session, cookie helpers
- `lib/academic/pool.ts` — academic DB access via existing persistence pool
- `lib/academic/register.ts` — student-first, parent-first, school, add-child
- `lib/academic/auth.ts` — login, `getSession` from cookies
- `lib/academic/roster.ts` — school roster CRUD
- `lib/academic/require-role.ts` — throw/redirect helpers for layouts and APIs
- `app/api/academic/register/student/route.ts`
- `app/api/academic/register/parent/route.ts`
- `app/api/academic/register/school/route.ts`
- `app/api/academic/login/route.ts`
- `app/api/academic/logout/route.ts`
- `app/api/academic/me/route.ts`
- `app/api/academic/children/route.ts`
- `app/api/academic/roster/route.ts`
- `app/api/academic/roster/[id]/route.ts`
- `app/welcome` is not used; `/` becomes the landing
- `app/register/student/page.tsx`
- `app/register/parent/page.tsx`
- `app/register/school/page.tsx`
- `app/login/page.tsx`
- `app/learn/page.tsx` — current classroom home (moved from `app/page.tsx`)
- `app/learn/layout.tsx`
- `app/parent/page.tsx`
- `app/parent/layout.tsx`
- `app/school/page.tsx`
- `app/school/layout.tsx`
- `components/academic/auth-form.tsx`
- `tests/academic/schema.test.ts`
- `tests/academic/password.test.ts`
- `tests/academic/register.test.ts`
- `tests/academic/session.test.ts`
- `tests/academic/roster.test.ts`
- `tests/academic/require-role.test.ts`
- `tests/academic/learner-principal.test.ts`

Modify:

- `app/page.tsx` — replace generator with dual-world landing (move generator to `app/learn/page.tsx`)
- `middleware.ts` — unauthenticated `/learn`, `/parent`, `/school` redirect to `/login`
- `lib/server/api-response.ts` — add `CONFLICT`, `FORBIDDEN`, `NOT_FOUND`
- `lib/persistence/server-provider.ts` — call `ensureAcademicSchema` on bootstrap
- `lib/persistence/server-auth.ts` — session-derived learner principal when cookie present
- `lib/persistence/bootstrap.ts` — send `user:{studentId}` after login; call `mergeLearner` once
- `docs/academic-hub/ROADMAP.md` — check off Slice 0 items as they land

---

### Task 1: Schema and types

**Files:**
- Create: `lib/academic/types.ts`
- Create: `lib/academic/schema.ts`
- Create: `tests/academic/schema.test.ts`
- Modify: `lib/persistence/server-provider.ts`
- Modify: `lib/server/api-response.ts`

**Interfaces:**

```ts
export const USER_ROLES = ['student', 'parent', 'school'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ACADEMIC_LEVELS = [
  'primary',
  'junior_secondary',
  'senior_secondary',
  'undergraduate',
  'postgraduate',
  'other',
] as const;
export type AcademicLevel = (typeof ACADEMIC_LEVELS)[number];

export function isAcademicLevel(value: string): value is AcademicLevel;
```

Schema SQL (idempotent):

```sql
CREATE TABLE IF NOT EXISTS academic_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS academic_parents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES academic_users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS academic_students (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES academic_users(id) ON DELETE CASCADE,
  parent_id TEXT NOT NULL REFERENCES academic_parents(id) ON DELETE RESTRICT,
  academic_level TEXT NOT NULL,
  display_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS academic_schools (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES academic_users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS academic_school_roster (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL REFERENCES academic_schools(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  grade TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS academic_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES academic_users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS academic_students_parent_idx ON academic_students (parent_id);
CREATE INDEX IF NOT EXISTS academic_roster_school_idx ON academic_school_roster (school_id);
CREATE INDEX IF NOT EXISTS academic_sessions_user_idx ON academic_sessions (user_id);
```

Table prefix `academic_` avoids colliding with existing `user` / session names in other stores.

- [ ] Write `tests/academic/schema.test.ts` using PGlite (copy `PGlitePool` pattern from `tests/persistence/owner-materials.test.ts`). Assert `ensureAcademicSchema` is idempotent (run twice) and that inserting a student without a parent fails.
- [ ] Run `pnpm exec vitest run tests/academic/schema.test.ts` — expect FAIL (module missing).
- [ ] Implement types, schema, `ensureAcademicSchema`. Add `CONFLICT`, `FORBIDDEN`, `NOT_FOUND` to `API_ERROR_CODES`. Call `ensureAcademicSchema` from `createServerPersistenceProvider` after other ensures.
- [ ] Re-run test — expect PASS.
- [ ] Commit and push to `main`. Mark roadmap: `Postgres tables`.

---

### Task 2: Password hashing

**Files:**
- Create: `lib/academic/password.ts`
- Create: `tests/academic/password.test.ts`

Use Node `scrypt` (no new dependency). Hash format: `scrypt$N$r$p$saltHex$hashHex` with N=16384, r=8, p=1, 16-byte salt, 32-byte key.

```ts
export async function hashPassword(plain: string): Promise<string>;
export async function verifyPassword(plain: string, stored: string): Promise<boolean>;
```

Reject empty or < 8 character passwords in register, not here. `verifyPassword` returns false on malformed stored hashes (no throw).

- [ ] Failing tests: round-trip, wrong password, malformed stored.
- [ ] Implement.
- [ ] Commit and push. (Password hashing is a Slice 0 sub-item of the session checkbox; do not mark roadmap until login works.)

---

### Task 3: Pool helper

**Files:**
- Create: `lib/academic/pool.ts`

```ts
import { getServerPersistenceProvider } from '@/lib/persistence/server-provider';
import type { Pool, PoolClient } from 'pg';

export async function getAcademicPool(): Promise<Pool> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new AcademicDbUnavailableError();
  const provider = await getServerPersistenceProvider(url);
  return provider.pool;
}

export class AcademicDbUnavailableError extends Error {
  constructor() {
    super('Academic hub requires DATABASE_URL');
    this.name = 'AcademicDbUnavailableError';
  }
}
```

API routes catch this and return 503 `INTERNAL_ERROR` with message `Academic hub requires DATABASE_URL`.

No standalone test if provider is already covered; register tests will hit schema via PGlite injected queryable instead of this pool.

- [ ] Implement pool helper.
- [ ] Commit and push only if this lands with Task 4 (do not push an unused file alone). Fold into Task 4 commit.

---

### Task 4: Family and school registration (domain)

**Files:**
- Create: `lib/academic/register.ts`
- Create: `tests/academic/register.test.ts`

Queryable type: `{ query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }>; connect?: () => Promise<{ query: ...; release: () => void }> }`.

Prefer `pool.connect()` + `BEGIN` / `COMMIT` / `ROLLBACK` when `connect` exists; otherwise sequential queries on PGlite (single connection).

```ts
export interface StudentFirstInput {
  studentEmail: string;
  studentPassword: string;
  studentDisplayName: string;
  academicLevel: AcademicLevel;
  parentEmail: string;
  parentPassword: string;
  parentDisplayName: string;
}

export interface ParentFirstInput {
  parentEmail: string;
  parentPassword: string;
  parentDisplayName: string;
  studentEmail: string;
  studentPassword: string;
  studentDisplayName: string;
  academicLevel: AcademicLevel;
}

export interface SchoolRegisterInput {
  email: string;
  password: string;
  name: string;
  contact: string;
}

export interface AddChildInput {
  parentId: string;
  studentEmail: string;
  studentPassword: string;
  studentDisplayName: string;
  academicLevel: AcademicLevel;
}

export class DuplicateEmailError extends Error {
  readonly email: string;
}
export class ValidationError extends Error {}

export async function registerStudentFirst(db, input: StudentFirstInput): Promise<{ studentUserId: string; parentUserId: string }>;
export async function registerParentFirst(db, input: ParentFirstInput): Promise<{ studentUserId: string; parentUserId: string }>;
export async function registerSchool(db, input: SchoolRegisterInput): Promise<{ schoolUserId: string }>;
export async function addChild(db, input: AddChildInput): Promise<{ studentUserId: string }>;
```

Normalize emails: trim, lower-case. Passwords min 8 chars. Names non-empty. Parent and student emails must differ.

On unique-violation (Postgres `23505` or PGlite equivalent), throw `DuplicateEmailError` after rollback. No leftover `academic_users` rows.

IDs: `crypto.randomUUID()`.

- [ ] Tests: student-first links parent_id; parent-first same; duplicate email leaves zero users; invalid level throws; addChild second student same parent_id; school has no student/parent rows.
- [ ] Implement.
- [ ] Commit and push. Mark roadmap: student-first, parent-first, school registration, academic level, parent add child (domain).

---

### Task 5: Sessions

**Files:**
- Create: `lib/academic/session.ts`
- Create: `tests/academic/session.test.ts`

```ts
export const SESSION_COOKIE = 'openmaic_session';
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export async function createSession(db, userId: string): Promise<{ id: string; expiresAt: Date }>;
export async function readSession(db, sessionId: string): Promise<null | {
  sessionId: string;
  userId: string;
  role: UserRole;
  expiresAt: Date;
  studentId: string | null;
  parentId: string | null;
  schoolId: string | null;
}>;
export async function destroySession(db, sessionId: string): Promise<void>;

export function sessionCookieOptions(expiresAt: Date): {
  httpOnly: true;
  sameSite: 'lax';
  path: '/';
  expires: Date;
  secure: boolean;
};
```

`readSession` joins `academic_users` and left-joins student/parent/school profile tables. Expired sessions return null and delete the row.

- [ ] Tests: create/read, expired returns null, destroy, missing id null.
- [ ] Implement.
- [ ] Commit and push. Mark roadmap: password hashing + httpOnly session cookie.

---

### Task 6: Auth API routes and login domain

**Files:**
- Create: `lib/academic/auth.ts`
- Create: `app/api/academic/register/student/route.ts`
- Create: `app/api/academic/register/parent/route.ts`
- Create: `app/api/academic/register/school/route.ts`
- Create: `app/api/academic/login/route.ts`
- Create: `app/api/academic/logout/route.ts`
- Create: `app/api/academic/me/route.ts`
- Create: `app/api/academic/children/route.ts`
- Modify: `lib/academic/require-role.ts` (create)

Login: lookup email, `verifyPassword`, `createSession`, set cookie. Wrong email or password → 401 `INVALID_CREDENTIALS` (same message).

`GET /api/academic/me` → `{ user, student, parent, school, children? }` based on role.

`POST /api/academic/children` parent-only: `addChild` then 201.

All register routes set session cookie for the **initiating** user (student-first → student session; parent-first → parent session; school → school session).

- [ ] Domain login tests in `tests/academic/session.test.ts` or `tests/academic/register.test.ts`: wrong password; successful login returns user id.
- [ ] Implement routes using `cookies()` from `next/headers` like `app/api/access-code/verify/route.ts`.
- [ ] Commit and push. Mark roadmap: login/logout.

---

### Task 7: Role gates

**Files:**
- Create: `lib/academic/require-role.ts`
- Create: `tests/academic/require-role.test.ts`
- Modify: `middleware.ts`
- Create: `app/learn/layout.tsx`
- Create: `app/parent/layout.tsx`
- Create: `app/school/layout.tsx`

```ts
export class UnauthenticatedError extends Error {}
export class ForbiddenRoleError extends Error {
  constructor(public readonly actual: UserRole | null, public readonly required: UserRole) {}
}

export function assertRole(session: { role: UserRole } | null, required: UserRole): asserts session is { role: UserRole };
```

Middleware: if pathname starts with `/learn`, `/parent`, or `/school` and `openmaic_session` cookie is absent, redirect to `/login?next=...`. Do not check role in Edge (no DB). Keep existing ACCESS_CODE and workbench logic.

Layouts are server components: `getSession()`, wrong role → `notFound()` or a 403 page. Use `forbidden`/`notFound` from `next/navigation`. Spec says 403 — implement `app/academic-forbidden/page.tsx` and `redirect('/academic-forbidden')` for wrong-world, to avoid leaking that the other world exists? Spec says 403. Use a simple 403 page at those layouts via `NextResponse` is not available in layouts. Render `academic-forbidden` component.

Wrong-world: student hitting `/school` sees "You do not have access to the school debate area." Parent/school hitting `/learn` sees "You do not have access to the learning hub."

- [ ] Unit test `assertRole`.
- [ ] Implement middleware + layouts.
- [ ] Commit and push. Mark roadmap: role-gated routes.

---

### Task 8: Pages (landing, register, login, three panels)

**Files:**
- Move: `app/page.tsx` → `app/learn/page.tsx` (keep client generator intact)
- Create: `app/page.tsx` — landing with two cards: Learn, School debate. Learn copy must not mention debate. School copy must not mention homework.
- Create: `app/register/student/page.tsx`
- Create: `app/register/parent/page.tsx`
- Create: `app/register/school/page.tsx`
- Create: `app/login/page.tsx`
- Create: `app/parent/page.tsx` — children list, progress stub ("Homework and grades will appear here"), add-child form
- Create: `app/school/page.tsx` — profile name/contact, roster CRUD
- Create: `components/academic/auth-form.tsx`
- Create: `app/api/academic/roster/route.ts` GET list POST add
- Create: `app/api/academic/roster/[id]/route.ts` DELETE
- Create: `lib/academic/roster.ts`
- Create: `tests/academic/roster.test.ts`

Roster:

```ts
export async function listRoster(db, schoolId: string): Promise<{ id: string; studentName: string; grade: string }[]>;
export async function addRosterEntry(db, schoolId: string, studentName: string, grade: string): Promise<{ id: string }>;
export async function deleteRosterEntry(db, schoolId: string, entryId: string): Promise<boolean>;
```

- [ ] Roster tests: add/list/delete; delete unknown returns false.
- [ ] Implement pages with existing `Button`, `Input`, `Card`, `Label`.
- [ ] After move, grep `href="/"` and `push('/')` that meant the generator; point student home links to `/learn`.
- [ ] Commit and push. Mark roadmap: public landing, parent progress stub, school roster CRUD.

---

### Task 9: Learner partition from session

**Files:**
- Create: `lib/academic/learner-principal.ts`
- Create: `tests/academic/learner-principal.test.ts`
- Modify: `lib/persistence/server-auth.ts`
- Modify: `lib/persistence/bootstrap.ts`

```ts
export function studentLearnerKey(studentId: string): string {
  return `user:${studentId}`;
}
```

Server: when `authenticatePersistenceHeaders` sees a valid academic session cookie, ignore client `x-learner-key` for partition and use `user:{studentId}`. School/parent sessions must not authenticate as a learner partition (return undefined learnerKey / 401 for runtime learner routes). If no academic session, keep existing dev-token behavior so current OpenMAIC persistence tests still pass.

Client bootstrap: `GET /api/academic/me`; if role is student, use `user:{studentId}` as learner key. If device has `anon:...` key, call runtime `mergeLearner(anon, user:{studentId})` once then store the account key. Parents and schools do not set a learner key.

- [ ] Tests: spoofed `x-learner-key` ignored when session present; school session has no learner key; `studentLearnerKey` format.
- [ ] Implement.
- [ ] Commit and push. Mark roadmap: bind student id, merge anonymous key, tests including header spoof.

---

### Task 10: Slice 0 verification and roadmap close

- [ ] Run `pnpm exec vitest run tests/academic`
- [ ] Run `pnpm exec tsc --noEmit -p tsconfig.json` if feasible, or `pnpm lint` on touched files
- [ ] Confirm every Slice 0 checkbox in `docs/academic-hub/ROADMAP.md` is `[x]`
- [ ] Push to `main`

**Done when:** a student, a parent with two children, and a school with a roster can log in to the correct panel and cannot open the other world.
