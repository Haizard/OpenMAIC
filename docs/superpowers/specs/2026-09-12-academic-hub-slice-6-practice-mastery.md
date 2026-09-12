# Academic Hub — Practice drills + topic mastery

Date: 2026-09-12
Status: proposed
Scope of this spec: a topic-linked practice item bank, the drill loop with immediate feedback,
a per-topic mastery signal, and wiring that signal into the Slice 5 guidance engine. Slices 0–5
are already built.

## Problem

Slice 5 closed the Guidance pillar but hit a wall it documented rather than papered over: it
could rank by *coverage* (has this topic been touched?) but not by *mastery* (is the student
actually any good at it?). The reason is structural — `academic_quiz_questions` has no
`topic_id`, and quizzes belong to the parked school world.

Meanwhile Practice, one of the four pillars, has almost nothing under it. There is a quiz engine
a hub student cannot meaningfully use, and no way to drill a topic and see whether it is landing.

Both problems have the same fix: **a practice attempt that is attributable to a curriculum
topic.** Once an attempt names a topic, a score becomes a mastery signal, and mastery turns
Slice 5's stand-in into the real thing.

## Decision 1 — Practice items are topic-linked from day one

This is the whole point of the slice, so it is a schema requirement rather than a nice-to-have.

```
academic_practice_items
  id, topic_id -> curriculum_topics ON DELETE CASCADE,
  prompt, choices JSONB, correct_index INTEGER, explanation, sort_order, published

academic_practice_attempts
  id, student_id -> academic_students ON DELETE CASCADE,
  item_id -> academic_practice_items ON DELETE CASCADE,
  correct BOOLEAN, answered_at
```

Rejected alternative: reuse `academic_quiz_*`. Those tables are keyed to `academic_schools` and
carry a submission/grading lifecycle built for a teacher marking a paper. Bolting a `topic_id`
onto `academic_quiz_questions` would drag school-owned data into the learn world, which rule 1
forbids, and would make every practice query carry a school join. A separate small pair of
tables is less code than that contortion.

## Decision 2 — Every attempt is a row; mastery reads the recent window

An attempt is append-only. There is no "current answer" to update, which means a re-drill
produces new evidence instead of overwriting history, and a mistaken click is visible as a
mistake rather than erased.

Mastery is computed over the **last `MASTERY_WINDOW` attempts per topic** (10), and only reported
once a topic has at least `MIN_ATTEMPTS_FOR_MASTERY` (4). Below that there is not enough
evidence to call anything, and saying "weak" on the strength of one wrong answer would be
exactly the kind of unfounded claim Slice 5 refused to make about coverage.

| Accuracy | Label |
| --- | --- |
| `< 0.6` | `weak` |
| `0.6 – 0.8` | `developing` |
| `>= 0.8` | `strong` |

A topic with no attempts is `unknown`, which is a different statement from `weak` and is never
rendered as one.

## Decision 3 — The bank is partial, and the UI admits it

The curriculum holds roughly 148 topics and only 21 have any authored content. Writing a full
bank is a content project, not a slice.

**Chosen: v1 ships Mathematics and Science drills** — primary Mathematics (all forms), primary
Science, Form 1–2 Mathematics, Form 1 Physics — and the drill page only offers topics that have
items. A topic with no bank coverage falls back to Slice 5's coverage signal.

**The empty state must not lie.** "Nothing to practise here yet" is an honest empty state;
"you have finished all practice" is not, and is forbidden. This is the same instinct as calling
an untouched topic untouched rather than weak.

## Decision 4 — Mastery enters the plan below deadlines, capped

Where does a weak topic rank against homework that is due soon?

**Chosen: `weak_topic` sits just below `due_soon`, and at most two weak-topic steps appear in a
plan.** A deadline resolves itself — the work gets handed in or it goes late — whereas a weak
topic is a gap that persists until someone does something about it. But burying five overdue
items under a wall of drills would be worse, hence the cap.

```
0 overdue
1 missing_recording
2 due_soon
3 weak_topic        <- new
4 in_progress
5 untouched
6 no_recent_practice
```

`weak_topic` steps point at `/learn/practice?topic=<id>`.

## Decision 5 — The drill is self-marking and immediate

Multiple choice with the correct answer and a short explanation stored on the item. The student
answers, sees whether they were right and why, and moves on. No teacher, no grading queue, no
`status` lifecycle — this is drill, not assessment, and it must not feel like an exam.

Essay and free-text practice is out of scope precisely because it cannot be self-marked.

## Data model

```
curriculum_topics
     │  topic_id  (the link that makes a score mean anything)
     ▼
academic_practice_items ──< academic_practice_attempts >── academic_students
```

## Routes

| Route | Role | Notes |
| --- | --- | --- |
| `GET /api/academic/practice/topics` | student | topics with a bank, plus per-topic mastery |
| `GET /api/academic/practice/items?topicId=` | student | the drill for one topic |
| `POST /api/academic/practice/items/[id]/answer` | student | records the attempt, returns correctness |
| `GET /api/academic/children/practice` | parent | per-child practice activity and weak topics |

## Out of this spec

- Free-text or essay practice (cannot be self-marked).
- Spaced repetition scheduling. Mastery is reported; it does not yet drive *when* to re-drill.
- Adaptive difficulty. One bank per topic in v1.
- Practice outside Mathematics and Science (Decision 3).
- Anything in the School world (parked).

## Testing

`tests/academic/practice.test.ts`:

- answering correctly records a correct attempt and returns the explanation;
- answering wrongly records a wrong attempt;
- a topic below `MIN_ATTEMPTS_FOR_MASTERY` reports `unknown`, never `weak`;
- a topic is `weak` below the threshold and `strong` above it;
- mastery uses only the recent window, so a topic improved after a bad start recovers;
- **mastery for student A is unaffected by student B's attempts** (isolation);
- a parent sees only their own children's practice;
- a topic with no bank items is absent from the drill list, and the empty state is honest;
- answering another student's item id is refused.
