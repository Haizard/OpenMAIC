# Academic Hub — Homework

Date: 2026-09-12
Status: proposed
Scope of this spec: homework as a distinct kind of work inside the learning hub, and the parent
mentor view of it. Holiday packages and recordings are Slice 4. The guidance engine is Slice 5.
Assignments (Slice 1) and the reading library (Slice 2) are already built.

## Problem

Slice 1 gave the hub a self-started **assignment**: the student picks a curriculum topic and
sets themselves work with an optional due date. That is useful for a motivated student, but it
is not homework.

Homework means **work that was set for you**. A tuition platform where the student is also the
person who decides what to do, when, and whether it is late has no accountability in it. The
parent mentor view is the whole point: a parent needs to see what their child was *supposed* to
do, what is outstanding, and when it is due.

So Slice 3 must answer two questions the existing model cannot:

1. Who sets homework, when v1 has no teacher role?
2. What makes homework different from an assignment, other than the label?

## Decision 1 — Homework is a kind of assignment, not a separate table

**Chosen: a `kind` flag on `academic_assignments`.**

Homework and an assignment share every structural field: title, description, curriculum topic,
due date, status, submission timestamp. The submission lifecycle, the late derivation, and the
parent join are identical. A separate `academic_homework` table would duplicate all of that and
would need a parallel set of queries and tests for logic that is already proven.

The roadmap anticipated this: Slice 3 "can share assignment tables if implementation treats
homework as an assignment type."

```
academic_assignments
  + kind TEXT NOT NULL DEFAULT 'assignment' CHECK (kind IN ('assignment', 'homework'))
  + assigned_by TEXT NOT NULL DEFAULT 'student' CHECK (assigned_by IN ('student', 'platform'))
```

The column is additive with a default, so every existing row stays valid and reads as
`assignment`. No backfill is required.

Rejected alternative: a separate table. More code, more drift, no benefit at this size.

## Decision 2 — The platform sets homework; the student sets assignments

v1 has no teacher role, and the roadmap defers one. So the setting authority has to come from
somewhere else. Three options were considered.

| Option | Verdict |
| --- | --- |
| Parent assigns homework | **Rejected for v1.** The roadmap defines the parent as a mentor who sees progress and nudges — not as the person who designs the work. A parent writing exercises also puts the parent in the teacher's seat, which rule 7 forbids. |
| Student assigns their own homework | **Rejected.** It collapses into Slice 1 and solves nothing. |
| **The platform assigns homework from the curriculum** | **Chosen.** |

Homework is materialised from the student's own curriculum form. A Standard 5 student gets
homework drawn from the Standard 5 topics they are actually studying. The work is *prescribed*
— the student did not choose it, cannot choose the deadline, and cannot mark it as "not needed".

This is the honest reading of a tuition platform: the syllabus sets the work, and the platform
is the syllabus. It also gives Slice 5 (guidance) real input: "you have three pieces due this
week" only means something if the student did not invent them.

**Materialisation.** A student's homework for a form is created on demand the first time they
open the homework list for that form, in one idempotent pass:

- one homework item per topic in the student's curriculum form
- due date defaults to 7 days from materialisation
- `assigned_by = 'platform'`, `kind = 'homework'`

Re-running the pass must not duplicate items. The uniqueness key is
`(student_id, topic_id, kind = 'homework')`.

A student whose form is unknown (registered before grades were stored — see the 2026-09-12 fix)
gets no materialised homework and sees an empty list with an explanation, rather than
homework for a grade they are not in.

## Decision 3 — What makes homework different

| | Assignment (Slice 1) | Homework (Slice 3) |
| --- | --- | --- |
| Who creates it | The student | The platform, from the curriculum |
| Due date | Optional | Always set |
| Deletable by the student | Yes | No — prescribed work is not theirs to remove |
| Appears in the parent mentor view | Yes | Yes, and this is its main purpose |
| Counts toward "pending" | Yes | Yes |

Both share the same submission path and the same late derivation. There is one submission
lifecycle in the codebase, not two.

## Decision 4 — What "pending" means to a parent

The parent's homework view answers one question: **what does my child still owe, and when is it
due?** It shows, per child, only items with `status = 'pending'`, ordered by due date, split
into:

- **Overdue** — `due_at` in the past, still pending
- **Due soon** — `due_at` within the next 7 days, still pending
- **Later** — everything else still pending

Submitted and late-submitted work is excluded from this view; the parent already has the full
assignment list from Slice 1 for history.

The parent sees only their own children. Siblings are shown separately and are never merged.

## Data model

```
academic_assignments   (existing, extended)
  id, student_id, topic_id, title, description, status, due_at, submitted_at,
  created_at, updated_at
  + kind        TEXT NOT NULL DEFAULT 'assignment'
                CHECK (kind IN ('assignment','homework'))
  + assigned_by TEXT NOT NULL DEFAULT 'student'
                CHECK (assigned_by IN ('student','platform'))
```

No new table.

## Routes

| Path | Role | Behavior |
| --- | --- | --- |
| `GET /api/academic/homework` | student | Own homework; materialises from the curriculum form on first call; returns overdue / due-soon / later buckets |
| `GET /api/academic/children/homework` | parent | Pending homework per own child, bucketed the same way |
| `POST /api/academic/assignments/[id]/submit` | student | Existing route, unchanged — homework submits through it |

Homework is not created or deleted over the API. It is produced by the platform only.

## Out of this spec

Holiday packages and home recordings (Slice 4). Study plans, progress analytics and student-facing
guidance (Slice 5). Teacher-authored homework. Parent-authored homework. Grading beyond what the
quiz engine already does. Notifications and reminders.

## Testing

- Materialisation is idempotent — calling it twice yields the same number of homework rows.
- A Standard 5 student gets homework from Standard 5 topics, never Standard 1.
- A student with no stored form gets no homework, and no error.
- A student cannot delete their homework through the assignment delete path.
- A student cannot see or submit another student's homework.
- Late submission is marked `late`; on-time is `submitted`; a second submission is refused.
- A parent sees pending homework for their own children only, correctly bucketed, and sees
  nothing for another family.
- A parent never sees submitted work in the pending view.
- Existing assignments keep their behaviour after the schema change (Slice 1 suite still green).

## Error handling

- No stored form: empty homework list, `200` with a reason field. Not an error.
- No curriculum topics for the form: empty list, `200`. Not an error.
- Submitting a homework item that is not the signed-in student's: `404`.
- Deleting a homework item via the assignment delete route: `404`, and the row is untouched.
- DB down: `503`. Do not silently serve an empty list.
