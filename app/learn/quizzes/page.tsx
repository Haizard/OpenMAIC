'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FileQuestion, Clock, CheckCircle2, ArrowLeft } from 'lucide-react';

interface Quiz {
  id: string;
  title: string;
  description: string;
  timeLimitMinutes: number | null;
  isPublished: boolean;
  createdAt: string;
}

interface BankQuiz {
  topicId: string;
  topicName: string;
  subjectName: string;
  questionCount: number;
  attemptCount: number;
  bestScore: number | null;
  bestMaxScore: number | null;
  lastScore: number | null;
  lastMaxScore: number | null;
}

interface Submission {
  id: string;
  quizId: string;
  quizTitle: string;
  status: string;
  score: number | null;
  maxScore: number | null;
  submittedAt: string | null;
}

export default function StudentQuizzesPage() {
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [bankQuizzes, setBankQuizzes] = useState<BankQuiz[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [quizzesRes, submissionsRes, bankRes] = await Promise.all([
        fetch('/api/academic/quizzes/published'),
        fetch('/api/academic/quizzes/my-submissions'),
        fetch('/api/academic/quizzes/bank'),
      ]);

      if (quizzesRes.status === 401 || submissionsRes.status === 401) {
        router.push('/login');
        return;
      }

      const quizzesData = await quizzesRes.json();
      const submissionsData = await submissionsRes.json();

      if (quizzesData.success) setQuizzes(quizzesData.quizzes);
      if (submissionsData.success) setSubmissions(submissionsData.submissions);

      if (bankRes.ok) {
        const bankData = await bankRes.json();
        if (bankData.success) setBankQuizzes(bankData.quizzes);
      }
    } catch {
      console.error('Failed to fetch quizzes');
    } finally {
      setLoading(false);
    }
  };

  const getSubmissionForQuiz = (quizId: string) =>
    submissions.find((s) => s.quizId === quizId);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <header className="bg-white dark:bg-slate-900 border-b border-border/60 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.push('/learn')}>
              <ArrowLeft className="w-4 h-4 mr-1" />Back
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Online Quizzes</h1>
              <p className="text-sm text-muted-foreground">Test your knowledge</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        {bankQuizzes.length > 0 ? (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-foreground">Topic quizzes</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Generated from your textbooks. Everyone in your class sits the same questions in a
              different order.
            </p>
            <div className="grid gap-4">
              {bankQuizzes.map((quiz) => (
                <div
                  key={quiz.topicId}
                  className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-border/60 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <FileQuestion className="w-5 h-5 text-blue-500" />
                        <h3 className="font-medium text-foreground">
                          {quiz.subjectName} · {quiz.topicName}
                        </h3>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{quiz.questionCount} questions</span>
                        {quiz.bestScore !== null && (
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Best: {quiz.bestScore}/{quiz.bestMaxScore}
                          </span>
                        )}
                        {quiz.attemptCount > 0 && quiz.lastScore !== null && (
                          <span>
                            Last: {quiz.lastScore}/{quiz.lastMaxScore}
                          </span>
                        )}
                      </div>
                    </div>
                    <Link href={`/learn/quizzes/bank/${quiz.topicId}`}>
                      <Button size="sm">
                        {quiz.attemptCount > 0 ? 'Try again' : 'Start Quiz'}
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {quizzes.length > 0 ? (
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-4">School quizzes</h2>
            <div className="grid gap-4">
            {quizzes.map((quiz) => {
              const submission = getSubmissionForQuiz(quiz.id);
              return (
                <div key={quiz.id} className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-border/60 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <FileQuestion className="w-5 h-5 text-blue-500" />
                        <h3 className="font-medium text-foreground">{quiz.title}</h3>
                      </div>
                      {quiz.description && (
                        <p className="text-sm text-muted-foreground mb-2">{quiz.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {quiz.timeLimitMinutes && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />{quiz.timeLimitMinutes} minutes
                          </span>
                        )}
                        {submission && (
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            {submission.status === 'graded'
                              ? `Score: ${submission.score}/${submission.maxScore}`
                              : submission.status === 'submitted'
                              ? 'Awaiting grading'
                              : 'In progress'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      {submission?.status === 'graded' ? (
                        <div className="text-right">
                          <div className="text-lg font-bold text-foreground">{submission.score}/{submission.maxScore}</div>
                          <div className="text-xs text-muted-foreground">
                            {Math.round(((submission.score ?? 0) / (submission.maxScore ?? 1)) * 100)}%
                          </div>
                        </div>
                      ) : submission?.status === 'in_progress' ? (
                        <Link href={`/learn/quizzes/${quiz.id}`}>
                          <Button size="sm">Continue</Button>
                        </Link>
                      ) : (
                        <Link href={`/learn/quizzes/${quiz.id}`}>
                          <Button size="sm">Start Quiz</Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
          </section>
        ) : bankQuizzes.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-border/60">
            <FileQuestion className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No quizzes available</h3>
            <p className="text-sm text-muted-foreground">Check back later for new quizzes.</p>
          </div>
        ) : null}
      </main>
    </div>
  );
}
