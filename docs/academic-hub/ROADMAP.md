# Academic Hub — Source of Truth

This file is the coding-agent contract for turning OpenMAIC into an academic product.

**How to use this file**

1. Read this file and `docs/superpowers/specs/2026-09-09-academic-hub-roles-design.md` before writing code.
2. Implement only the current slice (the first `[ ]` epic that is not blocked).
3. When a checkbox item is fully implemented, tested, and verified, change `[ ]` to `[x]` in the same commit as the feature. Do not mark it done from intent.
4. Do not skip slices. Later epics depend on earlier ones.
5. If a decision here conflicts with hallway talk, this file wins until a human updates it.
6. New features discussed in chat must be added here before implementation.

**Product status:** roles/auth spec approved. Implementation not started.

---

## Locked product rules

These are not optional. Do not "simplify" them away.

1. **Two worlds, no overlap.** Hub learners never see debate. Schools never see hub homework.
2. **Student and parent are a family.** Whoever registers first must create the other on the same form. One parent, many students. Not many parents per child in v1.
3. **School debate students are a roster, not accounts.** School types names/grades. Those people cannot log in. Coaches run Zoom later.
4. **Hub students cannot join or create debates.** Debate is school-only.
5. **Stack:** this Next.js repo + existing Postgres (`DATABASE_URL`). No separate Express app for v1.
6. **ACCESS_CODE** is an optional site password, not user identity.
7. Parent is a **mentor**: see progress, pending homework, deadlines; nudge the child. Parent does not take the student's classes.

---

## Worlds

```
Public landing
├── Learn (students + parents)
│   ├── Student: classroom, assignments, homework, holiday packages
│   └── Parent: children list, progress, pending work, mentor nudges
└── School debate (schools only)
    ├── School profile
    ├── Roster (names/grades, no login)
    └── Matches / tournament (later)
```

A person who self-registers as a student for learning has **zero** relationship to any school on this platform.

---

## Implementation status

Legend: `[ ]` not started · `[x]` done · `BLOCKED` waiting on earlier slice.

### Slice 0 — Identity, auth, dual worlds (CURRENT)

Spec: `docs/superpowers/specs/2026-09-09-academic-hub-roles-design.md`

- [x] Postgres tables: `users`, `parents`, `students`, `schools`, `school_roster`, `sessions`
- [ ] Password hashing (argon2 preferred) + httpOnly session cookie
- [x] Student-first registration (creates parent in one transaction)
- [x] Parent-first registration (creates first student in one transaction)
- [x] School registration (school user + school profile only)
- [ ] Login / logout
- [ ] Role-gated routes: `/learn/*`, `/parent/*`, `/school/*`
- [ ] Public landing: Learn vs School, copy never cross-leaks
- [x] Student academic level on register (`primary` | `junior_secondary` | `senior_secondary` | `undergraduate` | `postgraduate` | `other`)
- [ ] Parent: list children, add another child, progress stub
- [ ] School: roster CRUD (name, grade)
- [ ] Bind signed-in student id to learner partition (replace spoofable `x-learner-key`)
- [ ] Merge anonymous device `learnerKey` into account on first login
- [ ] Tests: family transaction, duplicate email, role 403, session expiry, header spoof

**Done when:** a student, a parent with two children, and a school with a roster can all log in to the correct panel and cannot open the other world.

### Slice 1 — Assignments (e-learning)

BLOCKED on Slice 0.

Online assignments generated or attached to a course. Student submits on the platform. Parent sees pending/complete.

- [ ] Assignment model: title, course/scene link, due_at, created_by (system or later teacher — v1 may be self-assigned from a course)
- [ ] Student: list assignments, open, submit
- [ ] Parent: see child's assignments and status
- [ ] Grade or auto-score stub (quiz reuse from OpenMAIC if present)
- [ ] Tests: submit after due date, parent cannot submit as child, student cannot see sibling assignments

**Open decision (record here before coding):** who creates assignments in a student-only hub with no teacher? Options: auto from generated course; student self-starts a unit; later school/teacher role. Default until changed: **auto from the student's generated/imported courses.**

### Slice 2 — Homework

BLOCKED on Slice 1 (or can share assignment tables if implementation treats homework as an assignment type).

Regular homework with due dates and parent mentor view.

- [ ] Homework vs assignment distinction (type flag or separate table — pick one in the slice spec)
- [ ] Student submit + status (pending / submitted / late)
- [ ] Parent pending-homework list and deadline visibility
- [ ] Tests: parent sees pending only for their children

### Slice 3 — Holiday packages + home recording

BLOCKED on Slice 2.

Bundled holiday homework. Parts of the package require a **recorded home submission**.

- [ ] Holiday package: date range, list of homework items, which items require recording
- [ ] Student: record/upload audio or video for required parts
- [ ] Parent: see which recorded parts are missing; mentor nudge
- [ ] Storage: use existing OpenMAIC media/persistence, scoped to the student account
- [ ] Tests: package incomplete without required recordings; parent cannot watch another family's recordings

### Slice 4 — School 1v1 debate match (foundation for tournament)

BLOCKED on Slice 0. Independent of homework slices.

Not a full tournament yet. One timed match: School A vs School B, pick a side, countdown, winner.

- [ ] School searches/challenges another school (or accepts an invite)
- [ ] Match: topic, For/Against assignment, start/end time
- [ ] Each school attaches roster members as the team for that match (still no student login)
- [ ] Zoom room: school-handled. Platform stores meeting URL + host keys for the two school accounts only
- [ ] In-match activities (questions / scores) that feed a winner calculation
- [ ] Winner recorded on the match
- [ ] Hub students and parents have no routes, no UI, no API to this
- [ ] Tests: third school cannot join a 1v1; hub student token 403s all debate APIs

**Zoom note:** do not build Zoom OAuth until the match model exists. First version may be "paste Zoom join URL" per match. Native Zoom SDK/API is a sub-task of this slice, not a separate world.

### Slice 5 — Tournament bracket

BLOCKED on Slice 4.

Wrap 1v1 matches in a season: schools enroll, system pairs, bracket advances winners.

- [ ] Season / tournament entity
- [ ] Enrollment
- [ ] Pairing / bracket
- [ ] Advance winner to next match
- [ ] Tests: bye handling, withdrawn school

---

## Deferred (do not build until a human unlocks them)

- Email verification, password reset, SSO
- Many parents per student
- Hub student invited into a school debate
- School-created student logins
- Open debate lobby (public join)
- Teacher role inside the learning hub
- Billing

---

## Suggested build order

```
Slice 0 (roles/auth) ──┬── Slice 1 (assignments) ── Slice 2 (homework) ── Slice 3 (holiday + recording)
                       └── Slice 4 (1v1 debate) ── Slice 5 (tournament)
```

Homework line and debate line may proceed in parallel **after** Slice 0.

---

## Agent checklist (every PR / session)

- [ ] I read this roadmap and the current slice spec.
- [ ] I did not implement a later slice.
- [ ] I did not mix hub users into debate APIs (or the reverse).
- [ ] I updated checkboxes in this file to `[x]` only for work that is tested.
- [ ] If I discovered a new product rule, I added it under Locked product rules or Deferred.

---

## Decision log

| Date | Decision |
| --- | --- |
| 2026-09-09 | First academic user intent: student learning hub + school Zoom debates |
| 2026-09-09 | Start with roles; Node.js (this Next.js app) + Postgres |
| 2026-09-09 | Students self-register with academic level; parent created on the same form (either side first) |
| 2026-09-09 | Schools register only for debate; hub students do not use debate |
| 2026-09-09 | School handles its own students via roster (no debate-student login) |
| 2026-09-09 | Debate shape: timed 1v1, pick a side; tournament later around that match |
| 2026-09-09 | Parent: one-to-many children; mentor view of progress and pending homework |
| 2026-09-09 | Architecture A: features live in this OpenMAIC repo |
| 2026-09-09 | v1 slice is identity only; other features tracked here as later slices |
