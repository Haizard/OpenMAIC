# The AI content platform — architecture

Date: 2026-09-13
Status: proposed (awaiting go-ahead)
Supersedes: the per-student content model in Slices 3, 4, 6 and the Slice 7 draft

## The model

**One human uploads sources. AI derives the work. Every student shares the bank. Nobody teaches.**

```
Haitham uploads a book (PDF)  ──per subject, per level
        │
        ▼
   parse → chunk → embed
        │
        ▼
   AI generates, grounded in that book:
     homework · quizzes · holiday items · readings · recording prompts
        │
        ▼
   SHARED content bank  (draft → reviewed → published)
        │
        ▼
   every student on that level draws from it —
   different questions each, mixed per student
```

There is no teacher role. Not deferred — deliberately absent. Haitham is the only human in the
content loop, and his job is to supply the source and approve what comes out of it.

## What this breaks in what already exists

This is the honest part. Four things I built assume content is authored per student.

| Built | Assumption | Under the new model |
| --- | --- | --- |
| Slice 3 homework | Materialise one row per student per **topic name** | Content comes from the bank; a homework row is *(student, shared item)* |
| Slice 4 holiday | Package claims existing per-student homework | Package picks N items from the bank |
| Slice 6 practice | 66 items I hand-authored | Generated from the uploads; my bank is a stopgap |
| Slice 7 (scoped) | Generate from a bare topic prompt | Generate **grounded in the uploaded book** — far better, and matches the real textbook |

**What survives intact, and it is the expensive part:** attempts, mastery scoring, the guidance
plan, parent views, family isolation, auth, curriculum scoping. All of that is per-student by
nature and is already built and tested (227 tests). The refactor is on the *content* side, not
the *learner* side.

## Ideas worth adding

### 1. Ground generation in the uploaded book, not the model's memory
A bare "write questions about Percentages" prompt produces generic questions. Retrieving the
actual Standard 5 chapter and generating from *that* produces questions matching the book the
student is holding. Store `source_chunk_id` on every generated item so any answer can be traced
back to the page it came from.

### 2. Refuse to generate when the source is too thin
If retrieval returns nothing usable for a topic, do not invent. Mark the topic
`needs_more_source` and surface it. A confident wrong question is worse than no question.

### 3. Provenance on every item
`source_document_id`, `source_chunk_id`, `model`, `generated_at`, `generator_version`. When a
question looks wrong you need to know which book, which chunk and which model produced it.

### 4. Keep the draft → publish gate, and add student reporting
You are the only reviewer, so add a second pair of eyes that scales: any student can flag a
question as wrong. A flagged item is **unpublished immediately** and returns to the review queue.
This is the single most valuable quality control available when there is no teacher.

### 5. Per-student mixing must be deterministic
Shuffle with a seed derived from `hash(studentId, setKey)`:
- stable across reloads — a student who refreshes sees the same questions, not a new set;
- different between students — neighbours cannot copy;
- reproducible — you can regenerate exactly what a given student saw.

Apply the same seed to **choice order**, and map the displayed index back to the true
`correct_index` at answer time. No per-student copy of the question text is needed.

### 6. Anti-repetition
Exclude items the student answered recently when building a set. Mastery should come from
seeing new questions, not re-answering the same three.

### 7. Batch, never per-request
Generation runs when a document is uploaded (or from a queue), never while a student waits.
Student requests only *select* from the bank: fast, cheap, and no model in the request path.

### 8. Coverage dashboard
Per form and topic: how many published items exist, how many drafts, how many flagged. This is
how you decide which book to upload next.

### 9. Version documents
Uploading a new edition should supersede, not silently duplicate. Keep `supersedes_id` and let
generated items point at the document version that produced them.

### 10. Licensing
Flag, do not block: generated questions derived from a copyrighted textbook are a grey area, and
extracted text stored in full is greyer. Keep chunk text minimal and be deliberate about which
books are uploaded.

## Proposed schema

```
academic_source_documents     uploaded by Haitham: subject, level/form, file, status, version
   └── academic_document_chunks    chunk_index, text, page, embedding

academic_content_items            THE SHARED BANK
   kind: homework | quiz | holiday | reading | recording_prompt
   topic_id, difficulty
   prompt/body, choices, correct_index, explanation
   source_document_id, source_chunk_id, model, generated_at
   status: draft | published | flagged | retired

academic_assignments              (existing) + content_item_id  ──> shared item
academic_practice_attempts        (existing, unchanged) per-student evidence
```

The key move: **content is shared; the attempt is per-student.** An assignment row stops carrying
its own question text and starts pointing at a bank item.

## Delivery: how a student gets their set

```
pool    = published items for (form, topics)
        − flagged or retired
        − items this student answered in the last N days

seed    = hash(studentId, setKey)      setKey = topic | package | date
set     = deterministic_shuffle(pool, seed).take(K)
choices = deterministic_shuffle(item.choices, seed)
```

## Suggested phases

| Phase | Delivers | Risk |
| --- | --- | --- |
| A — Ingest | Upload, parse, chunk, store documents | Low; nothing existing changes |
| B — Generate | Grounded generation → draft items | Medium; needs the model wiring |
| C — Review | Your queue: publish / discard / see flagged | Low |
| D — Deliver | Per-student mixing replaces per-student materialisation | **Highest** — touches tested slices |
| E — QC loop | Student reporting auto-unpublishes | Low |

A–C are additive and safe. D is the real refactor and should only start once the bank has real
content in it, so there is something to mix.

## Open questions for Haitham

1. **Upload path** — a simple admin page, or a watched folder on disk?
2. **Language** — English, Kiswahili, or both? Primary is largely Kiswahili-medium.
3. **Keep my hand-authored bank?** Useful as a fallback until enough books are uploaded.
4. **Quiz vs homework** — same bank, different `kind`, or genuinely different behaviour?
5. **How many items per student per set?** (I would start at 5–10.)
