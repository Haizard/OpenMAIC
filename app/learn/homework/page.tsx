'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Loader2,
} from 'lucide-react';

type AssignmentStatus = 'pending' | 'submitted' | 'late';

interface HomeworkItem {
  id: string;
  title: string;
  description: string;
  topicId: string | null;
  topicName: string | null;
  subjectName: string | null;
  status: AssignmentStatus;
  dueAt: string | null;
  submittedAt: string | null;
}

interface Homework {
  overdue: HomeworkItem[];
  dueSoon: HomeworkItem[];
  later: HomeworkItem[];
  counts: { overdue: number; dueSoon: number; later: number };
  total: number;
  reason: 'no_form' | null;
}

function formatDue(dueAt: string | null): string {
  if (!dueAt) return 'No deadline';
  return new Date(dueAt).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function HomeworkPage() {
  const router = useRouter();
  const [homework, setHomework] = useState<Homework | null>(null);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const fetchHomework = useCallback(async () => {
    try {
      const response = await fetch('/api/academic/homework');
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      const data = await response.json();
      if (data.success) {
        setHomework(data.homework);
      }
    } catch {
      console.error('Failed to fetch homework');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchHomework();
  }, [fetchHomework]);

  const submit = async (id: string) => {
    setSubmittingId(id);
    try {
      const response = await fetch(`/api/academic/assignments/${id}/submit`, { method: 'POST' });
      if (response.ok) {
        await fetchHomework();
      }
    } catch {
      console.error('Failed to submit homework');
    } finally {
      setSubmittingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const sections: { key: 'overdue' | 'dueSoon' | 'later'; label: string; tone: string }[] = [
    { key: 'overdue', label: 'Overdue', tone: 'text-red-600 dark:text-red-400' },
    { key: 'dueSoon', label: 'Due soon', tone: 'text-amber-600 dark:text-amber-400' },
    { key: 'later', label: 'Later', tone: 'text-muted-foreground' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <header className="bg-white dark:bg-slate-900 border-b border-border/60 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Homework</h1>
              <p className="text-sm text-muted-foreground">Work set from your syllabus</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => router.push('/learn')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        {homework?.reason === 'no_form' ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 border border-border/60 text-center">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-foreground mb-2">
              We do not know your class yet
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Homework is set from your syllabus, so we need to know which class you are in.
              Ask your parent to set your form or grade on your account.
            </p>
          </div>
        ) : (
          <>
            {homework && (
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-border/60">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {homework.counts.overdue}
                  </div>
                  <div className="text-sm text-muted-foreground">Overdue</div>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-border/60">
                  <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    {homework.counts.dueSoon}
                  </div>
                  <div className="text-sm text-muted-foreground">Due soon</div>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-border/60">
                  <div className="text-2xl font-bold text-foreground">{homework.total}</div>
                  <div className="text-sm text-muted-foreground">Total</div>
                </div>
              </div>
            )}

            {homework && homework.total === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 border border-border/60 text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <p className="text-muted-foreground">Nothing set for your class yet.</p>
              </div>
            ) : (
              <div className="space-y-8">
                {sections.map(({ key, label, tone }) => {
                  const items = homework?.[key] ?? [];
                  if (items.length === 0) return null;
                  return (
                    <section key={key}>
                      <h2 className={`text-sm font-medium mb-3 ${tone}`}>
                        {label} · {items.length}
                      </h2>
                      <div className="space-y-2">
                        {items.map((item) => (
                          <div
                            key={item.id}
                            className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-border/60"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <div className="font-medium text-foreground">{item.title}</div>
                                {item.subjectName && (
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    {item.subjectName}
                                    {item.topicName ? ` · ${item.topicName}` : ''}
                                  </div>
                                )}
                                <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                                  <CalendarClock className="w-3.5 h-3.5" />
                                  Due {formatDue(item.dueAt)}
                                </div>
                              </div>
                              {item.status === 'pending' ? (
                                <Button
                                  size="sm"
                                  onClick={() => submit(item.id)}
                                  disabled={submittingId === item.id}
                                >
                                  {submittingId === item.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    'Submit'
                                  )}
                                </Button>
                              ) : (
                                <span
                                  className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                                    item.status === 'late'
                                      ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                                      : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                  }`}
                                >
                                  {item.status === 'late' ? 'Submitted late' : 'Submitted'}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
