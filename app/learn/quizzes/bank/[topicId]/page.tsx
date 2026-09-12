'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, XCircle } from 'lucide-react';

/**
 * Sitting a bank-backed quiz.
 *
 * The questions come from the shared bank in this student's own order, and the answers are graded
 * on the server: the page only ever sends the position that was clicked.
 */

interface Question {
  itemId: string;
  prompt: string;
  choices: string[];
}

interface Review {
  itemId: string;
  prompt: string;
  choices: string[];
  yourIndex: number | null;
  correctIndex: number | null;
  explanation: string;
  correct: boolean;
}

interface Result {
  score: number;
  maxScore: number;
  review: Review[];
}

export default function TakeBankQuizPage() {
  const router = useRouter();
  const params = useParams<{ topicId: string }>();
  const topicId = params.topicId as string;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/academic/quizzes/bank/${topicId}/start`, {
        method: 'POST',
      });
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      const data = await response.json();
      if (!data.success) {
        setError(data.error ?? 'That quiz is not ready yet');
        return;
      }
      setQuestions(data.questions as Question[]);
    } catch {
      setError('Could not reach the server');
    } finally {
      setLoading(false);
    }
  }, [topicId, router]);

  useEffect(() => {
    void start();
  }, [start]);

  const submit = async () => {
    if (submitting || result) return;
    setSubmitting(true);
    try {
      const response = await fetch(`/api/academic/quizzes/bank/${topicId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: Object.entries(answers).map(([itemId, choiceIndex]) => ({
            itemId,
            choiceIndex,
          })),
        }),
      });
      const data = await response.json();
      if (!data.success) {
        setError(data.error ?? 'Could not mark the quiz');
        return;
      }
      setResult(data as Result);
    } catch {
      setError('Could not mark the quiz');
    } finally {
      setSubmitting(false);
    }
  };

  const current = questions[index];
  const chosen = current ? answers[current.itemId] : undefined;
  const answeredCount = questions.filter((question) => answers[question.itemId] !== undefined).length;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading quiz…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 p-6">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={() => router.push('/learn/quizzes')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to quizzes
        </Button>
      </div>
    );
  }

  if (result) {
    const percent = Math.round((result.score / Math.max(result.maxScore, 1)) * 100);
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <header className="border-b border-border/60 bg-white px-6 py-4 dark:bg-slate-900">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.push('/learn/quizzes')}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
            <h1 className="text-lg font-semibold text-foreground">Your result</h1>
          </div>
        </header>

        <main className="mx-auto max-w-3xl p-6">
          <div className="mb-6 rounded-xl border border-border/60 bg-white p-6 text-center dark:bg-slate-900">
            <div className="text-3xl font-bold text-foreground">
              {result.score}/{result.maxScore}
            </div>
            <div className="text-sm text-muted-foreground">{percent}%</div>
          </div>

          <ul className="flex flex-col gap-4">
            {result.review.map((entry, position) => (
              <li
                key={entry.itemId}
                className="rounded-xl border border-border/60 bg-white p-5 dark:bg-slate-900"
              >
                <div className="mb-2 flex items-start gap-2">
                  {entry.correct ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  )}
                  <p className="text-sm font-medium text-foreground">
                    {position + 1}. {entry.prompt}
                  </p>
                </div>
                <ol className="ml-6 flex flex-col gap-1 text-sm">
                  {entry.choices.map((choice, choiceIndex) => {
                    const isCorrect = choiceIndex === entry.correctIndex;
                    const isYours = choiceIndex === entry.yourIndex;
                    return (
                      <li
                        key={choiceIndex}
                        className={
                          isCorrect
                            ? 'font-medium text-emerald-700'
                            : isYours
                              ? 'text-destructive'
                              : 'text-muted-foreground'
                        }
                      >
                        {choice}
                        {isYours ? ' (your answer)' : ''}
                        {isCorrect ? ' ✓' : ''}
                      </li>
                    );
                  })}
                  {entry.yourIndex === null ? (
                    <li className="text-xs text-muted-foreground">You left this blank.</li>
                  ) : null}
                </ol>
                {entry.explanation ? (
                  <p className="ml-6 mt-2 text-xs text-muted-foreground">{entry.explanation}</p>
                ) : null}
              </li>
            ))}
          </ul>

          <div className="mt-6">
            <Button onClick={() => router.push('/learn/quizzes')}>Done</Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <header className="border-b border-border/60 bg-white px-6 py-4 dark:bg-slate-900">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.push('/learn/quizzes')}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Topic quiz</h1>
              <p className="text-sm text-muted-foreground">
                Question {index + 1} of {questions.length}
              </p>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">{answeredCount} answered</div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl p-6">
        {current ? (
          <div className="rounded-xl border border-border/60 bg-white p-6 dark:bg-slate-900">
            <p className="mb-4 text-base font-medium text-foreground">{current.prompt}</p>
            <div className="flex flex-col gap-2">
              {current.choices.map((choice, choiceIndex) => (
                <button
                  key={choiceIndex}
                  type="button"
                  onClick={() =>
                    setAnswers((prev) => ({ ...prev, [current.itemId]: choiceIndex }))
                  }
                  className={`rounded-md border px-4 py-3 text-left text-sm transition-colors ${
                    chosen === choiceIndex
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                      : 'hover:bg-muted/50'
                  }`}
                >
                  {choice}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-6 flex items-center justify-between">
          <Button
            variant="outline"
            disabled={index === 0}
            onClick={() => setIndex((prev) => Math.max(0, prev - 1))}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>

          {index < questions.length - 1 ? (
            <Button onClick={() => setIndex((prev) => Math.min(questions.length - 1, prev + 1))}>
              Next
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={submit} disabled={submitting}>
              {submitting ? 'Marking…' : 'Submit quiz'}
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
