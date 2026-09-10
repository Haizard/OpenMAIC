# Academic Hub — Slice 0 Roadmap

> Source plan: `docs/superpowers/plans/2026-09-09-academic-hub-slice-0.md`
> Spec: `docs/superpowers/specs/2026-09-09-academic-hub-roles-design.md`
> Scope: identity, registration, auth, role gates, learner partition binding.
> Out of scope for Slice 0: assignments, homework, holiday packages, Zoom, debate matching.

## Database and domain

- [x] Postgres tables (`academic_users`, `academic_parents`, `academic_students`, `academic_schools`, `academic_school_roster`, `academic_sessions`) with idempotent `CREATE TABLE IF NOT EXISTS`
- [x] Password hashing with Node `scrypt` (`hashPassword` / `verifyPassword`)
- [x] Student-first registration (creates parent too, one transaction)
- [x] Parent-first registration (creates first student too, one transaction)
- [x] School registration (no student/parent rows)
- [x] Academic levels: `primary` | `junior_secondary` | `senior_secondary` | `undergraduate` | `postgraduate` | `other`
- [x] Add child under an existing parent
- [x] School roster CRUD (names/grades, no logins for roster students)

## Auth and sessions

- [x] HttpOnly session cookie (`openmaic_session`, 7-day TTL)
- [x] Server-side session rows in `academic_sessions`
- [x] Login: email + password, 401 on wrong credentials
- [x] Logout: destroy session + clear cookies
- [x] `GET /api/academic/me` returns role-scoped profile

## API routes

- [x] `POST /api/academic/register/student`
- [x] `POST /api/academic/register/parent`
- [x] `POST /api/academic/register/school`
- [x] `POST /api/academic/login`
- [x] `POST /api/academic/logout`
- [x] `GET /api/academic/me`
- [x] `GET /api/academic/children` (parent-only)
- [x] `POST /api/academic/children` (parent-only, add child)
- [x] `GET /api/academic/roster` (school-only)
- [x] `POST /api/academic/roster` (school-only)
- [x] `DELETE /api/academic/roster/[id]` (school-only) — REST path-param delete

## Routing and guards

- [x] Middleware: unauthenticated `/learn`, `/parent`, `/school` redirect to `/login`
- [x] Middleware: wrong-role redirects to the correct dashboard
- [x] Server role-gate layouts: `app/learn/layout.tsx`, `app/parent/layout.tsx`, `app/school/layout.tsx`
- [x] Wrong-world 403 page (`app/academic-forbidden/page.tsx`)
- [x] Shared auth form component (`components/academic/auth-form.tsx`)

## Learner partition

- [x] `lib/academic/learner-principal.ts` (`studentLearnerKey`)
- [x] `tests/academic/learner-principal.test.ts` (header spoof ignored when session present; school has no learner key)
- [x] `lib/persistence/server-auth.ts` derives principal from academic session, not `x-learner-key`
- [x] `lib/persistence/bootstrap.ts` sends `user:{studentId}` after login; calls `mergeLearner` once for previously anonymous devices

## Pages

- [x] Public landing `/` with Learn vs School cards
- [x] `app/learn/page.tsx` — classroom home
- [x] `app/parent/page.tsx` — children list + add-child + progress stub
- [x] `app/school/page.tsx` — profile + roster CRUD
- [x] `app/login/page.tsx`
- [x] `app/register/student/page.tsx`
- [x] `app/register/parent/page.tsx`
- [x] `app/register/school/page.tsx`

## Verification

- [x] `pnpm exec vitest run tests/academic` passes (35/35)
- [ ] Typecheck on touched files passes
- [ ] Student, parent with two children, and school can log in to the correct panel and cannot open the other world
