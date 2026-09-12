# Academic Hub — Holiday packages + home recording

Date: 2026-09-12
Status: proposed
Scope of this spec: a holiday package that bundles homework over a date range, the student
recording required parts of it, and the parent mentor view of what is missing. The guidance
engine is Slice 5. Assignments (Slice 1), the reading library (Slice 2) and homework (Slice 3)
are already built.

## Problem

Slice 3 made homework real: the platform prescribes one item per topic in the student's own
curriculum form, and the parent sees what is outstanding. But it has two gaps that matter for a
tuition product.

1. **There is no calendar.** Homework appears the moment the student opens the page, one item
   per topic, forever. A school year is not like that. Over a long break a student should get a
   *package*: a named block of work with a start and an end, due at the end of the break.
2. **Some work is not text.** A big part of tuition is spoken: reading aloud, explaining a
   method, answering in Kiswahili or English. Today the only thing a student can submit is
   typed work, so the platform cannot see the thing a tutor would most want to hear.

Slice 4 closes both: a holiday package groups work over a date range, and a required part of
that work is answered by recording audio or video at home.

## Decision 1 — A package groups existing homework; it is not a second kind of work

**Chosen: `academic_holiday_packages` plus two columns on `academic_assignments`.**

A package needs a name, a date range, and a set of items. The items themselves are already
homework: same title, same curriculum topic, same submission lifecycle, same parent join. This
is the same argument Slice 3 made for `kind`, and it applies again here.

```
academic_holiday_packages
  id, student_id, slug, title, description, starts_on, ends_on, created_at
  UNIQUE (student_id, slug)

academic_assignments
  + package_id TEXT                                  -- NULL = ordinary homework
  + requires_recording BOOLEAN NOT NULL DEFAULT false
```

Crucially, **materialising a package does not create new homework rows — it claims existing
ones.** Slice 3 already materialises one homework item per topic of the student's form, guarded
by `UNIQUE (student_id, topic_id) WHERE kind = 'homework'`. If a package inserted its own rows
for the same topics, every one of them would collide with that index. So a package instead:

1. materialises homework (no-op if already present),
2. selects the form's topics in a deterministic slice owned by that package,
3. sets `package_id` and `requires_recording` on those rows, and moves `due_at` to the
   package end date.

**Only `pending` items are claimed.** An item the student already submitted stays ordinary
homework — re-issuing completed work into a holiday package would silently reset progress.

`package_id` deliberately has **no foreign key**. The migration runner splits SQL on `;`, so an
`ALTER TABLE ... REFERENCES` cannot be made idempotent through it, and the assignment schema is
ensured before the package schema exists in several call paths. This is the same trade-off
already accepted for `academic_students.curriculum_form_id`. Packages are never deleted in v1,
so the missing cascade has no reachable consequence.

Rejected alternative: a `package_items` join table. It would let one topic appear in several
packages, but that immediately breaks the homework unique index, and the join buys nothing at
this size.

## Decision 2 — Recording bytes live in academic-owned tables, not the shared asset store

The roadmap says "use existing OpenMAIC media/persistence, scoped to the student account". I
investigated that layer and **it cannot satisfy this slice's own acceptance test.** Recording
the finding matters more than following the letter of the line.

What the existing layer actually does:

- `PgAssetStore` partitions every entry on `principal.key` only. `learnerKey` is carried on the
  principal object but `packages/@openmaic/storage/src/asset/pg.ts` never reads it — it appears
  in no partition predicate, index, or ownership check.
- `lib/persistence/server-auth.ts` maps **every** caller to one constant
  `SHARED_ASSET_PRINCIPAL = 'shared'`. Its own docstring says it "provides no confidentiality
  and no user isolation".
- So two families' assets share one partition, and a valid asset id resolves for any caller.

The roadmap requires the test *"parent cannot watch another family's recordings"*. The shared
store cannot express that, and retrofitting it means replacing the deployment's authenticator —
which is explicitly out of scope ("production must replace this module with real session
verification", deferred since Slice 0). Separately, `PgAssetStore` needs a `withTransaction`
over a real `pg` Pool, while the academic suite runs on PGlite with a query-only handle, so
nothing built on it could be unit-tested.

**Chosen: two academic-owned tables, with an explicit ownership check on every read.**

```
academic_recording_bytes             -- content-addressed bytes, never SELECTed by list queries
  hash TEXT PRIMARY KEY, mime TEXT NOT NULL, bytes BYTEA NOT NULL,
  byte_length INTEGER NOT NULL, created_at TIMESTAMPTZ

academic_recordings                  -- the ownership-bearing reference row
  id, assignment_id -> academic_assignments ON DELETE CASCADE,
  student_id       -> academic_students   ON DELETE CASCADE,
  byte_hash        -> academic_recording_bytes ON DELETE RESTRICT,
  mime, byte_length, kind CHECK (kind IN ('audio','video')), created_at
  UNIQUE (assignment_id)             -- one current recording per item; re-record replaces
```

The design deliberately copies the *discipline* of the OpenMAIC asset layer without its shared
partition:

- bytes are content-hash addressed and stored in their own table, so listing a package never
  pulls megabytes of `bytea`;
- **request paths never delete bytes.** Re-recording replaces the `academic_recordings` row and
  leaves the old byte row orphaned, exactly as the asset store leaves orphans for its offline
  collector. A reclamation job is future work.
- a read that is not authorised returns `null`, indistinguishable from "no such recording", so
  the endpoint is not an existence oracle.

`AcademicMediaStore` is the seam: the byte table is the v1 backend, and swapping in S3 later
means reimplementing one module, not touching callers.

## Decision 3 — Who creates a package, and when

Same authority as homework, for the same reason: **the platform**, from the student's own
curriculum form. Parent-authored packages are rejected (rule 7 — the parent mentors, they do not
design work). Student-authored packages collapse into Slice 1.

A package is materialised when `now` falls inside its window, or within 14 days before it
starts. Each catalogue entry owns a deterministic slice of the form's topics, so no two packages
ever claim the same topic:

| slug | window | topic offset | topics | recordings required |
| --- | --- | --- | --- | --- |
| `june-break` | Jun 1 – Jun 30 | 0 | 3 | 1 |
| `august-break` | Aug 1 – Aug 31 | 3 | 3 | 1 |
| `december-break` | Dec 1 – Jan 5 | 6 | 3 | 2 |

A form with fewer topics than an offset simply yields an empty package, which is skipped
rather than created.

## Decision 4 — Completeness is enforced at submit time, not derived at read time

A package is complete when every claimed item is submitted. An item with
`requires_recording = true` **cannot be submitted until a recording exists** — the gate lives in
`submitAssignment`, which throws `ValidationError` rather than letting a text-only submission
through. Because the gate is on the write path, "a package is incomplete while a required
recording is missing" is true by construction and cannot drift out of sync with a display rule.

The read side still reports `recordingsRequired`, `recordingsDone` and `missingItemIds` so the
parent nudge can say *what* is missing, not just that something is.

The gate applies only where `requires_recording` is true. Every pre-Slice-4 row defaults to
`false`, so Slice 1 and Slice 3 behaviour is untouched.

## Data model

```
academic_holiday_packages (student_id, slug, title, description, starts_on, ends_on)
        │
        │  package_id  (no FK — see Decision 1)
        ▼
academic_assignments  (kind='homework', requires_recording, package_id)
        │
        │  assignment_id  UNIQUE
        ▼
academic_recordings  (student_id, byte_hash, mime, byte_length, kind)
        │
        │  byte_hash  ON DELETE RESTRICT
        ▼
academic_recording_bytes  (hash PK, bytes BYTEA)
```

## Routes

| Route | Role | Notes |
| --- | --- | --- |
| `GET /api/academic/holiday-packages` | student | materialises on demand, then returns packages with completion |
| `POST /api/academic/assignments/[id]/recording` | student | raw body = bytes, `Content-Type` = mime; replaces any existing take |
| `GET /api/academic/recordings/[id]` | student / parent | ownership-checked byte stream |
| `GET /api/academic/children/holiday-packages` | parent | per-child completion and missing recordings |

`GET /api/academic/recordings/[id]` resolves the viewer from the session: a student may read
their own recording; a parent may read a recording whose owner is their child
(`academic_students.parent_id`). Anyone else gets `404`. A `school` session gets `403` — rule 1.

Uploads are capped at **25 MB** and restricted to an allowlist
(`audio/webm`, `audio/mp4`, `audio/mpeg`, `audio/ogg`, `audio/wav`, `video/webm`, `video/mp4`).
Responses carry `X-Content-Type-Options: nosniff` and a type outside the allowlist is served as
an attachment, never inline.

## Out of this spec

- Transcription or automated marking of a recording. A human (parent/tutor) reviews it.
- Streaming/range requests. The whole blob is served; recordings are short by construction.
- Byte reclamation of orphaned takes.
- Push notifications / email for the mentor nudge. The nudge is a state shown in the parent UI.
- Anything in the School world (parked).

## Testing

`tests/academic/holiday.test.ts`:

- materialising twice creates one package (idempotent);
- a package claims only `pending` items — a submitted item is untouched;
- an item with `requires_recording` throws on submit without a recording, and succeeds after;
- completeness is `false` while a required recording is missing and `true` once all are in;
- a package outside its date window is not materialised;
- parent sees own child's packages; a second parent sees none;
- `getRecordingForViewer`: owner student → bytes; parent of owner → bytes; unrelated parent →
  `null`; unrelated student → `null`; school session → refused;
- recording listing never contains another family's recording;
- mime outside the allowlist is rejected; oversized upload is rejected.

## Error handling

| Case | Behaviour |
| --- | --- |
| No stored curriculum form | `reason: 'no_form'`, empty result — same as Slice 3 |
| Submit without a required recording | `ValidationError` → `400` with the item id |
| Upload over 25 MB | `413` |
| Disallowed media type | `415` |
| Recording not owned by viewer | `404` (never `403` — no existence oracle) |
| School session on any learn route | `403` (rule 1) |
