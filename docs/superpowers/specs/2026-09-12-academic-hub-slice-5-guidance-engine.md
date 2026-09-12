# Academic Hub — Guidance engine

Date: 2026-09-12
Status: proposed
Scope of this spec: the study plan, the student's own view of their progress, the "what next"
recommendation, and the parent nudge surface. Assignments (1), reading (2), homework (3) and
holiday packages with recordings (4) are already built.

## Problem

Every slice so far gave the student a *place to do work*. None of them answered the question a
student actually opens an app asking: **what should I do right now?**

Today the learn world is four separate rooms — homework, readings, quizzes, holiday — and the
student has to walk into each one and work out for themselves what is urgent. The parent has a
slightly better deal (they see pending work), but both of them are looking at raw lists rather
than a recommendation.

The north star says the platform provides "full guidance on the student journey". Guidance is
the one pillar with nothing under it, and it is the pillar that turns the other three from a
filing cabinet into a tutor.

Slice 5 builds the map: a derived, ranked plan for today, a progress view the student owns, and
a nudge surface for the parent — all from data that already exists.

## Decision 1 — "Weak topics" is renamed to "least covered", because weakness is not measurable

The roadmap asks for a plan derived from "due work + unread material + weak topics". Two of
those three exist. The third does not, and shipping a fake version of it would be worse than
shipping none.

What I checked:

- `academic_quiz_questions` has **no `topic_id`**. Grep for it returns nothing across both the
  schema and the module. Quiz results cannot be attributed to a curriculum topic.
- `academic_quizzes.school_id` means quizzes are owned by the school world, which is parked.
  A hub student's `academic_quiz_submissions` is empty in practice.
- So there is no per-topic score anywhere in the schema. Nothing measures whether a student is
  bad at fractions.

What *is* derivable per topic is **coverage**: whether any work on it exists at all.

| Signal | Available? |
| --- | --- |
| Topic has submitted/late homework | Yes — `academic_assignments.status` joined on `topic_id` |
| Topic has a reading marked `read` | Yes — `academic_reading_progress.status` |
| Topic has quiz answers | **No** — no topic link on questions |
| Topic mastery score | **No** — nothing records it |

**Chosen: the plan ranks by coverage and says so.** A topic with no finished work on it is
surfaced as *untouched*, never as *weak*. The wording in the UI is deliberate: "You have not
started this" is a true statement the platform can defend; "You are weak at this" is not.

If per-topic mastery is wanted later, it needs a real change first — a `topic_id` on
`academic_quiz_questions` and a practice engine that writes it. That is a Practice-pillar
slice, not a Guidance one.

## Decision 2 — The plan is derived on read, never stored

A stored plan is a cache of four other tables, and every write path in Slices 1–4 would have to
invalidate it correctly. One missed invalidation gives a student a plan that tells them to do
work they have already handed in — which is precisely the failure that makes people stop
trusting a study planner.

**Chosen: no new tables.** `buildStudyPlan` is a pure read over:

| Source | Contributes |
| --- | --- |
| `academic_assignments` (homework) | overdue, due soon |
| `academic_assignments` (self-started) | overdue, due soon |
| `academic_holiday_packages` + `academic_recordings` | package items, missing takes |
| `academic_readings` + `academic_reading_progress` | in-progress and unread material |
| `curriculum_topics` / `subjects` / `forms` | what the student's form even covers |
| `academic_quiz_submissions` | a single "recent practice" signal, when any exist |

The cost is a handful of queries per page load at a scale of one student. That is not a cost
worth a cache.

## Decision 3 — One ranked list, every step carrying the reason it is there

A plan that says "do these five things" without saying why is a to-do list. The reason is what
makes it guidance, and it is also what makes the parent nudge honest.

```ts
interface PlanStep {
  kind: 'homework' | 'assignment' | 'holiday' | 'reading' | 'practice';
  title: string;
  detail: string;
  topicId: string | null;
  topicName: string | null;
  subjectName: string | null;
  reason: 'overdue' | 'due_soon' | 'missing_recording' | 'in_progress' | 'untouched' | 'no_recent_practice';
  priority: number;
  minutes: number;
  href: string;
}
```

Ranking, first sort key:

| Priority | Reason | Why it is here |
| --- | --- | --- |
| 0 | `overdue` | A deadline has passed. Nothing else matters as much. |
| 1 | `missing_recording` | Cannot be submitted at all until recorded — strictly more blocked than ordinary due-soon work, so it outranks a nearer deadline. |
| 2 | `due_soon` | Still recoverable, but the clock is running. |
| 3 | `in_progress` | Already started; finishing beats starting. |
| 4 | `untouched` | Coverage gap — the honest stand-in for "weak". |
| 5 | `no_recent_practice` | Only when there is nothing else at all. |

`missing_recording` and `due_soon` were both priority 1 in the first draft. They are not equal:
an item needing a take is *blocked*, not merely *pending*, so it ranks above ordinary due-soon
work even when that work is due sooner. The implementation sorts by priority first and only
then by date, which is what makes this hold.

Within a priority, closer deadlines first, then curriculum order so the student works through
their syllabus rather than jumping about.

**A plan is never empty.** When there is no work and no reading left, a practice step is
emitted. A student who has caught up and opens the app to a blank page has been told nothing.
How long they have been away changes the wording ("it has been N days" vs "keeps it fresh"),
not whether the step exists — an earlier draft gated this behind `STALE_ACTIVITY_DAYS` and left
a caught-up student with an empty screen.

Minutes come from `academic_readings.reading_minutes` where it exists and a fixed per-kind
estimate otherwise. They are an estimate for planning a session, not a measurement.

## Decision 4 — "What next" is the first step; the plan is the rest

The roadmap asks for both a "what next" recommendation and a study plan. These are the same
function with a different limit, so they are the same endpoint: `/api/academic/plan` returns the
full ranked list, and the caller takes what it needs.

- `/learn` shows the single top step as an "Up next" card with the reason.
- `/learn/plan` shows the whole list with a progress summary.

One function, two views, no second source of truth to drift.

## Decision 5 — Parent nudges use the same builder

`listNudgesForParent` calls the same per-student computation for each child and reduces it to
what a mentor can act on: how much is overdue, how many recordings are missing, how many topics
have never been touched, and how many days since the last finished thing.

The parent never sees a grade or a ranking of subjects. Rule 7: the parent mentors, they do not
mark. A nudge is a sentence, not a score.

## Data model

None. This slice adds no tables. See Decision 2.

## Routes

| Route | Role | Notes |
| --- | --- | --- |
| `GET /api/academic/plan` | student | full ranked plan + progress summary |
| `GET /api/academic/children/nudges` | parent | per-child nudge summary |

## Out of this spec

- Per-topic mastery scoring. Blocked on a `topic_id` on quiz questions (Decision 1).
- Spaced repetition or a scheduled curriculum sequence. The plan reacts to state; it does not
  keep a long-horizon syllabus model.
- Push notification or email delivery of a nudge. Nudges are shown in the app.
- Marking a plan step done from the plan page. The step links to the room where the work lives.
- Anything in the School world (parked).

## Testing

`tests/academic/guidance.test.ts`:

- an overdue item outranks a due-soon one, which outranks an untouched topic;
- a package item missing its recording outranks ordinary due-soon work;
- a topic with no finished work appears as `untouched` and never as `weak`;
- a topic with a submitted assignment or a read reading does **not** appear as untouched;
- `no_recent_practice` is emitted only when there is no other work;
- **student A's plan contains none of student B's items** (the roadmap's explicit test);
- a student with no stored grade gets `reason: 'no_form'` and an empty plan;
- parent nudges cover only that parent's children; another parent's nudge list is empty;
- the plan is a pure read: running it twice with no writes in between returns the same steps.

## Error handling

| Case | Behaviour |
| --- | --- |
| No stored curriculum form | `reason: 'no_form'`, empty steps — same as Slices 3 and 4 |
| Parent with no children | empty nudge list |
| School session on either route | `403` (rule 1) |
| Unauthenticated | `401` |
