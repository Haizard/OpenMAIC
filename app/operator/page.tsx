'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Upload } from 'lucide-react';

/**
 * The operator console — the single place content enters the platform.
 *
 * There is no teacher account and no content editor for anyone else: Haitham authenticates
 * with `ACADEMIC_OPERATOR_TOKEN`, uploads a textbook for a form and subject, and everything a
 * student is ever given is generated from what lands here.
 */

const TOKEN_KEY = 'academic_operator_token';

interface CoverageRow {
  levelId: string;
  levelName: string;
  formId: string;
  formName: string;
  subjectId: string;
  subjectName: string;
  documentCount: number;
  chunkCount: number;
  charCount: number;
  edition: string | null;
  language: string | null;
  uploadedAt: string | null;
}

interface TopicRef {
  id: string;
  name: string;
}

interface ContentCoverageRow {
  levelName: string;
  formName: string;
  subjectId: string;
  subjectName: string;
  draft: number;
  published: number;
  flagged: number;
  retired: number;
  total: number;
}

interface ContentItem {
  id: string;
  subjectId: string;
  topicId: string | null;
  kind: string;
  language: string;
  prompt: string;
  choices: string[] | null;
  correctIndex: number | null;
  explanation: string;
  status: string;
  model: string | null;
  generatedAt: string | null;
}

export default function OperatorPage() {
  const [token, setToken] = useState('');
  const [tokenReady, setTokenReady] = useState(false);
  const [coverage, setCoverage] = useState<CoverageRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [subjectId, setSubjectId] = useState('');
  const [title, setTitle] = useState('');
  const [edition, setEdition] = useState('');
  const [language, setLanguage] = useState('en');
  const [licenseNote, setLicenseNote] = useState('');
  const [pasted, setPasted] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [topics, setTopics] = useState<TopicRef[]>([]);
  const [genSubject, setGenSubject] = useState('');
  const [genTopic, setGenTopic] = useState('');
  const [genKind, setGenKind] = useState('homework');
  const [genLanguage, setGenLanguage] = useState('en');
  const [genCount, setGenCount] = useState(8);
  const [generating, setGenerating] = useState(false);

  const [drafts, setDrafts] = useState<ContentItem[]>([]);
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);
  const [contentCoverage, setContentCoverage] = useState<ContentCoverageRow[]>([]);

  useEffect(() => {
    const stored = window.localStorage.getItem(TOKEN_KEY);
    if (stored) {
      setToken(stored);
      setTokenReady(true);
    }
  }, []);

  const loadCoverage = useCallback(async (activeToken: string) => {
    setLoading(true);
    setError(null);
    try {
      const [sourceResponse, contentResponse] = await Promise.all([
        fetch('/api/academic/operator/coverage', {
          headers: { 'x-academic-operator-token': activeToken },
        }),
        fetch('/api/academic/operator/content?view=coverage', {
          headers: { 'x-academic-operator-token': activeToken },
        }),
      ]);
      const data = await sourceResponse.json();
      if (data.success) {
        setCoverage(data.coverage as CoverageRow[]);
      } else {
        setError(data.error ?? 'Could not load coverage');
        if (sourceResponse.status === 401) {
          window.localStorage.removeItem(TOKEN_KEY);
          setTokenReady(false);
        }
      }
      if (contentResponse.ok) {
        const contentData = await contentResponse.json();
        if (contentData.success) setContentCoverage(contentData.coverage as ContentCoverageRow[]);
      }
    } catch {
      setError('Could not reach the server');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tokenReady && token) void loadCoverage(token);
  }, [tokenReady, token, loadCoverage]);

  const loadDrafts = useCallback(async (activeToken: string) => {
    const response = await fetch('/api/academic/operator/content?status=draft', {
      headers: { 'x-academic-operator-token': activeToken },
    });
    const data = await response.json();
    if (data.success) setDrafts(data.items as ContentItem[]);
  }, []);

  useEffect(() => {
    if (tokenReady && token) void loadDrafts(token);
  }, [tokenReady, token, loadDrafts]);

  useEffect(() => {
    if (!tokenReady || !token || !genSubject) {
      setTopics([]);
      return;
    }
    void (async () => {
      const response = await fetch(
        `/api/academic/operator/topics?subjectId=${encodeURIComponent(genSubject)}`,
        { headers: { 'x-academic-operator-token': token } },
      );
      const data = await response.json();
      setTopics(data.success ? (data.topics as TopicRef[]) : []);
    })();
  }, [tokenReady, token, genSubject]);

  const generate = async (event: React.FormEvent) => {
    event.preventDefault();
    setReviewMessage(null);
    setError(null);
    setGenerating(true);
    try {
      const response = await fetch('/api/academic/operator/content', {
        method: 'POST',
        headers: {
          'x-academic-operator-token': token,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          subjectId: genSubject,
          ...(genTopic ? { topicId: genTopic } : {}),
          kind: genKind,
          language: genLanguage,
          count: genCount,
        }),
      });
      const data = await response.json();
      if (!data.success) {
        setError(data.message ?? data.error ?? 'Generation failed');
        return;
      }
      setReviewMessage(`${data.items.length} drafts generated. Review them below.`);
      await loadDrafts(token);
    } catch {
      setError('Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const review = async (id: string, action: 'publish' | 'discard') => {
    setReviewMessage(null);
    const response = await fetch(`/api/academic/operator/content/${id}`, {
      method: 'PATCH',
      headers: {
        'x-academic-operator-token': token,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ action }),
    });
    const data = await response.json();
    if (!data.success) {
      setError(data.error ?? 'Update failed');
      return;
    }
    await loadDrafts(token);
  };

  const subjects = useMemo(
    () =>
      coverage.map((row) => ({
        id: row.subjectId,
        label: `${row.levelName} · ${row.formName} · ${row.subjectName}`,
      })),
    [coverage],
  );

  const submitToken = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = token.trim();
    if (!trimmed) return;
    window.localStorage.setItem(TOKEN_KEY, trimmed);
    setToken(trimmed);
    setTokenReady(true);
  };

  const upload = async (event: React.FormEvent) => {
    event.preventDefault();
    setNotice(null);
    setError(null);
    if (!subjectId || !title.trim()) {
      setError('Pick a subject and give the book a title');
      return;
    }
    if (!file && pasted.trim() === '') {
      setError('Choose a PDF or paste some text');
      return;
    }

    const body = new FormData();
    const row = coverage.find((entry) => entry.subjectId === subjectId);
    body.set('formId', row?.formId ?? '');
    body.set('subjectId', subjectId);
    body.set('title', title.trim());
    body.set('language', language);
    if (edition.trim()) body.set('edition', edition.trim());
    if (licenseNote.trim()) body.set('licenseNote', licenseNote.trim());
    if (file) body.set('file', file);
    else body.set('text', pasted);

    setUploading(true);
    try {
      const response = await fetch('/api/academic/operator/sources', {
        method: 'POST',
        headers: { 'x-academic-operator-token': token },
        body,
      });
      const data = await response.json();
      if (!data.success) {
        setError(data.error ?? 'Upload failed');
        return;
      }
      setNotice(
        data.reused
          ? 'Already in the library — nothing changed.'
          : `Ingested ${data.document.chunkCount} chunks${
              data.supersededDocumentId ? ' and superseded the previous edition' : ''
            }.`,
      );
      setTitle('');
      setEdition('');
      setLicenseNote('');
      setPasted('');
      setFile(null);
      await loadCoverage(token);
    } catch {
      setError('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (!tokenReady) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
        <h1 className="text-xl font-semibold">Operator console</h1>
        <p className="text-sm text-muted-foreground">
          Enter the operator token (server env <code>ACADEMIC_OPERATOR_TOKEN</code>). This console
          is the only place content enters the platform.
        </p>
        <form onSubmit={submitToken} className="flex flex-col gap-3">
          <input
            type="password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Operator token"
            className="rounded-md border px-3 py-2 text-sm"
          />
          <Button type="submit">Continue</Button>
        </form>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Operator console</h1>
          <p className="text-sm text-muted-foreground">
            Upload a textbook per form and subject. Everything students receive is generated from
            these documents.
          </p>
        </div>
        <Button variant="ghost" onClick={() => window.history.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>

      <section className="mb-8 rounded-lg border p-4">
        <h2 className="mb-3 text-lg font-medium">Add a source document</h2>
        <form onSubmit={upload} className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Subject
            <select
              value={subjectId}
              onChange={(event) => setSubjectId(event.target.value)}
              className="rounded-md border px-3 py-2"
            >
              <option value="">Select…</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Primary Mathematics 5"
              className="rounded-md border px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Edition (optional)
            <input
              value={edition}
              onChange={(event) => setEdition(event.target.value)}
              placeholder="2026"
              className="rounded-md border px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Language
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              className="rounded-md border px-3 py-2"
            >
              <option value="en">English</option>
              <option value="sw">Kiswahili</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            Licence note (optional)
            <input
              value={licenseNote}
              onChange={(event) => setLicenseNote(event.target.value)}
              placeholder="Purchased copy, internal use only"
              className="rounded-md border px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            PDF or text file
            <input
              type="file"
              accept=".pdf,.txt,.md,text/plain"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="rounded-md border px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            Or paste text
            <textarea
              value={pasted}
              onChange={(event) => setPasted(event.target.value)}
              rows={5}
              className="rounded-md border px-3 py-2"
            />
          </label>

          <div className="md:col-span-2">
            <Button type="submit" disabled={uploading}>
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Ingest document
            </Button>
          </div>
        </form>
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        {notice ? <p className="mt-3 text-sm text-emerald-700">{notice}</p> : null}
      </section>

      <section className="mb-8 rounded-lg border p-4">
        <h2 className="mb-3 text-lg font-medium">Generate from the source</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Items are generated only from the uploaded book for that subject, and land as drafts.
        </p>
        <form onSubmit={generate} className="grid gap-3 md:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            Subject
            <select
              value={genSubject}
              onChange={(event) => {
                setGenSubject(event.target.value);
                setGenTopic('');
              }}
              className="rounded-md border px-3 py-2"
            >
              <option value="">Select…</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Topic (optional)
            <select
              value={genTopic}
              onChange={(event) => setGenTopic(event.target.value)}
              className="rounded-md border px-3 py-2"
            >
              <option value="">Whole subject</option>
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Kind
            <select
              value={genKind}
              onChange={(event) => setGenKind(event.target.value)}
              className="rounded-md border px-3 py-2"
            >
              <option value="homework">Homework</option>
              <option value="quiz">Quiz</option>
              <option value="practice">Practice</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Language
            <select
              value={genLanguage}
              onChange={(event) => setGenLanguage(event.target.value)}
              className="rounded-md border px-3 py-2"
            >
              <option value="en">English</option>
              <option value="sw">Kiswahili</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Questions
            <input
              type="number"
              min={1}
              max={20}
              value={genCount}
              onChange={(event) => setGenCount(Number(event.target.value))}
              className="rounded-md border px-3 py-2"
            />
          </label>

          <div className="flex items-end">
            <Button type="submit" disabled={generating || !genSubject}>
              {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Generate
            </Button>
          </div>
        </form>
      </section>

      <section className="mb-8 rounded-lg border p-4">
        <h2 className="mb-3 text-lg font-medium">Review drafts ({drafts.length})</h2>
        {reviewMessage ? <p className="mb-3 text-sm text-emerald-700">{reviewMessage}</p> : null}
        {drafts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No drafts waiting.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {drafts.map((item) => (
              <li key={item.id} className="rounded-md border p-3">
                <p className="text-sm font-medium">{item.prompt}</p>
                {item.choices ? (
                  <ol className="mt-2 list-inside list-decimal text-sm text-muted-foreground">
                    {item.choices.map((choice, index) => (
                      <li key={index} className={index === item.correctIndex ? 'font-medium' : ''}>
                        {choice}
                      </li>
                    ))}
                  </ol>
                ) : null}
                <p className="mt-2 text-xs text-muted-foreground">
                  {item.kind} · {item.language} · {item.model ?? 'unknown model'} · correct answer
                  shown in bold
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{item.explanation}</p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => review(item.id, 'publish')}>
                    Publish
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => review(item.id, 'discard')}>
                    Discard
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-1 text-lg font-medium">Content coverage</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Published is the only column a student can see. The gap between draft and published is
          how much is waiting on you.
        </p>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2">Level</th>
                <th className="px-3 py-2">Form</th>
                <th className="px-3 py-2">Subject</th>
                <th className="px-3 py-2 text-right">Draft</th>
                <th className="px-3 py-2 text-right">Published</th>
                <th className="px-3 py-2 text-right">Flagged</th>
                <th className="px-3 py-2 text-right">Retired</th>
              </tr>
            </thead>
            <tbody>
              {contentCoverage.map((row) => (
                <tr key={row.subjectId} className="border-t">
                  <td className="px-3 py-2">{row.levelName}</td>
                  <td className="px-3 py-2">{row.formName}</td>
                  <td className="px-3 py-2">{row.subjectName}</td>
                  <td className="px-3 py-2 text-right">{row.draft}</td>
                  <td className="px-3 py-2 text-right">{row.published}</td>
                  <td className="px-3 py-2 text-right">{row.flagged}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{row.retired}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Source coverage</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2">Level</th>
                  <th className="px-3 py-2">Form</th>
                  <th className="px-3 py-2">Subject</th>
                  <th className="px-3 py-2 text-right">Docs</th>
                  <th className="px-3 py-2 text-right">Chunks</th>
                  <th className="px-3 py-2 text-right">Chars</th>
                  <th className="px-3 py-2">Edition</th>
                </tr>
              </thead>
              <tbody>
                {coverage.map((row) => (
                  <tr key={row.subjectId} className="border-t">
                    <td className="px-3 py-2">{row.levelName}</td>
                    <td className="px-3 py-2">{row.formName}</td>
                    <td className="px-3 py-2">{row.subjectName}</td>
                    <td className="px-3 py-2 text-right">{row.documentCount}</td>
                    <td className="px-3 py-2 text-right">{row.chunkCount}</td>
                    <td className="px-3 py-2 text-right">{row.charCount.toLocaleString()}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.edition ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
