# Academic Hub — Roles, Auth, and Dual Worlds

Date: 2026-09-09
Status: approved (Section 1–3)
Scope of this spec: identity, registration, auth, route split. Homework, assignments, holiday packages, and Zoom debates are later slices; see `docs/academic-hub/ROADMAP.md`.

## Problem

OpenMAIC is a single-user AI classroom generator (anonymous `learnerKey`, optional site-wide `ACCESS_CODE`, Postgres used for course/runtime persistence with no real user isolation). We are shifting it into an academic product with two non-overlapping worlds:

1. **Learning hub** — self-registered students and parents.
2. **School debates** — schools that compete with other schools. Hub learners never see this.

## Users

| Role | How they appear | What they can do in v1 |
| --- | --- | --- |
| Student | Self-register, or created by a parent on the parent form | Set academic level; use existing OpenMAIC learning behind their account |
| Parent | Self-register, or created by a student on the student form | See all linked children; progress stub; pending-homework stub; add more children |
| School | Self-register on the school path only | Profile + school-only roster (names/grades, no logins) |

Hard rules:

- Hub students never see debate, Zoom, or school matching.
- Schools never see hub homework/assignments.
- Debate participants are **not accounts**. The school types a roster. Coaches run Zoom later.
- Either parent or student may register first and must create the other party on the same form.
- One parent, many students. Not many parents per student in v1.

## Architecture

Stay in this repo: Next.js App Router + existing `DATABASE_URL` Postgres.

- New academic tables live beside current persistence. They do not replace course documents.
- Replace anonymous identity for hub users: signed-in student id becomes the learner partition. Use `RuntimeStore.mergeLearner(anonKey, accountKey)` when a previously anonymous device signs in.
- `ACCESS_CODE` remains an optional **site** gate, not user identity.
- Persistence authenticator (`lib/persistence/server-auth.ts`) must derive principal from the server session, not client-supplied `x-learner-key`.

Do not add a separate Express service for v1.

## Data model

```
users
  id, email (unique), password_hash, role ('student' | 'parent' | 'school'), created_at

parents
  id, user_id (unique FK users), display_name

students
  id, user_id (unique FK users), parent_id (FK parents, required), academic_level, display_name

schools
  id, user_id (unique FK users), name, contact

school_roster
  id, school_id (FK schools), student_name, grade
  -- no user_id; these people cannot log in

sessions
  id, user_id, expires_at, created_at
```

Registration is one DB transaction:

- Student-first: insert student `users` + parent `users` + `parents` + `students` (parent_id set).
- Parent-first: insert parent `users` + `parents` + first student `users` + `students`.
- School: insert school `users` + `schools` only.

Parent may later add more `students` (and their `users`) under the same `parent_id`.

## Auth

- Email + password. Hash with argon2 (preferred) or bcrypt.
- Server-side session rows. HttpOnly, Secure, SameSite=Lax cookie.
- Middleware: unauthenticated requests to `/learn`, `/parent`, `/school` redirect to login. Role mismatch returns 403.
- School users never receive a learner partition.
- Parents are viewers of children; they do not own a classroom learner key unless later specs say so.

## Routes (v1)

| Path | Role | Behavior |
| --- | --- | --- |
| `/` | public | Landing: Learn vs School debate. Learn copy never mentions debate. |
| `/register/student` | public | Student-first form (creates parent too) |
| `/register/parent` | public | Parent-first form (creates first student too) |
| `/register/school` | public | School-only form |
| `/login` | public | Email/password |
| `/learn/*` | student | Existing classroom, scoped to this student |
| `/parent/*` | parent | Children list, progress stub, add child |
| `/school/*` | school | Profile + roster CRUD |

## Out of this spec

Assignments, homework, holiday packages, Zoom, debate matching, scoring, email verification, SSO, many-to-many guardians.

## Testing

- Transactional registration: student-first and parent-first both yield linked pair; rollback on duplicate email.
- Role gates: student cannot open `/school`; school cannot open `/learn`.
- Session cookie rejected when expired or user deleted.
- Persistence principal comes from session, not `x-learner-key` header spoofing.
- Parent can add a second child; both list under the same parent.

## Error handling

- Duplicate email: 409, no partial users left.
- Missing counterpart fields on family register: 400, no write.
- Invalid academic level: 400. Allowed values: `primary`, `junior_secondary`, `senior_secondary`, `undergraduate`, `postgraduate`, `other`.
- DB down: 503, do not fall back to anonymous shared persistence for signed-in routes.
