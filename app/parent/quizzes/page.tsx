'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileQuestion, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

interface QuizResult {
  student_name: string;
  student_id: string;
  quiz_title: string;
  quiz_id: string;
  status: string;
  score: number | null;
  max_score: number | null;
  submitted_at: string | null;
  graded_at: string | null;
}

export default function ParentQuizzesPage() {
  const router = useRouter();
  const [results, setResults] = useState<QuizResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResults();
  }, []);

  const fetchResults = async () => {
    try {
      const res = await fetch('/api/academic/children/quiz-results');
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      if (data.success) setResults(data.results);
    } catch { console.error('Failed to fetch quiz results'); }
    finally { setLoading(false); }
  };

  // Group results by student
  const byStudent = results.reduce<Record<string, QuizResult[]>>((acc, r) => {
    if (!acc[r.student_id]) acc[r.student_id] = [];
    acc[r.student_id].push(r);
    return acc;
  }, {});

  const getPercentage = (score: number | null, max: number | null) => {
    if (score === null || max === null || max === 0) return null;
    return Math.round((score / max) * 100);
  };

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
            <Button variant="ghost" size="sm" onClick={() => router.push('/parent')}>
              <ArrowLeft className="w-4 h-4 mr-1" />Back
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Quiz Results</h1>
              <p className="text-sm text-muted-foreground">Your children&apos;s quiz performance</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        {Object.keys(byStudent).length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-border/60">
            <FileQuestion className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No quiz results yet</h3>
            <p className="text-sm text-muted-foreground">Your children haven&apos;t taken any quizzes yet.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(byStudent).map(([studentId, studentResults]) => {
              const studentName = studentResults[0]?.student_name ?? 'Student';
              const gradedCount = studentResults.filter((r) => r.status === 'graded').length;
              const avgScore = gradedCount > 0
                ? Math.round(
                    studentResults
                      .filter((r) => r.status === 'graded')
                      .reduce((sum, r) => sum + (getPercentage(r.score, r.max_score) ?? 0), 0) / gradedCount
                  )
                : null;

              return (
                <div key={studentId} className="bg-white dark:bg-slate-900 rounded-xl border border-border/60 overflow-hidden">
                  <div className="p-4 border-b border-border/60 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                          {studentName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-medium text-foreground">{studentName}</h3>
                        <p className="text-xs text-muted-foreground">{gradedCount} quiz{gradedCount !== 1 ? 'zes' : ''} graded</p>
                      </div>
                    </div>
                    {avgScore !== null && (
                      <div className="text-right">
                        <div className="text-lg font-semibold text-foreground">{avgScore}%</div>
                        <div className="text-xs text-muted-foreground">Average</div>
                      </div>
                    )}
                  </div>

                  <div className="divide-y divide-border/60">
                    {studentResults.map((result) => {
                      const pct = getPercentage(result.score, result.max_score);
                      return (
                        <div key={`${result.quiz_id}-${result.submitted_at}`} className="px-4 py-3 flex items-center justify-between">
                          <div>
                            <div className="font-medium text-foreground text-sm">{result.quiz_title}</div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                              <span className="flex items-center gap-1">
                                {result.status === 'graded' ? (
                                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                                ) : result.status === 'submitted' ? (
                                  <Clock className="w-3 h-3 text-yellow-500" />
                                ) : (
                                  <AlertCircle className="w-3 h-3 text-blue-500" />
                                )}
                                {result.status === 'graded' ? 'Graded' : result.status === 'submitted' ? 'Awaiting review' : 'In progress'}
                              </span>
                              {result.submitted_at && (
                                <span>Submitted {new Date(result.submitted_at).toLocaleDateString()}</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            {result.status === 'graded' && result.score !== null && result.max_score !== null ? (
                              <>
                                <div className="text-sm font-semibold text-foreground">
                                  {result.score}/{result.max_score}
                                </div>
                                <div className={`text-xs font-medium ${pct !== null && pct >= 70 ? 'text-green-600' : pct !== null && pct >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                                  {pct}%
                                </div>
                              </>
                            ) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
